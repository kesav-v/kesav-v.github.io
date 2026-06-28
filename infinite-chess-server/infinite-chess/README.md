# Infinite Chess

A Python SDK for infinite multiplayer chess.

## Installation

```bash
pip install infinite-chess
```

Or install from the copy bundled in this repo:

```bash
cd infinite-chess-server/infinite-chess
pip install -e .
```

## Quick Start

```python
from infinite_chess import Board, Position

# Create a new board
board = Board()

# Spawn players (each gets a full set of pieces)
player1_id, spawn_pos = board.spawn_player()
player2_id, spawn_pos = board.spawn_player()

# Get legal moves for a player
moves = board.get_legal_moves(player1_id)
for from_pos, to_positions in moves.items():
    print(f"Piece at {from_pos} can move to: {to_positions}")

# Make a move
result = board.move_piece(
    from_pos=Position(row=1, col=0),
    to_pos=Position(row=3, col=0),
    player_id=player1_id
)

if result["success"]:
    print("Move successful!")
else:
    print(f"Move failed: {result.get('error')}")

# Get board state as JSON-serializable dict
state = board.to_dict()
```

## Features

- **Infinite Board**: No boundaries - pieces can exist at any integer coordinates
- **Multi-player Support**: Spawn unlimited players in a spiral pattern
- **Full Chess Rules**: All standard piece movements (pawn, rook, knight, bishop, queen, king)
- **Pawn Promotion**: Pawns promote after advancing 6 squares, spawning a new pawn at the back rank
- **Captures**: Standard capture mechanics between players

## API Reference

### Board

The main game board class.

```python
board = Board()
```

#### Methods

- `spawn_player(player_id=None)` - Add a new player with a full set of pieces
- `get_legal_moves(player_id)` - Get all legal moves for a player
- `move_piece(from_pos, to_pos, player_id, promotion_piece=None)` - Execute a move
- `get_piece(position)` - Get the piece at a position
- `get_player_pieces(player_id)` - Get all pieces belonging to a player
- `get_board_bounds()` - Get min/max coordinates of all pieces
- `get_pieces_in_range(top_left, bottom_right)` - Get pieces in a rectangular area
- `to_dict()` - Serialize board state to dictionary

### Position

Represents a coordinate on the board.

```python
pos = Position(row=0, col=0)
```

### Piece

Represents a chess piece.

```python
piece = Piece(type="queen", player_id="player1", position=Position(0, 0))
```

Piece types: `"pawn"`, `"rook"`, `"knight"`, `"bishop"`, `"queen"`, `"king"`

## Game Rules

### Piece Movement

- **Sliding pieces** (rook, bishop, queen): Move up to 7 squares in their allowed directions
- **King**: Moves 1 square in any direction
- **Knight**: Standard L-shaped movement
- **Pawn**: Moves forward, captures diagonally. Can move 2 squares from starting position.

### Player Spawning

Players spawn in a spiral pattern:
1. Player 1: Faces upward (row direction -1)
2. Player 2: Faces leftward
3. Player 3: Faces downward
4. Player 4: Faces rightward
5. And so on...

### Pawn Promotion

When a pawn reaches 6 squares ahead of its starting position, it must promote to queen, rook, bishop, or knight. A new pawn spawns at the back rank.

## License

MIT
