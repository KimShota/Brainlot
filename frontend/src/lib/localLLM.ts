const LOCAL_COMPLETION_TIMEOUT_MS = 90_000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
import { LlamaContext } from 'llama.rn';

export type MCQ = {
  question: string;
  options: string[];
  answer_index: number;
};

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export type LocalModelDefinition = {
  id: string;
  label: string;
  repo: string;
  file: string;
  sizeGB: number;
  latencyHint: string;
};

export const LOCAL_MODELS: LocalModelDefinition[] = [
  {
    id: 'llama-3b-q5',
    label: 'Llama 3.2 • 3B (Q5_K_S)',
    repo: 'bartowski/Llama-3.2-3B-Instruct-GGUF',
    file: 'Llama-3.2-3B-Instruct-Q5_K_S.gguf',
    sizeGB: 1.3,
    latencyHint: '~3s',
  },
  {
    id: 'phi-3_5-mini-q4',
    label: 'Phi-3.5 Mini • 3.8B (Q4_K_M)',
    repo: 'bartowski/Phi-3.5-mini-instruct-GGUF',
    file: 'Phi-3.5-mini-instruct-Q4_K_M.gguf',
    sizeGB: 2.3,
    latencyHint: '~4s',
  },
];

export const DEFAULT_LOCAL_MODEL_ID = LOCAL_MODELS[0].id;

export const getLocalModel = (modelId?: string): LocalModelDefinition => {
  if (!modelId) {
    return LOCAL_MODELS[0];
  }
  return LOCAL_MODELS.find((model) => model.id === modelId) ?? LOCAL_MODELS[0];
};

// indicate where to stop the generation
const STOP_MARKERS = ['Q6:', 'Question 6', '--- END ---'];

// function to create the prompt for local LLM
export function buildLocalPrompt(material: string, count = 5) {
  return [
    `You are a tutor who writes knowledge-check MCQs.`,
    `Write ${count} multiple-choice questions from the STUDY MATERIAL below.`,
    `Rules:`,
    `1. Test understanding of the concepts, not wording.`,
    `2. Each question must have exactly 4 answer options.`,
    `3. Options should be short (less than 60 chars).`,
    `4. Mark the correct option with "Answer: <letter>".`,
    `5. Do NOT mention "text", "document", "passage", or similar words.`,
    `6. Use this exact format:`,
    `Q1: <question>`,
    `A: option`,
    `B: option`,
    `C: option`,
    `D: option`,
    `Answer: A`,
    `Repeat for Q2..Q${count}.`,
    `STUDY MATERIAL:`,
    material.trim(),
  ].join('\n');
}

// function to parse the raw output into valid JSON format 
export function parseLocalMcqResponse(raw: string, expected = 5): MCQ[] {
  if (!raw) {
    return [];
  }

  const normalized = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  const blocks = normalized.match(/Q\d+:[\s\S]*?(?=Q\d+:|$)/g) || [];
  const mcqs: MCQ[] = [];

  // make each Q block
  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      continue;
    }

    const questionLine = lines[0].replace(/^Q\d+:\s*/i, '').trim();
    if (!questionLine) {
      continue;
    }

    // extract each option
    const options: string[] = [];
    for (const label of OPTION_LABELS) {
      const optionLine = lines.find((line) => line.startsWith(`${label}:`) || line.startsWith(`${label})`));
      if (!optionLine) {
        break;
      }
      const text = optionLine.replace(`${label}:`, '').replace(`${label})`, '').trim();
      if (!text) {
        break;
      }
      options.push(text);
    }

    if (options.length !== OPTION_LABELS.length) {
      continue;
    }

    const answerLine = lines.find((line) => /^Answer[:\)]/i.test(line));
    if (!answerLine) {
      continue;
    }
    const answerMatch = answerLine.match(/Answer[:\)]\s*([A-D0-3])/i);
    if (!answerMatch) {
      continue;
    }
    const answerToken = answerMatch[1].toUpperCase();
    const answerIndex =
      OPTION_LABELS.indexOf(answerToken) >= 0
        ? OPTION_LABELS.indexOf(answerToken)
        : parseInt(answerToken, 10);

    if (Number.isNaN(answerIndex) || answerIndex < 0 || answerIndex > 3) {
      continue;
    }

    mcqs.push({
      question: questionLine,
      options,
      answer_index: answerIndex,
    });
  }

  if (!mcqs.length && raw.includes('[') && raw.includes('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as MCQ[];
      }
    } catch {
      // ignore json fallback failure
    }
  }

  if (expected && mcqs.length > expected) {
    return mcqs.slice(0, expected);
  }

  return mcqs;
}

export async function generateLocalMcqs({
  context,
  material,
  count = 5,
}: {
  context: LlamaContext;
  material: string;
  count?: number;
}): Promise<MCQ[]> {
  const prompt = buildLocalPrompt(material, count); // build the prompt first 
  // call local LLM to generate MCQs
  const completionPromise = context.completion(
    {
      prompt,
      n_predict: 384, // keep output shorter for faster responses
      temperature: 0.7, // slightly less random for more concise answers
      top_p: 0.9, // narrower word selection for determinism
      stop: STOP_MARKERS, // stop when Q6 appears
    },
    undefined
  );

  const result = await withTimeout(
    completionPromise,
    LOCAL_COMPLETION_TIMEOUT_MS,
    'Local model took too long to respond. Please try again with shorter study material.'
  );

  // parse the raw output into valid JSON format 
  const raw = (result?.content || result?.text || '').trim();
  console.log('[localLLM] raw response:', raw);
  const parsed = parseLocalMcqResponse(raw, count);

  if (!parsed.length) {
    throw new Error('Local model returned an empty response. Please try again.');
  }

  return parsed;
}

