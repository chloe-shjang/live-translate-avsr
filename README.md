# AVSR Web MVP

This is a personal project exploring a browser-based AVSR live translation experience.

## What's here

- `docs/minimal-fix-plan.md`: minimum changes to make the current Python prototype behave more reliably
- `docs/web-mvp-architecture.md`: recommended web architecture and folder layout
- `docs/server-api-contract.md`: current API contract used by the frontend
- `docs/project-explainer.md`: interview-friendly project explanation and architecture walkthrough
- `src/*`: React UI skeleton for the webcam translation experience

## Intended stack

- Frontend: React + Vite + TypeScript
- Media: `getUserMedia`, `Web Audio API`, optional WebRTC/WebSocket uplink
- Backend: FastAPI session server with GPU worker

## Run locally

1. Start the frontend:
   - `npm install`
   - `npm run dev`
2. Set `AVSR_PROXY_TARGET` if your API server is not running on the default local target.
3. The Vite proxy forwards `/api/*` to the configured backend target.

## Current live integration

- `GET /api/health`
- `POST /api/infer`
- `POST /api/transcribe`
- `POST /api/translate`

The app now prefers `/infer` as the main integration path and prepares synchronized lip ROI clips for future visual speech recognition.
