# ---- TalentIQ Backend (FastAPI + Celery) ----

FROM python:3.12-slim

# System deps:
# - build-essential + gcc: needed to compile some ML/vector-search wheels (faiss-cpu, etc.)
# - libpq-dev: Postgres client headers for psycopg2
# - curl: used by the HEALTHCHECK below

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first — separate layer so `docker build` doesn't
# re-download/re-compile everything (including heavy ML packages) on every
# code change, only when requirements.txt itself changes

COPY requirements.txt .

RUN pip install --no-cache-dir && \
    pip install --no-cache-dir -r requirements.txt

# Now copy the actual application code

COPY . .

# Persisted at runtime via a Docker volume (see docker-compose.yml) so
# uploaded CVs / FAISS indexes survive container restarts.

RUN mkdir -p /app/data/pdf /app/data/faiss_index /app/data/hr_faiss_index /app/data/hr_poilices /app/data/bulk_tmp

EXPOSE 8000

# Default command runs the API. The Celery worker container overrides this
# command in docker-compose.yml (same image, different process).

CMD ["uvicorn","main:app","--host","0.0.0.0","--port","8000"]

