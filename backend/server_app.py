"""
Generic backend app for AVSR experiments.

This version upgrades MT from Argos Translate to NLLB-200 distilled 1.3B,
keeps Whisper for ASR, and accepts an optional lip ROI video clip in `/infer`.
The visual branch currently computes video quality / motion confidence and keeps
an integration point for a full lip-reading model.
"""
from __future__ import annotations

import io
import os
import tempfile
import threading
from typing import Any

import argostranslate.translate
import cv2
import librosa
import numpy as np
import soundfile as sf
import torch
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from faster_whisper import WhisperModel
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

app = FastAPI(title="AVSR Inference Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WHISPER_MODEL_ID = os.getenv("AVSR_ASR_MODEL", "large-v3")
MT_MODEL_ID = os.getenv("AVSR_MT_MODEL", "facebook/nllb-200-distilled-1.3B")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

ALLOWED_LANGUAGES = {"ko", "en"}
NLLB_LANG_CODES = {
    "ko": "kor_Hang",
    "en": "eng_Latn",
}

ASR_MODEL = WhisperModel(
    WHISPER_MODEL_ID,
    device=DEVICE,
    compute_type="float16" if DEVICE == "cuda" else "int8",
)

MT_LOCK = threading.Lock()
MT_TOKENIZER = None
MT_MODEL = None
MT_STATUS = "loading"


def _read_audio(data: bytes) -> np.ndarray:
    buf = io.BytesIO(data)
    samples, sr = sf.read(buf, dtype="float32", always_2d=False)
    if sr != 16000:
        samples = librosa.resample(samples, orig_sr=sr, target_sr=16000)
    return samples


def _normalize_detected_language(language: str | None) -> str | None:
    if language in ALLOWED_LANGUAGES:
        return language
    return None


def _translate_text(text: str, from_code: str, to_code: str) -> str:
    if not text or from_code == to_code:
        return text

    global MT_STATUS
    src_lang = NLLB_LANG_CODES.get(from_code)
    tgt_lang = NLLB_LANG_CODES.get(to_code)
    if MT_MODEL is not None and MT_TOKENIZER is not None and src_lang and tgt_lang:
        inputs = MT_TOKENIZER(
            text,
            return_tensors="pt",
            src_lang=src_lang,
            truncation=True,
            max_length=512,
        ).to(DEVICE)
        forced_bos_token_id = MT_TOKENIZER.lang_code_to_id[tgt_lang]

        with torch.inference_mode():
            output_tokens = MT_MODEL.generate(
                **inputs,
                forced_bos_token_id=forced_bos_token_id,
                max_new_tokens=256,
                num_beams=4,
            )

        return MT_TOKENIZER.decode(output_tokens[0], skip_special_tokens=True)

    installed = argostranslate.translate.get_installed_languages()
    from_lang = [lang for lang in installed if lang.code == from_code]
    to_lang = [lang for lang in installed if lang.code == to_code]
    if not from_lang or not to_lang:
        return ""

    translation = from_lang[0].get_translation(to_lang[0])
    return translation.translate(text) if translation else ""


def _warm_mt_model():
    global MT_MODEL
    global MT_TOKENIZER
    global MT_STATUS

    try:
        tokenizer = AutoTokenizer.from_pretrained(MT_MODEL_ID)
        model = AutoModelForSeq2SeqLM.from_pretrained(
            MT_MODEL_ID,
            torch_dtype=torch.float16 if DEVICE == "cuda" else torch.float32,
        ).to(DEVICE)
        model.eval()

        with MT_LOCK:
            MT_TOKENIZER = tokenizer
            MT_MODEL = model
            MT_STATUS = "ready"
    except Exception:
        MT_STATUS = "fallback"


def _run_asr(samples: np.ndarray, language_hint: str | None) -> dict[str, Any]:
    segments, info = ASR_MODEL.transcribe(
        samples,
        language=language_hint if language_hint else None,
        vad_filter=True,
    )
    text = " ".join([segment.text.strip() for segment in segments]).strip()
    detected_language = _normalize_detected_language(info.language if info else None)
    return {
        "text": text,
        "language": detected_language,
    }


def _analyze_video_bytes(data: bytes) -> dict[str, Any]:
    """
    Visual branch placeholder.

    This does not perform real lip reading yet. It decodes the clip and returns
    a motion-based confidence score so the system can begin reasoning about the
    usefulness of the visual stream before a dedicated VSR model is integrated.
    """
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp.write(data)
        path = tmp.name

    try:
        cap = cv2.VideoCapture(path)
        frames: list[np.ndarray] = []
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            frames.append(gray)
        cap.release()

        if len(frames) < 2:
            return {
                "text": "",
                "confidence": 0.0,
                "frames": len(frames),
                "source": "vsr_stub",
                "motion_score": 0.0,
            }

        diffs = [
            float(np.mean(cv2.absdiff(frames[index - 1], frames[index])))
            for index in range(1, len(frames))
        ]
        motion_score = float(np.mean(diffs))
        confidence = float(min(0.95, motion_score / 18.0))

        return {
            "text": "",
            "confidence": confidence,
            "frames": len(frames),
            "source": "vsr_stub",
            "motion_score": motion_score,
        }
    finally:
        os.unlink(path)


def _fuse(
    source_text: str,
    translated_text: str,
    visual_text: str,
    visual_confidence: float,
) -> dict[str, Any]:
    if visual_text and visual_confidence >= 0.75:
        return {
            "source_text": visual_text,
            "translated_text": translated_text,
            "fusion_source": "visual",
        }

    return {
        "source_text": source_text,
        "translated_text": translated_text,
        "fusion_source": "audio",
    }


@app.get("/health")
async def health():
    active_mt = MT_MODEL_ID if MT_MODEL is not None else "argostranslate-fallback"
    return {
        "status": "ok",
        "mt_model": active_mt,
        "mt_status": MT_STATUS,
        "asr_model": WHISPER_MODEL_ID,
    }


@app.on_event("startup")
async def startup_event():
    thread = threading.Thread(target=_warm_mt_model, daemon=True)
    thread.start()


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...), language: str = Form(default=None)):
    data = await audio.read()
    samples = _read_audio(data)
    return JSONResponse(_run_asr(samples, language))


