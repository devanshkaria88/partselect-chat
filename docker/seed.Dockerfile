# One-shot, offline seed runner. Scripts and the SQLite snapshot are mounted at
# runtime (see docker-compose.yml), so this image only needs the Postgres driver.
FROM python:3.12-slim

RUN pip install --no-cache-dir "psycopg2-binary>=2.9"

WORKDIR /app
# Default command is overridden by compose; kept here for `docker run` ergonomics.
CMD ["python", "/app/scripts/seed_postgres.py"]
