import { useEffect, useState } from 'react';
import { Briefcase } from 'lucide-react';
import { getOpportunities, saveOpportunity, unsaveOpportunity } from '../services/api';
import { useAuth } from '../context/AuthContext';
import useFilterOptions from '../hooks/useFilterOptions';
import useUrlFilters from '../hooks/useUrlFilters';
import OpportunityCard from '../components/OpportunityCard';
import SearchBar from '../components/SearchBar';
import FilterChips from '../components/FilterChips';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import SampleNotice from '../components/SampleNotice';
import PageHero from '../components/ui/PageHero';

const SORTS = [
  { value: 'deadline', label: 'Deadline' },
  { value: 'newest', label: 'Newest' },
  { value: 'relevance', label: 'Relevance' },
];

export default function Opportunities() {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';
  const { values, setValue, clearAll, isFiltered } = useUrlFilters(['search', 'category', 'type', 'scope', 'deadline', 'location', 'workMode', 'sort', 'page']);
  const { search, category, type, scope, deadline, location, workMode, sort, page } = values;
  const deadlineParam = { 'Open now': 'open', 'Closing in 30 days': 'soon' }[deadline] || '';
  const sortParam = SORTS.some((s) => s.value === sort) ? sort : 'deadline';
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const options = useFilterOptions();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [savingId, setSavingId] = useState(null);

  const setFilter = (key, value) => setValue(key, value, { resetPage: true });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const res = await getOpportunities({
          search, category, type, scope, location, workMode,
          deadline: deadlineParam, sort: sortParam, page: String(pageNum), pageSize: '12',
        });
        if (!cancelled) {
          setItems(res.data || []);
          setTotal(res.total || 0);
          setPageSize(res.pageSize || 12);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load opportunities');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [search, category, type, scope, location, workMode, deadlineParam, sortParam, pageNum, reloadKey]);

  async function toggleSave(opportunity) {
    if (!isStudent || savingId) return;
    setSavingId(opportunity.id);
    try {
      if (opportunity.saved) await unsaveOpportunity(opportunity.id);
      else await saveOpportunity(opportunity.id);
      setItems((list) => list.map((item) => item.id === opportunity.id ? { ...item, saved: !item.saved } : item));
    } catch (err) {
      setError(err.message || 'Could not update your saved opportunities.');
    } finally {
      setSavingId(null);
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const locations = options.opportunityLocations || [];

  return (
    <div className="page-enter">
      <PageHero
        title="Find your next opportunity."
        lead="Ethiopian internships, scholarships, fellowships and competitions in one place, each with its deadline, who can apply and a link to the official source."
      >
        <SearchBar value={search} onChange={(v) => setFilter('search', v)} placeholder="Search by title, organisation, skills, or location" />
      </PageHero>

      <div className="container discover">
        <SampleNotice what="opportunities" />

        <div className="filters">
          <FilterChips label="Type" options={['All', ...(options.opportunityTypes || [])]} value={type} onChange={(v) => setFilter('type', v)} />
          <FilterChips label="Category" options={['All', ...(options.opportunityCategories || [])]} value={category} onChange={(v) => setFilter('category', v)} />
          <FilterChips label="Where" options={['All', 'Ethiopia', 'International']} value={scope} onChange={(v) => setFilter('scope', v)} />
          <FilterChips label="Work mode" options={['All', 'Remote', 'Hybrid', 'On-site']} value={workMode} onChange={(v) => setFilter('workMode', v)} />
          <FilterChips label="Deadline" options={['All', 'Open now', 'Closing in 30 days']} value={deadline} onChange={(v) => setFilter('deadline', v)} />
          {locations.length > 0 && (
            <FilterChips label="Location" options={['All', ...locations]} value={location} onChange={(v) => setFilter('location', v)} />
          )}
          <div>
            <p className="label" id="sort-label">Sort</p>
            <select id="sort" className="input" aria-labelledby="sort-label" value={sortParam} onChange={(e) => setFilter('sort', e.target.value)}>
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}{s.value === 'relevance' && !isStudent ? ' (log in as a student)' : ''}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner size="lg" text="Searching opportunities..." />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No opportunities found"
            description={isFiltered ? 'Nothing matches your search or filters. Try removing some of them.' : 'There are no opportunities yet. Please check back later.'}
            action={isFiltered ? <button type="button" className="btn btn-secondary btn-sm" onClick={clearAll}>Clear search and filters</button> : null}
          />
        ) : (
          <>
            <p className="discover__count" aria-live="polite">
              <span>Showing <strong>{items.length}</strong> of <strong>{total}</strong> opportunit{total !== 1 ? 'ies' : 'y'}</span>
              {isFiltered && <button type="button" className="discover__clear" onClick={clearAll}>Clear filters</button>}
            </p>
            <div className="grid grid--stagger">
              {items.map((item, i) => (
                <div className="grid__item" style={{ '--i': Math.min(i, 8) }} key={item.id}>
                  <OpportunityCard opportunity={item} showMatch={sortParam === 'relevance' && Boolean(item.match)} onToggleSave={isStudent ? toggleSave : undefined} saving={savingId === item.id} />
                </div>
              ))}
            </div>
            {pages > 1 && (
              <div className="pager">
                <button type="button" className="btn btn-secondary btn-sm" disabled={pageNum <= 1} onClick={() => setValue('page', String(pageNum - 1))}>Previous</button>
                <span>Page {pageNum} of {pages}</span>
                <button type="button" className="btn btn-secondary btn-sm" disabled={pageNum >= pages} onClick={() => setValue('page', String(pageNum + 1))}>Next</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
