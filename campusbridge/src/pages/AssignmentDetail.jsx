import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Clock } from 'lucide-react';
import { downloadSubmissionFile, getAssignment, submitAssignment } from '../services/api';
import useLoad from '../hooks/useLoad';
import { formatDate, formatDateTime } from '../utils/format';
import PageShell from '../components/PageShell';
import AsyncView from '../components/AsyncView';
import FieldError from '../components/FieldError';
import Alert from '../components/Alert';

const MAX_FILE = 5 * 1024 * 1024;

function SubmitForm({ assignment, onDone }) {
  const existing = assignment.submission;
  const [form, setForm] = useState({ content: existing?.content || '', link: existing?.link || '' });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    const found = {};
    if (form.content.trim().length < 20) found.content = 'Your answer must be at least 20 characters.';
    if (form.link.trim() && !/^https?:\/\/\S+$/i.test(form.link.trim())) found.link = 'Enter a full link starting with http:// or https://';
    if (file && file.size > MAX_FILE) found.file = 'File must be 5 MB or smaller.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const result = await submitAssignment(assignment.id, form, file);
      onDone(result.data);
    } catch (err) {
      setError(err.message);
      if (err.fieldErrors) setErrors((p) => ({ ...p, ...err.fieldErrors }));
      if (err.status === 409) onDone();
    } finally {
      setBusy(false);
    }
  }
  const change = (e) => { setForm((p) => ({ ...p, [e.target.name]: e.target.value })); setErrors((p) => ({ ...p, [e.target.name]: '' })); };

  return (
    <form onSubmit={handleSubmit} noValidate className="card" style={{ padding: '1.5rem' }}>
      <h2 style={{ fontSize: '1.1rem', marginBottom: 12 }}>{existing ? 'Update your submission' : 'Your submission'}</h2>
      {assignment.isOverdue && <Alert type="info">The deadline has passed. This submission will be marked late.</Alert>}
      <Alert>{error}</Alert>
      <div style={{ marginBottom: 14 }}>
        <label className="label" htmlFor="content">Your answer *</label>
        <textarea id="content" name="content" className="input textarea" rows={7} value={form.content} onChange={change} placeholder="Explain what you did and what you learned..." />
        <FieldError message={errors.content} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="label" htmlFor="link">Link to your work (optional)</label>
        <input id="link" name="link" className="input" value={form.link} onChange={change} placeholder="https://github.com/you/project" />
        <FieldError message={errors.link} />
      </div>
      <div style={{ marginBottom: 18 }}>
        <label className="label" htmlFor="file">File (optional, pdf, png, jpg, txt, doc, or docx, up to 5 MB)</label>
        <input id="file" name="file" type="file" className="input" accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx" onChange={(e) => { setFile(e.target.files?.[0] || null); setErrors((p) => ({ ...p, file: '' })); }} />
        <FieldError message={errors.file} />
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Submitting...' : existing ? 'Resubmit assignment' : 'Submit assignment'}</button>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 10 }}>
        {existing ? 'You can update this until it is graded.' : 'You can update an ungraded submission later.'}
      </p>
    </form>
  );
}

function SubmittedWork({ assignment, onDownload }) {
  const submission = assignment.submission;
  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
      <h2 style={{ fontSize: '1.1rem', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
        <CheckCircle2 size={20} style={{ color: 'var(--success)' }} aria-hidden="true" /> Submitted
      </h2>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
        {formatDateTime(submission.submittedAt)}
        {submission.isLate ? ' · Late submission' : ''}
      </p>
      <p className="pre-wrap" style={{ lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: 10 }}>{submission.content}</p>
      {submission.link && <a href={submission.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600, overflowWrap: 'anywhere' }}>{submission.link}</a>}
      {submission.hasFile && (
        <p style={{ marginTop: 10 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onDownload(submission)}>{submission.fileName || 'Download file'}</button>
        </p>
      )}
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        {submission.grade === null ? (
          <span className="badge badge-warning">Awaiting grading</span>
        ) : (
          <>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{submission.grade} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {assignment.maxPoints}</span></div>
            {submission.feedback && <p style={{ marginTop: 6, color: 'var(--text-secondary)' }}><strong>Feedback:</strong> {submission.feedback}</p>}
          </>
        )}
      </div>
    </div>
  );
}

export default function AssignmentDetail() {
  const { id } = useParams();
  const state = useLoad(() => getAssignment(id).then((r) => r.data), [id]);
  const [notice, setNotice] = useState('');
  const [fileError, setFileError] = useState('');

  async function download(submission) {
    setFileError('');
    try { await downloadSubmissionFile(submission.id, submission.fileName); }
    catch (err) { setFileError(err.message); }
  }

  return (
    <AsyncView state={state} loadingText="Loading assignment...">
      {(a) => {
        const canResubmit = a.submission && a.submission.grade === null && a.allowResubmit !== false;
        return (
          <PageShell title={a.title} subtitle={a.courseTitle} maxWidth={760} back={{ to: `/courses/${a.courseId}`, label: 'Back to course' }}>
            <Alert type="success">{notice}</Alert>
            <Alert>{fileError}</Alert>
            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.25rem', fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                <span>{a.maxPoints} points</span>
                {a.dueDate && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Clock size={15} aria-hidden="true" /> Due {formatDate(a.dueDate)}{a.isOverdue ? ' (passed)' : ''}</span>}
              </div>
              <p className="pre-wrap" style={{ lineHeight: 1.7, color: 'var(--text-secondary)' }}>{a.description}</p>
            </div>

            {a.submission && <SubmittedWork assignment={a} onDownload={download} />}
            {!a.submission || canResubmit ? (
              <SubmitForm key={a.submission?.submittedAt || 'new'} assignment={a} onDone={(data) => {
                if (data) setNotice(data.isLate ? 'Your late submission was received.' : data.resubmitted ? 'Your submission was updated.' : 'Your submission was received.');
                state.reload();
              }} />
            ) : null}
          </PageShell>
        );
      }}
    </AsyncView>
  );
}
