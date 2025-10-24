import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Body = { file_id: string; job_id?: string };

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

console.log("🚀 Deployed generate-mcqs function is running with Gemini 2.5 Flash-Lite");

/**
 * Utility: guess MIME type if missing
 */
function guessMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf": return "application/pdf";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "png": return "image/png";
    default: return "application/octet-stream";
  }
}

/**
 * Call Gemini with retry logic for temporary failures.
 */
async function callGeminiWithFile(fileUrl: string, mimeType: string, prompt: string, maxRetries = 3) {
  // Fetch file data
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) throw new Error(`Failed to fetch file: ${fileUrl}`);
  const fileData = new Uint8Array(await fileRes.arrayBuffer());
  
  // Check file size (Gemini has a 20MB limit)
  const fileSizeMB = fileData.length / (1024 * 1024);
  if (fileSizeMB > 20) {
    throw new Error(`File too large: ${fileSizeMB.toFixed(1)}MB. Maximum size is 20MB. Please compress the image.`);
  }

  // Convert Uint8Array to base64 safely for large files
  let binaryStr = '';
  for (let i = 0; i < fileData.length; i += 8192) {
    const chunk = fileData.slice(i, i + 8192);
    binaryStr += String.fromCharCode(...chunk);
  }
  const base64Data = btoa(binaryStr); 

  // Build request
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
  };

  // Retry logic for temporary failures
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" +
          GEMINI_API_KEY,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        const errorData = JSON.parse(errorText);
        
        // Check if it's a temporary error (5xx) and we have retries left
        if (res.status >= 500 && attempt < maxRetries) {
          console.log(`Attempt ${attempt} failed with ${res.status}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
          continue;
        }
        
        throw new Error(`Gemini API failed: ${errorText}`);
      }

      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
      
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      console.log(`Attempt ${attempt} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
    }
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ ok: false, error: "This method is not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    // 1. Verify Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized: Missing or invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Extract and verify user from token
    const token = authHeader.replace('Bearer ', '');
    
    // Create a Supabase client with the user's token for authentication
    // Use anon key (not service key) to respect RLS policies
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
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

    console.log("⚡ Entering ownership verification block");
    console.log("🟢 Step 2: verifying user");
    console.log("🟢 Step 3: verifying file_id");
    const { file_id, job_id }: Body = await req.json();
    console.log("🧾 Parsed request body:", { file_id, job_id });
    if (!file_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "file_id is missing" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Verify file ownership using user's JWT token (respects RLS)
    console.log("🟢 Checking file ownership...");
    console.log("Received file_id from client:", file_id);
    
    const { data: fileData, error: fileError } = await supabaseClient
      .from('files')
      .select('*')
      .eq('id', file_id)
      .single();

    if (fileError || !fileData) {
      console.error("❌ File not found or access denied:", fileError);
      return new Response(
        JSON.stringify({ ok: false, error: "File not found or access denied" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("✅ File found:", fileData);
    const fileRow = fileData;

    // Ensure job exists (using user's JWT token for RLS)
    let jobId = job_id;
    if (!jobId) {
      const { data: jobData, error: jobCreateError } = await supabaseClient
        .from('jobs')
        .insert([{ file_id, status: 'queued' }])
        .select()
        .single();

      if (jobCreateError || !jobData) {
        console.error("Failed to create job:", jobCreateError);
        return new Response(
          JSON.stringify({ ok: false, error: "Failed to create the job" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      jobId = jobData.id;
    }

    // Mark job as processing (using user's JWT token for RLS)
    const { error: jobUpdateError } = await supabaseClient
      .from('jobs')
      .update({ status: 'processing' })
      .eq('id', jobId);
    
    if (jobUpdateError) {
      console.error("Failed to update job status:", jobUpdateError);
    }

    // File metadata already fetched and verified above
    // Generate a signed URL for private storage access (expires in 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabaseClient
      .storage
      .from('study')
      .createSignedUrl(fileRow.storage_path, 3600); // 3600 seconds = 1 hour

    if (signedUrlError || !signedUrlData) {
      console.error("Failed to create signed URL:", signedUrlError);
      return new Response(
        JSON.stringify({ ok: false, error: "Failed to access file in storage" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const fileUrl = signedUrlData.signedUrl;
    const mimeType = fileRow.mime_type || guessMimeType(fileRow.storage_path);
    
    console.log("✅ Signed URL created for file access");

    // Prompt for MCQ generation
    const prompt = `
You are an expert MCQ generator. Create 30 high-quality multiple-choice questions that test users' understanding and knowledge of the concepts, facts, and ideas covered in the study material.

CRITICAL REQUIREMENTS:
1. Questions MUST test understanding and knowledge of concepts, facts, and ideas - NOT retrieval of specific text passages
2. Questions must be answerable from MEMORY and COMPREHENSION - users should NOT need to look back at the material
3. NEVER use words like "text", "document", "passage", "material", "according to", "mentioned", "stated", "explained", "notes", or "discusses" in the question itself
4. Focus on testing KNOWLEDGE and UNDERSTANDING of the subject matter, not memory of specific wording
5. Each question must have exactly 4 options
6. Include "answer_index" (0-based index) for the correct answer
7. Respond ONLY with a valid JSON array - no markdown, no code blocks, no additional text

QUESTION TYPES TO INCLUDE:
- Factual knowledge questions (definitions, key facts, numbers, measurements)
- Conceptual understanding questions (processes, relationships, cause and effect)
- Application questions (using knowledge to solve problems or make predictions)
- Analysis questions (comparing, contrasting, identifying patterns)
- Questions about concepts, theories, formulas, or principles
- Questions about historical events, people, dates, or facts
- Questions about scientific processes, chemical reactions, or biological processes
- Questions about mathematical concepts, equations, or calculations

QUESTION TYPES TO STRICTLY AVOID:
- ANY questions that reference "text", "document", "passage", "material", "according to", "mentioned", "stated", "explained", "notes", "discusses"
- Questions asking "what does the image/figure/chart show" or "what is depicted in the image"
- Questions about document layout, structure, or organization
- Questions asking "where to find information" or "which page/section"
- Questions about study tips, learning strategies, or methodology
- Questions not directly covered in the provided material
- Questions requiring visual inspection of the material
- Questions about colors, shapes, or visual characteristics
- Questions asking users to identify something "in the picture" or "shown in the image"

GOOD EXAMPLES:
{ "question": "What is the resolving power of a light microscope?", "options": ["0.2 nm", "200 nm", "2 μm", "0.2 μm"], "answer_index": 1 }
{ "question": "Which process occurs during photosynthesis?", "options": ["Glucose breakdown", "Carbon dioxide absorption", "Protein synthesis", "DNA replication"], "answer_index": 1 }
{ "question": "What is the chemical formula for water?", "options": ["H2O", "CO2", "NaCl", "O2"], "answer_index": 0 }
{ "question": "Who was the first African American to serve in the U.S. Senate?", "options": ["Frederick Douglass", "Hiram Revels", "Booker T. Washington", "W.E.B. Du Bois"], "answer_index": 1 }
{ "question": "What type of sound sources exist besides musical instruments and traffic?", "options": ["Electronic devices", "Natural phenomena", "Human voices", "Animal sounds"], "answer_index": 1 }
{ "question": "How does the speed of sound change with temperature?", "options": ["Increases by 0.6 m/s per °C", "Decreases by 0.6 m/s per °C", "Remains constant", "Increases by 3.31 m/s per °C"], "answer_index": 0 }

BAD EXAMPLES (DO NOT CREATE THESE):
{ "question": "The text notes that sound waves are created by vibrations", "options": ["True", "False", "Sometimes", "Never"], "answer_index": 0 }
{ "question": "According to the text, what is the speed of sound?", "options": ["343 m/s", "300 m/s", "400 m/s", "250 m/s"], "answer_index": 0 }
{ "question": "What does the text explain about temperature?", "options": ["It affects sound speed", "It doesn't matter", "It's constant", "It varies"], "answer_index": 0 }
{ "question": "The passage mentions that...", "options": ["Option A", "Option B", "Option C", "Option D"], "answer_index": 0 }

IMPORTANT: Generate questions that test users' understanding and knowledge of the subject matter. Focus on concepts, facts, and ideas that users should know and understand, not on specific wording or references to the source material. Users should be able to answer all questions based on their knowledge and comprehension of the topics covered.
`;

    // Call Gemini
    const geminiRaw = await callGeminiWithFile(fileUrl, mimeType, prompt);

    // Parse MCQs - handle both JSON and markdown formats
    let mcqs: any[] = [];
    try {
      // First try to parse as direct JSON
      mcqs = JSON.parse(geminiRaw);
    } catch {
      try {
        // If that fails, try to extract JSON from markdown format
        const jsonMatch = geminiRaw.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          mcqs = JSON.parse(jsonMatch[1].trim());
        } else {
          // Try to find JSON array pattern without markdown
          const arrayMatch = geminiRaw.match(/\[\s*\{[\s\S]*\}\s*\]/);
          if (arrayMatch && arrayMatch[0]) {
            mcqs = JSON.parse(arrayMatch[0]);
          } else {
            throw new Error("Could not extract JSON from response");
          }
        }
      } catch (parseError) {
        throw new Error("Gemini did not return valid JSON. Raw response: " + geminiRaw);
      }
    }

    if (!Array.isArray(mcqs)) {
      throw new Error("Gemini response is not an array: " + geminiRaw);
    }

    // Insert MCQs into DB (using user's JWT token for RLS)
    const mcqsToInsert = mcqs.map(q => ({
      file_id,
      question: q.question,
      options: q.options,
      correct_answer: q.answer_index,
    }));

    const { error: mcqInsertError } = await supabaseClient
      .from('mcqs')
      .insert(mcqsToInsert);

    if (mcqInsertError) {
      console.error("Failed to insert MCQs:", mcqInsertError);
      return new Response(
        JSON.stringify({ ok: false, error: "Failed to insert MCQs into database" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Mark job as done (using user's JWT token for RLS)
    const { error: jobDoneError } = await supabaseClient
      .from('jobs')
      .update({ status: 'done' })
      .eq('id', jobId);

    if (jobDoneError) {
      console.error("Failed to mark job as done:", jobDoneError);
    }

    return new Response(
      JSON.stringify({ ok: true, job_id: jobId }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Edge function error:", e);
    console.error("Error stack:", e.stack);
    console.error("Error message:", e.message);
    
    // Always show detailed error for debugging
    const errorMessage = e.message || String(e);
    
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
