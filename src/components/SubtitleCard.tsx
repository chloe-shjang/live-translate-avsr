import type { TranscriptFrame } from "../types/session";

type SubtitleCardProps = {
  transcript: TranscriptFrame;
};

export function SubtitleCard({ transcript }: SubtitleCardProps) {
  return (
    <div className="subtitle-card">
      <div className="subtitle-card__source">{transcript.sourceText}</div>
      <div className="subtitle-card__translated">{transcript.translatedText}</div>
    </div>
  );
}
