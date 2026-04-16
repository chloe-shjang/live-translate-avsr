import type { PermissionState, ServerState, TranscriptFrame } from "../types/session";

const API_BASE = "/api";

export async function fetchHealth(signal?: AbortSignal): Promise<ServerState> {
  try {
    const response = await fetch(`${API_BASE}/health`, { signal });
    if (!response.ok) {
      return "offline";
    }

    const data = (await response.json()) as { status?: string };
    return data.status === "ok" ? "live" : "offline";
  } catch {
    return "offline";
  }
}

export async function transcribeAudio(blob: Blob, language?: string | null) {
  const formData = new FormData();
  formData.append("audio", blob, "segment.wav");
  if (language) {
    formData.append("language", language);
  }

  const response = await fetch(`${API_BASE}/transcribe`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Transcribe failed with ${response.status}`);
  }

  return (await response.json()) as {
    text: string;
    language?: string | null;
  };
}

export async function translateText(
  text: string,
  fromCode: string,
  toCode: string
) {
  const formData = new FormData();
  formData.append("text", text);
  formData.append("from_code", fromCode);
  formData.append("to_code", toCode);

  const response = await fetch(`${API_BASE}/translate`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Translate failed with ${response.status}`);
  }

  return (await response.json()) as {
    translated: string;
  };
}

export function fallbackPermission(error: unknown): PermissionState {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "denied";
  }
  return "unknown";
}

export function emptyTranscript(): TranscriptFrame {
  return {
    sourceText: "Listening...",
    translatedText: "번역 대기 중...",
    detectedLanguage: null,
    source: "audio",
    confidence: 0,
    ts: Date.now()
  };
}
