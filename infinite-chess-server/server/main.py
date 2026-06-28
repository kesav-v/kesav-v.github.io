"""FastAPI server with WebSocket support for multiplayer infinite chess."""

from __future__ import annotations

import asyncio
import os
import time
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from .state import GameState

app = FastAPI(title="Infinite Chess Server")

SERVER_VERSION = "0.1.0"
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")


def _env_flag(name: str) -> bool:
    return os.environ.get(name, "").lower() in ("1", "true", "yes")


def _cors_origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", "*").strip()
    if raw == "*":
        return ["*"]
    return [origin for origin in (part.strip() for part in raw.split(",")) if origin]


_cors = _cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors,
    allow_credentials="*" not in _cors,
    allow_methods=["*"],
    allow_headers=["*"],
)

if _env_flag("SERVE_STATIC"):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

def run() -> None:
    """Entry point for the server."""
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser(description="Infinite Chess multiplayer server")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8000, help="Port to run on")
    parser.add_argument("--save", default="world.board.json", help="World save file path")
    parser.add_argument("--turn-seconds", type=float, default=10.0, help="Seconds per player turn")
    parser.add_argument("--admin-secret", type=str, default="", help="Secret for POST /admin/clear (or set ADMIN_SECRET)")
    args = parser.parse_args()

    if args.admin_secret:
        os.environ["ADMIN_SECRET"] = args.admin_secret

    global state
    state = GameState(
        save_path=args.save,
        turn_seconds=args.turn_seconds,
    )

    uvicorn.run(app, host=args.host, port=args.port)

def _turn_seconds_from_env() -> float:
    return float(os.environ.get("TURN_SECONDS", "10"))


state = GameState(
    save_path=os.environ.get("SAVE_PATH", "world.board.json"),
    turn_seconds=_turn_seconds_from_env(),
)

_turn_timer_task: asyncio.Task[None] | None = None


async def _turn_watcher() -> None:
    while True:
        await asyncio.sleep(0.25)
        result = state.apply_turn_timeout(time.time())
        if result is None:
            continue
        msg_type = result.pop("type", "move_result")
        await manager.broadcast({"type": msg_type, **result})
        await _broadcast_state(exclude=None)


@app.on_event("startup")
async def _startup_turn_watcher() -> None:
    if os.environ.get("DISABLE_TURN_WATCHER") == "1":
        return
    global _turn_timer_task
    _turn_timer_task = asyncio.create_task(_turn_watcher())

def _get_admin_secret() -> str:
    return os.environ.get("ADMIN_SECRET", "").strip()


async def require_admin(x_admin_secret: str | None = Header(None, alias="X-Admin-Secret")) -> None:
    """Require X-Admin-Secret header to match ADMIN_SECRET. Reject if not configured."""
    secret = _get_admin_secret()
    if not secret:
        raise HTTPException(403, "Admin secret not configured (set ADMIN_SECRET)")
    if x_admin_secret != secret:
        raise HTTPException(403, "Invalid or missing X-Admin-Secret")


class ConnectionManager:
    """Manages WebSocket connections and broadcasts."""

    def __init__(self) -> None:
        self.active: dict[str, WebSocket] = {}

    async def connect(self, player_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self.active[player_id] = ws

    def disconnect(self, player_id: str) -> None:
        self.active.pop(player_id, None)

    async def broadcast(self, message: dict[str, Any], exclude: str | None = None) -> None:
        disconnected: list[str] = []
        for pid, ws in self.active.items():
            if pid == exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.append(pid)
        for pid in disconnected:
            self.active.pop(pid, None)


manager = ConnectionManager()


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "name": "infinite-chess-server",
        "version": SERVER_VERSION,
        "websocket": "/ws",
        "admin": "/admin/clear",
    }


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


if _env_flag("SERVE_STATIC"):

    @app.get("/play")
    async def play() -> HTMLResponse:
        path = os.path.join(STATIC_DIR, "index.html")
        with open(path, "r") as f:
            return HTMLResponse(f.read())


@app.post("/admin/clear")
async def admin_clear(_: None = Depends(require_admin)) -> dict[str, str]:
    """Clear the world state (board + all players). Requires X-Admin-Secret header."""
    state.clear()
    await _broadcast_state(exclude=None)
    return {"status": "ok", "message": "World state cleared"}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await ws.accept()

    player_id: str | None = None

    try:
        while True:
            data: dict[str, Any] = await ws.receive_json()
            action: str = data.get("action", "")

            if action == "join":
                display_name: str = data.get("name", "Anonymous")
                session, king_pos = state.join(display_name)
                player_id = session.player_id
                manager.active[player_id] = ws

                await ws.send_json(
                    {
                        "type": "joined",
                        "player_id": session.player_id,
                        "token": session.token,
                        "display_name": session.display_name,
                        "king_pos": {"row": king_pos.row, "col": king_pos.col},
                    }
                )
                await _broadcast_state(exclude=None)

            elif action == "reconnect":
                token: str = data.get("token", "")
                session = state.reconnect(token)
                if session is None:
                    await ws.send_json({"type": "error", "error": "Invalid token"})
                    continue
                player_id = session.player_id
                manager.active[player_id] = ws

                await ws.send_json(
                    {
                        "type": "reconnected",
                        "player_id": session.player_id,
                        "display_name": session.display_name,
                    }
                )
                await _broadcast_state(exclude=None)

            elif action == "state":
                await ws.send_json(_state_message())

            elif action == "select":
                row: int = data.get("row", 0)
                col: int = data.get("col", 0)
                result = state.select(row, col)
                await ws.send_json({"type": "selection", **result})

            elif action == "move":
                if player_id is None:
                    await ws.send_json({"type": "error", "error": "Not authenticated"})
                    continue

                result = state.move(
                    player_id=player_id,
                    from_row=data.get("from_row", 0),
                    from_col=data.get("from_col", 0),
                    to_row=data.get("to_row", 0),
                    to_col=data.get("to_col", 0),
                    promotion=data.get("promotion"),
                )
                await ws.send_json({"type": "move_result", **result})

                if result.get("success"):
                    await _broadcast_state(exclude=None)

            elif action == "drop":
                if player_id is None:
                    await ws.send_json({"type": "error", "error": "Not authenticated"})
                    continue

                result = state.drop(
                    player_id=player_id,
                    piece_type=data.get("piece_type", ""),
                    row=data.get("row", 0),
                    col=data.get("col", 0),
                )
                await ws.send_json({"type": "move_result", **result})

                if result.get("success"):
                    await _broadcast_state(exclude=None)

            else:
                await ws.send_json({"type": "error", "error": f"Unknown action: {action}"})

    except WebSocketDisconnect:
        pass
    finally:
        if player_id:
            manager.disconnect(player_id)
            state.disconnect(player_id)
            await _broadcast_state(exclude=player_id)


async def _broadcast_state(exclude: str | None) -> None:
    await manager.broadcast(_state_message(), exclude=exclude)


def _state_message() -> dict[str, Any]:
    msg: dict[str, Any] = {
        "type": "state",
        "pieces": state.get_pieces_data(),
        "players": state.get_players_data(),
    }
    turn = state.get_turn_data()
    if turn is not None:
        msg["turn"] = turn
    return msg
