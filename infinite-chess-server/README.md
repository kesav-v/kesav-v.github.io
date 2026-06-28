# infinite-chess-server

Multiplayer server for [infinite-chess](https://github.com/kesav-v/infinite-chess). Players connect via WebSocket, join a shared persistent world, and move their own pieces in real time.

## Setup

```bash
cd infinite-chess-server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Running

```bash
python -m uvicorn server.main:app --host 0.0.0.0 --port 8000
```

Or with the entry point (after `pip install -e .`):

```bash
infinite-chess-server --port 8000
```

**Turn-based play:** each alive player gets **10 seconds** per turn (configurable). If they don't move or drop in time, the server picks a random legal action for them. Only the active player may move or drop.

- **CLI:** `infinite-chess-server --turn-seconds 10`
- **Env:** `TURN_SECONDS=10`

**Admin (clear world):** `POST /admin/clear` resets the board and all players. It requires authentication:

- Set a secret: **env** `ADMIN_SECRET=your-secret` or **CLI** `--admin-secret your-secret`
- Send it on each request: header `X-Admin-Secret: your-secret`
- If `ADMIN_SECRET` is not set, the endpoint returns 403 (disabled).

Example: `curl -X POST -H "X-Admin-Secret: your-secret" http://localhost:8000/admin/clear`

**CORS** (for a separate frontend): set `CORS_ORIGINS` to a comma-separated list of allowed origins, or `*` (default).

**Local UI:** the bundled browser client is opt-in. Run with `SERVE_STATIC=1`, then open `http://localhost:8000/play`. Production deployments (e.g. `infinite-chess.viswanadha.com`) should leave this unset so the host serves API/WebSocket only.

## API

| Endpoint | Description |
|----------|-------------|
| `GET /` | Service metadata (name, version, routes) |
| `GET /health` | Health check |
| `WebSocket /ws` | Game protocol (join, move, state, …) |
| `POST /admin/clear` | Reset world (requires `X-Admin-Secret`) |

## How it works

- **Join**: Enter a display name. The server spawns a full set of pieces for you and returns a session token (stored in `localStorage` for reconnection).
- **Move**: Click your pieces to see legal moves, click a highlighted square to move. Only your own pieces can be moved.
- **Real-time**: All connected clients receive board state updates via WebSocket whenever any player moves.
- **Persistence**: The world is saved to `world.board.json` after every move. The server reloads it on restart.

## Testing

```bash
pip install -r requirements-dev.txt
pytest tests/ -v
```

## Deploy to Raspberry Pi (Docker)

Build locally and push the image to `kesav-pi`:

```bash
./deploy-pi.sh
```

Optional env overrides (create `.env.pi` locally — copied to the Pi as `.env`):

```bash
ADMIN_SECRET=your-secret
CORS_ORIGINS=https://your-frontend.example
```

The script installs Docker on the Pi if needed, disables the legacy systemd service, loads the image over SSH, and runs `docker compose up -d`. World state persists in a Docker volume at `/data/world.board.json`. Cloudflare tunnel (`cloudflared-infinite-chess.service`) should keep pointing at `127.0.0.1:8000`.

## Architecture

```
kesav-v.github.io/
    └── infinite-chess-server/
            ├── infinite-chess/       Engine library (Board, Piece, Position, move logic)
            ├── server/main.py      FastAPI app + WebSocket handler
            ├── server/state.py     Game state, sessions, persistence
            └── static/index.html   Browser client
```
