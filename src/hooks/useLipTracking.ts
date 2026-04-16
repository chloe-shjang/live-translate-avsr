import { useEffect, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { LipBox } from "../types/session";

const LIP_OUTER = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409,
  291, 375, 321, 405, 314, 17, 84, 181, 91, 146
];
const LIP_PADDING = 0.22;
const MODEL_ASSET_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

function smoothBox(previous: LipBox | null, next: LipBox) {
  if (!previous) {
    return next;
  }

  const alpha = 0.28;
  return {
    x: previous.x + (next.x - previous.x) * alpha,
    y: previous.y + (next.y - previous.y) * alpha,
    width: previous.width + (next.width - previous.width) * alpha,
    height: previous.height + (next.height - previous.height) * alpha
  };
}

export function useLipTracking(video: HTMLVideoElement | null, enabled: boolean) {
  const [lipBox, setLipBox] = useState<LipBox | null>(null);
  const [trackingReady, setTrackingReady] = useState(false);

  useEffect(() => {
    if (!video || !enabled) {
      setLipBox(null);
      setTrackingReady(false);
      return;
    }

    let cancelled = false;
    let frameId = 0;
    let faceLandmarker: FaceLandmarker | null = null;
    let lastVideoTime = -1;
    let previousBox: LipBox | null = null;

    const renderLoop = () => {
      if (cancelled || !faceLandmarker) {
        return;
      }

      if (video.readyState < 2) {
        frameId = window.requestAnimationFrame(renderLoop);
        return;
      }

      if (video.currentTime !== lastVideoTime) {
        const result = faceLandmarker.detectForVideo(video, performance.now());
        lastVideoTime = video.currentTime;

        const landmarks = result.faceLandmarks?.[0];
        if (landmarks?.length) {
          const lipPoints = LIP_OUTER
            .map((index) => landmarks[index])
            .filter(Boolean);

          if (lipPoints.length) {
            const xs = lipPoints.map((point) => point.x);
            const ys = lipPoints.map((point) => point.y);
            const x1 = Math.max(0, Math.min(...xs));
            const y1 = Math.max(0, Math.min(...ys));
            const x2 = Math.min(1, Math.max(...xs));
            const y2 = Math.min(1, Math.max(...ys));
            const width = x2 - x1;
            const height = y2 - y1;
            const padded = {
              x: Math.max(0, x1 - width * LIP_PADDING),
              y: Math.max(0, y1 - height * LIP_PADDING),
              width: Math.min(1 - x1, width * (1 + LIP_PADDING * 2)),
              height: Math.min(1 - y1, height * (1 + LIP_PADDING * 2))
            };

            previousBox = smoothBox(previousBox, padded);
            setLipBox(previousBox);
            setTrackingReady(true);
          }
        } else {
          setLipBox(null);
        }
      }

      frameId = window.requestAnimationFrame(renderLoop);
    };

    const setup = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
        if (cancelled) {
          return;
        }

        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_PATH
          },
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        if (cancelled) {
          faceLandmarker.close();
          return;
        }

        renderLoop();
      } catch {
        setTrackingReady(false);
      }
    };

    setup();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      faceLandmarker?.close();
    };
  }, [video, enabled]);

  return {
    lipBox,
    trackingReady
  };
}
