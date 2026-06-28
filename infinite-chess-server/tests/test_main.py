"""Unit tests for server.main FastAPI app and WebSocket."""

from __future__ import annotations

import pytest


def _receive_until(ws, msg_type: str):
    """Drain messages until we get one with type == msg_type (e.g. broadcast state after join)."""
    while True:
        msg = ws.receive_json()
        if msg.get("type") == msg_type:
            return msg


def test_index_returns_api_info(client):
    r = client.get("/")
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "infinite-chess-server"
    assert data["websocket"] == "/ws"
    assert data["admin"] == "/admin/clear"


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_static_mount_when_enabled(client, monkeypatch):
    monkeypatch.setenv("SERVE_STATIC", "1")
    from server import main

    assert main._env_flag("SERVE_STATIC") is True


def test_admin_clear_requires_secret(client):
    r = client.post("/admin/clear")
    assert r.status_code == 403
    assert "secret" in r.json()["detail"].lower()


def test_admin_clear_rejects_wrong_secret(client, monkeypatch):
    monkeypatch.setenv("ADMIN_SECRET", "correct-secret")
    r = client.post("/admin/clear", headers={"X-Admin-Secret": "wrong"})
    assert r.status_code == 403


def test_admin_clear_succeeds_with_correct_secret(client, game_state, monkeypatch):
    monkeypatch.setenv("ADMIN_SECRET", "correct-secret")
    game_state.join("Someone")
    assert len(game_state.sessions) == 1
    r = client.post("/admin/clear", headers={"X-Admin-Secret": "correct-secret"})
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert len(game_state.sessions) == 0


def test_websocket_join_returns_joined(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"action": "join", "name": "TestPlayer"})
        msg = ws.receive_json()
        assert msg["type"] == "joined"
        assert msg["player_id"]
        assert msg["token"]
        assert msg["display_name"] == "TestPlayer"
        assert "king_pos" in msg


def test_websocket_join_then_state_request(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"action": "join", "name": "A"})
        joined = ws.receive_json()
        assert joined["type"] == "joined"
        ws.send_json({"action": "state"})
        state_msg = ws.receive_json()
        assert state_msg["type"] == "state"
        assert "pieces" in state_msg
        assert "players" in state_msg
        assert len(state_msg["players"]) >= 1


def test_websocket_reconnect_invalid_token_returns_error(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"action": "reconnect", "token": "invalid"})
        msg = ws.receive_json()
        assert msg["type"] == "error"
        assert "Invalid" in msg["error"]


def test_websocket_reconnect_valid_token(client, game_state):
    session, _ = game_state.join("ReconnectMe")
    token = session.token
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"action": "reconnect", "token": token})
        msg = ws.receive_json()
        assert msg["type"] == "reconnected"
        assert msg["player_id"] == session.player_id
        assert msg["display_name"] == "ReconnectMe"


def test_websocket_select_returns_selection(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"action": "join", "name": "Sel"})
        _receive_until(ws, "joined")
        ws.send_json({"action": "state"})
        state_msg = _receive_until(ws, "state")
        pieces = state_msg["pieces"]
        assert pieces, "joined player should receive pieces in state"
        p = pieces[0]
        ws.send_json({"action": "select", "row": p["row"], "col": p["col"]})
        sel = _receive_until(ws, "selection")
        assert sel["success"] is True
        assert "piece" in sel
        assert "legal_moves" in sel


def test_websocket_move_without_join_returns_error(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_json({
            "action": "move",
            "from_row": 0, "from_col": 0,
            "to_row": 1, "to_col": 0,
            "promotion": None,
        })
        msg = ws.receive_json()
        assert msg["type"] == "error"
        assert "Not authenticated" in msg["error"]


def test_websocket_unknown_action_returns_error(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"action": "join", "name": "U"})
        _receive_until(ws, "joined")
        ws.send_json({"action": "nonexistent"})
        msg = _receive_until(ws, "error")
        assert "Unknown action" in msg["error"]
