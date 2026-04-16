type LanguageSelectorProps = {
  value: string;
  onChange: (value: string) => void;
};

const options = [
  { value: "ko", label: "한국어", flag: "🇰🇷" },
  { value: "en", label: "English", flag: "🇺🇸" }
];

export function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  const selected = options.find((option) => option.value === value);

  return (
    <label className="language-selector">
      <span className="language-selector__label">
        Target {selected ? ` ${selected.flag}` : ""}
      </span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.flag} {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
