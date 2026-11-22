// The line that carries one student through every scene. The page script draws it as you scroll and moves the
// marker along it. Two shapes: a wide one for desktop and a tall one for phones (CSS picks which is shown).
export const PATH_DESKTOP = 'M40 560 C220 560 260 400 420 380 S720 330 780 220 S600 90 500 70';
export const PATH_MOBILE = 'M40 580 C40 470 220 500 220 400 S60 330 160 240 S420 190 500 70';

export default function JourneyPath({ desktopRef, mobileRef }) {
  return (
    <svg className="journey" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path className="journey__rail journey__rail--d" d={PATH_DESKTOP} vectorEffect="non-scaling-stroke" />
      <path ref={desktopRef} className="journey__draw journey__draw--d" d={PATH_DESKTOP} vectorEffect="non-scaling-stroke" />
      <path className="journey__rail journey__rail--m" d={PATH_MOBILE} vectorEffect="non-scaling-stroke" />
      <path ref={mobileRef} className="journey__draw journey__draw--m" d={PATH_MOBILE} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
