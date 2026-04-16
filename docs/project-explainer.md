# Project Explainer

## One-line summary

This project is a browser-based live translation prototype that combines:

- webcam input
- microphone input
- speech recognition
- machine translation
- lip-region tracking for future visual speech recognition

The goal is to evolve it into an AVSR system:

- `A` = audio
- `V` = visual
- `SR` = speech recognition

That means the system should eventually understand speech from both:

- sound
- lip movement

## What the app does today

Current working behavior:

- captures camera and microphone in the browser
- shows a live webcam preview
- tracks the lip region and draws a moving ROI box on the face
- measures audio level
- sends audio chunks to the backend
- translates recognized speech into the selected target language

Current visual limitation:

- the browser tracks the lips
- but the backend does not yet run a real lip-reading model
- so the visual stream is currently useful for tracking and synchronization, not for text generation yet

## What `Visual = warm` means

`warm` means:

- the visual path is partially alive
- lip tracking is running in the browser
- lip ROI video can be prepared and sent
- but the backend still does not have a real VSR model generating text from lip motion

So:

- `unavailable`: visual pipeline is not ready at all
- `warm`: tracking/capture path is alive, but not yet doing real lip-reading inference
- `live`: visual inference is producing usable text

## What `MT` means

`MT` means `Machine Translation`.

In this project, MT is the step that converts:

- Korean -> English
- English -> Korean

after the speech has first been recognized into text.

So the full text pipeline is:

1. Audio ASR or future visual ASR
2. Source text generation
3. MT into the chosen target language

## What `NLLB` means

`NLLB` stands for `No Language Left Behind`.

It is Meta's multilingual translation model family. In this project, it is being used as the stronger MT replacement for the previous lightweight translator.

Why it matters:

- higher translation quality than lightweight local translators
- better multilingual coverage
- better fit for interview/demo explanation because it is a recognized modern multilingual MT model

Current planned model:

- `facebook/nllb-200-distilled-1.3B`

This is stronger than the previous translation layer, but heavier to load.

## Models used in the project

### Current or intended backend models

- ASR: `Whisper large-v3`
- MT fallback: `Argos Translate`
- Stronger MT target: `NLLB-200 distilled 1.3B`
- Visual tracking in browser: `MediaPipe Face Landmarker`
- Future VSR target: dedicated lip-reading / AVSR model such as `AV-HuBERT` family or a similar visual speech model

### Why the current performance is limited

1. Visual speech recognition is not yet a true lip-reading model.
2. Translation quality depends heavily on the MT model.
3. The current prototype still processes data in short chunks instead of a more optimized streaming pipeline.
4. Audio and visual fusion is only partially scaffolded today.

## High-level logic

### Frontend flow

1. Ask for camera and microphone permission
2. Show webcam preview
3. Track the lip region in the browser
4. Draw a moving lip ROI box
5. Record audio chunks
6. Record lip ROI video chunks
7. Send the chunk pair to `/infer`
8. Show detected language, translated text, status, and latency

### Backend flow

1. Receive audio, and optionally video
2. Run ASR on the audio
3. Detect source language
4. Translate recognized text with MT
5. Analyze the visual clip for readiness / motion confidence
6. Return a fusion response object for the frontend

## How the codebase is organized

Current tracked file count: `26`

Breakdown:

- `src`: `15` files
- `docs`: `4` files
- `backend`: `2` files
- root config and entry files: the rest

### Frontend structure

- `src/app/App.tsx`
  - top-level screen composition
- `src/components/*`
  - camera stage, controls, language selector, status pills, subtitle UI
- `src/hooks/useMediaSession.ts`
  - main live-session orchestration
- `src/hooks/useLipTracking.ts`
  - browser-side lip ROI tracking
- `src/hooks/useAudioLevel.ts`
  - audio level meter
- `src/lib/api.ts`
  - backend request helpers
- `src/lib/wav.ts`
  - converts browser PCM audio into WAV
- `src/types/session.ts`
  - shared UI/session types

### Backend structure

- `backend/server_app.py`
  - FastAPI server
  - ASR
  - MT
  - `/infer`
  - future visual integration point
- `backend/requirements.txt`
  - backend dependency list

## Audio-only and visual-only modes

Desired product behavior:

- audio-only should work when the face is not visible
- visual-only should work when audio is missing or noisy

Current state:

- audio-only: supported in architecture and already works
- visual-only: transport path is being prepared, but real lip-reading text output still needs a real VSR model

## How to explain this in an interview

You can describe it like this:

> This project is a live AVSR translation prototype. The browser captures audio and video, tracks the speaker's lip region in real time, and sends synchronized media chunks to a backend. The backend performs speech recognition, language detection, and translation, while the visual path is being prepared for lip-reading based fusion. I designed it so that audio-only, visual-only, and audio-visual fusion can all exist within the same inference contract.

Shorter version:

> I built a browser-based multimodal translation prototype that combines webcam lip tracking, speech recognition, and multilingual translation, with a backend designed to evolve into full audio-visual speech recognition.
