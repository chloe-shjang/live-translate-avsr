import type { LipBox, SessionStatus, TranscriptFrame } from "../types/session";
import { DebugPanel } from "./DebugPanel";
import { LanguageSelector } from "./LanguageSelector";
import { SubtitleCard } from "./SubtitleCard";

type CameraStageProps = {
  status: SessionStatus;
  transcript: TranscriptFrame;
  videoRef: React.RefObject<HTMLVideoElement>;
  lipBox: LipBox | null;
  trackingReady: boolean;
  onTargetLanguageChange: (value: string) => void;
};

export function CameraStage({
  status,
  transcript,
  videoRef,
  lipBox,
  trackingReady,
  onTargetLanguageChange
}: CameraStageProps) {
  return (
    <section className="camera-stage">
      <div className="camera-stage__chrome">
        <DebugPanel status={status} trackingReady={trackingReady} />
        <LanguageSelector
          value={status.targetLanguage}
          onChange={onTargetLanguageChange}
        />
      </div>

      <div className="camera-stage__viewport">
        <div className="camera-stage__glow" />
        <video
          ref={videoRef}
          className={status.cameraOn ? "camera-feed" : "camera-feed is-off"}
          autoPlay
          muted
          playsInline
        />
        {lipBox ? (
          <div
            className="lip-box"
            style={{
              left: `${lipBox.x * 100}%`,
              top: `${lipBox.y * 100}%`,
              width: `${lipBox.width * 100}%`,
              height: `${lipBox.height * 100}%`
            }}
          >
            <span className="lip-box__label">Lip ROI</span>
          </div>
        ) : null}
        {!status.cameraOn ? <div className="camera-stage__person" /> : null}
        <SubtitleCard transcript={transcript} />
      </div>
    </section>
  );
}
