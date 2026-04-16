# Next Steps

This is the current recommended sequence from here.

## 1. Frontend live verification

- Run `npm run dev`
- Open the browser UI
- Confirm:
  - camera preview appears
  - microphone permission is granted
  - audio level meter moves while speaking
  - `/health` stays live
  - Korean speech returns English translation
  - English speech returns Korean translation

## 2. Replace interval upload with streaming

- Current frontend sends periodic WAV segments.
- Next upgrade:
  - stream audio chunks over WebSocket
  - stream lip ROI frames alongside audio
  - keep server-side timestamps aligned

## 3. Upgrade `/vsr`

- Current `/vsr` is a safe stub that proves routing and payload shape.
- Next backend work:
  - accept lip ROI clip input
  - run a real visual speech model
  - return text plus confidence

## 4. Switch frontend from `/transcribe + /translate` to `/infer`

- Current UI uses the already-deployed stable path.
- After `/infer` is finalized:
  - send one request
  - receive source text, translated text, detected language, and fusion source
  - reduce latency and duplicated request overhead

## 5. Add language and model controls

- target language dropdown is already in place
- next:
  - source language lock vs auto toggle
  - quality vs latency mode
  - VSR enabled/disabled toggle

## 6. Publish to GitHub

- choose repository name
- choose visibility: `public` or `private`
- authenticate `gh auth login`
- create remote repo and push
