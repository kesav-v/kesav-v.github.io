import sqlite3
import pickle
from typing import Optional, cast
from board import Board


def init_db() -> None:
    """Initialize the database with required tables."""
    conn = sqlite3.connect("chess_games.db")
    c = conn.cursor()
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS games
        (game_id TEXT PRIMARY KEY, board_state BLOB)
        """
    )
    conn.commit()
    conn.close()


def save_game(game_id: str, board: Board) -> None:
    """Save or update a game in the database."""
    conn = sqlite3.connect("chess_games.db")
    c = conn.cursor()
    board_state = pickle.dumps(board)
    c.execute(
        "INSERT OR REPLACE INTO games (game_id, board_state) VALUES (?, ?)",
        (game_id, board_state),
    )
    conn.commit()
    conn.close()


def load_game(game_id: str) -> Optional[Board]:
    """Load a game from the database."""
    conn = sqlite3.connect("chess_games.db")
    c = conn.cursor()
    c.execute("SELECT board_state FROM games WHERE game_id = ?", (game_id,))
    result = c.fetchone()
    conn.close()

    if result:
        try:
            return cast(Board, pickle.loads(result[0]))
        except (pickle.UnpicklingError, TypeError, AttributeError):
            return None
    return None


def delete_game(game_id: str) -> None:
    """Delete a game from the database."""
    conn = sqlite3.connect("chess_games.db")
    c = conn.cursor()
    c.execute("DELETE FROM games WHERE game_id = ?", (game_id,))
    conn.commit()
    conn.close()
