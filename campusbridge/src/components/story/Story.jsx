import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useReducedMotion from '../../hooks/useReducedMotion';
import { ROLE_HOME, deadlineInfo, tone } from '../../utils/format';
import { SHOW_SAMPLE_DATA_NOTICE } from '../../config';
import CountUp from '../ui/CountUp';
import Medal, { markFor } from '../ui/Medal';
import OpportunityCard from '../OpportunityCard';
import CourseCard from '../CourseCard';
import Campus from './Campus';
import Bridge from './Bridge';
import JourneyPath from './JourneyPath';
import {
  DECK_DESKTOP, DECK_MOBILE, GLOW, SCENES, SCENE_NAMES,
  clamp01, colorsAt, copyShift, copyVisibility, faceVisibility, sample, sceneAt, span,
} from './storyMath';

// The first badges a student can earn. These mirror the badge definitions in backend/src/routes/learning.js.
const BADGES = [
  { id: 'first-steps', name: 'First Steps', description: 'Enrol in your first course.' },
  { id: 'first-submission', name: 'Doer', description: 'Submit your first assignment.' },
  { id: 'applicant', name: 'Go-Getter', description: 'Apply for an opportunity.' },
];

// Shown only while real listings have not loaded (or there are fewer than three). They name a kind of listing and
// carry no title, employer, date or number, so nothing here pretends to be real data.
const OPP_FALLBACK = [
  { tag: 'Internship', title: 'Internships', sub: 'Posted by organisations', to: '/opportunities' },
  { tag: 'Scholarship', title: 'Scholarships', sub: 'Funding for your studies', to: '/opportunities' },
  { tag: 'Research', title: 'Research roles', sub: 'Work with a lab or team', to: '/opportunities' },
];
const COURSE_FALLBACK = [
  { tag: 'Courses', title: 'Practical courses', sub: 'Taught by instructors', to: '/courses' },
  { tag: 'Assignments', title: 'Hand in your work', sub: 'Get graded feedback', to: '/courses' },
  { tag: 'Points', title: 'Earn points', sub: 'From graded assignments', to: '/courses' },
];

const oppFace = (o, i) => (o
  ? { tag: o.type, tone: tone(o.type), status: deadlineInfo(o).label, title: o.title, sub: o.company, meta: [o.location, o.duration].filter(Boolean).join(' · '), to: `/opportunities/${o.id}` }
  : { ...OPP_FALLBACK[i], tone: tone(OPP_FALLBACK[i].tag) });
const courseFace = (c, i) => (c
  ? { tag: c.category, tone: tone(c.category), status: c.level, title: c.title, sub: c.instructor, meta: c.duration, to: `/courses/${c.id}` }
  : { ...COURSE_FALLBACK[i], tone: 'sage' });

/* ────────────── pieces shared by the live and the static versions ────────────── */

function FaceBody({ f }) {
  return (
    <>
      <span className="face__row">
        <span className={`face__tag face__tag--${f.tone}`}>{f.tag}</span>
        {f.status && <span className="face__status">{f.status}</span>}
      </span>
      <strong className="face__title">{f.title}</strong>
      <span className="face__sub">{f.sub}</span>
      {f.meta && <span className="face__meta">{f.meta}</span>}
    </>
  );
}

function HeroCopy() {
  return (
    <>
      <h1 className="hero__title">
        <span className="hero__line"><span>Your future doesn’t wait.</span></span>
        <span className="hero__line hero__line--alt"><span>Neither should you.</span></span>
      </h1>
      <p className="hero__lead">Discover opportunities, build skills, and create your own path forward.</p>
      <div className="hero__cta">
        <Link to="/opportunities" className="btn btn-accent btn-lg">Explore Opportunities <ArrowRight size={17} aria-hidden="true" /></Link>
        <Link to="/courses" className="btn btn-outline-cream btn-lg">Start Learning</Link>
      </div>
    </>
  );
}

