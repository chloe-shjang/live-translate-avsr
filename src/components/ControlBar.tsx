type ControlBarProps = {
  micOn: boolean;
  cameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
};

export function ControlBar({
  micOn,
  cameraOn,
  onToggleMic,
  onToggleCamera
}: ControlBarProps) {
  return (
    <div className="control-bar">
      <button className="icon-button" type="button" aria-label="Toggle camera" onClick={onToggleCamera}>
        <span>📹</span>
        <span className="icon-button__label">{cameraOn ? "Cam On" : "Cam Off"}</span>
      </button>
      <button
        className={micOn ? "icon-button icon-button--primary" : "icon-button"}
        type="button"
        onClick={onToggleMic}
        aria-label="Toggle microphone"
      >
        <span>🎙</span>
        <span className="icon-button__label">{micOn ? "Mic On" : "Mic Off"}</span>
      </button>
      <div className="live-indicator">
        <span className="live-indicator__dot" />
        LIVE
      </div>
    </div>
  );
}
