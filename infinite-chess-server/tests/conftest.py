"""Pytest fixtures for infinite-chess-server tests."""

from __future__ import annotations

import os

os.environ.setdefault("DISABLE_TURN_WATCHER", "1")

import pytest

from server.state import GameState


@pytest.fixture
def save_path(tmp_path):
    """Unique save file path so tests don't share state."""
    return str(tmp_path / "world.board.json")


@pytest.fixture
def game_state(save_path):
    """Fresh GameState with no persisted data."""
    return GameState(save_path=save_path)


@pytest.fixture
def client(game_state):
    """FastAPI TestClient with patched state and cleared connection manager."""
    from unittest.mock import patch
    from fastapi.testclient import TestClient

    from server import main

    with patch.object(main, "state", game_state), patch.object(
        main.manager, "active", {}
    ):
        yield TestClient(main.app)
