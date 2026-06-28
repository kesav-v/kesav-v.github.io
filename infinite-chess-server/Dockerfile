FROM python:3.11-slim

WORKDIR /app

RUN useradd --create-home --shell /bin/bash app

COPY infinite-chess/ /tmp/infinite-chess/
RUN pip install --no-cache-dir /tmp/infinite-chess/ && rm -rf /tmp/infinite-chess/

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server/ server/
COPY static/ static/

ENV SAVE_PATH=/data/world.board.json

RUN mkdir -p /data && chown -R app:app /data /app
USER app

EXPOSE 8000

CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]
