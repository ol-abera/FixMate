import { useEffect, useState } from 'react';
import { getCourses, getOpportunities, getStats } from '../services/api';
import Story from '../components/story/Story';

// The homepage is one scroll-driven story. Everything it shows (listings, counts) comes from the API;
// while that loads, or if it fails, the story falls back to plain labels instead of made-up data.
export default function Landing() {
  const [opps, setOpps] = useState([]);
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    Promise.all([getOpportunities(), getCourses(), getStats()])
      .then(([o, c, s]) => {
        if (cancelled) return;
        setOpps((o.data || []).filter((x) => !x.isClosed).slice(0, 3));
        setCourses((c.data || []).slice(0, 3));
        setStats(s.data);
      })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load featured content.'); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  return <Story opps={opps} courses={courses} stats={stats} error={error} onRetry={() => setReloadKey((k) => k + 1)} />;
}
