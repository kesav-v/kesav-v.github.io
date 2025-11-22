from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
import random
import time


@dataclass
class Position:
    row: int
    col: int

    def __hash__(self) -> int:
        return hash((self.row, self.col))


@dataclass
class VisibleRange:
    min_row: int
    max_row: int
    min_col: int
    max_col: int
    player_id: str


@dataclass
class Piece:
    type: str  # "pawn", "rook", "knight", "bishop", "queen", "king"
    player_id: str
    position: Position


class Board:
    def __init__(self) -> None:
        self.pieces: Dict[Position, Piece] = {}  # position -> piece mapping
        self.players: Dict[str, List[Position]] = (
            {}
        )  # player_id -> list of piece positions
        self.last_move_times: Dict[str, float] = {}  # player_id -> timestamp of last move
        self.pawn_directions: Dict[str, Tuple[int, int]] = {
            "player1": (-1, 0)
        }  # (row_direction, col_direction) for pawn movement: (-1,0)=up, (1,0)=down, (0,-1)=left, (0,1)=right
        self.pawn_starting_rows: Dict[str, List[int]] = {}  # player_id -> list of starting rows for pawns
        self.pawn_starting_cols: Dict[str, List[int]] = {}  # player_id -> list of starting cols for pawns (for horizontal orientations)
        self.cooldown_seconds: float = 3.0  # Cooldown between moves

    def add_piece(self, piece: Piece) -> None:
        """Add a piece to the board."""
        self.pieces[piece.position] = piece
        if piece.player_id not in self.players:
            self.players[piece.player_id] = []
        self.players[piece.player_id].append(piece.position)

    def remove_piece(self, position: Position) -> Optional[Piece]:
        """Remove and return the piece at the given position, if any."""
        if position in self.pieces:
            piece = self.pieces.pop(position)
            self.players[piece.player_id].remove(position)
            if not self.players[piece.player_id]:  # If player has no pieces left
                del self.players[piece.player_id]
            return piece
        return None

    def move_piece(
        self,
        from_pos: Position,
        to_pos: Position,
        player_id: str,
        promotion_piece: Optional[str] = None,
    ) -> dict:
        """
        Move a piece from one position to another, capturing if necessary.

        Args:
            from_pos: Starting position
            to_pos: Target position
            player_id: ID of the player making the move
            promotion_piece: Type of piece to promote to ("queen", "rook", "bishop", "knight")

        Returns:
            Dictionary containing:
                success: Whether the move was successful
                promotion_available: Whether promotion is available
                moved_piece_type: Type of the piece after move (may change due to promotion)
                spawned_pawn: Whether a new pawn was spawned
                spawn_position: Position of the spawned pawn if any
                cooldown_remaining: Seconds remaining in cooldown if move failed due to cooldown
        """
        if from_pos not in self.pieces:
            return {"success": False, "promotion_available": False}

        piece = self.pieces[from_pos]

        # Check if the piece belongs to the player making the move
        if piece.player_id != player_id:
            return {"success": False, "error": "This piece doesn't belong to you"}

        # Check cooldown
        current_time = time.time()
        if player_id in self.last_move_times:
            time_since_last_move = current_time - self.last_move_times[player_id]
            if time_since_last_move < self.cooldown_seconds:
                cooldown_remaining = self.cooldown_seconds - time_since_last_move
                return {
                    "success": False,
                    "error": "Cooldown active",
                    "cooldown_remaining": round(cooldown_remaining, 2),
                }

        # Remove any piece at the destination (capture)
        self.remove_piece(to_pos)
        # Update piece position
        self.pieces.pop(from_pos)

        # Handle pawn promotion
        promotion_available = False
        if piece.type == "pawn":
            # Get pawn direction and calculate target promotion rank
            direction = self.pawn_directions.get(piece.player_id, (-1, 0))
            row_dir, col_dir = direction
            # Get starting positions for this player's pawns
            starting_rows = self.pawn_starting_rows.get(piece.player_id, [])
            starting_cols = self.pawn_starting_cols.get(piece.player_id, [])
            
            if row_dir != 0 and starting_rows:
                # Vertical movement - use the front starting row (furthest in forward direction)
                # If moving down (1), front row is the maximum row
                # If moving up (-1), front row is the minimum row
                if row_dir == 1:  # Moving down
                    front_starting_row = max(starting_rows)
                else:  # Moving up
                    front_starting_row = min(starting_rows)
                
                # Calculate promotion rank - 6 squares ahead of front starting row
                promotion_rank = front_starting_row + (row_dir * 6)
                promotion_available = to_pos.row == promotion_rank
            elif col_dir != 0 and starting_cols:
                # Horizontal movement - use the front starting col (furthest in forward direction)
                # If moving right (1), front col is the maximum col
                # If moving left (-1), front col is the minimum col
                if col_dir == 1:  # Moving right
                    front_starting_col = max(starting_cols)
                else:  # Moving left
                    front_starting_col = min(starting_cols)
                
                # Calculate promotion rank - 6 squares ahead of front starting col
                promotion_rank = front_starting_col + (col_dir * 6)
                promotion_available = to_pos.col == promotion_rank

        spawned_pawn = False
        spawn_position = None

        if promotion_available:
            # Only allow valid promotion pieces
            valid_promotion_pieces = ["queen", "rook", "bishop", "knight"]
            if promotion_piece in valid_promotion_pieces:
                piece.type = promotion_piece
            else:
                piece.type = "queen"  # Default to queen if no valid choice provided

            # If this was a pawn promotion and the original square is empty,
            # spawn a new pawn there using the back starting row
            starting_rows = self.pawn_starting_rows.get(piece.player_id, [])
            if starting_rows:
                # Use the back starting row (furthest behind in forward direction)
                # If moving down (1), back row is the minimum row
                # If moving up (-1), back row is the maximum row
                if pawn_direction == 1:  # Moving down
                    back_starting_row = min(starting_rows)
                else:  # Moving up
                    back_starting_row = max(starting_rows)
                
                spawn_pos = Position(back_starting_row, from_pos.col)
                if self.get_piece(spawn_pos) is None:
                    new_pawn = Piece("pawn", piece.player_id, spawn_pos)
                    self.add_piece(new_pawn)
                    spawned_pawn = True
                    spawn_position = {"row": spawn_pos.row, "col": spawn_pos.col}

        piece.position = to_pos
        self.pieces[to_pos] = piece
        # Update player's piece positions
        self.players[piece.player_id].remove(from_pos)
        self.players[piece.player_id].append(to_pos)

        # Update last move time for this player
        self.last_move_times[player_id] = current_time

        return {
            "success": True,
            "promotion_available": promotion_available,
            "moved_piece_type": piece.type,
            "spawned_pawn": spawned_pawn,
            "spawn_position": spawn_position,
        }

    def get_piece(self, position: Position) -> Optional[Piece]:
        """Get the piece at the given position, if any."""
        return self.pieces.get(position)

    def get_player_pieces(self, player_id: str) -> List[Piece]:
        """Get all pieces belonging to a player."""
        if player_id not in self.players:
            return []
        return [self.pieces[pos] for pos in self.players[player_id]]

    def get_board_bounds(self) -> Tuple[Position, Position]:
        """Get the minimum and maximum coordinates of pieces on the board."""
        if not self.pieces:
            return Position(0, 0), Position(0, 0)

        positions = list(self.pieces.keys())
        min_row = min(p.row for p in positions)
        max_row = max(p.row for p in positions)
        min_col = min(p.col for p in positions)
        max_col = max(p.col for p in positions)

        return Position(min_row, min_col), Position(max_row, max_col)

    def get_pieces_in_range(
        self, top_left: Position, bottom_right: Position
    ) -> List[Piece]:
        """Get all pieces within the specified rectangular range."""
        pieces = []
        for pos, piece in self.pieces.items():
            if (
                top_left.row <= pos.row <= bottom_right.row
                and top_left.col <= pos.col <= bottom_right.col
            ):
                pieces.append(piece)
        return pieces

    def _get_knight_moves(self, piece: Piece) -> List[Position]:
        """Calculate legal moves for a knight."""
        moves = []
        # All possible L-shaped moves for a knight
        offsets = [
            # Standard 2x1 L-shapes
            (-2, -1),
            (-2, 1),  # Up 2, left/right 1
            (2, -1),
            (2, 1),  # Down 2, left/right 1
            (-1, -2),
            (1, -2),  # Left 2, up/down 1
            (-1, 2),
            (1, 2),  # Right 2, up/down 1
        ]

        for row_offset, col_offset in offsets:
            new_row = piece.position.row + row_offset
            new_col = piece.position.col + col_offset
            new_pos = Position(new_row, new_col)

            # Check if the position is occupied by a piece of the same player
            target_piece = self.get_piece(new_pos)
            if target_piece is None or target_piece.player_id != piece.player_id:
                moves.append(new_pos)

        return moves

    def _get_sliding_moves(
        self, piece: Piece, directions: List[Tuple[int, int]], max_distance: int = 7
    ) -> List[Position]:
        """
        Calculate legal moves for a sliding piece (rook, bishop, queen).

        Args:
            piece: The piece to calculate moves for
            directions: List of (row_delta, col_delta) tuples indicating movement directions
            max_distance: Maximum number of squares the piece can move in each direction
        """
        moves = []

        for row_dir, col_dir in directions:
            for distance in range(1, max_distance + 1):
                new_row = piece.position.row + (row_dir * distance)
                new_col = piece.position.col + (col_dir * distance)
                new_pos = Position(new_row, new_col)

                # Check if the position is occupied
                target_piece = self.get_piece(new_pos)
                if target_piece is None:
                    # Empty square, can move here
                    moves.append(new_pos)
                elif target_piece.player_id != piece.player_id:
                    # Enemy piece, can capture it but can't move further in this direction
                    moves.append(new_pos)
                    break
                else:
                    # Friendly piece, can't move here or further in this direction
                    break

        return moves

    def _get_rook_moves(self, piece: Piece) -> List[Position]:
        """Calculate legal moves for a rook (up to 7 squares in each direction)."""
        # Four directions: up, right, down, left
        directions = [(-1, 0), (0, 1), (1, 0), (0, -1)]
        return self._get_sliding_moves(piece, directions)

    def _get_bishop_moves(self, piece: Piece) -> List[Position]:
        """Calculate legal moves for a bishop (up to 7 squares in each diagonal)."""
        # Four diagonal directions: up-left, up-right, down-left, down-right
        directions = [(-1, -1), (-1, 1), (1, -1), (1, 1)]
        return self._get_sliding_moves(piece, directions)

    def _get_queen_moves(self, piece: Piece) -> List[Position]:
        """Calculate legal moves for a queen (up to 7 squares in any direction)."""
        # Combine rook and bishop directions for queen's movement
        # Orthogonal directions (like a rook): up, right, down, left
        rook_directions = [(-1, 0), (0, 1), (1, 0), (0, -1)]
        # Diagonal directions (like a bishop): up-left, up-right, down-left, down-right
        bishop_directions = [(-1, -1), (-1, 1), (1, -1), (1, 1)]

        # Queen can move in all eight directions
        all_directions = rook_directions + bishop_directions
        return self._get_sliding_moves(piece, all_directions)

    def _get_king_moves(self, piece: Piece) -> List[Position]:
        """Calculate legal moves for a king (two squares in any direction)."""
        # Combine rook and bishop directions for queen's movement
        # Orthogonal directions (like a rook): up, right, down, left
        rook_directions = [(-1, 0), (0, 1), (1, 0), (0, -1)]
        # Diagonal directions (like a bishop): up-left, up-right, down-left, down-right
        bishop_directions = [(-1, -1), (-1, 1), (1, -1), (1, 1)]

        # Queen can move in all eight directions
        all_directions = rook_directions + bishop_directions
        return self._get_sliding_moves(piece, all_directions, max_distance=1)

    def _get_pawn_moves(self, piece: Piece) -> List[Position]:
        """Calculate legal moves for a pawn."""
        moves = []
        # Get pawn direction for this player (default to moving up if not set)
        direction = self.pawn_directions.get(piece.player_id, (-1, 0))
        row_dir, col_dir = direction

        # Forward one square
        new_pos = Position(piece.position.row + row_dir, piece.position.col + col_dir)
        if self.get_piece(new_pos) is None:  # Only if square is empty
            moves.append(new_pos)

            # Check if this pawn is on a starting position
            starting_rows = self.pawn_starting_rows.get(piece.player_id, [])
            starting_cols = self.pawn_starting_cols.get(piece.player_id, [])
            is_on_starting_pos = (
                (row_dir != 0 and piece.position.row in starting_rows) or
                (col_dir != 0 and piece.position.col in starting_cols)
            )

            # Initial two-square move (only from starting positions)
            if is_on_starting_pos:
                two_forward = Position(
                    piece.position.row + (row_dir * 2), piece.position.col + (col_dir * 2)
                )
                if self.get_piece(two_forward) is None:  # Only if square is empty
                    moves.append(two_forward)

        # Diagonal captures (perpendicular to movement direction)
        # For vertical movement (up/down), capture diagonally left/right
        # For horizontal movement (left/right), capture diagonally up/down
        if row_dir != 0:  # Moving vertically (up or down)
            for col_offset in [-1, 1]:  # Left and right diagonals
                capture_pos = Position(
                    piece.position.row + row_dir, piece.position.col + col_offset
                )
                target_piece = self.get_piece(capture_pos)
                if target_piece is not None and target_piece.player_id != piece.player_id:
                    moves.append(capture_pos)
        else:  # Moving horizontally (left or right)
            for row_offset in [-1, 1]:  # Up and down diagonals
                capture_pos = Position(
                    piece.position.row + row_offset, piece.position.col + col_dir
                )
                target_piece = self.get_piece(capture_pos)
                if target_piece is not None and target_piece.player_id != piece.player_id:
                    moves.append(capture_pos)

        return moves

    def get_legal_moves(self, player_id: str) -> Dict[Position, List[Position]]:
        """
        Get all legal moves for the specified player.
        """
        moves_dict: Dict[Position, List[Position]] = {}

        # Get all pieces belonging to the player
        for piece in self.pieces.values():
            if piece.player_id != player_id:
                continue

            legal_moves = []
            if piece.type == "pawn":
                legal_moves = self._get_pawn_moves(piece)
            elif piece.type == "knight":
                legal_moves = self._get_knight_moves(piece)
            elif piece.type == "rook":
                legal_moves = self._get_rook_moves(piece)
            elif piece.type == "bishop":
                legal_moves = self._get_bishop_moves(piece)
            elif piece.type == "queen":
                legal_moves = self._get_queen_moves(piece)
            elif piece.type == "king":
                legal_moves = self._get_king_moves(piece)

            if legal_moves:  # Only add to dict if there are legal moves
                moves_dict[piece.position] = legal_moves

        return moves_dict

    def spawn_player(self, visible_range_padding: int = 7) -> Tuple[str, Position]:
        """
        Spawns a new player on the board in a spiral pattern.
        Player 1: upward orientation at (0, 0)
        Player 2: leftward orientation, one chessboard (8 squares) to the right
        Player 3: downward orientation, one chessboard above player 2
        Player 4: rightward orientation, one chessboard to the left of player 3
        And so on in a spiral pattern.

        Args:
            visible_range_padding: Number of squares padding around each player's pieces

        Returns:
            Tuple of (player_id, spawn_position)
        """
        # Generate a unique player ID
        player_id = f"player{len(self.players) + 1}"
        player_num = len(self.players) + 1

        # Calculate spiral position
        # Spiral pattern: right, up, left, down, right, up, left, down...
        # Each step is 8 squares (one chessboard width)
        if player_num == 1:
            base_row, base_col = 0, 0
            direction = (-1, 0)  # Upward
        else:
            # Calculate which "ring" we're in and position within that ring
            ring = (player_num - 2) // 4  # Which spiral ring (0-indexed)
            side = (player_num - 2) % 4  # Which side of the ring (0=right, 1=up, 2=left, 3=down)
            
            # Starting position for this ring
            if ring == 0:
                start_row, start_col = 0, 8
            else:
                # Each ring starts 8 squares further out
                start_row = -8 * ring
                start_col = 8 * (ring + 1)
            
            # Calculate position based on side
            if side == 0:  # Right side
                base_row = start_row
                base_col = start_col
                direction = (0, -1)  # Leftward
            elif side == 1:  # Top side
                base_row = start_row - 8
                base_col = start_col
                direction = (1, 0)  # Downward
            elif side == 2:  # Left side
                base_row = start_row - 8
                base_col = start_col - 8
                direction = (0, 1)  # Rightward
            else:  # Bottom side
                base_row = start_row
                base_col = start_col - 8
                direction = (-1, 0)  # Upward

        self.pawn_directions[player_id] = direction
        row_dir, col_dir = direction

        # Add pieces for the new player
        pieces_to_add = [
            ("rook", 0),
            ("knight", 1),
            ("bishop", 2),
            ("queen", 3),
            ("king", 4),
            ("bishop", 5),
            ("knight", 6),
            ("rook", 7),
        ]

        # Place pieces based on orientation
        # For upward (row_dir=-1): pieces at base_row, pawns at base_row+1 (front) and base_row-1 (back)
        # For downward (row_dir=1): pieces at base_row, pawns at base_row-1 (front) and base_row+1 (back)
        # For leftward (col_dir=-1): pieces at base_col, pawns at base_col+1 (front) and base_col-1 (back)
        # For rightward (col_dir=1): pieces at base_col, pawns at base_col-1 (front) and base_col+1 (back)
        
        if row_dir != 0:  # Vertical orientation (up or down)
            if row_dir == -1:  # Upward
                front_pawn_row = base_row + 1
                piece_row = base_row
                back_pawn_row = base_row - 1
            else:  # Downward
                front_pawn_row = base_row - 1
                piece_row = base_row
                back_pawn_row = base_row + 1
            
            # Add back row pieces
            for piece_type, col_offset in pieces_to_add:
                self.add_piece(
                    Piece(piece_type, player_id, Position(piece_row, base_col + col_offset))
                )
            
            # Add front row pawns
            for col_offset in range(8):
                self.add_piece(
                    Piece("pawn", player_id, Position(front_pawn_row, base_col + col_offset))
                )
            
            # Add back row pawns
            for col_offset in range(8):
                self.add_piece(
                    Piece("pawn", player_id, Position(back_pawn_row, base_col + col_offset))
                )
            
            # Track starting rows for pawns
            self.pawn_starting_rows[player_id] = [front_pawn_row, back_pawn_row]
            self.pawn_starting_cols[player_id] = []
        else:  # Horizontal orientation (left or right)
            if col_dir == -1:  # Leftward
                front_pawn_col = base_col + 1
                piece_col = base_col
                back_pawn_col = base_col - 1
            else:  # Rightward
                front_pawn_col = base_col - 1
                piece_col = base_col
                back_pawn_col = base_col + 1
            
            # Add back row pieces
            for piece_type, row_offset in pieces_to_add:
                self.add_piece(
                    Piece(piece_type, player_id, Position(base_row + row_offset, piece_col))
                )
            
            # Add front row pawns
            for row_offset in range(8):
                self.add_piece(
                    Piece("pawn", player_id, Position(base_row + row_offset, front_pawn_col))
                )
            
            # Add back row pawns
            for row_offset in range(8):
                self.add_piece(
                    Piece("pawn", player_id, Position(base_row + row_offset, back_pawn_col))
                )
            
            # Track starting cols for pawns
            self.pawn_starting_cols[player_id] = [front_pawn_col, back_pawn_col]
            self.pawn_starting_rows[player_id] = []

        return player_id, Position(base_row, base_col)

    def get_cooldown_remaining(self, player_id: str) -> float:
        """Get the remaining cooldown time for a player in seconds."""
        if player_id not in self.last_move_times:
            return 0.0
        current_time = time.time()
        time_since_last_move = current_time - self.last_move_times[player_id]
        if time_since_last_move >= self.cooldown_seconds:
            return 0.0
        return self.cooldown_seconds - time_since_last_move

    def to_dict(self) -> dict:
        """Convert the board state to a dictionary for JSON serialization."""
        return {
            "pieces": [
                {
                    "type": piece.type,
                    "player_id": piece.player_id,
                    "position": {"row": piece.position.row, "col": piece.position.col},
                }
                for piece in self.pieces.values()
            ],
            "players": list(self.players.keys()),
        }
