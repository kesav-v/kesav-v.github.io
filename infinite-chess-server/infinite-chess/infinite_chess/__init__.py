"""
Infinite Chess - A Python SDK for infinite multiplayer chess.

This package provides the core game logic for an infinite chess board
where multiple players can spawn and play simultaneously.
"""

from .board import Board, Piece, Player, Position

__version__ = "0.1.0"
__all__ = ["Board", "Piece", "Player", "Position"]
