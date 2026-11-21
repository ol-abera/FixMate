FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

RUN useradd --create-home --uid 10001 fixmate \
    && mkdir -p /app/media /app/staticfiles \
    && chown -R fixmate:fixmate /app/media /app/staticfiles \
    && chmod +x /app/docker-entrypoint.sh
USER fixmate

EXPOSE 8000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["daphne", "--bind", "0.0.0.0", "--port", "8000", "--proxy-headers", "config.asgi:application"]
