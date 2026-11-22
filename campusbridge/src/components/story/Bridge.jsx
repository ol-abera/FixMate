// The bridge that appears in scene four: an arch that draws itself, with hangers dropping to the road.
const P = [[390, 548], [470, 230], [820, 230], [930, 548]]; // cubic Bézier control points of the arch
const ROAD_Y = 548;

function pointAt(t) {
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [
    Math.round(w.reduce((s, k, i) => s + k * P[i][0], 0)),
    Math.round(w.reduce((s, k, i) => s + k * P[i][1], 0)),
  ];
}

const HANGERS = [0.14, 0.24, 0.34, 0.44, 0.56, 0.66, 0.76, 0.86].map(pointAt);

export default function Bridge({ archRef }) {
  return (
    <svg className="bridge" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path className="bridge__road" d={`M330 ${ROAD_Y}H980`} vectorEffect="non-scaling-stroke" />
      <path ref={archRef} className="bridge__arch" d={`M${P[0].join(' ')}C${P[1].join(' ')} ${P[2].join(' ')} ${P[3].join(' ')}`} vectorEffect="non-scaling-stroke" />
      {HANGERS.map(([x, y], i) => (
        <path key={x} className="bridge__hanger" style={{ '--i': i }} d={`M${x} ${y}V${ROAD_Y}`} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
