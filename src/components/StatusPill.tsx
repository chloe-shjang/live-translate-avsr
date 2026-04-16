type StatusPillProps = {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn";
  leading?: string;
};

export function StatusPill({ label, value, tone = "neutral", leading }: StatusPillProps) {
  return (
    <div className={`status-pill status-pill--${tone}`}>
      <span className="status-pill__label">{label}</span>
      <strong className="status-pill__value">
        {leading ? <span className="status-pill__leading">{leading}</span> : null}
        {value}
      </strong>
    </div>
  );
}