function DiscoverCopy({ stats, error, onRetry, active }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const go = (e) => {
    e.preventDefault();
    const s = q.trim();
    navigate(s ? `/opportunities?search=${encodeURIComponent(s)}` : '/opportunities');
  };
  return (
    <>
      <h2 className="copy__title">Then the doors start opening.</h2>
      <p className="copy__text">Internships, scholarships, research roles and courses, posted by organisations and searchable in one place.</p>
      <form className="story-search" onSubmit={go}>
        <Search size={18} aria-hidden="true" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try “web development” or “scholarship”" aria-label="Search opportunities" />
        <button type="submit" className="btn btn-accent btn-sm">Search</button>
      </form>
      {stats && (
        <dl className="counters">
          <div><dt>{stats.openOpportunities === 1 ? 'open opportunity' : 'open opportunities'}</dt><dd><CountUp value={stats.openOpportunities} active={active} /></dd></div>
          <div><dt>{stats.courses === 1 ? 'course listed' : 'courses listed'}</dt><dd><CountUp value={stats.courses} active={active} /></dd></div>
        </dl>
      )}
      {error && <p className="story__note" role="status">Live listings could not be loaded. <button type="button" onClick={onRetry}>Try again</button></p>}
      {!error && SHOW_SAMPLE_DATA_NOTICE && <p className="story__note">Listings shown are sample data for demonstration.</p>}
    </>
  );
}

const TRACK = [
  { name: 'Enrol', text: 'Join a course' },
  { name: 'Submit', text: 'Hand in assignments' },
  { name: 'Graded', text: 'Instructors review your work' },
  { name: 'Points', text: 'Graded work earns points' },
];

function LearnCopy() {
  return (
    <>
      <h2 className="copy__title">Learning turns into progress.</h2>
      <p className="copy__text">Enrol in a course, submit assignments, and watch graded work turn into points on your own dashboard.</p>
      <ol className="track">
        <li className="track__line" aria-hidden="true" />
        {TRACK.map((s, k) => (
          <li key={s.name} className="track__step" style={{ '--k': k }}>
            <span className="track__dot"><span /></span>
            <strong>{s.name}</strong>
            <span>{s.text}</span>
          </li>
        ))}
      </ol>
      <Link to="/courses" className="copy__link">Browse courses <ArrowRight size={16} aria-hidden="true" /></Link>
    </>
  );
}

function BuildCopy() {
  return (
    <>
      <h2 className="copy__title">Build something that lasts.</h2>
      <p className="copy__text">Earn badges as you go, apply to internships, and connect with the organisations hiring. Every step is tracked in one place.</p>
      <Link to="/opportunities" className="copy__link">See open opportunities <ArrowRight size={16} aria-hidden="true" /></Link>
    </>
  );
}

function DestinationCopy({ isAuthenticated, user }) {
  const first = user?.fullName?.split(' ')[0];
  return (
    <>
      <h2 className="copy__title copy__title--xl">Take the next step.</h2>
      <p className="copy__text">
        {isAuthenticated
          ? `Welcome back${first ? `, ${first}` : ''}. Pick up where you left off.`
          : 'Create an account to apply for opportunities, enrol in courses and keep every application in one place.'}
      </p>
      <div className="hero__cta hero__cta--center">
        {isAuthenticated ? (
          <>
            <Link to={ROLE_HOME[user?.role] || '/dashboard'} className="btn btn-accent btn-lg">Go to my dashboard <ArrowRight size={17} aria-hidden="true" /></Link>
            <Link to="/opportunities" className="btn btn-outline-cream btn-lg">Explore opportunities</Link>
          </>
        ) : (
          <>
            <Link to="/register" className="btn btn-accent btn-lg">Create your account <ArrowRight size={17} aria-hidden="true" /></Link>
            <Link to="/opportunities" className="btn btn-outline-cream btn-lg">Browse without signing up</Link>
          </>
        )}
      </div>
    </>
  );
}

/* ────────────── the pinned, scroll-driven version ────────────── */

