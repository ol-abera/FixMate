import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentUser, updateProfile } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { YEARS_OF_STUDY } from '../config';
import LoadingSpinner from '../components/LoadingSpinner';
import FieldError from '../components/FieldError';
import Alert from '../components/Alert';
import ErrorState from '../components/ErrorState';

const PHONE_RE = /^[+\d\s()-]{0,20}$/;
const EMPTY = { fullName: '', email: '', university: '', yearOfStudy: '', field: '', phone: '', bio: '', skills: '' };

const toForm = (u) => ({
  fullName: u.fullName || '', email: u.email || '', university: u.university || '',
  yearOfStudy: u.yearOfStudy || '', field: u.field || '', phone: u.phone || '', bio: u.bio || '',
  skills: (u.skills || []).join(', '),
});

function validate(form, isOrg) {
  const errs = {};
  if (form.fullName.trim().length < 2) errs.fullName = 'Enter your full name.';
  if (!isOrg && form.university.trim().length < 2) errs.university = 'Enter your university.';
  if (!PHONE_RE.test(form.phone.trim())) errs.phone = 'Phone can only contain digits, spaces, + ( ) and -.';
  if (form.field.length > 100) errs.field = 'Field of study must be 100 characters or fewer.';
  if (form.bio.length > 500) errs.bio = 'Bio must be 500 characters or fewer.';
  const skills = form.skills.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
  if (skills.length > 15 || skills.some((x) => x.length > 40)) errs.skills = 'Add up to 15 skills, each 40 characters or fewer.';
  return errs;
}

export default function Profile() {
  const { user: me, updateUser } = useAuth();
  const isOrg = me?.role === 'organization';
  const isStudent = me?.role === 'student';
  const [form, setForm] = useState(EMPTY);
  const [memberSince, setMemberSince] = useState('');
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // Always load the profile from the server (the database), not from a cached copy.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    getCurrentUser()
      .then(({ user }) => {
        if (cancelled) return;
        setForm(toForm(user));
        setMemberSince(user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '');
      })
      .catch((err) => { if (!cancelled) setLoadError(err.message || 'Could not load your profile.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setSaved(false);
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;
    setError(''); setSaved(false);
    const found = validate(form, isOrg);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      const { user } = await updateProfile(isOrg
        ? { fullName: form.fullName, phone: form.phone, bio: form.bio }
        : {
          fullName: form.fullName, university: form.university, yearOfStudy: form.yearOfStudy,
          field: form.field, phone: form.phone, bio: form.bio,
          ...(isStudent ? { skills: form.skills.split(/[\n,]/).map((x) => x.trim()).filter(Boolean) } : {}),
        });
      setForm(toForm(user)); // show exactly what the database now holds
      updateUser(user);       // the navbar greeting updates immediately
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Could not save your profile.');
      if (err.fieldErrors) setErrors((prev) => ({ ...prev, ...err.fieldErrors }));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner size="lg" text="Loading your profile..." />;
  if (loadError) {
    return (
      <div style={{ padding: '3rem 0' }}>
        <ErrorState title="Could not load your profile" message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ padding: '2rem 0 4rem' }}>
      <div className="container" style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: '1.6rem', marginBottom: 4 }}>My profile</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Keep your details up to date: they pre-fill your applications.{memberSince && ` Member since ${memberSince}.`}
        </p>
        <form onSubmit={handleSubmit} className="card" style={{ padding: '1.5rem' }} noValidate>
          <Alert>{error}</Alert>
          <Alert type="success">{saved ? 'Your profile has been saved.' : ''}</Alert>

          <div style={{ marginBottom: 14 }}>
            <label className="label" htmlFor="fullName">Full name</label>
            <input id="fullName" name="fullName" className="input" value={form.fullName} onChange={handleChange} autoComplete="name" />
            <FieldError message={errors.fullName} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" className="input" value={form.email} disabled aria-describedby="email-note" />
            <p id="email-note" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Your email is your login and cannot be changed here.</p>
          </div>
          {isOrg && (
            <p className="muted-box" style={{ marginBottom: 14 }}>This is your personal contact account. Your organisation's public details are on the <Link to="/organization/profile" style={{ textDecoration: 'underline' }}>organisation profile</Link> page.</p>
          )}
          {!isOrg && <div className="profile-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label className="label" htmlFor="university">University</label>
              <input id="university" name="university" className="input" value={form.university} onChange={handleChange} />
              <FieldError message={errors.university} />
            </div>
            <div>
              <label className="label" htmlFor="yearOfStudy">Year of study</label>
              <select id="yearOfStudy" name="yearOfStudy" className="input" value={form.yearOfStudy} onChange={handleChange}>
                <option value="">Select...</option>
                {YEARS_OF_STUDY.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>}
          {!isOrg && <div style={{ marginBottom: 14 }}>
            <label className="label" htmlFor="field">Field of study (department)</label>
            <input id="field" name="field" className="input" value={form.field} onChange={handleChange} placeholder="e.g. Software Engineering" />
            <FieldError message={errors.field} />
          </div>}
          {isStudent && (
            <div style={{ marginBottom: 14 }}>
              <label className="label" htmlFor="skills">Skills</label>
              <input id="skills" name="skills" className="input" value={form.skills} onChange={handleChange} placeholder="e.g. Python, SQL, Figma (separate with commas)" />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Used to recommend opportunities that fit you. Up to 15 skills.</p>
              <FieldError message={errors.skills} />
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <label className="label" htmlFor="phone">Phone</label>
            <input id="phone" name="phone" className="input" value={form.phone} onChange={handleChange} placeholder="+251 ..." autoComplete="tel" />
            <FieldError message={errors.phone} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="label" htmlFor="bio">Short bio</label>
            <textarea id="bio" name="bio" className="input textarea" value={form.bio} onChange={handleChange} placeholder="A few sentences about your interests..." rows={3} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <FieldError message={errors.bio} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{form.bio.length} / 500</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
            <Link to="/dashboard" className="btn btn-secondary">Back to dashboard</Link>
          </div>
        </form>
      </div>
      <style>{`@media (max-width: 520px) { .profile-row { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
