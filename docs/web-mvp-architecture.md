# Web MVP Architecture

## Product goal

Browser-based live translation UI where:

- webcam shows the speaker
- lip-reading is the primary visual signal when available
- microphone audio acts as supporting input
- source language is auto-detected
- target language is user-selectable
- top status area shows mic permission, mic on/off, listening status, audio level, and server state

## Recommended system shape

```text
Browser (React)
  |- Camera track
  |- Microphone track
  |- Web Audio level meter
  |- WebSocket / WebRTC uplink
  v
Session API (FastAPI)
  |- session manager
  |- connection health
  |- frame/audio window alignment
  |- result stream
  v
GPU Worker
  |- audio ASR
  |- visual speech model
  |- fusion
  |- translation
  v
Result stream back to browser
```

## Why this is better than the current app

- Browser APIs make mic/camera permissions and audio level monitoring straightforward.
- The UI becomes responsive, mobile-friendly, and easier to style than OpenCV overlays.
- Session-based streaming lets audio and video stay aligned before inference.
- GPU work stays on the server; the client just captures and displays.

## Folder structure

```text
src/
  app/
    App.tsx
    mockData.ts
  components/
    CameraStage.tsx
    ControlBar.tsx
    DebugPanel.tsx
    LanguageSelector.tsx
    SubtitleCard.tsx
    StatusPill.tsx
  hooks/
    useAudioLevel.ts
    useMediaSession.ts
  styles/
    globals.css
  types/
    session.ts
  main.tsx
```

## Data contracts

### Client state

```ts
type SessionStatus = {
  permission: "unknown" | "granted" | "denied";
  micOn: boolean;
  listening: boolean;
  audioLevel: number;
  detectedLanguage: string | null;
  targetLanguage: string;
  serverState: "offline" | "connecting" | "live";
  lastLatencyMs: number | null;
};
```

### Result payload

```ts
type TranscriptFrame = {
  sourceText: string;
  translatedText: string;
  detectedLanguage: string | null;
  source: "audio" | "visual" | "fusion";
  confidence: number;
  ts: number;
};
```

## Backend endpoints

- `GET /health`
- `POST /session`
- `WS /session/{id}/stream`
- `POST /session/{id}/config`

## MVP milestones

1. Browser capture and polished live UI
2. Mic permission, audio level, and language selection
3. Mock result stream for UI work
4. Real server session connection
5. Server-side synchronized audio/video inference
6. Real VSR integration and fusion tuning
