FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=botique_backend.settings

WORKDIR /srv/app

# Install dependencies first for better layer caching.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY . .

# Collect static assets (served by WhiteNoise) at image build time.
RUN python manage.py collectstatic --noinput

# Render injects PORT automatically; fall back to 8000 locally.
EXPOSE 8000
# Apply schema migrations before serving traffic. Render's free tier supports
# no pre-deploy command, so this runs on every container start (idempotent).
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn botique_backend.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --threads 4 --timeout 120 --max-requests 1000 --max-requests-jitter 100 --access-logfile -"]