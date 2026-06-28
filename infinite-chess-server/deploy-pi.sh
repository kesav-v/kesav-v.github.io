#!/usr/bin/env bash
# Build the Docker image locally and deploy it to kesav-pi.
set -euo pipefail

PI_HOST="${PI_HOST:-kesav-pi}"
PI_USER="${PI_USER:-kesav}"
PI_DIR="${PI_DIR:-/home/kesav/infinite-chess}"
IMAGE_NAME="${IMAGE_NAME:-infinite-chess-server}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
PLATFORM="${PLATFORM:-linux/arm64}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "==> Building ${IMAGE_NAME}:${IMAGE_TAG} for ${PLATFORM}"
docker build --platform "$PLATFORM" -t "${IMAGE_NAME}:${IMAGE_TAG}" .

echo "==> Ensuring Docker is installed on ${PI_USER}@${PI_HOST}"
ssh "${PI_USER}@${PI_HOST}" 'bash -s' <<'REMOTE'
set -euo pipefail
if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo systemctl enable --now docker
if ! groups "$USER" | grep -qw docker; then
  sudo usermod -aG docker "$USER"
  echo "Added $USER to docker group. Open a new SSH session for it to take effect."
fi
REMOTE

echo "==> Stopping legacy systemd service (if present)"
ssh "${PI_USER}@${PI_HOST}" 'sudo systemctl disable --now infinite-chess.service 2>/dev/null || true'

echo "==> Transferring image to ${PI_HOST}"
docker save "${IMAGE_NAME}:${IMAGE_TAG}" | ssh "${PI_USER}@${PI_HOST}" 'docker load'

echo "==> Syncing compose files"
ssh "${PI_USER}@${PI_HOST}" "mkdir -p ${PI_DIR}"
scp docker-compose.yml "${PI_USER}@${PI_HOST}:${PI_DIR}/docker-compose.yml"
if [[ -f .env.pi ]]; then
  scp .env.pi "${PI_USER}@${PI_HOST}:${PI_DIR}/.env"
fi

echo "==> Starting container"
ssh "${PI_USER}@${PI_HOST}" "cd ${PI_DIR} && docker compose up -d --remove-orphans"

echo "==> Health check"
ssh "${PI_USER}@${PI_HOST}" 'curl -fsS http://127.0.0.1:8000/health'

echo
echo "Deploy complete. API: https://infinite-chess.viswanadha.com"
