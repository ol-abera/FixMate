import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, Send } from 'lucide-react';
import { askAssistant, getAssistantStatus, getProgress } from '../services/api';
import useLoad from '../hooks/useLoad';
import PageShell from '../components/PageShell';
import AsyncView from '../components/AsyncView';
import EmptyState from '../components/EmptyState';
import Alert from '../components/Alert';

const MODES = [
  { id: 'ask', label: 'Ask', hint: 'Ask a question about the course.', placeholder: 'e.g. What is the difference between a stack and a queue?' },
  { id: 'explain', label: 'Explain', hint: 'Get a simple, step-by-step explanation.', placeholder: 'e.g. Big-O notation' },
  { id: 'summarize', label: 'Summarise', hint: 'Paste your notes or reading, or summarise the course outline.', placeholder: 'Optional: what should the summary focus on?' },
  { id: 'practice', label: 'Practice', hint: 'Generate practice questions with an answer key.', placeholder: 'Topic, e.g. binary search (leave empty for the whole course)' },
];

function Chat({ courses }) {
  const [params] = useSearchParams();
  const wanted = params.get('course');
  const [courseId, setCourseId] = useState(courses.find((c) => c.id === wanted)?.id || courses[0].id);
  const [mode, setMode] = useState('ask');
  const [message, setMessage] = useState('');
  const [material, setMaterial] = useState('');
  const [useOutline, setUseOutline] = useState(false);
  const [level, setLevel] = useState('medium');
  const [count, setCount] = useState(5);
  const [turns, setTurns] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const status = useLoad(() => getAssistantStatus(), []);
  const endRef = useRef(null);
  const current = MODES.find((m) => m.id === mode);
  const enabled = status.data?.enabled !== false;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns, busy]);

  function changeCourse(id) { setCourseId(id); setTurns([]); setError(''); }

  async function send(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    const text = message.trim();
    if ((mode === 'ask' || mode === 'explain') && text.length < 3) { setError('Type your question first (at least 3 characters).'); return; }
    if (mode === 'summarize' && !material.trim() && !useOutline) { setError('Paste the text to summarise, or choose the course outline.'); return; }
    const label = mode === 'summarize' ? `Summarise${text ? `: ${text}` : material.trim() ? ' my notes' : ' the course outline'}` : mode === 'practice' ? `Practice questions${text ? `: ${text}` : ''}` : text;
    // Earlier turns give the assistant context (the server keeps no history).
    const history = turns.slice(-6).map((t) => ({ role: t.role, text: t.text }));
    setTurns((t) => [...t, { role: 'user', text: label }]);
    setBusy(true);
    try {
      const { reply } = await askAssistant({
        courseId, mode, message: text, history,
        ...(mode === 'summarize' ? { material: material.trim(), useCourseOutline: useOutline && !material.trim() } : {}),
        ...(mode === 'practice' ? { level, count: Number(count) } : {}),
      });
      setTurns((t) => [...t, { role: 'assistant', text: reply }]);
      setMessage('');
    } catch (err) {
      setError(err.message || 'The assistant could not answer.');
    } finally { setBusy(false); }
  }

  return (
    <>
      <div className="assist__bar">
        <div>
          <label className="label" htmlFor="course">Course</label>
          <select id="course" className="input" value={courseId} onChange={(e) => changeCourse(e.target.value)}>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <div role="tablist" aria-label="What do you need?" className="chips__row">
          {MODES.map((m) => (
            <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} className={`chip ${mode === m.id ? 'is-active' : ''}`} onClick={() => { setMode(m.id); setError(''); }}>{m.label}</button>
          ))}
        </div>
      </div>
      <p className="assist__hint">{current.hint}</p>

      {!enabled && <Alert type="info">The AI assistant is not set up on this server yet. The administrator needs to add an API key (see the setup notes).</Alert>}

      <div className="assist__log" aria-live="polite">
        {turns.length === 0 && <p className="assist__empty">Your conversation will appear here. The assistant only knows about the course you choose, and it can make mistakes: check important facts with your instructor.</p>}
        {turns.map((t, i) => (
          <div key={i} className={`bubble bubble--${t.role}`}>
            <span className="bubble__who">{t.role === 'user' ? 'You' : 'Assistant'}</span>
            <p className="pre-wrap">{t.text}</p>
          </div>
        ))}
        {busy && <div className="bubble bubble--assistant"><span className="bubble__who">Assistant</span><p>Thinking…</p></div>}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="assist__form" noValidate>
        <Alert>{error}</Alert>
        {mode === 'summarize' && (
          <div style={{ marginBottom: 10 }}>
            <label className="label" htmlFor="material">Text to summarise</label>
            <textarea id="material" className="input textarea" rows={5} maxLength={8000} value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Paste your notes or a passage from your reading (up to 8,000 characters)" />
            <label className="assist__check"><input type="checkbox" checked={useOutline} onChange={(e) => setUseOutline(e.target.checked)} /> No text? Summarise the course outline instead</label>
          </div>
        )}
        {mode === 'practice' && (
          <div className="assist__opts">
            <div>
              <label className="label" htmlFor="level">Difficulty</label>
              <select id="level" className="input" value={level} onChange={(e) => setLevel(e.target.value)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>
            </div>
            <div>
              <label className="label" htmlFor="count">Questions</label>
              <select id="count" className="input" value={count} onChange={(e) => setCount(e.target.value)}>{[3, 5, 8, 10].map((n) => <option key={n}>{n}</option>)}</select>
            </div>
          </div>
        )}
        <div className="assist__send">
          <input className="input" aria-label={current.label} value={message} maxLength={2000} onChange={(e) => setMessage(e.target.value)} placeholder={current.placeholder} />
          <button type="submit" className="btn btn-primary" disabled={busy || !enabled}><Send size={16} aria-hidden="true" /> {busy ? 'Sending…' : 'Send'}</button>
        </div>
      </form>
    </>
  );
}

export default function Assistant() {
  const state = useLoad(() => getProgress().then((r) => r.data.courses));
  return (
    <PageShell title="AI learning assistant" subtitle="Ask about your courses, get explanations, summarise your notes and practise." maxWidth={820}>
      <AsyncView state={state} loadingText="Loading your courses...">
        {(courses) => courses.length === 0 ? (
          <EmptyState icon={BookOpen} title="Enrol in a course first" description="The assistant helps with the courses you are enrolled in." action={<Link to="/courses" className="btn btn-primary btn-sm">Browse courses</Link>} />
        ) : <Chat courses={courses} />}
      </AsyncView>
    </PageShell>
  );
}
