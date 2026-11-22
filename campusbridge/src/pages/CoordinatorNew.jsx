import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createOpportunity, getOpportunityById, updateOpportunity } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { YEARS_OF_STUDY } from '../config';
import PageShell from '../components/PageShell';
import FieldError from '../components/FieldError';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';

const TYPES = ['Internship', 'Scholarship', 'Fellowship', 'Competition', 'Research Opportunity'];
const EMPTY = {
  title: '', company: '', type: 'Internship', category: '', location: '', duration: '', stipend: '', deadline: '', description: '',
  requirements: '', tags: '', sourceUrl: '', scope: 'Ethiopia', workMode: '', eligibleUniversities: '', eligibleFields: '', eligibleYears: [], skills: '',
};
const lines = (a) => (a || []).join('\n');
const commas = (a) => (a || []).join(', ');

// One form for publishing a new opportunity and for editing one you already published (route /coordinator/opportunities/:id/edit).
export default function CoordinatorNew() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { user } = useAuth();
  const isOrg = user.role === 'organization';
  const home = isOrg ? '/organization' : '/coordinator';
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState('');

  // When editing, start from what the database holds now.
  useEffect(() => {
    if (!editing) return undefined;
    let cancelled = false;
    getOpportunityById(id)
      .then(({ data: o }) => {
        if (cancelled) return;
        setForm({
          title: o.title, company: o.company, type: o.type, category: o.category, location: o.location || '', duration: o.duration || '', stipend: o.stipend || '',
          deadline: o.deadline || '', description: o.description, requirements: lines(o.requirements), tags: lines(o.tags), sourceUrl: o.sourceUrl || '', scope: o.scope || 'Ethiopia',
          eligibleUniversities: lines(o.eligibleUniversities), eligibleFields: lines(o.eligibleFields), eligibleYears: o.eligibleYears || [], skills: commas(o.skills),
          workMode: o.workMode || '',
        });
      })
      .catch((err) => { if (!cancelled) setLoadError(err.message || 'Could not load this opportunity.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, editing]);

  const change = (e) => { setForm((p) => ({ ...p, [e.target.name]: e.target.value })); setErrors((p) => ({ ...p, [e.target.name]: '' })); };
  const toggleYear = (y) => setForm((p) => ({ ...p, eligibleYears: p.eligibleYears.includes(y) ? p.eligibleYears.filter((x) => x !== y) : [...p.eligibleYears, y] }));

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    const found = {};
    if (form.title.trim().length < 3) found.title = 'Title must be at least 3 characters.';
    if (!isOrg && form.company.trim().length < 2) found.company = 'Organisation is required.';
    if (form.category.trim().length < 2) found.category = 'Category is required (for example Technology).';
    if (!form.deadline) found.deadline = 'Deadline is required.';
    if (form.description.trim().length < 20) found.description = 'Description must be at least 20 characters.';
    if (form.sourceUrl.trim() && !/^https?:\/\/\S+$/i.test(form.sourceUrl.trim())) found.sourceUrl = 'Enter a full link starting with http:// or https://';
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      if (editing) await updateOpportunity(id, form); else await createOpportunity(form);
      navigate(home);
    } catch (err) {
      setError(err.message); if (err.fieldErrors) setErrors(err.fieldErrors);
    } finally { setBusy(false); }
  }

  const field = (name, label, props = {}) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} className="input" value={form[name]} onChange={change} {...props} />
      <FieldError message={errors[name]} />
    </div>
  );

  if (loading) return <PageShell title="Edit opportunity" back={{ to: home, label: 'My opportunities' }} maxWidth={760}><LoadingSpinner size="lg" text="Loading..." /></PageShell>;
  if (loadError) return <PageShell title="Edit opportunity" back={{ to: home, label: 'My opportunities' }} maxWidth={760}><ErrorState message={loadError} /></PageShell>;

  return (
    <PageShell
      title={editing ? 'Edit opportunity' : 'Post an opportunity'}
      subtitle={editing ? 'Changes are visible to students straight away.' : 'Students will see it on the Opportunities page straight away.'}
      back={{ to: home, label: 'My opportunities' }}
      maxWidth={760}
    >
      <form onSubmit={submit} noValidate className="card" style={{ padding: '1.5rem' }}>
        <Alert>{error}</Alert>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>
          {field('title', 'Title *')}
          {isOrg ? (
            <div>
              <label className="label" htmlFor="company">Organisation</label>
              <input id="company" className="input" value="Your organisation profile name" disabled />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Taken from your <Link to="/organization/profile" style={{ textDecoration: 'underline' }}>organisation profile</Link>.</p>
            </div>
          ) : field('company', 'Organisation *')}
          <div>
            <label className="label" htmlFor="type">Type *</label>
            <select id="type" name="type" className="input" value={form.type} onChange={change}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            <FieldError message={errors.type} />
          </div>
          {field('category', 'Category *', { placeholder: 'e.g. Technology' })}
          <div>
            <label className="label" htmlFor="scope">Where is it? *</label>
            <select id="scope" name="scope" className="input" value={form.scope} onChange={change}>
              <option value="Ethiopia">In Ethiopia</option>
              <option value="International">International (open to Ethiopians)</option>
            </select>
            <FieldError message={errors.scope} />
          </div>
          {field('location', 'Location', { placeholder: 'e.g. Jimma · On-site' })}
          <div>
            <label className="label" htmlFor="workMode">Work mode</label>
            <select id="workMode" name="workMode" className="input" value={form.workMode} onChange={change}>
              <option value="">Not specified</option>
              <option>Remote</option>
              <option>Hybrid</option>
              <option>On-site</option>
            </select>
          </div>
          {field('duration', 'Duration', { placeholder: 'e.g. 3 months' })}
          {field('stipend', 'Stipend / support', { placeholder: 'e.g. ETB 5,000/month' })}
          {field('deadline', 'Application deadline *', { type: 'date' })}
          {field('sourceUrl', 'Official source link', { type: 'url', placeholder: 'https://' })}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="label" htmlFor="description">Description *</label>
          <textarea id="description" name="description" className="input textarea" rows={5} value={form.description} onChange={change} />
          <FieldError message={errors.description} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>
          <div>
            <label className="label" htmlFor="requirements">Requirements (one per line)</label>
            <textarea id="requirements" name="requirements" className="input textarea" rows={4} value={form.requirements} onChange={change} />
            <FieldError message={errors.requirements} />
          </div>
          <div>
            <label className="label" htmlFor="tags">Tags (one per line)</label>
            <textarea id="tags" name="tags" className="input textarea" rows={4} value={form.tags} onChange={change} />
          </div>
        </div>

        <fieldset className="elig">
          <legend>Who can apply (optional)</legend>
          <p>Used to match students to your opportunity. Leave a box empty for no restriction.</p>
          <div className="label" id="years-label">Years of study</div>
          <div className="chips__row" role="group" aria-labelledby="years-label" style={{ marginBottom: 14 }}>
            {YEARS_OF_STUDY.map((y) => (
              <button key={y} type="button" className={`chip ${form.eligibleYears.includes(y) ? 'is-active' : ''}`} aria-pressed={form.eligibleYears.includes(y)} onClick={() => toggleYear(y)}>{y}</button>
            ))}
          </div>
          <FieldError message={errors.eligibleYears} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <div>
              <label className="label" htmlFor="eligibleFields">Fields of study (one per line)</label>
              <textarea id="eligibleFields" name="eligibleFields" className="input textarea" rows={3} value={form.eligibleFields} onChange={change} placeholder={'Computer Science\nSoftware Engineering'} />
            </div>
            <div>
              <label className="label" htmlFor="eligibleUniversities">Universities (one per line)</label>
              <textarea id="eligibleUniversities" name="eligibleUniversities" className="input textarea" rows={3} value={form.eligibleUniversities} onChange={change} placeholder="Leave empty for all universities" />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <label className="label" htmlFor="skills">Useful skills (separate with commas)</label>
            <input id="skills" name="skills" className="input" value={form.skills} onChange={change} placeholder="e.g. Python, SQL, Figma" />
            <FieldError message={errors.skills} />
          </div>
        </fieldset>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : editing ? 'Save changes' : 'Post opportunity'}</button>
          <Link to={home} className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </PageShell>
  );
}
