# Deployed Server API Contract

Verified against the currently deployed backend on `2026-04-16`.

Base URL in development is expected to be proxied through Vite as `/api`.

## `GET /health`

Response:

```json
{
  "status": "ok"
}
```

Use:

- server reachability check
- UI live/offline badge

## `POST /transcribe`

Content type:

- `multipart/form-data`

Fields:

- `audio`: audio file upload
- `language`: optional language hint. Omit or send empty for auto-detect.

Current response:

```json
{
  "text": "안녕하세요",
  "language": "ko"
}
```

Notes:

- The deployed server reads uploaded audio with `soundfile`.
- Browser-recorded `webm` is not a safe input here, so the frontend sends PCM data encoded as `wav`.

## `POST /translate`

Content type:

- `multipart/form-data` is accepted by the live server

Fields:

- `text`: source text
- `from_code`: source language code
- `to_code`: target language code

Current response:

```json
{
  "translated": "Hello"
}
```

Notes:

- Translation is currently powered by installed `Argos Translate` language packages.
- The live server currently supports the installed pairs, which were prepared for `ko <-> en`.

## Known limitations of the deployed server

- No `/vsr` endpoint yet
- No AV fusion endpoint yet
- No CORS middleware configured
- Deployment-specific script locations are intentionally omitted from this repository
- Ensure audio resampling dependencies are included in your deployment environment

## Frontend integration strategy

- Development: Vite proxy from `/api` to a configurable backend target
- Browser capture: microphone PCM -> local WAV encoder -> `/api/transcribe`
- Translation: `/api/translate`
- Health check: `/api/health`
