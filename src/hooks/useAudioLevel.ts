import { useEffect, useState } from "react";

export function useAudioLevel(analyser: AnalyserNode | null, enabled: boolean) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!analyser || !enabled) {
      setLevel(0);
      return;
    }

    const data = new Uint8Array(analyser.frequencyBinCount);
    let frameId = 0;

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const average = data.reduce((sum, value) => sum + value, 0) / data.length;
      setLevel(Math.min(1, average / 160));
      frameId = window.requestAnimationFrame(tick);
    };

    tick();
    return () => window.cancelAnimationFrame(frameId);
  }, [analyser, enabled]);

  return level;
}
