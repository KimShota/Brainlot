type TextStreamingSource = {
    type: "text";
    text: string;
};

type FileStreamingSource = {
    type: "file";
    fileData: string;
    mimeType: string;
};

export type StreamingSource = TextStreamingSource | FileStreamingSource;

const streamingStore = new Map<string, StreamingSource>();

function generateId(prefix: string = "stream"): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createStreamingSource(source: StreamingSource): string {
    const id = generateId();
    streamingStore.set(id, source);
    return id;
}

export function getStreamingSource(id: string | undefined | null): StreamingSource | null {
    if (!id) return null;
    return streamingStore.get(id) ?? null;
}

export function removeStreamingSource(id: string | undefined | null) {
    if (!id) return;
    streamingStore.delete(id);
}

