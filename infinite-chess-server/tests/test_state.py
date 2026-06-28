"""Unit tests for server.state.GameState."""

from __future__ import annotations

import json
import os
import random
import time

import pytest

from infinite_chess.board import Position
from server.state import GameState


def test_join_creates_session_and_spawns_pieces(game_state):
    session, king_pos = game_state.join("Alice")
    assert session.player_id.startswith("player")
    assert session.token
    assert session.display_name == "Alice"
    assert session.connected is True
    assert isinstance(king_pos, Position)
    assert king_pos.row == 0 and king_pos.col == 0  # first player at origin


def test_join_saves_to_disk(game_state, save_path):
    game_state.join("Bob")
    assert os.path.exists(save_path)
    with open(save_path) as f:
        data = json.load(f)
    assert "board" in data
    assert "sessions" in data
    assert len(data["sessions"]) == 1
    assert data["sessions"][0]["display_name"] == "Bob"


def test_second_join_gets_different_player_and_token(game_state):
    s1, _ = game_state.join("A")
    s2, _ = game_state.join("B")
    assert s1.player_id != s2.player_id
    assert s1.token != s2.token


def test_reconnect_valid_token(game_state):
    session, _ = game_state.join("Charlie")
    token = session.token
    reconnected = game_state.reconnect(token)
    assert reconnected is not None
    assert reconnected.player_id == session.player_id
    assert reconnected.display_name == "Charlie"
    assert reconnected.connected is True


def test_reconnect_invalid_token_returns_none(game_state):
    game_state.join("D")
    assert game_state.reconnect("bad-token") is None


def test_disconnect_marks_session_offline(game_state):
    session, _ = game_state.join("Eve")
    game_state.disconnect(session.player_id)
    s = game_state.sessions[session.player_id]
    assert s.connected is False


def test_authenticate_valid_token(game_state):
    session, _ = game_state.join("Frank")
    assert game_state.authenticate(session.token) == session.player_id


def test_authenticate_invalid_token(game_state):
    assert game_state.authenticate("nope") is None


def test_get_pieces_data_returns_list_of_dicts(game_state):
    game_state.join("Gina")
    pieces = game_state.get_pieces_data()
    assert isinstance(pieces, list)
    assert len(pieces) > 0
    for p in pieces:
        assert "row" in p and "col" in p and "type" in p and "player_id" in p


def test_get_players_data_includes_display_name_and_connected(game_state):
    session, _ = game_state.join("Hank")
    players = game_state.get_players_data()
    assert len(players) == 1
    p = players[0]
    assert p["id"] == session.player_id
    assert p["display_name"] == "Hank"
    assert p["connected"] is True
    assert "orientation" in p
    assert "alive" in p


def test_select_empty_square_returns_error(game_state):
    game_state.join("Ivy")
    result = game_state.select(100, 100)
    assert result["success"] is False
    assert "error" in result


def test_select_own_piece_returns_success_and_legal_moves(game_state):
    session, king_pos = game_state.join("Jack")
    result = game_state.select(king_pos.row, king_pos.col)
    assert result["success"] is True
    assert result["piece"]["type"] == "king"
    assert result["piece"]["player_id"] == session.player_id
    assert "legal_moves" in result


def test_move_without_own_piece_fails(game_state):
    session, _ = game_state.join("Kate")
    game_state.join("Leo")  # second player
    # Try to move from empty square
    result = game_state.move(session.player_id, 99, 99, 100, 100)
    assert result["success"] is False
    assert "error" in result


def test_move_not_your_piece_fails(game_state):
    s1, pos1 = game_state.join("Mia")
    s2, _ = game_state.join("Noah")
    # player1's turn — player2 cannot move at all
    result = game_state.move(s2.player_id, pos1.row, pos1.col, pos1.row + 1, pos1.col)
    assert result["success"] is False
    assert "Not your turn" in result["error"]


