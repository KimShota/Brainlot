import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Body = { 
  file_data?: string; 
  mime_type?: string;
  text_content?: string;
  content_type?: string;
  target_count?: number;
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const DEFAULT_TARGET_COUNT = 20;
const MAX_TARGET_COUNT = 40;

// Global usage tracking
let globalUsageCount = 0;
let globalUsageResetTime = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
const MAX_GLOBAL_USAGE = 500000; // Supabase free tier limit

// Rate limiting storage (in-memory)
const rateLimitMap = new Map<string, { count: number, resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per hour per user

// User subscription limits (daily only)
const USER_LIMITS = {
  FREE: {
    daily_limit: 5      // 5 files per day
  },
  PRO: {
    daily_limit: 50     // 50 files per day
  }
};

// Cache for storing MCQs temporarily (in-memory)
const mcqCache = new Map<string, { mcqs: any[], timestamp: number }>();
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours (extended for better cost savings)

console.log("🚀 Deployed generate-mcqs function (Stateless Architecture with Usage Monitoring)");

/**
 * Check global usage limit
 */
function checkGlobalUsage(): { allowed: boolean, remaining: number, resetTime: number } {
  const now = Date.now();
  
  // Reset counter monthly
  if (now > globalUsageResetTime) {
    globalUsageCount = 0;
    globalUsageResetTime = now + (30 * 24 * 60 * 60 * 1000);
  }
  
  if (globalUsageCount >= MAX_GLOBAL_USAGE) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: globalUsageResetTime
    };
  }
  
  return {
    allowed: true,
    remaining: MAX_GLOBAL_USAGE - globalUsageCount,
    resetTime: globalUsageResetTime
  };
}

/**
 * Increment global usage counter
 */
function incrementGlobalUsage(): void {
  globalUsageCount++;
  console.log(`📊 Global usage: ${globalUsageCount}/${MAX_GLOBAL_USAGE}`);
}

/**
 * Get user subscription status from database
 */
