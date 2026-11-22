// The CampusBridge mark: a stone arch over a river, drawn with the brand palette.
export default function Logo({ size = 30, tone = 'dark' }) {
  const light = tone === 'light';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill={light ? '#D7E6B1' : '#102E26'} />
      <path d="M5 23h22" stroke={light ? '#102E26' : '#F5F0E6'} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 23c0-6 4-10 9-10s9 4 9 10" stroke={light ? '#102E26' : '#F5F0E6'} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11.5 23c0-3.4 1.9-6 4.5-6s4.5 2.6 4.5 6" stroke="#D99A58" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="8.5" r="1.7" fill="#D99A58" />
    </svg>
  );
}
