import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';
import Alert from '../components/Alert';
import FieldError from '../components/FieldError';
import AuthLayout from '../components/ui/AuthLayout';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Login() {
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function check(e = email, p = password) {
    const found = {};
    if (!e.trim()) found.email = 'Enter your email address.';
    else if (!EMAIL_RE.test(e.trim())) found.email = 'Enter a valid email address.';
    if (!p) found.password = 'Enter your password.';
    return found;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (loading) return;
    setError('');
    const found = check();
    setErrors(found);
    if (Object.keys(found).length) return;
    setLoading(true);
    try {
      await login({ email: email.trim(), password });
      // GuestRoute sees the new session and redirects to the page the visitor wanted.
    } catch (err) {
      setError(err.message || 'Could not log in. Please try again.');
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back."
      lead={location.state?.from ? 'Please log in to continue.' : 'Log in to reach your dashboard, courses and applications.'}
      panelTitle="Pick up where you left off."
      panelText="Your courses, assignments and applications are waiting exactly where you left them."
      footer={<>No account yet? <Link to="/register" state={location.state}>Sign up</Link></>}
    >
      <form onSubmit={handleSubmit} noValidate className="auth__form">
        <Alert>{error}</Alert>
        <div className="auth__field">
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" value={email} placeholder="you@university.edu" autoComplete="email" aria-invalid={Boolean(errors.email) || undefined}
            onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((x) => ({ ...x, email: '' })); }}
            onBlur={() => email && setErrors((x) => ({ ...x, email: check().email || '' }))} />
          <FieldError message={errors.email} />
        </div>
        <div className="auth__field">
          <label className="label" htmlFor="password">Password</label>
          <PasswordInput id="password" name="password" value={password} placeholder="Enter your password" autoComplete="current-password" invalid={Boolean(errors.password)}
            onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((x) => ({ ...x, password: '' })); }} />
          <FieldError message={errors.password} />
        </div>
        <button type="submit" className="btn btn-primary btn-lg auth__submit" disabled={loading}>
          {loading ? <><span className="spinner spinner--btn" aria-hidden="true" /> Signing in...</> : 'Log in'}
        </button>
      </form>
    </AuthLayout>
  );
}
