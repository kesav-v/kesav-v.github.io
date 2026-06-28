"""Persistent game state management."""

from __future__ import annotations

import json
import os
import random
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from infinite_chess.board import Board, Position

PROMOTION_PIECES = ("queen", "rook", "bishop", "knight")


@dataclass
class PlayerSession:
    player_id: str
    token: str
    display_name: str
    connected: bool = False
    last_seen: float = field(default_factory=time.time)


class GameState:
    """Thread-safe game state with persistence and turn-based play."""

    def __init__(
        self,
        save_path: str = "world.board.json",
        turn_seconds: float = 10.0,
    ) -> None:
        self.board = Board()
        self.sessions: dict[str, PlayerSession] = {}
        self.token_to_player: dict[str, str] = {}
        self.save_path = save_path
        self.turn_seconds = turn_seconds
        self.turn_order: list[str] = []
        self.turn_index: int = 0
        self.turn_deadline: float | None = None
        self._lock = threading.Lock()
        self._load()

    def _load(self) -> None:
        if not os.path.exists(self.save_path):
            return
        try:
            with open(self.save_path, "r") as f:
                data: dict[str, Any] = json.load(f)
            self.board = Board.from_dict(data["board"])
            for s in data.get("sessions", []):
                session = PlayerSession(
                    player_id=s["player_id"],
                    token=s["token"],
                    display_name=s["display_name"],
                    connected=False,
                    last_seen=s.get("last_seen", time.time()),
                )
                self.sessions[session.player_id] = session
                self.token_to_player[session.token] = session.player_id
            self.turn_order = data.get("turn_order", [])
            self.turn_index = int(data.get("turn_index", 0))
            deadline = data.get("turn_deadline")
            self.turn_deadline = float(deadline) if deadline is not None else None
            self._ensure_turn_state()
            print(f"Loaded world from {self.save_path}")
        except Exception as e:
            print(f"Failed to load {self.save_path}: {e}")

    def _serialize_unlocked(self) -> dict[str, Any]:
        return {
            "board": self.board.to_dict(),
            "sessions": [
                {
                    "player_id": s.player_id,
                    "token": s.token,
                    "display_name": s.display_name,
                    "last_seen": s.last_seen,
                }
                for s in self.sessions.values()
            ],
            "turn_order": self.turn_order,
            "turn_index": self.turn_index,
            "turn_deadline": self.turn_deadline,
        }

    def _write_save_file(self, data: dict[str, Any]) -> None:
        with open(self.save_path, "w") as f:
            json.dump(data, f, indent=2)

    def save(self) -> None:
        with self._lock:
            data = self._serialize_unlocked()
        self._write_save_file(data)

    def clear(self) -> None:
        """Reset world to empty: fresh board, no players, no move history. Saves to disk."""
        with self._lock:
            self.board = Board()
            self.sessions.clear()
            self.token_to_player.clear()
            self.turn_order = []
            self.turn_index = 0
            self.turn_deadline = None
        self.save()

    def _alive_player_ids(self) -> list[str]:
        return [
            pid
            for pid in self.turn_order
            if pid in self.board.players and self.board.players[pid].alive
        ]

    def _should_auto_play_turns(self) -> bool:
        """Auto-moves on timeout only when multiple alive players are in the game."""
        return len(self._alive_player_ids()) > 1

    def _sync_turn_order(self) -> None:
        """Ensure turn_order contains each joined player once, in join order."""
        for pid in self.sessions:
            if pid not in self.turn_order:
                self.turn_order.append(pid)
        self.turn_order = [pid for pid in self.turn_order if pid in self.sessions]

    def _ensure_turn_state(self) -> None:
        self._sync_turn_order()
        alive = self._alive_player_ids()
        if not alive:
            self.turn_deadline = None
            return
        if self.turn_index >= len(self.turn_order):
            self.turn_index = 0
        current = self._current_turn_player_id_unlocked()
        if current is None or current not in alive:
            self.turn_index = self.turn_order.index(alive[0])
            self._start_turn_timer_unlocked()

    def _current_turn_player_id_unlocked(self) -> str | None:
        if not self.turn_order:
            return None
        if self.turn_index >= len(self.turn_order):
            self.turn_index = 0
        return self.turn_order[self.turn_index]

    def current_turn_player_id(self) -> str | None:
        with self._lock:
            return self._current_turn_player_id_unlocked()

    def get_turn_deadline(self) -> float | None:
        with self._lock:
            return self.turn_deadline

    def get_turn_data(self) -> dict[str, Any] | None:
        with self._lock:
            player_id = self._current_turn_player_id_unlocked()
            if player_id is None or self.turn_deadline is None:
                return None
            remaining = max(0.0, self.turn_deadline - time.time())
            return {
                "player_id": player_id,
                "deadline": self.turn_deadline,
                "seconds_remaining": remaining,
                "turn_seconds": self.turn_seconds,
            }

    def _start_turn_timer_unlocked(self) -> None:
        player_id = self._current_turn_player_id_unlocked()
        if player_id is None:
            self.turn_deadline = None
            return
        if not self._should_auto_play_turns():
            self.turn_deadline = None
            return
        player = self.board.players.get(player_id)
        if player is None or not player.alive:
            self._advance_turn_unlocked()
            return
        self.turn_deadline = time.time() + self.turn_seconds

    def _advance_turn_unlocked(self) -> None:
        alive = self._alive_player_ids()
        if not alive:
            self.turn_deadline = None
            return
        if not self.turn_order:
            self.turn_deadline = None
            return

        for _ in range(len(self.turn_order)):
            self.turn_index = (self.turn_index + 1) % len(self.turn_order)
            current = self._current_turn_player_id_unlocked()
            if current in alive:
                break
        self._start_turn_timer_unlocked()

    def _complete_turn_action(self, player_id: str) -> None:
        if player_id != self._current_turn_player_id_unlocked():
            return
        self._advance_turn_unlocked()

    def _is_players_turn(self, player_id: str) -> bool:
        return player_id == self._current_turn_player_id_unlocked()

    def join(self, display_name: str) -> tuple[PlayerSession, Position]:
        """Register a new player, spawn them on the board, return session + king pos."""
        with self._lock:
            player_id, king_pos = self.board.spawn_player()
            token = uuid.uuid4().hex
            session = PlayerSession(
                player_id=player_id,
                token=token,
                display_name=display_name,
                connected=True,
                last_seen=time.time(),
            )
            self.sessions[player_id] = session
            self.token_to_player[token] = player_id
            if player_id not in self.turn_order:
                self.turn_order.append(player_id)
            if self.turn_deadline is None and self._alive_player_ids():
                if len(self._alive_player_ids()) == 1:
                    self.turn_index = self.turn_order.index(player_id)
                self._start_turn_timer_unlocked()
        self.save()
        return session, king_pos

    def reconnect(self, token: str) -> PlayerSession | None:
        """Reconnect with an existing token."""
        player_id = self.token_to_player.get(token)
        if player_id is None:
            return None
        session = self.sessions.get(player_id)
        if session is None:
            return None
        with self._lock:
            session.connected = True
            session.last_seen = time.time()
        return session

    def disconnect(self, player_id: str) -> None:
        session = self.sessions.get(player_id)
        if session:
            with self._lock:
                session.connected = False
                session.last_seen = time.time()

    def authenticate(self, token: str) -> str | None:
        """Return the player_id for a token, or None."""
        return self.token_to_player.get(token)

    def get_pieces_data(self) -> list[dict[str, Any]]:
        result: list[dict[str, Any]] = []
        for pos, piece in self.board.pieces.items():
            result.append(
                {
                    "row": pos.row,
                    "col": pos.col,
                    "type": piece.type,
                    "player_id": piece.player_id,
                }
            )
        return result

    def get_players_data(self) -> list[dict[str, Any]]:
        result: list[dict[str, Any]] = []
        get_bank = getattr(self.board, "get_captured_bank", None)
        get_pawn_info = getattr(self.board, "get_pawn_drop_rank_info", None)
        current_turn = self.current_turn_player_id()
        for pid, session in self.sessions.items():
            player = self.board.players.get(pid)
            if player:
                row: dict[str, Any] = {
                    "id": pid,
                    "display_name": session.display_name,
                    "orientation": player.orientation,
                    "alive": player.alive,
                    "connected": session.connected,
                    "is_turn": pid == current_turn,
                }
                if get_bank is not None:
                    row["bank"] = get_bank(pid)
                if get_pawn_info is not None:
                    row["pawn_drop_rank_info"] = get_pawn_info(pid)
                result.append(row)
        return result

    def select(self, row: int, col: int) -> dict[str, Any]:
        pos = Position(row, col)
        piece = self.board.get_piece(pos)
        if not piece:
            return {"success": False, "error": "No piece at that position"}

        if piece.type == "stone":
            return {"success": False, "error": "Stones cannot be selected"}

        all_moves = self.board.get_legal_moves(piece.player_id)
        legal_moves = all_moves.get(pos, [])

        return {
            "success": True,
            "piece": {
                "type": piece.type,
                "player_id": piece.player_id,
                "row": pos.row,
                "col": pos.col,
            },
            "legal_moves": [{"row": m.row, "col": m.col} for m in legal_moves],
        }

    def move(
        self,
        player_id: str,
        from_row: int,
        from_col: int,
        to_row: int,
        to_col: int,
        promotion: str | None = None,
        *,
        auto: bool = False,
    ) -> dict[str, Any]:
        from_pos = Position(from_row, from_col)
        to_pos = Position(to_row, to_col)

        with self._lock:
            if not self._is_players_turn(player_id):
                return {"success": False, "error": "Not your turn"}

            piece = self.board.get_piece(from_pos)
            if not piece:
                return {"success": False, "error": "No piece at that position"}
            if piece.player_id != player_id:
                return {"success": False, "error": "Not your piece"}

            result = self.board.move_piece(from_pos, to_pos, player_id, promotion)
            if result.get("success"):
                self._complete_turn_action(player_id)

        if result.get("success"):
            self.save()
        if auto and result.get("success"):
            result = {**result, "auto": True}
        return result

    def drop(
        self,
        player_id: str,
        piece_type: str,
        row: int,
        col: int,
        *,
        auto: bool = False,
    ) -> dict[str, Any]:
        """Crazyhouse: drop a piece from the player's bank onto the board."""
        with self._lock:
            if not self._is_players_turn(player_id):
                return {"success": False, "error": "Not your turn"}

            drop_piece = getattr(self.board, "drop_piece", None)
            if drop_piece is None:
                return {"success": False, "error": "Drops not supported"}
            result = drop_piece(player_id, piece_type, row, col)
            if result.get("success"):
                self._complete_turn_action(player_id)

        if result.get("success"):
            self.save()
        if auto and result.get("success"):
            result = {**result, "auto": True}
        return result

    def _promotion_required(self, player_id: str, from_pos: Position, to_pos: Position) -> bool:
        piece = self.board.get_piece(from_pos)
        if piece is None or piece.type != "pawn":
            return False
        player = self.board.players.get(player_id)
        if player is None:
            return False
        pawn_direction = player.get_pawn_direction(from_pos)
        row_dir, col_dir = pawn_direction
        if player.orientation == "vertical":
            if row_dir == player.front_direction[0]:
                starting_line = player.front_pawn_line
            else:
                starting_line = player.back_pawn_line
            promotion_rank = starting_line + (row_dir * 6)
            return to_pos.row == promotion_rank
        if col_dir == player.front_direction[1]:
            starting_line = player.front_pawn_line
        else:
            starting_line = player.back_pawn_line
        promotion_rank = starting_line + (col_dir * 6)
        return to_pos.col == promotion_rank

    def _enumerate_actions(self, player_id: str) -> list[dict[str, Any]]:
        actions: list[dict[str, Any]] = []

        for from_pos, destinations in self.board.get_legal_moves(player_id).items():
            for to_pos in destinations:
                promotions: tuple[str | None, ...] = (None,)
                if self._promotion_required(player_id, from_pos, to_pos):
                    promotions = PROMOTION_PIECES
                for promotion in promotions:
                    actions.append(
                        {
                            "kind": "move",
                            "from_row": from_pos.row,
                            "from_col": from_pos.col,
                            "to_row": to_pos.row,
                            "to_col": to_pos.col,
                            "promotion": promotion,
                        }
                    )

        get_bank = getattr(self.board, "get_captured_bank", None)
        drop_piece_fn = getattr(self.board, "drop_piece", None)
        if get_bank is None or drop_piece_fn is None:
            return actions

        bank = get_bank(player_id)
        if not bank:
            return actions

        min_pos, max_pos = self.board.get_board_bounds()
        for row in range(min_pos.row - 2, max_pos.row + 3):
            for col in range(min_pos.col - 2, max_pos.col + 3):
                pos = Position(row, col)
                if self.board.get_piece(pos) is not None:
                    continue
                for piece_type in set(bank):
                    if piece_type == "pawn":
                        if not self.board._is_valid_pawn_drop_square(player_id, pos):
                            continue
                    actions.append(
                        {
                            "kind": "drop",
                            "piece_type": piece_type,
                            "row": row,
                            "col": col,
                        }
                    )
        return actions

    def apply_turn_timeout(self, now: float | None = None) -> dict[str, Any] | None:
        """If the current turn expired, play a random legal action or pass. Returns move_result."""
        if now is None:
            now = time.time()

        with self._lock:
            player_id = self._current_turn_player_id_unlocked()
            if (
                player_id is None
                or self.turn_deadline is None
                or now < self.turn_deadline
                or not self._should_auto_play_turns()
            ):
                return None

            actions = self._enumerate_actions(player_id)
            if not actions:
                self._advance_turn_unlocked()
                data = self._serialize_unlocked()
                result = {
                    "type": "turn_passed",
                    "success": True,
                    "player_id": player_id,
                    "reason": "no_legal_actions",
                }
            else:
                action = random.choice(actions)
                if action["kind"] == "move":
                    result = self.board.move_piece(
                        Position(action["from_row"], action["from_col"]),
                        Position(action["to_row"], action["to_col"]),
                        player_id,
                        action["promotion"],
                    )
                else:
                    result = self.board.drop_piece(
                        player_id,
                        action["piece_type"],
                        action["row"],
                        action["col"],
                    )
                if result.get("success"):
                    self._complete_turn_action(player_id)
                else:
                    self._advance_turn_unlocked()
                result = {**result, "auto": True, "player_id": player_id}
                data = self._serialize_unlocked()

        self._write_save_file(data)
        return result
