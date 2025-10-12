import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Body = { file_id: string; job_id?: string };

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

console.log("🚀 Deployed generate-mcqs function is running with Gemini 2.5 Flash-Lite");

const headers = {
  "Content-Type": "application/json",
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
};

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

    const { file_id, job_id }: Body = await req.json();
    if (!file_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "file_id is missing" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Ensure job exists
    let jobId = job_id;
    if (!jobId) {
      const jobRes = await fetch(`${supabaseUrl}/rest/v1/jobs`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ file_id, status: "queued" }),
      });

      if (!jobRes.ok) {
        const text = await jobRes.text();
        return new Response(
          JSON.stringify({ ok: false, error: text || "Failed to create the job" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      const data = await jobRes.json().catch(() => []);
      if (!data || !data.length) {
        return new Response(
          JSON.stringify({ ok: false, error: "No job created" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      jobId = data[0].id;
    }

    // Mark job as processing
    await fetch(`${supabaseUrl}/rest/v1/jobs?id=eq.${jobId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "processing" }),
    });

    // Get file metadata
    const fileRes = await fetch(`${supabaseUrl}/rest/v1/files?id=eq.${file_id}`, { headers });
    const files = await fileRes.json();
    if (!files.length) throw new Error("File not found");
    const fileRow = files[0];
    const fileUrl = fileRow.public_url;
    const mimeType = fileRow.mime_type || guessMimeType(fileRow.storage_path); // 👈 fallback added

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

    // Insert MCQs into DB
    for (const q of mcqs) {
      await fetch(`${supabaseUrl}/rest/v1/mcqs`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          file_id,
          question: q.question,
          options: q.options,
          answer_index: q.answer_index,
        }),
      });
    }

    // Mark job as done
    await fetch(`${supabaseUrl}/rest/v1/jobs?id=eq.${jobId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "done" }),
    });

    return new Response(
      JSON.stringify({ ok: true, job_id: jobId }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Edge function error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