def test_move_legal_updates_state_and_saves(game_state, save_path):
    session, _ = game_state.join("Oscar")
    pieces_before = game_state.get_pieces_data()
    legal = game_state.board.get_legal_moves(session.player_id)
    assert legal, "new player should have legal moves"
    from_pos = next(iter(legal))
    to_pos = legal[from_pos][0]
    result = game_state.move(
        session.player_id,
        from_pos.row, from_pos.col,
        to_pos.row, to_pos.col,
    )
    assert result["success"] is True
    pieces_after = game_state.get_pieces_data()
    keys_before = {(p["row"], p["col"]) for p in pieces_before}
    keys_after = {(p["row"], p["col"]) for p in pieces_after}
    assert (to_pos.row, to_pos.col) in keys_after
    assert (from_pos.row, from_pos.col) not in keys_after
    assert os.path.exists(save_path)


def test_turn_blocks_wrong_player(game_state):
    s1, _ = game_state.join("First")
    s2, _ = game_state.join("Second")
    assert game_state.current_turn_player_id() == s1.player_id
    legal = game_state.board.get_legal_moves(s2.player_id)
    from_pos = next(iter(legal))
    to_pos = legal[from_pos][0]
    result = game_state.move(
        s2.player_id,
        from_pos.row, from_pos.col,
        to_pos.row, to_pos.col,
    )
    assert result["success"] is False
    assert "Not your turn" in result["error"]


def test_successful_move_advances_turn(game_state):
    s1, _ = game_state.join("First")
    s2, _ = game_state.join("Second")
    legal = game_state.board.get_legal_moves(s1.player_id)
    from_pos = next(iter(legal))
    to_pos = legal[from_pos][0]
    result = game_state.move(
        s1.player_id,
        from_pos.row, from_pos.col,
        to_pos.row, to_pos.col,
    )
    assert result["success"] is True
    assert game_state.current_turn_player_id() == s2.player_id


def test_turn_timeout_single_player_does_not_auto_play(game_state, monkeypatch):
    session, _ = game_state.join("Solo")
    legal = game_state.board.get_legal_moves(session.player_id)
    assert legal

    fixed = random.Random(0)
    monkeypatch.setattr("server.state.random.choice", fixed.choice)

    game_state.turn_deadline = time.time() - 1

    result = game_state.apply_turn_timeout()
    assert result is None


def test_turn_timeout_plays_random_move_with_two_players(game_state, monkeypatch):
    s1, _ = game_state.join("First")
    s2, _ = game_state.join("Second")
    legal = game_state.board.get_legal_moves(s1.player_id)
    assert legal

    fixed = random.Random(0)
    monkeypatch.setattr("server.state.random.choice", fixed.choice)

    game_state.turn_deadline = time.time() - 1

    result = game_state.apply_turn_timeout()
    assert result is not None
    assert result.get("auto") is True
    assert result.get("success") is True
    assert game_state.current_turn_player_id() == s2.player_id


def test_turn_timeout_passes_when_no_actions(game_state):
    game_state.join("First")
    game_state.join("Second")
    session_id = game_state.current_turn_player_id()
    assert session_id is not None
    game_state.board.pieces.clear()
    game_state.turn_deadline = time.time() - 1

    result = game_state.apply_turn_timeout()
    assert result is not None
    assert result["type"] == "turn_passed"
    assert result["player_id"] == session_id


def test_turn_timeout_single_player_does_not_pass(game_state):
    session, _ = game_state.join("Stuck")
    game_state.board.pieces.clear()
    game_state.turn_deadline = time.time() - 1

    result = game_state.apply_turn_timeout()
    assert result is None


def test_get_turn_data(game_state):
    game_state.join("First")
    game_state.join("Second")
    turn = game_state.get_turn_data()
    assert turn is not None
    assert turn["player_id"] == "player1"
    assert turn["turn_seconds"] == 10.0
    assert turn["seconds_remaining"] >= 0


def test_get_turn_data_absent_for_single_player(game_state):
    game_state.join("Solo")
    assert game_state.get_turn_data() is None


def test_load_restores_sessions_and_board(game_state, save_path):
    session, _ = game_state.join("Paul")
    token = session.token
    player_id = session.player_id
    state2 = GameState(save_path=save_path)
    assert player_id in state2.sessions
    assert state2.token_to_player.get(token) == player_id
    assert state2.get_players_data()
    assert state2.get_pieces_data()
