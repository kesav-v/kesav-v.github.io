#!/usr/bin/env python3
"""Web-based UI for infinite chess."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any

from flask import Flask, Response, jsonify, request, send_from_directory

from .board import Board, Position

app = Flask(__name__, static_folder=None)


@dataclass
class GameState:
    board: Board = field(default_factory=Board)
    player_ids: list[str] = field(default_factory=lambda: list[str]())
    current_player_idx: int = 0
    camera_row: int = 0
    camera_col: int = 0


_state = GameState()


def _reset() -> None:
    global _state
    _state = GameState()


@app.route("/")
def index() -> str:
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    with open(os.path.join(static_dir, "index.html"), "r") as f:
        return f.read()


@app.route("/static/<path:filename>")
def serve_static(filename: str) -> Response:
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    return send_from_directory(static_dir, filename)  # type: ignore[return-value]


@app.route("/api/state", methods=["GET"])
def get_state() -> Response:
    pieces_data: list[dict[str, Any]] = []
    for pos, piece in _state.board.pieces.items():
        pieces_data.append(
            {
                "row": pos.row,
                "col": pos.col,
                "type": piece.type,
                "player_id": piece.player_id,
            }
        )

    players_data: list[dict[str, Any]] = []
    for pid in _state.player_ids:
        player = _state.board.players.get(pid)
        if player:
            players_data.append(
                {
                    "id": pid,
                    "orientation": player.orientation,
                    "alive": player.alive,
                }
            )

    current_player: str | None = None
    if _state.player_ids:
        current_player = _state.player_ids[_state.current_player_idx]

    return jsonify(
        {
            "pieces": pieces_data,
            "players": players_data,
            "current_player_idx": _state.current_player_idx,
            "current_player": current_player,
            "camera_row": _state.camera_row,
            "camera_col": _state.camera_col,
        }
    )


@app.route("/api/spawn", methods=["POST"])
def spawn_player() -> Response:
    player_id, pos = _state.board.spawn_player()
    _state.player_ids.append(player_id)
    _state.current_player_idx = len(_state.player_ids) - 1
    _state.camera_row = pos.row
    _state.camera_col = pos.col

    return jsonify(
        {
            "success": True,
            "player_id": player_id,
            "position": {"row": pos.row, "col": pos.col},
        }
    )


@app.route("/api/select", methods=["POST"])
def select_piece() -> Response:
    data: dict[str, Any] = request.json  # type: ignore[assignment]
    row: int | None = data.get("row")
    col: int | None = data.get("col")

    if row is None or col is None:
        return jsonify({"success": False, "error": "Missing row or col"})

    pos = Position(row, col)
    piece = _state.board.get_piece(pos)

    if not piece:
        return jsonify({"success": False, "error": "No piece at that position"})

    all_moves = _state.board.get_legal_moves(piece.player_id)
    legal_moves = all_moves.get(pos, [])

    return jsonify(
        {
            "success": True,
            "piece": {
                "type": piece.type,
                "player_id": piece.player_id,
                "row": pos.row,
                "col": pos.col,
            },
            "legal_moves": [{"row": m.row, "col": m.col} for m in legal_moves],
        }
    )


@app.route("/api/move", methods=["POST"])
def move_piece() -> Response:
    data: dict[str, Any] = request.json  # type: ignore[assignment]
    from_row: int | None = data.get("from_row")
    from_col: int | None = data.get("from_col")
    to_row: int | None = data.get("to_row")
    to_col: int | None = data.get("to_col")
    promotion: str | None = data.get("promotion")

    if from_row is None or from_col is None or to_row is None or to_col is None:
        return jsonify({"success": False, "error": "Missing position data"})

    from_pos = Position(from_row, from_col)
    to_pos = Position(to_row, to_col)

    piece = _state.board.get_piece(from_pos)
    if not piece:
        return jsonify({"success": False, "error": "No piece at that position"})

    result = _state.board.move_piece(from_pos, to_pos, piece.player_id, promotion)
    return jsonify(result)


@app.route("/api/cycle_player", methods=["POST"])
def cycle_player() -> Response:
    if _state.player_ids:
        _state.current_player_idx = (_state.current_player_idx + 1) % len(
            _state.player_ids
        )
        current_player = _state.player_ids[_state.current_player_idx]
        return jsonify({"success": True, "current_player": current_player})
    return jsonify({"success": False, "error": "No players"})


@app.route("/api/camera", methods=["POST"])
def update_camera() -> Response:
    data: dict[str, Any] = request.json  # type: ignore[assignment]
    if "row" in data:
        _state.camera_row = data["row"]
    if "col" in data:
        _state.camera_col = data["col"]
    return jsonify({"success": True})


@app.route("/api/save", methods=["POST"])
def save_game() -> Response:
    data: dict[str, Any] = request.json  # type: ignore[assignment]
    filename: str = data.get("filename", "game")

    if not filename.endswith(".board.json"):
        filename += ".board.json"

    try:
        save_data: dict[str, Any] = {
            "board": _state.board.to_dict(),
            "camera_row": _state.camera_row,
            "camera_col": _state.camera_col,
            "current_player_idx": _state.current_player_idx,
            "player_ids": _state.player_ids,
        }
        with open(filename, "w") as f:
            json.dump(save_data, f, indent=2)
        return jsonify({"success": True, "filename": filename})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route("/api/load", methods=["POST"])
def load_game() -> Response:
    data: dict[str, Any] = request.json  # type: ignore[assignment]
    filename: str = data.get("filename", "")

    if not filename.endswith(".board.json"):
        filename += ".board.json"

    if not os.path.exists(filename):
        return jsonify({"success": False, "error": f"File not found: {filename}"})

    try:
        with open(filename, "r") as f:
            load_data: dict[str, Any] = json.load(f)

        _state.board = Board.from_dict(load_data["board"])
        _state.camera_row = load_data.get("camera_row", 0)
        _state.camera_col = load_data.get("camera_col", 0)
        _state.current_player_idx = load_data.get("current_player_idx", 0)
        _state.player_ids = load_data.get(
            "player_ids", list(_state.board.players.keys())
        )

        return jsonify({"success": True, "filename": filename})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route("/api/reset", methods=["POST"])
def reset_game() -> Response:
    _reset()
    return jsonify({"success": True})


def main() -> None:
    """Run the web server."""
    import argparse
    import threading
    import webbrowser

    parser = argparse.ArgumentParser(description="Infinite chess web UI")
    parser.add_argument("--port", type=int, default=5000, help="Port to run on")
    parser.add_argument("--no-browser", action="store_true", help="Don't open browser")
    parser.add_argument("file", nargs="?", help="JSON file to load game state from")
    args = parser.parse_args()

    if args.file:
        if os.path.exists(args.file):
            try:
                with open(args.file, "r") as f:
                    data: dict[str, Any] = json.load(f)
                _state.board = Board.from_dict(data["board"])
                _state.camera_row = data.get("camera_row", 0)
                _state.camera_col = data.get("camera_col", 0)
                _state.current_player_idx = data.get("current_player_idx", 0)
                _state.player_ids = data.get(
                    "player_ids", list(_state.board.players.keys())
                )
                print(f"Loaded game from {args.file}")
            except Exception as e:
                print(f"Failed to load {args.file}: {e}")
        else:
            print(f"File not found: {args.file}")

    url = f"http://localhost:{args.port}"
    print(f"Starting Infinite Chess Web UI at {url}")

    if not args.no_browser:
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()

    app.run(host="0.0.0.0", port=args.port, debug=False)


if __name__ == "__main__":
    main()
