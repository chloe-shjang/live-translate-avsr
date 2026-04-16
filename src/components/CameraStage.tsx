import type { SessionStatus, TranscriptFrame } from "../types/session";
import { DebugPanel } from "./DebugPanel";
import { LanguageSelector } from "./LanguageSelector";
import { SubtitleCard } from "./SubtitleCard";

type CameraStageProps = {
  status: SessionStatus;
  transcript: TranscriptFrame;
  videoRef: React.RefObject<HTMLVideoElement>;
  onTargetLanguageChange: (value: string) => void;
};

export function CameraStage({
  status,
  transcript,
  videoRef,
  onTargetLanguageChange
}: CameraStageProps) {
  return (
    <section className="camera-stage">
      <div className="camera-stage__chrome">
        <DebugPanel status={status} />
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
        {!status.cameraOn ? <div className="camera-stage__person" /> : null}
        <SubtitleCard transcript={transcript} />
      </div>
    </section>
  );
}
