#!/bin/sh
set -e

# Wait for PostgreSQL; compose healthchecks cover the normal case, this covers restarts and other orchestrators.
tries=0
until python -c "import psycopg, os; psycopg.connect(host=os.environ.get('DATABASE_HOST', 'localhost'), port=os.environ.get('DATABASE_PORT', '5432'), user=os.environ.get('DATABASE_USER', 'fixmate'), password=os.environ.get('DATABASE_PASSWORD', ''), dbname=os.environ.get('DATABASE_NAME', 'fixmate'), connect_timeout=3).close()" 2>/dev/null; do
  tries=$((tries + 1))
  if [ "$tries" -ge 30 ]; then echo "Database not reachable after 30 attempts" >&2; exit 1; fi
  echo "Waiting for database..."; sleep 2
done

python manage.py migrate --noinput
python manage.py collectstatic --noinput --verbosity 0

if [ "${SEED_DEMO:-0}" = "1" ]; then
  python manage.py seed_data --force
fi

exec "$@"
