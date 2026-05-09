FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1

# Default command: dry-run demo using sample inputs
CMD ["python", "run_audit.py", "--config", "sample_inputs/config.yml", "--dry-run"]