async function getUserSubscription(userId: string, supabaseClient: any): Promise<'FREE' | 'PRO'> {
  try {
    const { data, error } = await supabaseClient
      .from('user_subscriptions')
      .select('plan_type, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();
    
    if (error || !data) {
      return 'FREE'; // Default to free if no subscription found
    }
    
    // Map plan_type to subscription level
    return data.plan_type === 'pro' ? 'PRO' : 'FREE';
  } catch (error) {
    console.error('Error fetching user subscription:', error);
    return 'FREE';
  }
}

/**
 * Get user usage stats from database (daily limit only)
 */
async function getUserUsageStatsFromDB(userId: string, supabaseClient: any): Promise<{
  uploads_today: number;
  daily_reset_at: string;
}> {
  try {
    // Use RPC function to get stats (automatically checks and resets if needed)
    const { data, error } = await supabaseClient.rpc('get_user_usage_stats', {
      user_id_param: userId,
    });

    if (error) {
      console.error('Error fetching usage stats from RPC:', error);
      // Fallback to direct query
      const { data: fallbackData, error: fallbackError } = await supabaseClient
        .from('user_usage_stats')
        .select('uploads_today, daily_reset_at')
        .eq('user_id', userId)
        .single();

      if (fallbackError) {
        console.error('Error fetching usage stats (fallback):', fallbackError);
        // Return defaults if record doesn't exist
        return {
          uploads_today: 0,
          daily_reset_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };
      }

      return {
        uploads_today: fallbackData.uploads_today || 0,
        daily_reset_at: fallbackData.daily_reset_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    if (data && data.length > 0) {
      return {
        uploads_today: data[0].uploads_today || 0,
        daily_reset_at: data[0].daily_reset_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    // Default if no data
    return {
      uploads_today: 0,
      daily_reset_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  } catch (error) {
    console.error('Error in getUserUsageStatsFromDB:', error);
    return {
      uploads_today: 0,
      daily_reset_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }
}

/**
 * Check user-specific limits (daily only) using database
 */
async function checkUserLimits(
  userId: string, 
  subscription: 'FREE' | 'PRO',
  supabaseClient: any
): Promise<{
  allowed: boolean;
  limitType: 'daily' | null;
  remaining: number;
  resetTime: number;
}> {
  const limits = USER_LIMITS[subscription];
  
  // Get usage stats from database
  const usage = await getUserUsageStatsFromDB(userId, supabaseClient);
  
  // Check daily limit only
  if (usage.uploads_today >= limits.daily_limit) {
    return {
      allowed: false,
      limitType: 'daily',
      remaining: 0,
      resetTime: new Date(usage.daily_reset_at).getTime(),
    };
  }
  
  // Daily limit passed
  return {
    allowed: true,
    limitType: null,
    remaining: limits.daily_limit - usage.uploads_today,
    resetTime: new Date(usage.daily_reset_at).getTime(),
  };
}

/**
 * Increment user usage counters in database
 */
async function incrementUserUsage(userId: string, supabaseClient: any): Promise<void> {
  try {
    // Use RPC function to increment (automatically handles daily reset)
    const { error } = await supabaseClient.rpc('increment_upload_count', {
      user_id_param: userId,
    });

    if (error) {
      console.error('Error incrementing upload count via RPC:', error);
      // Fallback to manual update (daily limit only)
      const { data: current } = await supabaseClient
        .from('user_usage_stats')
        .select('uploads_today, daily_reset_at')
        .eq('user_id', userId)
        .single();

      if (current) {
        const now = new Date();
        const resetAt = new Date(current.daily_reset_at);
        
        // Check if daily reset is needed
        if (now >= resetAt) {
          await supabaseClient
            .from('user_usage_stats')
            .update({
              uploads_today: 1,
              daily_reset_at: new Date(now.setUTCHours(24, 0, 0, 0)).toISOString(),
            })
            .eq('user_id', userId);
        } else {
          await supabaseClient
            .from('user_usage_stats')
            .update({
              uploads_today: (current.uploads_today || 0) + 1,
            })
            .eq('user_id', userId);
        }
      }
    } else {
      console.log(`✅ User ${userId} upload count incremented via RPC`);
    }
  } catch (error) {
    console.error('Error in incrementUserUsage:', error);
  }
}

/**
 * Generate a simple hash for file content
 */
function generateFileHash(fileData: string): string {
  // Simple hash function - in production, consider using crypto.subtle.digest
  let hash = 0;
  for (let i = 0; i < fileData.length; i++) {
    const char = fileData.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Check if MCQs are cached for this file
 */
function getCachedMCQs(fileHash: string): any[] | null {
  const cached = mcqCache.get(fileHash);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log(`📦 Cache hit for file hash: ${fileHash}`);
    return cached.mcqs;
  }
  
  // Remove expired cache entry
  if (cached) {
    mcqCache.delete(fileHash);
  }
  
  return null;
}

/**
 * Cache MCQs for future use
 */
function cacheMCQs(fileHash: string, mcqs: any[]): void {
  mcqCache.set(fileHash, {
    mcqs: mcqs,
    timestamp: Date.now()
  });
  
  // Clean up old cache entries periodically
  if (mcqCache.size > 1000) { // Limit cache size
    const now = Date.now();
    for (const [key, value] of mcqCache.entries()) {
      if (now - value.timestamp > CACHE_DURATION) {
        mcqCache.delete(key);
      }
    }
  }
}

/**
 * Optimize text content by removing unnecessary whitespace and normalizing
 */
function optimizeTextContent(text: string): string {
  // Remove excessive whitespace (multiple spaces/newlines)
  let optimized = text.replace(/\s+/g, ' ').trim();
  
  // Limit to reasonable length (prevent extremely long inputs)
  const MAX_INPUT_LENGTH = 3000; // Reduced from 4000
  if (optimized.length > MAX_INPUT_LENGTH) {
    // Take first part and last part to preserve context
    const firstPart = optimized.substring(0, MAX_INPUT_LENGTH * 0.6);
    const lastPart = optimized.substring(optimized.length - MAX_INPUT_LENGTH * 0.4);
    optimized = firstPart + '...' + lastPart;
  }
  
  return optimized;
}

function buildNdjsonPrompt(targetCount: number): string {
  return `Generate exactly ${targetCount} multiple-choice questions that test conceptual understanding of the provided material.
Each MCQ must be challenging yet fair, never copy sentences verbatim, and avoid referencing "the text" or "the passage".

Output format: newline-delimited JSON (NDJSON).
Each line must be a standalone JSON object formatted as:
{"q":"question text","o":["option1","option2","option3","option4"],"a":0}

Rules:
- "q" is the question text (string).
- "o" is an array of exactly 4 concise options (strings).
- "a" is the index (0-3) of the single correct option.
- Do NOT wrap the objects in an array or add commentary, numbering, or explanations.
- Only output the NDJSON lines.`;
}

async function* streamGeminiNDJSON(body: any): AsyncGenerator<string> {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:streamGenerateContent?key=" + GEMINI_API_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API failed: ${errorText}`);
  }

  if (!response.body) {
    throw new Error("Gemini API returned an empty response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let pendingText = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const segments = buffer.split("\n");
    buffer = segments.pop() ?? "";

    for (const segment of segments) {
      const line = segment.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }

      const parts = parsed.candidates?.[0]?.content?.parts;
      if (!parts) continue;

      const textChunk = parts.map((part: any) => part?.text || "").join("");
      if (!textChunk) continue;

      pendingText += textChunk;
      let newlineIndex: number;
      while ((newlineIndex = pendingText.indexOf("\n")) >= 0) {
        const rawLine = pendingText.slice(0, newlineIndex).trim();
        pendingText = pendingText.slice(newlineIndex + 1);
        if (rawLine) {
          yield rawLine;
        }
      }
    }
  }

  if (pendingText.trim()) {
    yield pendingText.trim();
  }
}

async function* streamMcqsFromText(textContent: string, targetCount: number): AsyncGenerator<string> {
  const optimizedText = optimizeTextContent(textContent);
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: `${buildNdjsonPrompt(targetCount)}\n\n${optimizedText}` },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: 1600,
      temperature: 0.7,
    },
  };

  for await (const line of streamGeminiNDJSON(body)) {
    yield line;
  }
}

async function* streamMcqsFromFile(fileData: string, mimeType: string, targetCount: number): AsyncGenerator<string> {
  const fileSizeBytes = (fileData.length * 3) / 4;
  const fileSizeMB = fileSizeBytes / (1024 * 1024);
  if (fileSizeMB > 20) {
    throw new Error(`File too large: ${fileSizeMB.toFixed(1)}MB. Maximum size is 20MB. Please compress the file.`);
  }

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: buildNdjsonPrompt(targetCount) },
          {
            inlineData: {
              mimeType,
              data: fileData,
            },
          },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: 2000,
      temperature: 0.7,
    },
  };

  for await (const line of streamGeminiNDJSON(body)) {
    yield line;
  }
}

function normalizeMcqShape(mcq: any) {
  const options = mcq?.options || mcq?.o || [];
  return {
    question: mcq?.question || mcq?.q || "",
    options,
    answer_index: typeof mcq?.answer_index === "number"
      ? mcq.answer_index
      : (typeof mcq?.a === "number" ? mcq.a : 0),
  };
}

function mapStreamError(error: any): string {
  const message = error?.message || String(error);
  if (message.includes("timeout")) {
    return "Request timed out. Please check your internet connection and try again.";
  }
  if (message.includes("Unauthorized") || message.includes("Invalid token")) {
    return "Authentication failed. Please log in again.";
  }
  if (message.includes("File too large")) {
    return message;
  }
  if (message.includes("Failed to fetch")) {
    return "Network error. Please check your connection and try again.";
  }
  if (message.includes("No MCQs generated")) {
    return message;
  }
  if (message.includes("Gemini API failed")) {
    return "AI service is temporarily unavailable. Please try again later.";
  }
  return "An unexpected error occurred. Please try again.";
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ ok: false, error: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    // 1. Check global usage limit first
    const globalUsage = checkGlobalUsage();
    if (!globalUsage.allowed) {
      const resetTimeDays = Math.ceil((globalUsage.resetTime - Date.now()) / (24 * 60 * 60 * 1000));
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: `Service temporarily unavailable. Monthly limit reached. Resets in ${resetTimeDays} days.`,
          global_usage: {
            remaining: 0,
            reset_time: globalUsage.resetTime
          }
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Verify Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized: Missing or invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Extract and verify user from token
    const token = authHeader.replace('Bearer ', '');
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        persistSession: false,
      },
    });

    // Verify user from token
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      console.error("❌ Auth error:", authError);
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    console.log("✅ User authenticated:", user.id);

    // 4. Parse request body
    const { 
      file_data, 
      mime_type, 
      text_content, 
      content_type,
      target_count
    }: Body = await req.json();
    
    // Check if either file_data or text_content is provided
    if (!file_data && !text_content) {
      return new Response(
        JSON.stringify({ ok: false, error: "Either file_data or text_content is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // If file_data is provided, mime_type is required
    if (file_data && !mime_type) {
      return new Response(
        JSON.stringify({ ok: false, error: "mime_type is required when file_data is provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("📄 Content received, type:", content_type || mime_type);

    const targetCount = Math.max(1, Math.min(target_count ?? DEFAULT_TARGET_COUNT, MAX_TARGET_COUNT));

    // 5. Get user subscription and check limits
    const subscription = await getUserSubscription(user.id, supabaseClient);
    console.log(`👤 User ${user.id} subscription: ${subscription}`);
    
    const userLimits = await checkUserLimits(user.id, subscription, supabaseClient);
    if (!userLimits.allowed) {
      const resetTimeDays = Math.ceil((userLimits.resetTime - Date.now()) / (24 * 60 * 60 * 1000));
      const errorMessage = `Daily limit reached. You can generate MCQs again in ${resetTimeDays} days.`;
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: errorMessage,
          user_limits: {
            subscription: subscription,
            limit_type: userLimits.limitType,
            remaining: 0,
            reset_time: userLimits.resetTime
          }
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    // 6. Generate content hash for caching
    const cacheKeySeed = `${text_content || file_data!}::target-${targetCount}`;
    const contentHash = generateFileHash(cacheKeySeed);
    console.log("🔑 Content hash:", contentHash);

    // 7. Check cache first
    const cachedMCQs = getCachedMCQs(contentHash);
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    (async () => {
      try {
        if (cachedMCQs) {
          console.log(`✅ Streaming cached MCQs for hash: ${contentHash}`);
          await writer.write(JSON.stringify({ type: "meta", total: cachedMCQs.length, cached: true }) + "\n");
          for (const mcq of cachedMCQs) {
            await writer.write(JSON.stringify({ type: "mcq", data: mcq }) + "\n");
          }
          await writer.write(JSON.stringify({ type: "done", count: cachedMCQs.length }) + "\n");
          return;
        }

        incrementGlobalUsage();
        await incrementUserUsage(user.id, supabaseClient);

        await writer.write(JSON.stringify({ type: "meta", total: targetCount, cached: false }) + "\n");

        const collected: any[] = [];
        const generator = text_content
          ? streamMcqsFromText(text_content, targetCount)
          : streamMcqsFromFile(file_data!, mime_type!, targetCount);

        for await (const rawLine of generator) {
          if (!rawLine) continue;
          let parsed;
          try {
            parsed = JSON.parse(rawLine);
                  } catch {
            continue;
          }

          const normalized = normalizeMcqShape(parsed);
          if (!normalized.question || !Array.isArray(normalized.options) || normalized.options.length !== 4) {
            continue;
          }

          collected.push(normalized);
          await writer.write(JSON.stringify({ type: "mcq", data: normalized }) + "\n");

          if (collected.length >= targetCount) {
            break;
          }
        }

        if (collected.length === 0) {
          throw new Error("No MCQs generated. Please try again with clearer content.");
        }

        cacheMCQs(contentHash, collected);
        await writer.write(JSON.stringify({ type: "done", count: collected.length }) + "\n");
      } catch (streamError) {
        console.error("Streaming generation error:", streamError);
        const message = mapStreamError(streamError);
        await writer.write(JSON.stringify({ type: "error", message }) + "\n");
      } finally {
        writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-store",
      },
    });

  } catch (e) {
    console.error("Edge function error:", e);
    console.error("Error stack:", e.stack);
    console.error("Error message:", e.message);
    
    // Hide detailed errors in production for security
    const isDevelopment = Deno.env.get("ENVIRONMENT") === "development";
    
    let userMessage = "An unexpected error occurred. Please try again later.";
    
    // Show detailed errors only in development
    if (isDevelopment) {
        userMessage = e.message || String(e);
    } else {
        // Provide user-friendly messages for common errors in production
        if (e.message?.includes('File too large')) {
            userMessage = "File size exceeds the maximum allowed limit (20MB).";
        } else if (e.message?.includes('Gemini API')) {
            userMessage = "AI service is temporarily unavailable. Please try again later.";
        } else if (e.message?.includes('not authenticated')) {
            userMessage = "Authentication failed. Please log in again.";
        } else if (e.message?.includes('Failed to fetch')) {
            userMessage = "Network error. Please check your connection and try again.";
        } else if (e.message?.includes('JSON')) {
            userMessage = "Failed to process AI response. Please try again.";
        }
    }
    
    return new Response(
      JSON.stringify({ ok: false, error: userMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});