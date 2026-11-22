import { pool } from '../db/index.js';
import { notify } from './notify.js';
import { OPPORTUNITY_COLUMNS, toOpportunity } from '../routes/catalog.js';
import { recommend } from './matching.js';

const TODAY = `(NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date`;

// Deadline reminders and new matches. Dedupe keys make it safe to call on every page load.
export async function ensureStudentNotices(user) {
  if (!user || user.role !== 'student') return;

  const due = await pool.query(
    `SELECT a.id, a.title, to_char(a.due_date, 'YYYY-MM-DD') AS due
     FROM assignments a
     JOIN enrollments e ON e.course_id = a.course_id AND e.user_id = $1
     LEFT JOIN submissions s ON s.assignment_id = a.id AND s.user_id = $1
     WHERE s.id IS NULL
       AND a.due_date IS NOT NULL
       AND a.due_date >= ${TODAY}
       AND a.due_date <= ${TODAY} + 3`,
    [user.id]
  );
  for (const row of due.rows) {
    await notify(pool, user.id, 'deadline', `"${row.title}" is due on ${row.due}.`, `/assignments/${row.id}`, `deadline:${row.id}:${row.due}`);
  }

  const open = await pool.query(
    `SELECT ${OPPORTUNITY_COLUMNS} FROM opportunities
     WHERE (deadline IS NULL OR deadline >= ${TODAY})
       AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.opportunity_id = opportunities.id AND a.user_id = $1)
     LIMIT 200`,
    [user.id]
  );
  const student = { university: user.university, yearOfStudy: user.year_of_study, field: user.field, skills: user.skills || [] };
  const matches = recommend(student, open.rows.map(toOpportunity), { limit: 3, minScore: 40 });
  for (const opp of matches) {
    await notify(pool, user.id, 'match', `New opportunity that matches your profile: "${opp.title}".`, `/opportunities/${opp.id}`, `match:${opp.id}`);
  }
}
