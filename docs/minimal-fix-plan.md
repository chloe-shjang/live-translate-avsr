# Existing Python App: Minimum Fix Plan

Target project: existing Python AVSR prototype

## Immediate blockers

1. `VSR` is not implemented.
   - File: `scripts/server_app.py`
   - Problem: `/vsr` returns an empty string and `confidence=0.0`, so lip-reading never contributes.
   - Minimum fix: make this explicit in UI and disable visual fusion until a real model is connected.

2. Auto language detection is effectively disabled.
   - File: `app/config.py`
   - Problem: `asr_language = "ko"` forces Whisper toward Korean instead of true language detection.
   - Minimum fix: default `asr_language = None` and only pass a language when the user explicitly locks it.

3. Translation target is not selectable.
   - File: `app/pipeline/remote_pipeline.py`
   - Problem: target language is hardcoded to `en` when source is `ko`, otherwise `ko`.
   - Minimum fix: add `target_language` to config and use detected language only for source selection.

4. Remote GPU usage is fragile.
   - Files: `app/pipeline/remote_pipeline.py`, `app/pipeline/visual_pipeline.py`
   - Problem: default server URL is `http://localhost:8000`, which only works if the SSH tunnel is already running.
   - Minimum fix: move `server_url` to config or env var and show connection health in the UI.

5. Dependency list is incomplete.
   - File: `requirements.txt`
   - Problem: runtime imports use `mediapipe`, `Pillow`, and optionally `argostranslate`, but they are missing.
   - Minimum fix: add missing packages and remove duplicate `opencv-python` / `numpy`.

6. Camera selection is brittle.
   - File: `app/main.py`
   - Problem: `device_index=2` is hardcoded.
   - Minimum fix: make camera device configurable and probe fallback indices.

## Performance fixes with the highest payoff

1. Stop encoding lip frames to a temp mp4 on every window.
   - File: `app/pipeline/visual_pipeline.py`
   - Reason: repeated disk writes and decode/encode cycles add unnecessary latency.
   - Minimum fix: send frame tensors or JPEG sequence bytes instead of mp4 temp files.

2. Combine ASR and MT into one server-side pipeline step.
   - File: `app/pipeline/remote_pipeline.py`
   - Reason: two sequential HTTP requests per segment increases round-trip latency.
   - Minimum fix: add a single `/infer` endpoint returning source text, detected language, and translated text.

3. Cap queue growth.
   - Files: `app/pipeline/remote_pipeline.py`, `app/pipeline/visual_pipeline.py`
   - Reason: `_queue` is unbounded; backlog can grow under load and make output stale.
   - Minimum fix: keep only the latest pending segment when the worker is behind.

4. Surface audio input health.
   - File: `app/audio/mic.py`
   - Reason: there is no audio level or capture status, so mic issues look like ASR issues.
   - Minimum fix: compute RMS level per chunk and expose `permission`, `mic_on`, `listening`, and `audio_level`.

## Recommended patch order

1. Set `asr_language = None` by default.
2. Add `server_url`, `target_language`, and `camera_index` to config.
3. Replace hardcoded translation direction with config-driven target selection.
4. Add mic status and audio level to stream state.
5. Bound worker queues to latest segment.
6. Mark VSR as unavailable instead of pretending AV fusion is active.

## Example shape of the minimum config cleanup

```python
class AppConfig:
    sample_rate = 16000
    blocksize = 1600
    segment_seconds = 2.0
    hop_seconds = 0.5

    server_url = "http://localhost:8000"
    camera_index = 0
    asr_language = None
    allowed_languages = ["ko", "en", "ja"]
    target_language = "en"
    visual_enabled = False
```