@app.post("/translate")
async def translate(
    text: str = Form(...),
    from_code: str = Form(default="ko"),
    to_code: str = Form(default="en"),
):
    return JSONResponse({"translated": _translate_text(text, from_code, to_code)})


@app.post("/vsr")
async def vsr(video: UploadFile = File(...), language: str = Form(default=None)):
    data = await video.read()
    result = _analyze_video_bytes(data)
    result["language"] = language
    return JSONResponse(result)


@app.post("/infer")
async def infer(
    audio: UploadFile | None = File(default=None),
    video: UploadFile | None = File(default=None),
    target_language: str = Form(default="en"),
    source_language_hint: str = Form(default=None),
):
    if audio is None and video is None:
        return JSONResponse({"error": "audio or video is required"}, status_code=400)

    source_text = ""
    detected_language = source_language_hint or "ko"
    translated_text = ""

    if audio is not None:
        audio_data = await audio.read()
        if audio_data:
            samples = _read_audio(audio_data)
            asr = _run_asr(samples, source_language_hint)
            source_text = asr["text"]
            detected_language = asr["language"] or source_language_hint or "ko"
            translated_text = _translate_text(source_text, detected_language, target_language) if source_text else ""

    visual = {
        "text": "",
        "confidence": 0.0,
        "frames": 0,
        "source": "none",
        "motion_score": 0.0,
    }
    if video is not None:
        video_data = await video.read()
        if video_data:
            visual = _analyze_video_bytes(video_data)

    fusion = _fuse(
        source_text=source_text,
        translated_text=translated_text,
        visual_text=visual["text"],
        visual_confidence=visual["confidence"],
    )

    return JSONResponse(
        {
            **fusion,
            "detected_language": detected_language,
            "audio_confidence": 0.82 if source_text else 0.0,
            "visual_text": visual["text"],
            "visual_confidence": visual["confidence"],
            "visual_motion_score": visual["motion_score"],
            "visual_frames": visual["frames"],
        }
    )
