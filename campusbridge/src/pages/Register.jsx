import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';
import FieldError from '../components/FieldError';
import Alert from '../components/Alert';
import AuthLayout from '../components/ui/AuthLayout';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Same rules as the backend (backend/src/utils/validate.js) so the student gets instant feedback.
function validate(form, isOrg) {
  const errors = {};
  if (form.fullName.trim().length < 2) errors.fullName = 'Enter your full name.';
  if (!form.email.trim()) errors.email = 'Email is required.';
  else if (!EMAIL_RE.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  if (isOrg) {
    if (form.organizationName.trim().length < 2) errors.organizationName = 'Enter your organisation name.';
  } else if (form.university.trim().length < 2) errors.university = 'Enter your university.';
  if (form.password.length < 8) errors.password = 'Password must be at least 8 characters.';
  else if (new TextEncoder().encode(form.password).length > 72) errors.password = 'Password is too long (72 bytes maximum).';
  else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) errors.password = 'Password must contain at least one letter and one number.';
  if (!form.confirmPassword) errors.confirmPassword = 'Please confirm your password.';
  else if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

export default function Register() {
  const location = useLocation();
  const { register, startSession } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', university: '', organizationName: '', password: '', confirmPassword: '' });
  const [accountType, setAccountType] = useState('student');
  const isOrg = accountType === 'organization';
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setError('');
    const found = validate(form, isOrg);
    setErrors(found);
    if (Object.keys(found).length) return;

    setLoading(true);
    try {
      const result = await register(isOrg
        ? { accountType, fullName: form.fullName.trim(), email: form.email.trim(), organizationName: form.organizationName.trim(), password: form.password }
        : { fullName: form.fullName.trim(), email: form.email.trim(), university: form.university.trim(), password: form.password });
      setSuccess(true);
      // Short pause so the student sees the success message, then log them in.
      // GuestRoute then moves them to the page they wanted (or the dashboard).
      setTimeout(() => startSession(result), 1200);
    } catch (err) {
      setError(err.message || 'Could not create your account. Please try again.');
      if (err.fieldErrors) setErrors((prev) => ({ ...prev, ...err.fieldErrors }));
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="page-enter notice-page">
        <CheckCircle2 size={48} style={{ color: 'var(--forest-mid)', marginBottom: 12 }} />
        <h1>Account created</h1>
        <p>Welcome to CampusBridge. Taking you to your dashboard...</p>
      </div>
    );
  }

  const field = (name, label, props = {}) => (
    <div className="auth__field">
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} className="input" value={form[name]} onChange={handleChange} aria-invalid={Boolean(errors[name]) || undefined} {...props} />
      <FieldError message={errors[name]} />
    </div>
  );

  const rules = [
    ['At least 8 characters', form.password.length >= 8],
    ['A letter', /[A-Za-z]/.test(form.password)],
    ['A number', /\d/.test(form.password)],
  ];

  return (
    <AuthLayout
      title="Start your journey."
      lead={isOrg ? 'Create an organisation account to publish opportunities and review applicants.' : 'Create an account to apply for opportunities, enrol in courses and track your progress.'}
      panelTitle="Your future doesn’t wait."
      panelText="Join CampusBridge to discover opportunities, build skills and keep every application in one place."
      footer={<>Already have an account? <Link to="/login" state={location.state}>Log in</Link></>}
    >
      <form onSubmit={handleSubmit} noValidate className="auth__form">
        <Alert>{error}</Alert>
        <div className="auth__field">
          <span className="label" id="account-type-label">I am signing up as</span>
          <div className="chips__row" role="group" aria-labelledby="account-type-label">
            <button type="button" className={`chip ${!isOrg ? 'is-active' : ''}`} aria-pressed={!isOrg} onClick={() => { setAccountType('student'); setErrors({}); }}>A student</button>
            <button type="button" className={`chip ${isOrg ? 'is-active' : ''}`} aria-pressed={isOrg} onClick={() => { setAccountType('organization'); setErrors({}); }}>An organisation</button>
          </div>
        </div>
        {isOrg && field('organizationName', 'Organisation name', { placeholder: 'e.g. Addis Tech Collective' })}
        {field('fullName', isOrg ? 'Contact person' : 'Full name', { placeholder: 'Abebe Kebede', autoComplete: 'name' })}
        {field('email', 'Email', { type: 'email', placeholder: 'you@university.edu', autoComplete: 'email' })}
        {!isOrg && field('university', 'University', { placeholder: 'e.g. Mizan-Tepi University' })}
        <div className="auth__field">
          <label className="label" htmlFor="password">Password</label>
          <PasswordInput id="password" name="password" value={form.password} onChange={handleChange} placeholder="8+ characters, letter and number" autoComplete="new-password" invalid={Boolean(errors.password)} />
          <FieldError message={errors.password} />
          <ul className="rules" aria-label="Password requirements">
            {rules.map(([text, ok]) => <li key={text} className={ok ? 'is-ok' : ''}><Check size={13} aria-hidden="true" />{text}</li>)}
          </ul>
        </div>
        <div className="auth__field">
          <label className="label" htmlFor="confirmPassword">Confirm password</label>
          <PasswordInput id="confirmPassword" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} placeholder="Re-enter your password" autoComplete="new-password" invalid={Boolean(errors.confirmPassword)} />
          <FieldError message={errors.confirmPassword} />
        </div>
        <button type="submit" className="btn btn-primary btn-lg auth__submit" disabled={loading}>
          {loading ? <><span className="spinner spinner--btn" aria-hidden="true" /> Creating account...</> : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}
