// API tests for the opportunity hub, organisation role, matching and the AI assistant.
// Starts its own API against your PostgreSQL database and a FAKE LLM server (no real AI key is used or needed).
// Needs the demo accounts: set SEED_DEMO_ACCOUNTS=true in backend/.env (the tests skip themselves otherwise).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { config } from '../src/config.js';
import { pool, initializeDatabase } from '../src/db/index.js';
import { createApp } from '../src/app.js';
import { DEMO_PASSWORD } from '../src/data/learning.js';

const skip = !config.seedDemoAccounts && 'set SEED_DEMO_ACCOUNTS=true in backend/.env to run these tests';
const stamp = Date.now();
const PASSWORD = 'TestPass123';
const FAKE_KEY = 'sk-test-SECRET-KEY-123';
let API; let server; let fake; let llmCalls = []; let llmMode = 'ok';
let org; let org2; let student; let demoStudent; let coordinator; let oppId;

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: await res.json().catch(() => ({})), text: null };
}
const login = async (email, password = DEMO_PASSWORD) => (await call('/auth/login', { method: 'POST', body: { email, password } })).body;
async function newOrg(label) {
  const email = `${label}.${stamp}@test.campusbridge.local`;
  const r = await call('/auth/register', { method: 'POST', body: { accountType: 'organization', fullName: `Test Contact ${label}`, email, organizationName: `ZZ Hub Org ${label}`, password: PASSWORD } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { token: r.body.token, id: r.body.user.id, user: r.body.user };
}
async function newStudent(label, extra = {}) {
  const email = `${label}.${stamp}@test.campusbridge.local`;
  const r = await call('/auth/register', { method: 'POST', body: { fullName: `Test Learner ${label}`, email, university: 'Test University', password: PASSWORD } });
  assert.equal(r.status, 201);
  if (Object.keys(extra).length) assert.equal((await call('/auth/me', { method: 'PATCH', token: r.body.token, body: extra })).status, 200);
  return { token: r.body.token, id: r.body.user.id };
}
const futureDate = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const oppBody = (over = {}) => ({
  title: 'ZZ Hub Python Fellowship', type: 'Fellowship', category: 'Technology', location: 'Addis Ababa', duration: '3 months', stipend: 'ETB 5,000',
  deadline: futureDate(30), description: 'A test fellowship for people who like Python and data work.', requirements: ['Enrolled student'], tags: ['Python'],
  sourceUrl: 'https://example.org/fellowship', scope: 'Ethiopia', eligibleFields: ['Software Engineering'], eligibleYears: ['3rd Year'], skills: ['Python', 'SQL'], ...over
});

before(async () => {
  if (skip) return;
  await initializeDatabase();
  // A fake AI provider that records what the server sends it.
  await new Promise((resolve) => {
    fake = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        llmCalls.push({ url: req.url, headers: req.headers, body: JSON.parse(raw || '{}') });
        if (llmMode === 'error') { res.writeHead(500); return res.end('{"error":"boom SECRET-DETAIL"}'); }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ content: [{ type: 'text', text: 'A stack is a last-in, first-out structure.' }] }));
      });
    }).listen(0, '127.0.0.1', resolve);
  });
  Object.assign(config.llm, { provider: 'anthropic', apiKey: FAKE_KEY, baseUrl: `http://127.0.0.1:${fake.address().port}`, model: 'test-model', timeoutMs: 5000 });
  await new Promise((resolve) => { server = createApp().listen(0, '127.0.0.1', resolve); });
  API = `http://127.0.0.1:${server.address().port}/api`;
  coordinator = await login('coordinator@demo.campusbridge.local');
  demoStudent = await login('student@demo.campusbridge.local');
  org = await newOrg('org1');
  org2 = await newOrg('org2');
  student = await newStudent('hubstu', { field: 'Software Engineering', yearOfStudy: '3rd Year', skills: ['Python', 'SQL'] });
});

