import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOrganizationProfile, saveOrganizationProfile } from '../services/api';
import PageShell from '../components/PageShell';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import FieldError from '../components/FieldError';
import Alert from '../components/Alert';

const EMPTY = { name: '', orgType: '', website: '', location: '', description: '', contactEmail: '' };
const ORG_TYPES = ['Company', 'Non-profit', 'Government', 'University', 'Foundation', 'Other'];

// An organisation's public profile: shown to students on the listings it publishes.
export default function OrganizationProfile() {
  const [form, setForm] = useState(EMPTY);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setLoadError('');
    getOrganizationProfile()
      .then(({ data }) => { if (cancelled) return; if (data) { setForm({ ...EMPTY, ...data }); setVerified(data.isVerified); } })
      .catch((err) => { if (!cancelled) setLoadError(err.message || 'Could not load your organisation profile.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const change = (e) => { setForm((p) => ({ ...p, [e.target.name]: e.target.value })); setErrors((p) => ({ ...p, [e.target.name]: '' })); setSaved(false); };

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setError(''); setSaved(false);
    const found = {};
    if (form.name.trim().length < 2) found.name = 'Enter your organisation name.';
    if (form.website && !/^https?:\/\/\S+$/i.test(form.website.trim())) found.website = 'Enter a full link starting with http:// or https://';
    if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.contactEmail.trim())) found.contactEmail = 'Enter a valid email address.';
    if (form.description.length > 1000) found.description = 'Description must be 1000 characters or fewer.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const { data } = await saveOrganizationProfile(form);
      setForm({ ...EMPTY, ...data }); setVerified(data.isVerified); setSaved(true);
    } catch (err) {
      setError(err.message || 'Could not save.'); if (err.fieldErrors) setErrors((p) => ({ ...p, ...err.fieldErrors }));
    } finally { setSaving(false); }
  }

  const field = (name, label, props = {}) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} className="input" value={form[name]} onChange={change} {...props} />
      <FieldError message={errors[name]} />
    </div>
  );

  return (
    <PageShell title="Organisation profile" subtitle="Students see these details on the opportunities you publish." back={{ to: '/organization', label: 'Dashboard' }} maxWidth={760}>
      {loading ? <LoadingSpinner size="lg" text="Loading your profile..." /> : loadError ? <ErrorState message={loadError} onRetry={() => setReloadKey((k) => k + 1)} /> : (
        <form onSubmit={submit} noValidate className="card" style={{ padding: '1.5rem' }}>
          <Alert>{error}</Alert>
          <Alert type="success">{saved ? 'Your organisation profile has been saved.' : ''}</Alert>
          <p className="muted-box" style={{ marginBottom: 14 }}>{verified ? 'Your organisation is verified.' : 'Verification is done by a CampusBridge administrator. Until then your listings show without the verified mark.'}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>
            {field('name', 'Organisation name *')}
            <div>
              <label className="label" htmlFor="orgType">Type</label>
              <select id="orgType" name="orgType" className="input" value={form.orgType} onChange={change}>
                <option value="">Select...</option>
                {ORG_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <FieldError message={errors.orgType} />
            </div>
            {field('website', 'Website', { placeholder: 'https://', type: 'url' })}
            {field('location', 'Location', { placeholder: 'e.g. Addis Ababa' })}
            {field('contactEmail', 'Contact email', { type: 'email' })}
          </div>
          <div style={{ marginBottom: 18 }}>
            <label className="label" htmlFor="description">About the organisation</label>
            <textarea id="description" name="description" className="input textarea" rows={5} value={form.description} onChange={change} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <FieldError message={errors.description} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{form.description.length} / 1000</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button>
            <Link to="/organization" className="btn btn-secondary">Back to dashboard</Link>
          </div>
        </form>
      )}
    </PageShell>
  );
}
