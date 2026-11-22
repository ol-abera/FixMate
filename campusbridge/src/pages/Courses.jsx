import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { getCourses } from '../services/api';
import useFilterOptions from '../hooks/useFilterOptions';
import useUrlFilters from '../hooks/useUrlFilters';
import CourseCard from '../components/CourseCard';
import SearchBar from '../components/SearchBar';
import FilterChips from '../components/FilterChips';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import SampleNotice from '../components/SampleNotice';
import PageHero from '../components/ui/PageHero';

export default function Courses() {
  const { values, setValue, clearAll, isFiltered } = useUrlFilters(['search', 'category', 'level']);
  const { search, category, level } = values;
  const options = useFilterOptions();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const res = await getCourses({ search, category, level });
        if (!cancelled) setCourses(res.data || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load courses');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [search, category, level, reloadKey]);

  return (
    <div className="page-enter">
      <PageHero
        tone="sage"
        title="Learn something you can use."
        lead="Browse courses that build practical skills for your studies and your career. Enrol, hand in assignments, and earn points."
      >
        <SearchBar value={search} onChange={(v) => setValue('search', v)} placeholder="Search courses, instructors, or topics" />
      </PageHero>

      <div className="container discover">
        <SampleNotice what="courses" />

        <div className="filters">
          <FilterChips label="Category" options={['All', ...options.courseCategories]} value={category} onChange={(v) => setValue('category', v)} />
          <FilterChips label="Level" options={['All', ...options.courseLevels]} value={level} onChange={(v) => setValue('level', v)} />
        </div>

        {loading ? (
          <LoadingSpinner size="lg" text="Finding courses..." />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : courses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No courses found"
            description={isFiltered ? 'Nothing matches your search or filters. Try removing some of them.' : 'There are no courses yet. Please check back later.'}
            action={isFiltered ? <button type="button" className="btn btn-secondary btn-sm" onClick={clearAll}>Clear search and filters</button> : null}
          />
        ) : (
          <>
            <p className="discover__count" aria-live="polite">
              <span>Showing <strong>{courses.length}</strong> course{courses.length !== 1 ? 's' : ''}</span>
              {isFiltered && <button type="button" className="discover__clear" onClick={clearAll}>Clear filters</button>}
            </p>
            <div className="grid grid--courses">
              {courses.map((course, i) => (
                <div className="grid__item" style={{ '--i': Math.min(i, 8) }} key={course.id}><CourseCard course={course} /></div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
