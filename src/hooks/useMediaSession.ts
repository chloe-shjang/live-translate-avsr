import { useEffect, useMemo, useRef, useState } from "react";
import { emptyTranscript, fallbackPermission, fetchHealth, inferSegment } from "../lib/api";
import { encodeWav, mergeFloat32 } from "../lib/wav";
import type { SessionStatus, TranscriptFrame } from "../types/session";
import { useAudioLevel } from "./useAudioLevel";
import { useLipTracking } from "./useLipTracking";

const SEGMENT_MS = 2200;
const HEALTH_MS = 5000;
const LIP_VIDEO_SIZE = 160;

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
  const lipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lipDrawFrameRef = useRef<number | null>(null);
  const lipRecorderRef = useRef<MediaRecorder | null>(null);
  const lipChunksRef = useRef<Blob[]>([]);

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
      if (lipDrawFrameRef.current) {
        window.cancelAnimationFrame(lipDrawFrameRef.current);
      }

      processorRef.current?.disconnect();
      analyserRef.current?.disconnect();
      sourceRef.current?.disconnect();
      audioContextRef.current?.close();
      lipRecorderRef.current?.stop();
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
    if (!videoRef.current || !status.cameraOn) {
      lipRecorderRef.current?.stop();
      lipRecorderRef.current = null;
      lipChunksRef.current = [];
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = LIP_VIDEO_SIZE;
    canvas.height = LIP_VIDEO_SIZE;
    lipCanvasRef.current = canvas;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return;
    }

    const draw = () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        lipDrawFrameRef.current = window.requestAnimationFrame(draw);
        return;
      }

      context.clearRect(0, 0, canvas.width, canvas.height);

      if (lipBox) {
        const sourceX = lipBox.x * video.videoWidth;
        const sourceY = lipBox.y * video.videoHeight;
        const sourceWidth = lipBox.width * video.videoWidth;
        const sourceHeight = lipBox.height * video.videoHeight;

        context.drawImage(
          video,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          canvas.width,
          canvas.height
        );
      }

      lipDrawFrameRef.current = window.requestAnimationFrame(draw);
    };

    draw();

    const stream = canvas.captureStream(12);
    try {
      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9"
      });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          lipChunksRef.current.push(event.data);
        }
      };
      recorder.start(1000);
      lipRecorderRef.current = recorder;
    } catch {
      try {
        const recorder = new MediaRecorder(stream, {
          mimeType: "video/webm"
        });
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            lipChunksRef.current.push(event.data);
          }
        };
        recorder.start(1000);
        lipRecorderRef.current = recorder;
      } catch {
        lipRecorderRef.current = null;
      }
    }

    return () => {
      if (lipDrawFrameRef.current) {
        window.cancelAnimationFrame(lipDrawFrameRef.current);
        lipDrawFrameRef.current = null;
      }
      lipRecorderRef.current?.stop();
      lipRecorderRef.current = null;
      lipChunksRef.current = [];
    };
  }, [status.cameraOn, lipBox, videoRef]);

  useEffect(() => {
    const flushAudio = async () => {
      if (sendingRef.current) {
        return;
      }

      sendingRef.current = true;
      const startedAt = performance.now();
      const chunks = chunksRef.current.splice(0, chunksRef.current.length);

      try {
        const videoMimeType = lipChunksRef.current[0]?.type || "video/webm";
        const videoBlob =
          lipChunksRef.current.length > 0
            ? new Blob(lipChunksRef.current.splice(0, lipChunksRef.current.length), {
                type: videoMimeType
              })
            : null;
        const wavBlob =
          chunks.length > 0
            ? encodeWav(mergeFloat32(chunks), audioContextRef.current?.sampleRate ?? 48000)
            : null;

        if (!wavBlob && !videoBlob) {
          sendingRef.current = false;
          return;
        }

        const result = await inferSegment(wavBlob, status.targetLanguage, {
          video: videoBlob,
          sourceLanguageHint: null
        });
        const sourceText = result.source_text?.trim();
        const detectedLanguage = normalizeSourceLanguage(result.detected_language);

        if (sourceText) {
          setTranscript({
            sourceText,
            translatedText: result.translated_text || "",
            detectedLanguage,
            source: result.fusion_source ?? "audio",
            confidence: result.audio_confidence ?? 0.72,
            visualConfidence: result.visual_confidence ?? 0,
            ts: Date.now()
          });
        }

        setStatus((current) => ({
          ...current,
          detectedLanguage,
          lastLatencyMs: Math.round(performance.now() - startedAt),
          visualState: trackingReady ? "warming" : current.visualState
        }));
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
  }, [status.micOn, status.targetLanguage, trackingReady]);

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
