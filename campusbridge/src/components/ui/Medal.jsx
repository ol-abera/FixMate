// A drawn badge medallion. `mark` picks the symbol inside; locked medals are greyed out.
const MARKS = {
  star: <path d="M32 20l3.6 7.4 8.1 1.1-5.9 5.7 1.4 8-7.2-3.9-7.2 3.9 1.4-8-5.9-5.7 8.1-1.1z" className="medal__mark" />,
  tick: <path d="M22 33l7 7 14-15" className="medal__tick" />,
  arrow: <path d="M23 41l18-18M30 23h11v11" className="medal__tick" />,
  bolt: <path d="M35 18L23 35h9l-3 11 13-18h-9z" className="medal__mark" />,
  flag: <path d="M25 44V21M25 22h16l-4 5 4 5H25" className="medal__tick" />,
};

// Badge names the backend defines, mapped to a symbol. Anything unknown falls back to the star.
export const markFor = (name = '') => ({ 'First Steps': 'star', Doer: 'tick', 'Go-Getter': 'arrow', 'High Achiever': 'bolt', 'Course Finisher': 'flag' }[name] || 'star');

export default function Medal({ mark = 'star', locked = false, size }) {
  return (
    <svg viewBox="0 0 64 64" className={`medal ${locked ? 'medal--locked' : ''}`} style={size ? { width: size } : undefined} aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="29" className="medal__ring" />
      <circle cx="32" cy="32" r="22" className="medal__core" />
      {MARKS[mark] || MARKS.star}
    </svg>
  );
}
