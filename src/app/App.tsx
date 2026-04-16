import { CameraStage } from "../components/CameraStage";
import { ControlBar } from "../components/ControlBar";
import { StatusPill } from "../components/StatusPill";
import { useMediaSession } from "../hooks/useMediaSession";

function languageDisplay(language: string | null) {
  if (language === "ko") {
    return { label: "한국어", flag: "KR" };
  }

  if (language === "en") {
    return { label: "English", flag: "US" };
  }

  return { label: "Auto", flag: "AI" };
}

export default function App() {
  const {
    videoRef,
    status,
    transcript,
    lipBox,
    trackingReady,
    setTargetLanguage,
    toggleMic,
    toggleCamera
  } = useMediaSession();
  const detected = languageDisplay(status.detectedLanguage);
  const target = languageDisplay(status.targetLanguage);

  return (
    <main className="app-shell">
      <header className="top-strip">
        <div className="top-strip__brand">
          <span className="eyebrow">AVSR Translator</span>
          <h1>Visual-first live translation for multilingual calls</h1>
        </div>
        <div className="top-strip__stats">
          <StatusPill label="Detected" value={detected.label} tone="good" leading={detected.flag} />
          <StatusPill label="Target" value={target.label} tone="neutral" leading={target.flag} />
          <StatusPill label="Server" value={status.serverState} tone="good" />
          <StatusPill label="Visual" value={status.visualState} tone="warn" />
          <StatusPill
            label="Latency"
            value={status.lastLatencyMs ? `${status.lastLatencyMs}ms` : "-"}
            tone="neutral"
          />
        </div>
      </header>

      <CameraStage
        status={status}
        transcript={transcript}
        videoRef={videoRef}
        lipBox={lipBox}
        trackingReady={trackingReady}
        onTargetLanguageChange={setTargetLanguage}
      />

      <ControlBar
        micOn={status.micOn}
        cameraOn={status.cameraOn}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
      />
    </main>
  );
}
