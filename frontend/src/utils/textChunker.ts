const DEFAULT_MAX_CHUNK_SIZE = 1400;

function normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, " ").trim();
}

export function chunkTextForBatches(
    rawText: string,
    desiredChunks: number,
    maxChunkSize: number = DEFAULT_MAX_CHUNK_SIZE
): string[] {
    if (!rawText) return [""];
    
    const cleanText = normalizeWhitespace(rawText);
    if (!cleanText) return [""];

    const safeDesiredChunks = Math.max(1, desiredChunks);
    const approxChunkSize = Math.min(
        maxChunkSize,
        Math.max(400, Math.ceil(cleanText.length / safeDesiredChunks))
    );

    const chunks: string[] = [];
    for (let i = 0; i < cleanText.length; i += approxChunkSize) {
        const slice = cleanText.slice(i, i + approxChunkSize).trim();
        if (slice) {
            chunks.push(slice);
        }
    }

    if (chunks.length === 0) {
        chunks.push(cleanText);
    }

    while (chunks.length < safeDesiredChunks) {
        chunks.push(chunks[chunks.length - 1]);
    }

    return chunks.slice(0, safeDesiredChunks);
}