function LiveStory({ opps, courses, stats, error, onRetry }) {
  const { isAuthenticated, user } = useAuth();
  const storyRef = useRef(null);
  const stageRef = useRef(null);
  const cardRefs = useRef([]);
  const markerRef = useRef(null);
  const pathD = useRef(null);
  const pathM = useRef(null);
  const archRef = useRef(null);
  const [scene, setScene] = useState(0);

  useEffect(() => {
    const story = storyRef.current;
    const stage = stageRef.current;
    if (!story || !stage) return undefined;

    const wide = window.matchMedia('(min-width: 1000px)');
    const fine = window.matchMedia('(pointer: fine)');
    let W = stage.clientWidth;
    let H = stage.clientHeight;
    let raf = 0;
    let lastScene = -1;
    let lastFaces = '';
    const set = (k, v) => stage.style.setProperty(k, v);

    // The line is dashed in screen pixels (the SVG is stretched, so its own units would not match), so we sample
    // each path into a table of [x, y, distance travelled] in pixels. The same table places the marker.
    let table = [];
    let pathLen = 0;
    let archLen = 0;
    const sample2 = (path) => {
      const out = [];
      try {
        const len = path.getTotalLength();
        let cum = 0; let px = 0; let py = 0;
        for (let i = 0; i <= 260; i += 1) {
          const pt = path.getPointAtLength((len * i) / 260);
          const x = (pt.x / 1000) * W; const y = (pt.y / 600) * H;
          if (i > 0) cum += Math.hypot(x - px, y - py);
          out.push([x, y, cum]); px = x; py = y;
        }
      } catch { /* path not rendered yet */ }
      return out;
    };
    const measure = () => {
      W = stage.clientWidth; H = stage.clientHeight;
      const path = wide.matches ? pathD.current : pathM.current;
      table = path ? sample2(path) : [];
      pathLen = table.length ? table[table.length - 1][2] : 0;
      if (path) { path.style.strokeDasharray = `${pathLen}`; }
      const arch = archRef.current ? sample2(archRef.current) : [];
      archLen = arch.length ? arch[arch.length - 1][2] : 0;
      if (archRef.current) archRef.current.style.strokeDasharray = `${archLen}`;
    };
    const at = (d) => {
      if (!table.length) return null;
      let lo = 0; let hi = table.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (table[mid][2] < d) lo = mid; else hi = mid; }
      const a = table[lo]; const b = table[hi];
      const t = b[2] === a[2] ? 0 : (d - a[2]) / (b[2] - a[2]);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    };

    function update() {
      raf = 0;
      const rect = story.getBoundingClientRect();
      const range = Math.max(1, rect.height - window.innerHeight);
      const p = clamp01(-rect.top / range);

      const { bg, ink } = colorsAt(p);
      set('--p', p.toFixed(4));
      set('--bg', bg);
      set('--ink', ink);

      for (let i = 0; i < SCENES; i += 1) {
        const vis = copyVisibility(p, i);
        set(`--sc${i}`, vis.toFixed(3));
        set(`--sy${i}`, `${copyShift(p, i, vis).toFixed(1)}px`);
      }

      set('--campus', span(p, 0.05, 0.27).toFixed(4));
      set('--light', (span(p, 0.36, 0.44) * (1 - span(p, 0.56, 0.64))).toFixed(3));
      set('--track', span(p, 0.43, 0.56).toFixed(4));
      set('--bridge', Math.min(span(p, 0.55, 0.64), 1 - span(p, 0.86, 0.94)).toFixed(3));

      // faces on the shared cards: opportunity -> course -> badge
      const fo = 1 - span(p, 0.35, 0.42);
      const fc = span(p, 0.35, 0.42) * (1 - span(p, 0.58, 0.65));
      const fb = span(p, 0.58, 0.65);
      set('--fo', fo.toFixed(3));
      set('--fc', fc.toFixed(3));
      set('--fb', fb.toFixed(3));
      const faces = [fo > 0.02 && 'o', fc > 0.02 && 'c', fb > 0.02 && 'b'].filter(Boolean).join(' ');
      if (faces !== lastFaces) { lastFaces = faces; stage.dataset.faces = faces; }

      // deck
      const deck = wide.matches ? DECK_DESKTOP : DECK_MOBILE;
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const [x, y, r, s, o] = sample(deck[i], p);
        el.style.transform = `translate3d(${((x / 100) * W).toFixed(1)}px, ${((y / 100) * H).toFixed(1)}px, 0) translate(-50%, -50%) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(3)})`;
        el.style.opacity = o.toFixed(3);
      });

      // sun / glow
      const [gx, gy, gs, go] = sample(GLOW, p);
      set('--gx', `${gx.toFixed(1)}%`);
      set('--gy', `${gy.toFixed(1)}%`);
      set('--gs', gs.toFixed(3));
      set('--go', go.toFixed(3));

      // journey line and the marker that travels along it
      const path = wide.matches ? pathD.current : pathM.current;
      if (path && pathLen) {
        path.style.strokeDashoffset = `${pathLen * (1 - p)}`;
        const pt = at(pathLen * p);
        if (pt && markerRef.current) markerRef.current.style.transform = `translate3d(${pt[0].toFixed(1)}px, ${pt[1].toFixed(1)}px, 0) translate(-50%, -50%)`;
      }
      if (archRef.current && archLen) archRef.current.style.strokeDashoffset = `${archLen * (1 - span(p, 0.6, 0.76))}`;

      const sc = sceneAt(p);
      if (sc !== lastScene) { lastScene = sc; setScene(sc); }
    }

    const request = () => { if (!raf) raf = requestAnimationFrame(update); };
    const onResize = () => { measure(); request(); };

    // Cursor depth: the deck and glow lean a little toward the pointer (fine pointers only).
    let tx = 0; let ty = 0; let cx = 0; let cy = 0; let pr = 0;
    const glide = () => {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      set('--mx', cx.toFixed(3)); set('--my', cy.toFixed(3));
      pr = Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002 ? requestAnimationFrame(glide) : 0;
    };
    const onPointer = (e) => {
      if (!fine.matches) return;
      const r = stage.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!pr) pr = requestAnimationFrame(glide);
    };

    measure();
    update();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', onResize);
    stage.addEventListener('pointermove', onPointer);
    return () => {
      window.removeEventListener('scroll', request);
      window.removeEventListener('resize', onResize);
      stage.removeEventListener('pointermove', onPointer);
      if (raf) cancelAnimationFrame(raf);
      if (pr) cancelAnimationFrame(pr);
    };
  }, []);

  const goTo = useCallback((i) => {
    const story = storyRef.current;
    if (!story) return;
    const range = story.offsetHeight - window.innerHeight;
    const top = story.offsetTop + (i === 0 ? 0 : ((i + 0.5) / SCENES) * range);
    window.scrollTo({ top, behavior: 'smooth' });
  }, []);

  const oppFaces = useMemo(() => [0, 1, 2].map((i) => oppFace(opps[i], i)), [opps]);
  const courseFaces = useMemo(() => [0, 1, 2].map((i) => courseFace(courses[i], i)), [courses]);

  return (
    <section className="story story--live" ref={storyRef} aria-label="The CampusBridge journey">
      <div className="stage" ref={stageRef} data-scene={scene} data-faces="o">
        <div className="stage__bg" aria-hidden="true" />
        <div className="stage__glow" aria-hidden="true" />
        <div className="stage__grid" aria-hidden="true" />

        <svg className="hills" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path className="hills__3" d="M0 190C120 130 240 150 360 120S600 70 720 110 900 150 1000 100V300H0Z" />
          <path className="hills__2" d="M0 230C140 180 260 200 400 170S640 140 760 175 920 210 1000 170V300H0Z" />
          <path className="hills__1" d="M0 268C160 232 300 250 460 226S720 214 840 238 960 252 1000 240V300H0Z" />
        </svg>

        <Campus className="stage__campus" />
        <Bridge archRef={archRef} />
        <JourneyPath desktopRef={pathD} mobileRef={pathM} />
        <span className="marker" ref={markerRef} aria-hidden="true" />

        <div className="deck">
          {[0, 1, 2].map((i) => {
            const o = oppFaces[i]; const c = courseFaces[i];
            return (
              <div className="dc" key={i} ref={(el) => { cardRefs.current[i] = el; }}>
                <div className="dc__depth" style={{ '--k': [16, 28, 40][i] }}>
                  <div className="dc__float" style={{ '--delay': `${i * -2.1}s`, '--amp': `${[7, 10, 6][i]}px` }}>
                    <div className="dc__card" style={{ '--in': `${0.7 + i * 0.16}s` }}>
                      <Link to={o.to} className="face face--o" tabIndex={0}><FaceBody f={o} /></Link>
                      <Link to={c.to} className="face face--c"><FaceBody f={c} /></Link>
                      <div className="face face--b">
                        <Medal mark={markFor(BADGES[i].name)} />
                        <span className="face__text">
                          <strong className="face__title">{BADGES[i].name}</strong>
                          <span className="face__sub">{BADGES[i].description}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className={`copy copy--hero c0 ${scene === 0 ? 'is-on' : ''}`}>
          <HeroCopy />
        </div>
        <div className={`copy copy--side c1 ${scene === 1 ? 'is-on' : ''}`}>
          <DiscoverCopy stats={stats} error={error} onRetry={onRetry} active={scene === 1} />
        </div>
        <div className={`copy copy--side c2 ${scene === 2 ? 'is-on' : ''}`}>
          <LearnCopy />
        </div>
        <div className={`copy copy--side c3 ${scene === 3 ? 'is-on' : ''}`}>
          <BuildCopy />
        </div>
        <div className={`copy copy--center c4 ${scene === 4 ? 'is-on' : ''}`}>
          <DestinationCopy isAuthenticated={isAuthenticated} user={user} />
        </div>

        <div className="scroll-cue" aria-hidden="true"><span>Scroll</span><i /></div>

        <nav className="rail" aria-label="Story chapters">
          <span className="rail__line" aria-hidden="true" />
          {SCENE_NAMES.map((name, i) => (
            <button key={name} type="button" className={`rail__stop ${scene === i ? 'is-active' : ''} ${scene > i ? 'is-past' : ''}`} onClick={() => goTo(i)} aria-label={`${name}, chapter ${i + 1} of ${SCENES}`} aria-current={scene === i ? 'step' : undefined}>
              <span className="rail__dot" /><span className="rail__name">{name}</span>
            </button>
          ))}
        </nav>
      </div>
    </section>
  );
}

/* ────────────── the plain stacked version (reduced motion, very short screens) ────────────── */

function StaticStory({ opps, courses, stats, error, onRetry }) {
  const { isAuthenticated, user } = useAuth();
  return (
    <section className="story story--static" aria-label="The CampusBridge journey">
      <div className="sx sx--dark sx--hero">
        <div className="container sx__inner">
          <div className="sx__copy"><HeroCopy /></div>
          <Campus className="sx__campus" />
        </div>
      </div>

      <div className="sx sx--dark">
        <div className="container">
          <div className="sx__copy copy--static"><DiscoverCopy stats={stats} error={error} onRetry={onRetry} active /></div>
          {opps.length > 0 && <div className="sx__grid">{opps.slice(0, 3).map((o) => <OpportunityCard key={o.id} opportunity={o} />)}</div>}
        </div>
      </div>

      <div className="sx sx--light">
        <div className="container">
          <div className="sx__copy copy--static" style={{ '--track': 1 }}><LearnCopy /></div>
          {courses.length > 0 && <div className="sx__grid">{courses.slice(0, 3).map((c) => <CourseCard key={c.id} course={c} />)}</div>}
        </div>
      </div>

      <div className="sx sx--dark">
        <div className="container">
          <div className="sx__copy copy--static"><BuildCopy /></div>
          <ul className="sx__badges">
            {BADGES.map((b, i) => (
              <li key={b.id}><Medal mark={markFor(BADGES[i].name)} /><span><strong>{b.name}</strong>{b.description}</span></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="sx sx--dark sx--end">
        <div className="container sx__center"><DestinationCopy isAuthenticated={isAuthenticated} user={user} /></div>
      </div>
    </section>
  );
}

export default function Story(props) {
  const reduced = useReducedMotion();
  const [short, setShort] = useState(() => window.innerHeight < 520);
  useEffect(() => {
    const onResize = () => setShort(window.innerHeight < 520);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return reduced || short ? <StaticStory {...props} /> : <LiveStory {...props} />;
}