after(async () => {
  if (skip) return;
  await pool.query(`DELETE FROM notifications WHERE message LIKE '%Test Learner%' OR message LIKE '%ZZ Hub%'`).catch(() => {});
  await pool.query(`DELETE FROM applications WHERE position_title LIKE 'ZZ Hub%'`).catch(() => {});
  await pool.query(`DELETE FROM opportunities WHERE title LIKE 'ZZ Hub%'`).catch(() => {});
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%.${stamp}@test.campusbridge.local`]).catch(() => {});
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => fake.close(resolve));
  await pool.end();
});

// ───────────────────────── 1. Opportunity hub ─────────────────────────
test('hub: new types, official links and eligibility are in the catalogue and filters', { skip }, async () => {
  const meta = (await call('/meta/filters')).body;
  assert.ok(meta.opportunityTypes.includes('Fellowship') && meta.opportunityTypes.includes('Competition'));
  const comp = (await call('/opportunities?type=Competition')).body;
  assert.ok(comp.total >= 2 && comp.data.every((o) => o.type === 'Competition'));
  const real = comp.data.find((o) => o.sourceUrl);
  assert.ok(real && /^https:\/\//.test(real.sourceUrl), 'a listing carries its official source link');
  const intl = (await call('/opportunities?scope=International')).body;
  assert.ok(intl.total >= 1 && intl.data.every((o) => o.scope === 'International'));
  assert.ok((await call('/opportunities?search=Python')).body.total >= 1, 'search looks at skills too');
  const detail = (await call(`/opportunities/${comp.data[0].id}`)).body.data;
  assert.ok(Array.isArray(detail.eligibleFields) && Array.isArray(detail.eligibleYears) && Array.isArray(detail.eligibleUniversities));
});

test('hub: deadline filters (open / closing soon) work', { skip }, async () => {
  const created = await call('/opportunities', { method: 'POST', token: org.token, body: oppBody({ title: 'ZZ Hub Soon', deadline: futureDate(5) }) });
  assert.equal(created.status, 201);
  const soon = (await call('/opportunities?deadline=soon')).body;
  assert.ok(soon.data.some((o) => o.title === 'ZZ Hub Soon'));
  assert.ok(soon.data.every((o) => o.deadline && !o.isClosed));
  const open = (await call('/opportunities?deadline=open')).body;
  assert.ok(open.data.every((o) => !o.isClosed));
});

// ───────────────────────── 2. Organisation role ─────────────────────────
test('org: sign-up creates an organisation account with a profile; public sign-up cannot make staff', { skip }, async () => {
  assert.equal(org.user.role, 'organization');
  assert.equal(JSON.stringify(org.user).includes('password'), false);
  const profile = (await call('/organization/profile', { token: org.token })).body.data;
  assert.equal(profile.name, 'ZZ Hub Org org1');
  assert.equal(profile.isVerified, false);
  const sneaky = await call('/auth/register', { method: 'POST', body: { accountType: 'coordinator', fullName: 'Sneaky Test Learner', email: `sneaky.${stamp}@test.campusbridge.local`, university: 'Test University', password: PASSWORD } });
  assert.equal(sneaky.body.user.role, 'student');
  const noName = await call('/auth/register', { method: 'POST', body: { accountType: 'organization', fullName: 'No Name', email: `noname.${stamp}@test.campusbridge.local`, password: PASSWORD } });
  assert.equal(noName.status, 400);
});

test('org: profile can be edited, cannot self-verify, and renames flow to its listings', { skip }, async () => {
  const put = await call('/organization/profile', { method: 'PUT', token: org.token, body: { name: 'ZZ Hub Org org1', orgType: 'NGO', website: 'https://example.org', location: 'Addis Ababa', description: 'We run programmes.', contactEmail: 'hello@example.org', isVerified: true } });
  assert.equal(put.status, 200);
  assert.equal(put.body.data.isVerified, false, 'is_verified cannot be set by the organisation');
  assert.equal((await call('/organization/profile', { method: 'PUT', token: org.token, body: { name: 'Z' } })).status, 400);
  assert.equal((await call('/organization/profile', { method: 'PUT', token: org.token, body: { name: 'Fine Org', website: 'javascript:1' } })).status, 400);
  assert.equal((await call('/organization/profile', { token: student.token })).status, 403);
  assert.equal((await call('/organization/profile')).status, 401);
});

test('org: publish, edit own listing; company is forced to the profile name; others cannot touch it', { skip }, async () => {
  assert.equal((await call('/opportunities', { method: 'POST', token: student.token, body: oppBody() })).status, 403, 'students cannot publish');
  const bad = await call('/opportunities', { method: 'POST', token: org.token, body: oppBody({ sourceUrl: 'javascript:alert(1)' }) });
  assert.equal(bad.status, 400);
  assert.equal((await call('/opportunities', { method: 'POST', token: org.token, body: oppBody({ deadline: '2000-01-01' }) })).status, 400);

  const created = await call('/opportunities', { method: 'POST', token: org.token, body: oppBody({ company: 'Someone Else Ltd' }) });
  assert.equal(created.status, 201);
  oppId = created.body.data.id;
  const shown = (await call(`/opportunities/${oppId}`)).body.data;
  assert.equal(shown.company, 'ZZ Hub Org org1', 'an organisation cannot publish under another name');
  assert.equal(shown.organization.name, 'ZZ Hub Org org1');
  assert.equal(shown.organization.isVerified, false);
  assert.equal(shown.sourceUrl, 'https://example.org/fellowship');

  assert.equal((await call(`/opportunities/${oppId}`, { method: 'PATCH', token: org2.token, body: oppBody() })).status, 403, 'another organisation cannot edit it');
  assert.equal((await call(`/opportunities/${oppId}`, { method: 'PATCH', token: coordinator.token, body: oppBody() })).status, 403, 'a coordinator cannot edit it');
  assert.equal((await call(`/opportunities/${oppId}`, { method: 'PATCH', token: student.token, body: oppBody() })).status, 403);
  assert.equal((await call(`/opportunities/${oppId}`, { method: 'PATCH', body: oppBody() })).status, 401);
  assert.equal((await call('/opportunities/does-not-exist', { method: 'PATCH', token: org.token, body: oppBody() })).status, 404);
  assert.equal((await call(`/opportunities/${oppId}`, { method: 'PATCH', token: org.token, body: oppBody({ title: 'x' }) })).status, 400, 'edits are validated');

  const edit = await call(`/opportunities/${oppId}`, { method: 'PATCH', token: org.token, body: oppBody({ title: 'ZZ Hub Python Fellowship v2', stipend: 'ETB 9,000' }) });
  assert.equal(edit.status, 200);
  const after = (await call(`/opportunities/${oppId}`)).body.data;
  assert.equal(after.title, 'ZZ Hub Python Fellowship v2');
  assert.equal(after.stipend, 'ETB 9,000');
  const mine = (await call('/coordinator/opportunities', { token: org.token })).body.data;
  assert.ok(mine.some((o) => o.id === oppId));
  assert.equal((await call('/coordinator/opportunities', { token: org2.token })).body.data.some((o) => o.id === oppId), false, 'organisations only see their own listings');
});

test('org: an old deadline can stay unchanged when editing, but a new past date is refused', { skip }, async () => {
  await pool.query(`UPDATE opportunities SET deadline = CURRENT_DATE - 10 WHERE id = $1`, [oppId]);
  const old = (await call(`/opportunities/${oppId}`)).body.data.deadline;
  assert.equal((await call(`/opportunities/${oppId}`, { method: 'PATCH', token: org.token, body: oppBody({ title: 'ZZ Hub Python Fellowship v2', deadline: old }) })).status, 200);
  assert.equal((await call(`/opportunities/${oppId}`, { method: 'PATCH', token: org.token, body: oppBody({ deadline: '2001-01-01' }) })).status, 400);
  await pool.query(`UPDATE opportunities SET deadline = CURRENT_DATE + 30 WHERE id = $1`, [oppId]);
});

test('org: sees applicants, manages statuses, and only for its own listings; student is notified', { skip }, async () => {
  const app = await call('/applications', { method: 'POST', token: student.token, body: { opportunityId: oppId, fullName: 'Test Learner hubstu', email: `hubstu.${stamp}@test.campusbridge.local`, university: 'Test University', yearOfStudy: '3rd Year', coverLetter: 'I would like to join this fellowship because I enjoy Python and want to grow my data skills.' } });
  assert.equal(app.status, 201, JSON.stringify(app.body));
  const appId = app.body.data.id;

  const list = await call(`/opportunities/${oppId}/applications`, { token: org.token });
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 1);
  assert.equal(list.body.data[0].field, 'Software Engineering');
  assert.deepEqual(list.body.data[0].skills, ['Python', 'SQL']);
  assert.equal((await call(`/opportunities/${oppId}/applications`, { token: org2.token })).status, 403);
  assert.equal((await call(`/opportunities/${oppId}/applications`, { token: student.token })).status, 403);

  assert.equal((await call(`/applications/${appId}/status`, { method: 'PATCH', token: org2.token, body: { status: 'Accepted' } })).status, 404, 'another organisation cannot change it');
  assert.equal((await call(`/applications/${appId}/status`, { method: 'PATCH', token: student.token, body: { status: 'Accepted' } })).status, 403);
  assert.equal((await call(`/applications/${appId}/status`, { method: 'PATCH', token: org.token, body: { status: 'Hired' } })).status, 400);
  assert.equal((await call(`/applications/${appId}/status`, { method: 'PATCH', token: org.token, body: { status: 'Accepted' } })).status, 200);
  assert.equal((await call(`/applications/${appId}`, { token: student.token })).body.data.status, 'Accepted');
  const notes = (await call('/notifications', { token: student.token })).body.data;
  assert.ok(notes.some((n) => n.message.includes('Accepted')));
  const orgNotes = (await call('/notifications', { token: org.token })).body.data;
  assert.ok(orgNotes.some((n) => n.type === 'application'), 'the organisation is told about new applicants');
});

test('org: the existing coordinator role still works exactly as before', { skip }, async () => {
  const mine = await call('/coordinator/opportunities', { token: coordinator.token });
  assert.equal(mine.status, 200);
  assert.ok(mine.body.data.length >= 1);
  const created = await call('/opportunities', { method: 'POST', token: coordinator.token, body: oppBody({ title: 'ZZ Hub Coordinator Post', company: 'Coordinator Org' }) });
  assert.equal(created.status, 201);
  assert.equal((await call(`/opportunities/${created.body.data.id}`)).body.data.company, 'Coordinator Org');
});

// ───────────────────────── 3. Matching ─────────────────────────
test('matching: recommends open listings with reasons; excludes applied and ineligible ones', { skip }, async () => {
  const r = await call('/recommendations', { token: demoStudent.token });
  assert.equal(r.status, 200);
  assert.ok(r.body.data.length >= 1);
  for (const o of r.body.data) {
    assert.ok(o.match.score >= 20 && o.match.score <= 100);
    assert.ok(o.match.reasons.length >= 1, 'every recommendation explains itself');
    assert.equal(o.isClosed, false);
  }
  const scores = r.body.data.map((o) => o.match.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a), 'best match first');
  assert.ok(r.body.data[0].match.matchedSkills.length >= 0);

  // The listing restricted to 3rd-year Software Engineering students is recommended to our test student …
  const mine = (await call('/recommendations', { token: student.token })).body;
  const hit = mine.data.find((o) => o.id === oppId);
  assert.equal(hit, undefined, 'already applied, so not recommended again');
  await call('/opportunities', { method: 'POST', token: org.token, body: oppBody({ title: 'ZZ Hub Second Fellowship' }) });
  const again = (await call('/recommendations', { token: student.token })).body.data.find((o) => o.title === 'ZZ Hub Second Fellowship');
  assert.ok(again && again.match.reasons.some((x) => x.includes('Python')));
  // … but not to a 1st-year student.
  const fresher = await newStudent('fresher', { field: 'Software Engineering', yearOfStudy: '1st Year', skills: ['Python'] });
  assert.equal((await call('/recommendations', { token: fresher.token })).body.data.some((o) => o.title === 'ZZ Hub Second Fellowship'), false);
});

test('matching: only students can ask; an empty profile gets hints, not an error', { skip }, async () => {
  assert.equal((await call('/recommendations')).status, 401);
  assert.equal((await call('/recommendations', { token: org.token })).status, 403);
  assert.equal((await call('/recommendations', { token: coordinator.token })).status, 403);
  const blank = await newStudent('blank');
  const r = await call('/recommendations', { token: blank.token });
  assert.equal(r.status, 200);
  assert.ok(r.body.missingProfile.includes('skills') && r.body.missingProfile.includes('field of study'));
});

// ───────────────────────── 4. AI assistant ─────────────────────────
test('assistant: needs a login and the student role; status never exposes the key', { skip }, async () => {
  assert.equal((await call('/assistant/status')).status, 401);
  assert.equal((await call('/assistant/status', { token: org.token })).status, 403);
  const s = await call('/assistant/status', { token: student.token });
  assert.deepEqual(s.body, { enabled: true });
  assert.equal((await call('/assistant/chat', { method: 'POST', body: { courseId: 'c1', mode: 'ask', message: 'hello there' } })).status, 401);
  assert.equal((await call('/assistant/chat', { method: 'POST', token: org.token, body: { courseId: 'c1', mode: 'ask', message: 'hello there' } })).status, 403);
});

test('assistant: validates input and requires enrolment in the course', { skip }, async () => {
  const bad = await call('/assistant/chat', { method: 'POST', token: student.token, body: { courseId: 'c1', mode: 'ask', message: '' } });
  assert.equal(bad.status, 400);
  assert.equal((await call('/assistant/chat', { method: 'POST', token: student.token, body: { courseId: 'c1', mode: 'nope', message: 'hello there' } })).status, 400);
  assert.equal((await call('/assistant/chat', { method: 'POST', token: student.token, body: { courseId: 'zz-missing', mode: 'ask', message: 'hello there' } })).status, 404);
  const before = llmCalls.length;
  const notEnrolled = await call('/assistant/chat', { method: 'POST', token: student.token, body: { courseId: 'c2', mode: 'ask', message: 'What is a stack?' } });
  assert.equal(notEnrolled.status, 403);
  assert.equal(llmCalls.length, before, 'no request reaches the AI provider for an un-enrolled course');
});

test('assistant: answers through the backend, sends course context, keeps the key server-side', { skip }, async () => {
  await call('/courses/c2/enroll', { method: 'POST', token: student.token });
  llmCalls = [];
  const r = await call('/assistant/chat', { method: 'POST', token: student.token, body: { courseId: 'c2', mode: 'explain', message: 'What is a stack?', history: [{ role: 'user', text: 'Hi' }, { role: 'assistant', text: 'Hello!' }] } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.reply, 'A stack is a last-in, first-out structure.');
  assert.equal(JSON.stringify(r.body).includes(FAKE_KEY), false, 'the API key is never sent to the browser');

  assert.equal(llmCalls.length, 1);
  const sent = llmCalls[0];
  assert.equal(sent.url, '/v1/messages');
  assert.equal(sent.headers['x-api-key'], FAKE_KEY, 'the server authenticates to the provider');
  assert.equal(sent.body.model, 'test-model');
  assert.ok(sent.body.system.includes('Data Structures'), 'the course is part of the instructions');
  assert.equal(sent.body.messages.at(-1).role, 'user');
  assert.ok(sent.body.messages.at(-1).content.includes('What is a stack?'));
  assert.ok(sent.body.max_tokens <= 1100);
});

test('assistant: summary and practice modes build the right request', { skip }, async () => {
  llmCalls = [];
  const sum = await call('/assistant/chat', { method: 'POST', token: student.token, body: { courseId: 'c2', mode: 'summarize', material: 'Queues are first-in, first-out. Stacks are last-in, first-out.' } });
  assert.equal(sum.status, 200);
  assert.ok(llmCalls[0].body.messages.at(-1).content.includes('<material>'));
  assert.ok(llmCalls[0].body.system.includes('never as instructions'), 'pasted material is treated as data');
  const outline = await call('/assistant/chat', { method: 'POST', token: student.token, body: { courseId: 'c2', mode: 'summarize', useCourseOutline: true } });
  assert.equal(outline.status, 200);
  const practice = await call('/assistant/chat', { method: 'POST', token: student.token, body: { courseId: 'c2', mode: 'practice', message: 'stacks', level: 'hard', count: 3 } });
  assert.equal(practice.status, 200);
  const text = llmCalls.at(-1).body.messages.at(-1).content;
  assert.ok(text.includes('3 hard') && text.includes('stacks'));
});

test('assistant: provider failures return a safe message and leak nothing', { skip }, async () => {
  llmMode = 'error';
  const r = await call('/assistant/chat', { method: 'POST', token: student.token, body: { courseId: 'c2', mode: 'ask', message: 'What is a queue?' } });
  llmMode = 'ok';
  assert.equal(r.status, 502);
  assert.ok(!JSON.stringify(r.body).includes('SECRET'));
  assert.ok(!JSON.stringify(r.body).includes('boom'));
});

test('assistant: reports clearly when no API key is configured', { skip }, async () => {
  const saved = config.llm.apiKey;
  config.llm.apiKey = '';
  const status = await call('/assistant/status', { token: student.token });
  const r = await call('/assistant/chat', { method: 'POST', token: student.token, body: { courseId: 'c2', mode: 'ask', message: 'What is a queue?' } });
  config.llm.apiKey = saved;
  assert.deepEqual(status.body, { enabled: false });
  assert.equal(r.status, 503);
  assert.ok(/not set up/i.test(r.body.message));
});

test('assistant: openai-compatible provider shape is supported', { skip }, async () => {
  const saved = { ...config.llm };
  let seen;
  const alt = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { seen = { url: req.url, auth: req.headers.authorization, body: JSON.parse(raw) }; res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ choices: [{ message: { content: 'OpenAI-style answer' } }] })); });
  });
  await new Promise((resolve) => alt.listen(0, '127.0.0.1', resolve));
  Object.assign(config.llm, { provider: 'openai', baseUrl: `http://127.0.0.1:${alt.address().port}/v1` });
  const r = await call('/assistant/chat', { method: 'POST', token: student.token, body: { courseId: 'c2', mode: 'ask', message: 'What is a queue?' } });
  Object.assign(config.llm, saved);
  await new Promise((resolve) => alt.close(resolve));
  assert.equal(r.body.reply, 'OpenAI-style answer');
  assert.equal(seen.url, '/v1/chat/completions');
  assert.equal(seen.auth, `Bearer ${FAKE_KEY}`);
  assert.equal(seen.body.messages[0].role, 'system');
});

test('assistant: each student is rate limited', { skip }, async () => {
  const heavy = await newStudent('heavy');
  await call('/courses/c2/enroll', { method: 'POST', token: heavy.token });
  let limited = 0;
  for (let i = 0; i < 24; i += 1) {
    const r = await call('/assistant/chat', { method: 'POST', token: heavy.token, body: { courseId: 'c2', mode: 'ask', message: `Question number ${i}?` } });
    if (r.status === 429) limited += 1;
  }
  assert.ok(limited >= 3, `expected the limiter to stop requests, got ${limited}`);
  // another student is not affected by someone else's limit
  assert.equal((await call('/assistant/chat', { method: 'POST', token: student.token, body: { courseId: 'c2', mode: 'ask', message: 'What is a queue?' } })).status, 200);
});
