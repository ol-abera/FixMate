// Unit tests for opportunity matching and the new validators. No database needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchOpportunity, missingProfile, recommend } from '../src/utils/matching.js';
import { validateAssistant, validateOpportunity, validateOrganization, validateProfile, validateRegistration } from '../src/utils/validate.js';

const student = { university: 'Mizan-Tepi University', yearOfStudy: '3rd Year', field: 'Software Engineering', skills: ['Python', 'SQL'] };
const base = { id: 'x', title: 'Data Analyst Intern', category: 'Data Science', tags: ['Analytics'], requirements: [], description: '', eligibleUniversities: [], eligibleFields: [], eligibleYears: [], skills: [] };

test('matching: a listing for the student\'s field, year and skills scores high and explains every point', () => {
  const m = matchOpportunity(student, { ...base, eligibleFields: ['Computer Science', 'Software Engineering'], eligibleYears: ['3rd Year', '4th Year'], skills: ['Python', 'SQL', 'Excel'] });
  assert.equal(m.eligible, true);
  assert.ok(m.score >= 80, `score ${m.score}`);
  assert.deepEqual(m.matchedSkills, ['Python', 'SQL']);
  assert.ok(m.reasons.some((r) => r.includes('Software Engineering')));
  assert.ok(m.reasons.some((r) => r.includes('3rd Year')));
  assert.ok(m.reasons.some((r) => r.includes('Python, SQL')));
});

test('matching: a listing restricted to other universities or other years is not eligible', () => {
  assert.equal(matchOpportunity(student, { ...base, eligibleUniversities: ['Jimma University'] }).eligible, false);
  assert.equal(matchOpportunity(student, { ...base, eligibleYears: ['1st Year'] }).eligible, false);
  assert.equal(matchOpportunity(student, { ...base, eligibleUniversities: ['mizan-tepi university'] }).eligible, true, 'university match ignores case');
});

test('matching: related fields count even when the words differ', () => {
  const m = matchOpportunity({ ...student, skills: [] }, { ...base, eligibleFields: ['Computer Science'] });
  assert.ok(m.reasons.some((r) => r.includes('related to Computer Science')));
  const none = matchOpportunity({ ...student, skills: [] }, { ...base, eligibleFields: ['Nursing'] });
  assert.equal(none.signals, 0);
});

test('matching: recommend() sorts best first, drops weak matches and limits the list', () => {
  const list = [
    { ...base, id: 'weak', category: 'Marketing', title: 'Social media intern', tags: [] },
    { ...base, id: 'best', eligibleFields: ['Software Engineering'], skills: ['Python', 'SQL'] },
    { ...base, id: 'mid', skills: ['Python'] },
    { ...base, id: 'blocked', eligibleYears: ['1st Year'], skills: ['Python', 'SQL'] }
  ];
  const out = recommend(student, list, { limit: 2 });
  assert.deepEqual(out.map((o) => o.id), ['best', 'mid']);
  assert.ok(out[0].match.reasons.length > 0);
});

test('matching: tells the student what is missing from their profile', () => {
  assert.deepEqual(missingProfile({ university: 'U', field: '', yearOfStudy: '', skills: [] }), ['field of study', 'year of study', 'skills']);
  assert.deepEqual(missingProfile(student), []);
});

test('validate: skills, organisation sign-up and hub fields', () => {
  assert.deepEqual(validateProfile({ skills: 'Python, SQL, python,  ' }).value.skills, ['Python', 'SQL']);
  assert.ok(validateProfile({ skills: Array.from({ length: 16 }, (_, i) => `s${i}`) }).errors.skills);
  const reg = validateRegistration({ accountType: 'organization', fullName: 'Contact Person', email: 'o@org.et', organizationName: 'Org', password: 'secret123' });
  assert.deepEqual(reg.errors, {});
  assert.equal(reg.value.accountType, 'organization');
  assert.equal(validateRegistration({ accountType: 'coordinator', fullName: 'Abe K', email: 'a@b.et', university: 'MTU', password: 'secret123' }).value.accountType, 'student', 'only student or organization can be requested');
  const opp = { title: 'A fellowship', company: 'Org', type: 'Fellowship', category: 'Tech', deadline: '2999-01-01', description: 'x'.repeat(30) };
  assert.deepEqual(validateOpportunity(opp, '2026-01-01').errors, {});
  assert.ok(validateOpportunity({ ...opp, sourceUrl: 'javascript:alert(1)' }, '2026-01-01').errors.sourceUrl, 'only http(s) source links');
  assert.ok(validateOpportunity({ ...opp, type: 'Job' }, '2026-01-01').errors.type);
  assert.ok(validateOpportunity({ ...opp, scope: 'Mars' }, '2026-01-01').errors.scope);
  assert.ok(validateOpportunity({ ...opp, eligibleYears: ['13th Year'] }, '2026-01-01').errors.eligibleYears);
  assert.ok(validateOrganization({ name: 'A' }).errors.name);
  assert.ok(validateOrganization({ name: 'Org', website: 'ftp://x' }).errors.website);
});

test('validate: assistant input', () => {
  const ok = validateAssistant({ courseId: 'c1', mode: 'ask', message: 'What is a stack?' });
  assert.deepEqual(ok.errors, {});
  assert.ok(validateAssistant({ courseId: 'c1', mode: 'hack', message: 'hi there' }).errors.mode);
  assert.ok(validateAssistant({ courseId: 'c1', mode: 'ask', message: '' }).errors.message);
  assert.ok(validateAssistant({ courseId: 'c1', mode: 'ask', message: 'x'.repeat(2001) }).errors.message);
  assert.ok(validateAssistant({ mode: 'ask', message: 'hello' }).errors.courseId);
  assert.ok(validateAssistant({ courseId: 'c1', mode: 'summarize' }).errors.material);
  assert.ok(validateAssistant({ courseId: 'c1', mode: 'practice', count: 99 }).errors.count);
  assert.ok(validateAssistant({ courseId: 'c1', mode: 'ask', message: 'hello', history: [{ role: 'system', text: 'x' }] }).errors.history);
});
