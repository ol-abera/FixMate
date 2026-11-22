import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, Banknote, Calendar, CheckCircle2, ExternalLink, BadgeCheck } from 'lucide-react';
import { getApplications, getOpportunityById, saveOpportunity, unsaveOpportunity } from '../services/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import SampleNotice from '../components/SampleNotice';
import { deadlineInfo, tone } from '../utils/format';

const formatDate = (yyyyMmDd, month = 'long') =>
  new Date(`${yyyyMmDd}T12:00:00`).toLocaleDateString('en-US', { year: 'numeric', month, day: 'numeric' });

export default function OpportunityDetail() {
  const { id } = useParams();
  const { isAuthenticated, user } = useAuth();
  const [opp, setOpp] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [existingApplication, setExistingApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setExistingApplication(null);
    getOpportunityById(id)
      .then(async (res) => {
        if (cancelled) return;
        setOpp(res.data);
        if (isAuthenticated) {
          // Has this student already applied? A failure here is not fatal: the server still blocks duplicates.
          try {
            const apps = await getApplications();
            if (!cancelled) setExistingApplication(apps.data.find((a) => a.opportunityId === res.data.id) || null);
          } catch { /* ignore */ }
        }
      })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, isAuthenticated, reloadKey]);

  if (loading) return <LoadingSpinner size="lg" text="Loading opportunity..." />;
  if (error || !opp) {
    const notFound = error?.status === 404;
    return (
      <div className="state-page">
        <ErrorState
          title={notFound ? 'Opportunity not found' : 'Could not load this opportunity'}
          message={notFound ? 'This opportunity does not exist or may have been removed.' : error?.message}
          onRetry={notFound ? undefined : () => setReloadKey((k) => k + 1)}
        />
        <div className="state-page__back">
          <Link to="/opportunities" className="btn btn-secondary btn-sm"><ArrowLeft size={16} /> Back to Opportunities</Link>
        </div>
      </div>
    );
  }

  async function toggleSave() {
    setSaving(true); setSaveError('');
    try {
      if (opp.saved) await unsaveOpportunity(opp.id);
      else await saveOpportunity(opp.id);
      setOpp((current) => ({ ...current, saved: !current.saved }));
    } catch (err) {
      setSaveError(err.message || 'Could not update this saved opportunity.');
    } finally {
      setSaving(false);
    }
  }

  const deadline = opp.deadline ? formatDate(opp.deadline) : null;
  const d = deadlineInfo(opp);
  const appliedStatus = existingApplication?.status || opp.applicationStatus;

  // A programme run by an outside body (it has an official link and no organisation account here) is applied for on
  // the official site. Listings posted by organisations on CampusBridge are applied for here.
  const external = Boolean(opp.sourceUrl) && !opp.organization;
  const sourceLink = opp.sourceUrl && (
    <a href={opp.sourceUrl} target="_blank" rel="noopener noreferrer" className={`btn ${external ? 'btn-primary btn-lg' : 'btn-secondary'}`} style={{ width: '100%' }}>
      {external ? 'Apply on the official site' : 'Official source'} <ExternalLink size={16} aria-hidden="true" />
    </a>
  );

  let action;
  if (external && !existingApplication) {
    action = (
      <>
        {sourceLink}
        <p className="apply__hint">Applications for this programme are made on its own website. Always confirm dates and eligibility there.</p>
      </>
    );
  } else if (existingApplication) {
    action = (
      <>
        <p className="apply__done"><CheckCircle2 size={18} aria-hidden="true" /> You have applied</p>
        <Link to={`/applications/${existingApplication.id}`} className="btn btn-secondary" style={{ width: '100%' }}>View my application</Link>
      </>
    );
  } else if (opp.isClosed) {
    action = <button type="button" className="btn btn-secondary" style={{ width: '100%' }} disabled>Applications closed</button>;
  } else {
    action = (
      <>
        <Link to={`/apply/${opp.id}`} className="btn btn-primary btn-lg" style={{ width: '100%' }}>Apply now</Link>
        {sourceLink}
        {!isAuthenticated && <p className="apply__hint">You will be asked to log in first.</p>}
      </>
    );
  }

  const facts = [
    opp.location && { icon: MapPin, label: 'Location', value: opp.location },
    opp.workMode && { icon: MapPin, label: 'Work mode', value: opp.workMode },
    opp.duration && { icon: Clock, label: 'Duration', value: opp.duration },
    opp.stipend && { icon: Banknote, label: 'Stipend', value: opp.stipend },
    deadline && { icon: Calendar, label: 'Deadline', value: deadline },
  ].filter(Boolean);

  return (
    <div className="page-enter">
      <section className={`dhero dhero--${tone(opp.type)}`}>
        <div className="container">
          <Link to="/opportunities" className="dhero__back"><ArrowLeft size={16} aria-hidden="true" /> Back to Opportunities</Link>
          <div className="dhero__tags">
            <span className="badge badge-teal">{opp.type}</span>
            <span className="badge badge-amber">{opp.category}</span>
            {opp.scope === 'International' && <span className="badge dhero__tag">Open to Ethiopians abroad</span>}
            {opp.workMode && <span className="badge badge-stone">{opp.workMode}</span>}
            {appliedStatus && <span className="badge badge-teal">{appliedStatus}</span>}
            {opp.isClosed && <span className="badge badge-stone">Closed</span>}
            {opp.tags?.map((t) => <span key={t} className="badge dhero__tag">{t}</span>)}
          </div>
          <h1>{opp.title}</h1>
          <p className="dhero__org">{opp.company}{opp.organization?.isVerified && <span className="verified"><BadgeCheck size={16} aria-hidden="true" /> Verified organisation</span>}</p>
          {facts.length > 0 && (
            <dl className="facts">
              {facts.map(({ icon: Icon, label, value }) => (
                <div key={label}><dt><Icon size={15} aria-hidden="true" /> {label}</dt><dd>{value}</dd></div>
              ))}
            </dl>
          )}
        </div>
      </section>

      <div className="container detail">
        <div className="detail__main">
          <SampleNotice what="opportunity details" />
          <section className="prose-card">
            <h2>About this opportunity</h2>
            <p className="pre-wrap">{opp.description}</p>
          </section>

          {(opp.eligibleUniversities?.length > 0 || opp.eligibleFields?.length > 0 || opp.eligibleYears?.length > 0 || opp.skills?.length > 0) && (
            <section className="prose-card">
              <h2>Who it is for</h2>
              <dl className="eligible">
                {opp.eligibleYears?.length > 0 && <div><dt>Years of study</dt><dd>{opp.eligibleYears.join(', ')}</dd></div>}
                {opp.eligibleFields?.length > 0 && <div><dt>Fields of study</dt><dd>{opp.eligibleFields.join(', ')}</dd></div>}
                {opp.eligibleUniversities?.length > 0 && <div><dt>Universities</dt><dd>{opp.eligibleUniversities.join(', ')}</dd></div>}
                {opp.skills?.length > 0 && <div><dt>Useful skills</dt><dd>{opp.skills.join(', ')}</dd></div>}
              </dl>
            </section>
          )}

          {opp.requirements?.length > 0 && (
            <section className="prose-card">
              <h2>Eligibility and requirements</h2>
              <ul className="ticks">
                {opp.requirements.map((req) => (
                  <li key={req}><CheckCircle2 size={18} aria-hidden="true" />{req}</li>
                ))}
              </ul>
              {opp.sourceUrl && <p className="prose-note">Requirements can change. Check the <a href={opp.sourceUrl} target="_blank" rel="noopener noreferrer">official source</a> before you apply.</p>}
            </section>
          )}

          {opp.organization && (
            <section className="prose-card">
              <h2>About the organisation</h2>
              <p><strong>{opp.organization.name}</strong>{opp.organization.isVerified ? ' (verified)' : ''}</p>
              {opp.organization.website && <p className="prose-note"><a href={opp.organization.website} target="_blank" rel="noopener noreferrer">{opp.organization.website}</a></p>}
            </section>
          )}
        </div>

        <aside className="detail__side">
          <div className="apply">
            <p className={`apply__status apply__status--${d.tone}`}>{d.label}</p>
            <h3>{opp.company}</h3>
            {opp.location && <p className="apply__loc">{opp.location}</p>}
            {action}
            {user?.role === 'student' && (
              <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }} onClick={toggleSave} disabled={saving}>
                {saving ? 'Saving...' : opp.saved ? 'Unsave opportunity' : 'Save opportunity'}
              </button>
            )}
            {saveError && <p className="apply__hint">{saveError}</p>}
            {deadline && <p className="apply__hint">Application deadline: {deadline}</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
