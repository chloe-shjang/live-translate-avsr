import type { SessionStatus } from "../types/session";

type DebugPanelProps = {
  status: SessionStatus;
};

function levelToBars(level: number) {
  const normalized = Math.max(0, Math.min(1, level));
  return Math.max(1, Math.round(normalized * 5));
}

export function DebugPanel({ status }: DebugPanelProps) {
  const bars = levelToBars(status.audioLevel);

  return (
    <section className="debug-panel">
      <div className="debug-panel__title">Debug</div>
      <div className="debug-row">
        <span>Permission</span>
        <strong className="tone-good">{status.permission}</strong>
      </div>
      <div className="debug-row">
        <span>Mic On</span>
        <strong className="tone-good">{String(status.micOn)}</strong>
      </div>
      <div className="debug-row">
        <span>Listening</span>
        <strong className="tone-good">{String(status.listening)}</strong>
      </div>
      <div className="debug-row">
        <span>Visual</span>
        <strong>{status.visualState}</strong>
      </div>
      <div className="debug-row">
        <span>Audio Level</span>
        <div className="audio-bars" aria-label={`Audio level ${bars}`}>
          {Array.from({ length: 5 }, (_, index) => (
            <span
              key={index}
              className={index < bars ? "audio-bars__bar is-active" : "audio-bars__bar"}
            />
          ))}
          <strong>{bars}</strong>
        </div>
      </div>
    </section>
  );
}
