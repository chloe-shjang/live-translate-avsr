export type PermissionState = "unknown" | "granted" | "denied";
export type ServerState = "offline" | "connecting" | "live";
export type TranscriptSource = "audio" | "visual" | "fusion";
export type VisualState = "unavailable" | "warming" | "live";

export type SessionStatus = {
  permission: PermissionState;
  micOn: boolean;
  cameraOn: boolean;
  listening: boolean;
  audioLevel: number;
  detectedLanguage: string | null;
  targetLanguage: string;
  serverState: ServerState;
  lastLatencyMs: number | null;
  visualState: VisualState;
};

export type LipBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TranscriptFrame = {
  sourceText: string;
  translatedText: string;
  detectedLanguage: string | null;
  source: TranscriptSource;
  confidence: number;
  visualConfidence?: number;
  ts: number;
};
