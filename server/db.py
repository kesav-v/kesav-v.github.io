import os
import pickle
from typing import Optional, cast
from board import Board

# Detect which database to use
DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    # PostgreSQL (production on Railway)
    import psycopg2
    from psycopg2.extras import RealDictCursor
    USE_POSTGRES = True
else:
    # SQLite (local development)
    import sqlite3
    USE_POSTGRES = False


def get_connection():
    """Get a database connection based on environment."""
    if USE_POSTGRES:
        # Parse DATABASE_URL (format: postgresql://user:password@host:port/dbname)
        # Railway provides this automatically
        return psycopg2.connect(DATABASE_URL)
    else:
        return sqlite3.connect("chess_games.db")


def init_db() -> None:
    """Initialize the database with required tables."""
    conn = get_connection()
    c = conn.cursor()
    
    if USE_POSTGRES:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS games
            (game_id TEXT PRIMARY KEY, board_state BYTEA, visibility TEXT DEFAULT 'unlisted')
            """
        )
    else:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS games
            (game_id TEXT PRIMARY KEY, board_state BLOB, visibility TEXT DEFAULT 'unlisted')
            """
        )
        # Add visibility column to existing tables if it doesn't exist (SQLite only)
        try:
            c.execute("ALTER TABLE games ADD COLUMN visibility TEXT DEFAULT 'unlisted'")
        except sqlite3.OperationalError:
            # Column already exists, ignore
            pass
    
    conn.commit()
    conn.close()


def save_game(game_id: str, board: Board, visibility: Optional[str] = None) -> None:
    """Save or update a game in the database.
    If visibility is None, preserves existing visibility or defaults to 'unlisted'."""
    conn = get_connection()
    c = conn.cursor()
    
    # If visibility not provided, preserve existing visibility
    if visibility is None:
        existing_visibility = get_game_visibility(game_id)
        visibility = existing_visibility if existing_visibility else "unlisted"
    
    board_state = pickle.dumps(board)
    
    if USE_POSTGRES:
        # PostgreSQL uses BYTEA for binary data
        # psycopg2 automatically handles bytes for BYTEA columns
        c.execute(
            "INSERT INTO games (game_id, board_state, visibility) VALUES (%s, %s, %s) "
            "ON CONFLICT (game_id) DO UPDATE SET board_state = EXCLUDED.board_state, visibility = EXCLUDED.visibility",
            (game_id, board_state, visibility),
        )
    else:
        # SQLite
        c.execute(
            "INSERT OR REPLACE INTO games (game_id, board_state, visibility) VALUES (?, ?, ?)",
            (game_id, board_state, visibility),
        )
    
    conn.commit()
    conn.close()


def load_game(game_id: str) -> Optional[Board]:
    """Load a game from the database."""
    conn = get_connection()
    c = conn.cursor()
    
    if USE_POSTGRES:
        c.execute("SELECT board_state FROM games WHERE game_id = %s", (game_id,))
    else:
        c.execute("SELECT board_state FROM games WHERE game_id = ?", (game_id,))
    
    result = c.fetchone()
    conn.close()

    if result:
        try:
            # PostgreSQL returns tuple, SQLite returns tuple
            board_data = result[0]
            # PostgreSQL BYTEA is already bytes, SQLite BLOB is already bytes
            return cast(Board, pickle.loads(board_data))
        except (pickle.UnpicklingError, TypeError, AttributeError):
            return None
    return None


def delete_game(game_id: str) -> None:
    """Delete a game from the database."""
    conn = get_connection()
    c = conn.cursor()
    
    if USE_POSTGRES:
        c.execute("DELETE FROM games WHERE game_id = %s", (game_id,))
    else:
        c.execute("DELETE FROM games WHERE game_id = ?", (game_id,))
    
    conn.commit()
    conn.close()


def get_public_games() -> list[tuple[str, str]]:
    """Get a list of all public games (game_id, visibility)."""
    conn = get_connection()
    c = conn.cursor()
    
    if USE_POSTGRES:
        c.execute("SELECT game_id, visibility FROM games WHERE visibility = 'public'")
    else:
        c.execute("SELECT game_id, visibility FROM games WHERE visibility = 'public'")
    
    result = c.fetchall()
    conn.close()
    return result


def get_game_visibility(game_id: str) -> Optional[str]:
    """Get the visibility of a game."""
    conn = get_connection()
    c = conn.cursor()
    
    if USE_POSTGRES:
        c.execute("SELECT visibility FROM games WHERE game_id = %s", (game_id,))
    else:
        c.execute("SELECT visibility FROM games WHERE game_id = ?", (game_id,))
    
    result = c.fetchone()
    conn.close()
    if result:
        return result[0]
    return None
