// A line-drawn university campus: central hall with a clock tower, two wings and trees.
// Pure SVG so it needs no image file and stays sharp at any size. The arched doorway glows amber.
export default function Campus({ className = '' }) {
  const cols = [236, 270, 304, 338, 372, 406];
  return (
    <svg className={`campus ${className}`} viewBox="0 0 680 400" role="img" aria-label="A university campus with a clock tower at sunrise" preserveAspectRatio="xMidYMax meet">
      <defs>
        <radialGradient id="campusDoor" cx="50%" cy="100%" r="90%">
          <stop offset="0" stopColor="#F2C58C" />
          <stop offset="1" stopColor="#D99A58" />
        </radialGradient>
      </defs>

      {/* ground */}
      <path className="campus__ln" d="M0 352H680" />
      <path className="campus__ln campus__ln--soft" d="M30 366H650M90 380H590" />

      {/* trees */}
      <g className="campus__tree">
        <circle cx="52" cy="300" r="26" /><path className="campus__ln" d="M52 326V352" />
        <circle cx="96" cy="312" r="20" /><path className="campus__ln" d="M96 332V352" />
        <circle cx="588" cy="312" r="20" /><path className="campus__ln" d="M588 332V352" />
        <circle cx="632" cy="300" r="26" /><path className="campus__ln" d="M632 326V352" />
      </g>

      {/* wings */}
      <g className="campus__wing">
        <rect x="120" y="262" width="104" height="90" />
        <rect x="456" y="262" width="104" height="90" />
        {[136, 164, 192].map((x) => <rect key={`l${x}`} className="campus__win" x={x} y="284" width="14" height="22" rx="7" />)}
        {[472, 500, 528].map((x) => <rect key={`r${x}`} className="campus__win" x={x} y="284" width="14" height="22" rx="7" />)}
        {[136, 164, 192].map((x) => <rect key={`l2${x}`} className="campus__win campus__win--dim" x={x} y="318" width="14" height="22" rx="7" />)}
        {[472, 500, 528].map((x) => <rect key={`r2${x}`} className="campus__win campus__win--dim" x={x} y="318" width="14" height="22" rx="7" />)}
      </g>

      {/* clock tower */}
      <g className="campus__hall">
        <rect x="312" y="88" width="56" height="96" />
        <path d="M304 88L340 44L376 88Z" />
        <path className="campus__ln" d="M340 44V28" />
        <path className="campus__flag" d="M340 28L360 34L340 40Z" />
      </g>
      <circle className="campus__clock" cx="340" cy="124" r="16" />
      <path className="campus__hand" d="M340 124V113M340 124L348 128" />

      {/* central hall */}
      <g className="campus__hall">
        <path d="M214 224L340 160L466 224Z" />
        <rect x="226" y="224" width="228" height="128" />
      </g>
      {cols.map((x) => <path key={x} className="campus__ln campus__ln--col" d={`M${x} 232V344`} />)}
      <path className="campus__ln" d="M214 224H466" />

      {/* doorway: the opening the opportunities come out of */}
      <path className="campus__door" d="M314 352V300a26 26 0 0 1 52 0V352Z" />

      {/* steps */}
      <path className="campus__ln" d="M204 352V344H476V352M190 352V360H490V352" />
    </svg>
  );
}
