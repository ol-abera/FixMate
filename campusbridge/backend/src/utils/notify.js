// Creates an in-app notification. `db` can be the pool or a transaction client.
// `dedupeKey` stops the same event (a deadline, a match, a status) from being stored twice.
export async function notify(db, userId, type, message, link = '', dedupeKey = '') {
  const text = message.slice(0, 300);
  const key = String(dedupeKey || '').slice(0, 160);
  if (key) {
    await db.query(
      `INSERT INTO notifications (user_id, type, message, link, dedupe_key)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
      [userId, type, text, link, key]
    );
    return;
  }
  await db.query('INSERT INTO notifications (user_id, type, message, link) VALUES ($1,$2,$3,$4)', [userId, type, text, link]);
}
