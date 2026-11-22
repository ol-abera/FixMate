// Opportunity matching. Pure functions (no database), so every rule can be unit-tested and explained to the student.
//
// A listing is first checked for ELIGIBILITY: if it names the universities or years of study it is open to and the
// student is not in them, it is left out. Then it is SCORED from what the student has in common with it, and every
// point of the score comes with a plain-language reason. An empty list on a listing means "no restriction".

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9+#.\s]/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['and', 'the', 'of', 'in', 'for', 'to', 'a', 'studies', 'study', 'general']);
const tokens = (s) => norm(s).split(' ').filter((t) => t.length > 2 && !STOP.has(t));

// Fields of study that count as "related" even when the words differ (e.g. Computer Science and Software Engineering).
const GROUPS = [
  ['computer', 'software', 'information', 'informatics', 'programming', 'cyber', 'data', 'technology', 'ict', 'it', 'ai', 'web'],
  ['health', 'medicine', 'medical', 'nursing', 'pharmacy', 'public', 'clinical', 'midwifery'],
  ['business', 'management', 'accounting', 'economics', 'finance', 'marketing', 'entrepreneurship', 'commerce'],
  ['engineering', 'civil', 'mechanical', 'electrical', 'construction', 'electronics', 'chemical'],
  ['education', 'teaching', 'pedagogy', 'psychology', 'language', 'linguistics'],
  ['biology', 'chemistry', 'physics', 'mathematics', 'statistics', 'agriculture', 'environmental', 'science']
];
const groupsOf = (text) => {
  const t = new Set(tokens(text));
  return GROUPS.map((g, i) => (g.some((w) => t.has(w)) ? i : -1)).filter((i) => i >= 0);
};

const sameText = (a, b) => {
  const x = norm(a); const y = norm(b);
  return Boolean(x) && Boolean(y) && (x === y || x.includes(y) || y.includes(x));
};
const listHas = (list, value) => (list || []).some((v) => norm(v) === norm(value));

// Does the skill appear (as a whole word or phrase) in the text?
const mentions = (haystack, skill) => {
  const s = norm(skill);
  if (!s) return false;
  return ` ${norm(haystack)} `.includes(` ${s} `);
};

export function matchOpportunity(student, opp) {
  const reasons = [];
  let score = 0;
  let signals = 0; // positive signals other than "open to everyone"
  let generic = ''; // the "open to everyone" note is shown last, after the reasons that are specific to this student

  // --- eligibility ---
  const unis = opp.eligibleUniversities || [];
  if (unis.length) {
    if (!student.university || !unis.some((u) => sameText(u, student.university))) return { eligible: false, score: 0, reasons: [], matchedSkills: [] };
    score += 25; signals += 1; reasons.push(`Open to students of ${student.university}.`);
  } else {
    score += 5; generic = 'Open to students from any university.';
  }

  const years = opp.eligibleYears || [];
  if (years.length) {
    if (student.yearOfStudy && !listHas(years, student.yearOfStudy)) return { eligible: false, score: 0, reasons: [], matchedSkills: [] };
    if (student.yearOfStudy) { score += 20; signals += 1; reasons.push(`Open to ${student.yearOfStudy} students.`); }
  }

  // --- field of study / department ---
  const fields = opp.eligibleFields || [];
  if (student.field) {
    const exact = fields.find((f) => sameText(f, student.field));
    if (exact) {
      score += 35; signals += 1; reasons.push(`Your field of study (${student.field}) is one this opportunity is open to.`);
    } else {
      const mine = groupsOf(student.field);
      const relatedField = fields.find((f) => groupsOf(f).some((g) => mine.includes(g)));
      if (relatedField) {
        score += 20; signals += 1; reasons.push(`Your field (${student.field}) is related to ${relatedField}, which this opportunity targets.`);
      } else if (!fields.length) {
        const text = `${opp.category} ${opp.title} ${(opp.tags || []).join(' ')}`;
        if (groupsOf(text).some((g) => mine.includes(g)) || tokens(student.field).some((t) => tokens(text).includes(t))) {
          score += 15; signals += 1; reasons.push(`The ${opp.category} category fits your field of study (${student.field}).`);
        }
      }
    }
  }

  // --- skills ---
  const mySkills = student.skills || [];
  const haystack = `${(opp.skills || []).join(' ')} ${(opp.tags || []).join(' ')} ${(opp.requirements || []).join(' ')} ${opp.title} ${opp.description || ''}`;
  const listed = [...(opp.skills || []), ...(opp.tags || [])];
  const matchedSkills = mySkills.filter((sk) => listHas(listed, sk) || mentions(haystack, sk));
  if (matchedSkills.length) {
    score += Math.min(36, matchedSkills.length * 12); signals += 1;
    reasons.push(`Your skills match: ${matchedSkills.slice(0, 5).join(', ')}.`);
  }

  if (generic) reasons.push(generic);
  return { eligible: true, score: Math.min(100, score), reasons, matchedSkills, signals };
}

// Returns the best matches, highest score first. Closed listings and ones the student already applied to must be
// filtered out by the caller (they need the database); this function only judges fit.
export function recommend(student, opportunities, { limit = 6, minScore = 20 } = {}) {
  return opportunities
    .map((o) => ({ opportunity: o, match: matchOpportunity(student, o) }))
    .filter(({ match }) => match.eligible && match.signals > 0 && match.score >= minScore)
    .sort((a, b) => b.match.score - a.match.score || String(a.opportunity.deadline || '9999').localeCompare(String(b.opportunity.deadline || '9999')))
    .slice(0, limit)
    .map(({ opportunity, match }) => ({ ...opportunity, match: { score: match.score, reasons: match.reasons, matchedSkills: match.matchedSkills } }));
}

// What the student could add to their profile to get better matches.
export function missingProfile(student) {
  const missing = [];
  if (!student.university) missing.push('university');
  if (!student.field) missing.push('field of study');
  if (!student.yearOfStudy) missing.push('year of study');
  if (!(student.skills || []).length) missing.push('skills');
  return missing;
}
