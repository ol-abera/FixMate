export default function FilterChips({ options, value, onChange, label }) {
  return (
    <div className="chips">
      {label && <span className="chips__label" id={`chips-${label}`}>{label}</span>}
      <div className="chips__row" role="group" aria-labelledby={label ? `chips-${label}` : undefined}>
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button key={opt} type="button" aria-pressed={active} onClick={() => onChange(opt)} className={`chip ${active ? 'is-active' : ''}`}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
