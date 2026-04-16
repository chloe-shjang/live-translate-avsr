import { useEffect, useMemo, useRef, useState } from "react";
import { emptyTranscript, fallbackPermission, fetchHealth, transcribeAudio, translateText } from "../lib/api";
import { encodeWav, mergeFloat32 } from "../lib/wav";
import type { SessionStatus, TranscriptFrame } from "../types/session";
import { useAudioLevel } from "./useAudioLevel";
import { useLipTracking } from "./useLipTracking";

const SEGMENT_MS = 2200;
const HEALTH_MS = 5000;

const initialStatus: SessionStatus = {
  permission: "unknown",
  micOn: true,
  cameraOn: true,
  listening: false,
  audioLevel: 0,
  detectedLanguage: null,
  targetLanguage: "en",
  serverState: "connecting",
  lastLatencyMs: null,
  visualState: "unavailable"
};

function normalizeSourceLanguage(language: string | null | undefined) {
  if (!language) {
    return "ko";
  }

  if (language === "ko" || language === "en") {
    return language;
  }

  return "ko";
}

export function useMediaSession() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const sendingRef = useRef(false);
  const micOnRef = useRef(true);

  const [status, setStatus] = useState<SessionStatus>(initialStatus);
  const [transcript, setTranscript] = useState<TranscriptFrame>(emptyTranscript);
  const { lipBox, trackingReady } = useLipTracking(videoRef.current, status.cameraOn);

  const audioLevel = useAudioLevel(analyserRef.current, status.micOn && status.listening);

  useEffect(() => {
    setStatus((current) => ({ ...current, audioLevel }));
  }, [audioLevel]);

  useEffect(() => {
    setStatus((current) => ({
      ...current,
      visualState: trackingReady ? "warming" : "unavailable"
    }));
  }, [trackingReady]);

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        const processor = audioContext.createScriptProcessor(4096, 1, 1);

        analyser.fftSize = 256;
        source.connect(analyser);
        analyser.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (event) => {
          if (!micOnRef.current) {
            return;
          }
          const channel = event.inputBuffer.getChannelData(0);
          chunksRef.current.push(new Float32Array(channel));
        };

        audioContextRef.current = audioContext;
        sourceRef.current = source;
        analyserRef.current = analyser;
        processorRef.current = processor;

        setStatus((current) => ({
          ...current,
          permission: "granted",
          listening: true
        }));
      } catch (error) {
        if (!cancelled) {
          setStatus((current) => ({
            ...current,
            permission: fallbackPermission(error),
            listening: false,
            micOn: false,
            cameraOn: false
          }));
        }
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (flushTimerRef.current) {
        window.clearInterval(flushTimerRef.current);
      }

      processorRef.current?.disconnect();
      analyserRef.current?.disconnect();
      sourceRef.current?.disconnect();
      audioContextRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const run = async () => {
      const serverState = await fetchHealth();
      setStatus((current) => ({ ...current, serverState }));
    };

    run();
    const id = window.setInterval(run, HEALTH_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const flushAudio = async () => {
      if (sendingRef.current || !status.micOn || chunksRef.current.length === 0) {
        return;
      }

      sendingRef.current = true;
      const startedAt = performance.now();
      const chunks = chunksRef.current.splice(0, chunksRef.current.length);

      try {
        const merged = mergeFloat32(chunks);
        const sampleRate = audioContextRef.current?.sampleRate ?? 48000;
        const wavBlob = encodeWav(merged, sampleRate);
        const transcribed = await transcribeAudio(wavBlob, null);
        const sourceText = transcribed.text?.trim();
        const detectedLanguage = normalizeSourceLanguage(transcribed.language);

        if (sourceText) {
          const translated =
            detectedLanguage === status.targetLanguage
              ? { translated: sourceText }
              : await translateText(sourceText, detectedLanguage, status.targetLanguage);

          setTranscript({
            sourceText,
            translatedText: translated.translated || "",
            detectedLanguage,
            source: "audio",
            confidence: 0.72,
            ts: Date.now()
          });

          setStatus((current) => ({
            ...current,
            detectedLanguage,
            lastLatencyMs: Math.round(performance.now() - startedAt)
          }));
        }
      } catch {
        setStatus((current) => ({
          ...current,
          serverState: "offline"
        }));
      } finally {
        sendingRef.current = false;
      }
    };

    flushTimerRef.current = window.setInterval(flushAudio, SEGMENT_MS);
    return () => {
      if (flushTimerRef.current) {
        window.clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
  }, [status.micOn, status.targetLanguage]);

  const controls = useMemo(
    () => ({
      setTargetLanguage: (targetLanguage: string) =>
        setStatus((current) => ({ ...current, targetLanguage })),
      toggleMic: () =>
        setStatus((current) => {
          const nextMicOn = !current.micOn;
          micOnRef.current = nextMicOn;
          streamRef.current?.getAudioTracks().forEach((track) => {
            track.enabled = nextMicOn;
          });
          return {
            ...current,
            micOn: nextMicOn,
            listening: nextMicOn && current.permission === "granted"
          };
        }),
      toggleCamera: () =>
        setStatus((current) => {
          const nextCameraOn = !current.cameraOn;
          streamRef.current?.getVideoTracks().forEach((track) => {
            track.enabled = nextCameraOn;
          });
          return {
            ...current,
            cameraOn: nextCameraOn
          };
        })
    }),
    []
  );

  return {
    videoRef,
    status,
    transcript,
    lipBox,
    trackingReady,
    ...controls
  };
}
