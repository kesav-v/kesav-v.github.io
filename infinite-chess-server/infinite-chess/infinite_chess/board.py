import random
from dataclasses import dataclass
from typing import Any


@dataclass
class Position:
    """Represents a position on the infinite chess board."""

    row: int
    col: int

    def __hash__(self) -> int:
        return hash((self.row, self.col))

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Position):
            return False
        return self.row == other.row and self.col == other.col

    def to_dict(self) -> dict[str, int]:
        """Convert to dictionary representation."""
        return {"row": self.row, "col": self.col}


@dataclass
class Player:
    """Represents a player in the game."""

    id: str
    orientation: str  # "vertical" or "horizontal"
    piece_row: int  # row of the main pieces (for vertical) or base row (for horizontal)
    piece_col: int  # col of the main pieces (for horizontal) or base col (for vertical)
    front_pawn_line: int  # row (vertical) or col (horizontal) of front pawns
    back_pawn_line: int  # row (vertical) or col (horizontal) of back pawns
    front_direction: tuple[int, int]  # direction front pawns move
    back_direction: tuple[int, int]  # direction back pawns move
    piece_positions: list[Position]
    alive: bool = True

    def get_pawn_direction(self, pawn_pos: Position) -> tuple[int, int]:
        """Get the movement direction for a pawn based on its position."""
        if self.orientation == "vertical":
            # Determine if pawn is on the front side or back side of the pieces
            # Front pawns are on the same side as front_pawn_line relative to piece_row
            front_side_of_pieces = self.front_pawn_line > self.piece_row
            if front_side_of_pieces:
                # Front is above (higher row), back is below (lower row)
                return (
                    self.front_direction
                    if pawn_pos.row >= self.piece_row
                    else self.back_direction
                )
            else:
                # Front is below (lower row), back is above (higher row)
                return (
                    self.front_direction
                    if pawn_pos.row <= self.piece_row
                    else self.back_direction
                )
        else:  # horizontal
            front_side_of_pieces = self.front_pawn_line > self.piece_col
            if front_side_of_pieces:
                # Front is to the right (higher col), back is to the left (lower col)
                return (
                    self.front_direction
                    if pawn_pos.col >= self.piece_col
                    else self.back_direction
                )
            else:
                # Front is to the left (lower col), back is to the right (higher col)
                return (
                    self.front_direction
                    if pawn_pos.col <= self.piece_col
                    else self.back_direction
                )

    def is_pawn_on_starting_line(self, pawn_pos: Position) -> bool:
        """Check if a pawn is on its starting line."""
        if self.orientation == "vertical":
            return pawn_pos.row in (self.front_pawn_line, self.back_pawn_line)
        else:
            return pawn_pos.col in (self.front_pawn_line, self.back_pawn_line)

    def to_dict(self) -> dict[str, str | int | bool | list[int]]:
        """Convert to dictionary representation."""
        return {
            "id": self.id,
            "orientation": self.orientation,
            "piece_row": self.piece_row,
            "piece_col": self.piece_col,
            "front_pawn_line": self.front_pawn_line,
            "back_pawn_line": self.back_pawn_line,
            "front_direction": list(self.front_direction),
            "back_direction": list(self.back_direction),
            "alive": self.alive,
        }


@dataclass
class Piece:
    """Represents a chess piece on the board."""

    type: str  # "pawn", "rook", "knight", "bishop", "queen", "king", "stone"
    player_id: str
    position: Position
    origin: int | None = None  # For pawns: original col (vertical) or row (horizontal)

    def to_dict(self) -> dict[str, str | int | dict[str, int]]:
        """Convert to dictionary representation."""
        result: dict[str, str | int | dict[str, int]] = {
            "type": self.type,
            "player_id": self.player_id,
            "position": self.position.to_dict(),
        }
        if self.origin is not None:
            result["origin"] = self.origin
        return result


class Board:
    """
    Infinite chess board supporting multiple players.

    The board has no fixed boundaries - pieces can exist at any integer coordinates.
    Players spawn using a BFS-like strategy, alternating between horizontal and vertical
    orientations. Each new player spawns at a neighbor of an existing player, where
    neighbors are positions +/- 7 in both x and y directions from a player's king.
    """

    NEIGHBOR_OFFSET = 7

    def __init__(self) -> None:
        self.pieces: dict[Position, Piece] = {}
        self.players: dict[str, Player] = {}
        # Crazyhouse: captured pieces per player (piece types only; no kings)
        self.captured_banks: dict[str, list[str]] = {}
        # Sets of candidate spawn positions for each orientation
        # These contain king positions (representing where a player could spawn)
        self.horizontal_spawn_candidates: set[Position] = set()
        self.vertical_spawn_candidates: set[Position] = set()
        # Track which positions are already occupied by players (king positions)
        self.occupied_king_positions: set[Position] = set()

    def add_piece(self, piece: Piece) -> None:
        """Add a piece to the board."""
        self.pieces[piece.position] = piece
        if piece.player_id in self.players:
            self.players[piece.player_id].piece_positions.append(piece.position)

    def remove_piece(self, position: Position) -> Piece | None:
        """Remove and return the piece at the given position, if any.

        If a king is captured, all pieces belonging to that player become stones.
        """
        if position in self.pieces:
            piece = self.pieces.pop(position)
            player = self.players.get(piece.player_id)
            if player and position in player.piece_positions:
                player.piece_positions.remove(position)

            # If a king was captured, convert all that player's pieces to stones
            if piece.type == "king":
                self._convert_player_to_stones(piece.player_id)

            return piece
        return None

    def _convert_player_to_stones(self, player_id: str) -> None:
        """Convert all pieces belonging to a player into stones and mark player dead."""
        player = self.players.get(player_id)
        if player:
            for pos in player.piece_positions:
                if pos in self.pieces:
                    self.pieces[pos].type = "stone"
            player.alive = False

    def move_piece(
        self,
        from_pos: Position,
        to_pos: Position,
        player_id: str,
        promotion_piece: str | None = None,
    ) -> dict[str, Any]:
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
                error: Error message if move failed
                promotion_available: Whether promotion is available
                moved_piece_type: Type of the piece after move (may change due to promotion)
                spawned_pawn: Whether a new pawn was spawned
                spawn_position: Position of the spawned pawn if any
        """
        if from_pos not in self.pieces:
            return {"success": False, "error": "No piece at that position"}

        piece = self.pieces[from_pos]

        if piece.player_id != player_id:
            return {"success": False, "error": "This piece doesn't belong to you"}

        # Check if the move is legal
        legal_moves = self.get_legal_moves(player_id)
        if from_pos not in legal_moves or to_pos not in legal_moves.get(from_pos, []):
            return {"success": False, "error": "Illegal move"}

        # Check if pawn promotion is needed
        promotion_available = False
        player = self.players.get(piece.player_id)
        pawn_direction = (0, 0)
        if piece.type == "pawn" and player:
            pawn_direction = player.get_pawn_direction(from_pos)
            row_dir, col_dir = pawn_direction

            # Promotion happens 6 squares from the starting line in the pawn's direction
            if player.orientation == "vertical":
                # Determine which starting line this pawn came from
                if row_dir == player.front_direction[0]:
                    starting_line = player.front_pawn_line
                else:
                    starting_line = player.back_pawn_line
                promotion_rank = starting_line + (row_dir * 6)
                promotion_available = to_pos.row == promotion_rank
            else:  # horizontal
                if col_dir == player.front_direction[1]:
                    starting_line = player.front_pawn_line
                else:
                    starting_line = player.back_pawn_line
                promotion_rank = starting_line + (col_dir * 6)
                promotion_available = to_pos.col == promotion_rank

        if promotion_available:
            valid_promotion_pieces = ["queen", "rook", "bishop", "knight"]
            if promotion_piece not in valid_promotion_pieces:
                return {
                    "success": False,
                    "promotion_available": True,
                    "error": "Promotion piece required",
                }

        # Crazyhouse: credit capture to moving player (no kings)
        captured = self.get_piece(to_pos)
        if (
            captured
            and captured.player_id != player_id
            and captured.type not in ("king", "stone")
        ):
            if player_id not in self.captured_banks:
                self.captured_banks[player_id] = []
            self.captured_banks[player_id].append(captured.type)

        # Execute the move
        self.remove_piece(to_pos)  # Capture if present
        self.pieces.pop(from_pos)

        spawned_pawn = False
        spawn_position = None

        if promotion_available and player:
            pawn_origin = piece.origin
            piece.type = promotion_piece  # type: ignore
            piece.origin = None  # No longer a pawn
            row_dir, col_dir = pawn_direction

            # Spawn new pawn at the original starting position
            if pawn_origin is not None:
                if player.orientation == "vertical":
                    if row_dir == player.front_direction[0]:
                        spawn_row = player.front_pawn_line
                    else:
                        spawn_row = player.back_pawn_line
                    spawn_pos = Position(spawn_row, pawn_origin)
                else:  # horizontal
                    if col_dir == player.front_direction[1]:
                        spawn_col = player.front_pawn_line
                    else:
                        spawn_col = player.back_pawn_line
                    spawn_pos = Position(pawn_origin, spawn_col)

                if self.get_piece(spawn_pos) is None:
                    new_pawn = Piece(
                        "pawn", piece.player_id, spawn_pos, origin=pawn_origin
                    )
                    self.add_piece(new_pawn)
                    spawned_pawn = True
                    spawn_position = spawn_pos.to_dict()

        piece.position = to_pos
        self.pieces[to_pos] = piece
        if player:
            player.piece_positions.remove(from_pos)
            player.piece_positions.append(to_pos)

        return {
            "success": True,
            "promotion_available": promotion_available,
            "moved_piece_type": piece.type,
            "spawned_pawn": spawned_pawn,
            "spawn_position": spawn_position,
        }

    def get_piece(self, position: Position) -> Piece | None:
        """Get the piece at the given position, if any."""
        return self.pieces.get(position)

    def get_player_pieces(self, player_id: str) -> list[Piece]:
        """Get all pieces belonging to a player."""
        player = self.players.get(player_id)
        if not player:
            return []
        return [self.pieces[pos] for pos in player.piece_positions]

    def get_captured_bank(self, player_id: str) -> list[str]:
        """Crazyhouse: list of piece types the player can drop (no kings)."""
        return list(self.captured_banks.get(player_id, []))

    def get_pawn_drop_rank_info(self, player_id: str) -> dict[str, Any] | None:
        """
        Crazyhouse: info so UI can show where pawns may be dropped.
        Pawns must go on the 'second rank' (front_pawn_line or back_pawn_line).
        Returns e.g. {"orientation": "vertical", "front_line": 1, "back_line": -1}
        where for vertical the line is row, for horizontal the line is col.
        """
        player = self.players.get(player_id)
        if not player:
            return None
        return {
            "orientation": player.orientation,
            "front_pawn_line": player.front_pawn_line,
            "back_pawn_line": player.back_pawn_line,
        }

    def _is_valid_pawn_drop_square(self, player_id: str, pos: Position) -> bool:
        """True if (row, col) is on this player's pawn drop ranks (second rank)."""
        player = self.players.get(player_id)
        if not player:
            return False
        if player.orientation == "vertical":
            return pos.row in (player.front_pawn_line, player.back_pawn_line)
        else:
            return pos.col in (player.front_pawn_line, player.back_pawn_line)

    def drop_piece(
        self, player_id: str, piece_type: str, row: int, col: int
    ) -> dict[str, Any]:
        """
        Crazyhouse: drop a captured piece onto an empty square.
        Pawns may only be dropped on the player's second rank (front/back pawn lines).
        """
        bank = self.captured_banks.get(player_id, [])
        if piece_type not in bank:
            return {
                "success": False,
                "error": f"You don't have a {piece_type} in your bank",
            }
        pos = Position(row, col)
        if self.get_piece(pos) is not None:
            return {"success": False, "error": "Square is not empty"}

        if piece_type == "pawn":
            if not self._is_valid_pawn_drop_square(player_id, pos):
                return {
                    "success": False,
                    "error": "Pawns must be dropped on your second rank (in front of or behind your pieces)",
                }
            # origin for pawn movement: vertical = col, horizontal = row
            player = self.players[player_id]
            origin: int = col if player.orientation == "vertical" else row
            piece = Piece(piece_type, player_id, pos, origin=origin)
        else:
            piece = Piece(piece_type, player_id, pos)

        # Remove one from bank
        bank.remove(piece_type)
        self.add_piece(piece)
        return {"success": True}

    def get_board_bounds(self) -> tuple[Position, Position]:
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
    ) -> list[Piece]:
        """Get all pieces within the specified rectangular range."""
        pieces: list[Piece] = []
        for pos, piece in self.pieces.items():
            if (
                top_left.row <= pos.row <= bottom_right.row
                and top_left.col <= pos.col <= bottom_right.col
            ):
                pieces.append(piece)
        return pieces

    def _can_capture_target(self, mover: Piece, target: Piece) -> bool:
        """Stones can be captured by any player, including their former owner."""
        if target.type == "stone":
            return True
        return target.player_id != mover.player_id

    def _get_knight_moves(self, piece: Piece) -> list[Position]:
        """Calculate legal moves for a knight."""
        moves: list[Position] = []
        offsets = [
            (-2, -1),
            (-2, 1),
            (2, -1),
            (2, 1),
            (-1, -2),
            (1, -2),
            (-1, 2),
            (1, 2),
        ]

        for row_offset, col_offset in offsets:
            new_row = piece.position.row + row_offset
            new_col = piece.position.col + col_offset
            new_pos = Position(new_row, new_col)

            target_piece = self.get_piece(new_pos)
            if target_piece is None or self._can_capture_target(piece, target_piece):
                moves.append(new_pos)

        return moves

    def _get_sliding_moves(
        self, piece: Piece, directions: list[tuple[int, int]], max_distance: int = 7
    ) -> list[Position]:
        """Calculate legal moves for a sliding piece (rook, bishop, queen)."""
        moves: list[Position] = []

        for row_dir, col_dir in directions:
            for distance in range(1, max_distance + 1):
                new_row = piece.position.row + (row_dir * distance)
                new_col = piece.position.col + (col_dir * distance)
                new_pos = Position(new_row, new_col)

                target_piece = self.get_piece(new_pos)
                if target_piece is None:
                    moves.append(new_pos)
                elif self._can_capture_target(piece, target_piece):
                    moves.append(new_pos)
                    break
                else:
                    break

        return moves

    def _get_rook_moves(self, piece: Piece) -> list[Position]:
        """Calculate legal moves for a rook (up to 7 squares in each direction)."""
        directions: list[tuple[int, int]] = [(-1, 0), (0, 1), (1, 0), (0, -1)]
        return self._get_sliding_moves(piece, directions)

    def _get_bishop_moves(self, piece: Piece) -> list[Position]:
        """Calculate legal moves for a bishop (up to 7 squares in each diagonal)."""
        directions: list[tuple[int, int]] = [(-1, -1), (-1, 1), (1, -1), (1, 1)]
        return self._get_sliding_moves(piece, directions)

    def _get_queen_moves(self, piece: Piece) -> list[Position]:
        """Calculate legal moves for a queen (up to 7 squares in any direction)."""
        rook_directions: list[tuple[int, int]] = [(-1, 0), (0, 1), (1, 0), (0, -1)]
        bishop_directions: list[tuple[int, int]] = [(-1, -1), (-1, 1), (1, -1), (1, 1)]
        return self._get_sliding_moves(piece, rook_directions + bishop_directions)

    def _get_king_moves(self, piece: Piece) -> list[Position]:
        """Calculate legal moves for a king (one square in any direction)."""
        rook_directions: list[tuple[int, int]] = [(-1, 0), (0, 1), (1, 0), (0, -1)]
        bishop_directions: list[tuple[int, int]] = [(-1, -1), (-1, 1), (1, -1), (1, 1)]
        return self._get_sliding_moves(
            piece, rook_directions + bishop_directions, max_distance=1
        )

    def _get_pawn_moves(self, piece: Piece) -> list[Position]:
        """Calculate legal moves for a pawn."""
        moves: list[Position] = []
        player = self.players.get(piece.player_id)
        if not player:
            return moves

        row_dir, col_dir = player.get_pawn_direction(piece.position)

        # Forward one square
        new_pos = Position(piece.position.row + row_dir, piece.position.col + col_dir)
        if self.get_piece(new_pos) is None:
            moves.append(new_pos)

            # Check if on starting position for two-square move
            if player.is_pawn_on_starting_line(piece.position):
                two_forward = Position(
                    piece.position.row + (row_dir * 2),
                    piece.position.col + (col_dir * 2),
                )
                if self.get_piece(two_forward) is None:
                    moves.append(two_forward)

        # Diagonal captures
        if row_dir != 0:  # vertical movement
            for col_offset in [-1, 1]:
                capture_pos = Position(
                    piece.position.row + row_dir, piece.position.col + col_offset
                )
                target_piece = self.get_piece(capture_pos)
                if target_piece is not None and self._can_capture_target(
                    piece, target_piece
                ):
                    moves.append(capture_pos)
        else:  # horizontal movement
            for row_offset in [-1, 1]:
                capture_pos = Position(
                    piece.position.row + row_offset, piece.position.col + col_dir
                )
                target_piece = self.get_piece(capture_pos)
                if target_piece is not None and self._can_capture_target(
                    piece, target_piece
                ):
                    moves.append(capture_pos)

        return moves

    def get_legal_moves(self, player_id: str) -> dict[Position, list[Position]]:
        """Get all legal moves for the specified player."""
        moves_dict: dict[Position, list[Position]] = {}

        for piece in self.pieces.values():
            if piece.player_id != player_id:
                continue

            legal_moves: list[Position] = []
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

            if legal_moves:
                moves_dict[piece.position] = legal_moves

        return moves_dict

    def _get_neighbor_positions(self, king_pos: Position) -> list[Position]:
        """Get the 4 diagonal neighbor positions for a king position."""
        offsets = [
            (-self.NEIGHBOR_OFFSET, -self.NEIGHBOR_OFFSET),
            (-self.NEIGHBOR_OFFSET, self.NEIGHBOR_OFFSET),
            (self.NEIGHBOR_OFFSET, -self.NEIGHBOR_OFFSET),
            (self.NEIGHBOR_OFFSET, self.NEIGHBOR_OFFSET),
        ]
        return [Position(king_pos.row + dr, king_pos.col + dc) for dr, dc in offsets]

    def _add_neighbors_to_candidate_set(
        self, king_pos: Position, target_orientation: str
    ) -> None:
        """Add neighbor positions to the appropriate candidate set."""
        neighbors = self._get_neighbor_positions(king_pos)
        target_set = (
            self.horizontal_spawn_candidates
            if target_orientation == "horizontal"
            else self.vertical_spawn_candidates
        )
        for neighbor in neighbors:
            if neighbor not in self.occupied_king_positions:
                target_set.add(neighbor)

    def spawn_player(self, player_id: str | None = None) -> tuple[str, Position]:
        """
        Spawns a new player on the board with a full set of pieces.

        Players spawn using a BFS-like strategy:
        - Player 1: horizontal orientation at (0, 0)
        - Subsequent players alternate between vertical and horizontal
        - Each new player spawns at a neighbor of an existing player
        - Neighbors are +/- 7 in both x and y from the king position

        Args:
            player_id: Optional custom player ID. If not provided, auto-generates.

        Returns:
            Tuple of (player_id, king_position)
        """
        if player_id is None:
            player_id = f"player{len(self.players) + 1}"

        player_num = len(self.players) + 1

        if player_num == 1:
            # First player spawns at origin, vertical orientation
            king_pos = Position(0, 0)
            orientation = "vertical"
        else:
            # Alternate orientation from the previous player
            # Even players are horizontal, odd players are vertical
            orientation = "horizontal" if player_num % 2 == 0 else "vertical"

            # Pick from the appropriate candidate set
            candidate_set = (
                self.horizontal_spawn_candidates
                if orientation == "horizontal"
                else self.vertical_spawn_candidates
            )

            # Remove any positions that are now occupied
            candidate_set -= self.occupied_king_positions

            if not candidate_set:
                raise RuntimeError(
                    f"No available spawn positions for {orientation} orientation"
                )

            # Choose randomly from candidates
            king_pos = random.choice(list(candidate_set))
            candidate_set.remove(king_pos)

        # Mark this position as occupied
        self.occupied_king_positions.add(king_pos)

        # Add neighbors to the opposite orientation's candidate set
        opposite_orientation = (
            "vertical" if orientation == "horizontal" else "horizontal"
        )
        self._add_neighbors_to_candidate_set(king_pos, opposite_orientation)

        # Calculate piece positions based on king position and orientation
        # King is at offset 4 from the base, so base = king_pos - 4
        if orientation == "horizontal":
            base_row = king_pos.row - 4
            base_col = king_pos.col
            # Horizontal players face left (pawns move outward horizontally)
            front_pawn_line = base_col + 1
            back_pawn_line = base_col - 1
            front_direction = (0, 1)
            back_direction = (0, -1)
        else:  # vertical
            base_row = king_pos.row
            base_col = king_pos.col - 4
            # Vertical players face up (pawns move outward vertically)
            front_pawn_line = base_row + 1
            back_pawn_line = base_row - 1
            front_direction = (1, 0)
            back_direction = (-1, 0)

        piece_row = base_row if orientation == "horizontal" else king_pos.row
        piece_col = base_col if orientation == "vertical" else king_pos.col

        # Create the player before adding pieces
        player = Player(
            id=player_id,
            orientation=orientation,
            piece_row=piece_row,
            piece_col=piece_col,
            front_pawn_line=front_pawn_line,
            back_pawn_line=back_pawn_line,
            front_direction=front_direction,
            back_direction=back_direction,
            piece_positions=[],
        )
        self.players[player_id] = player

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

        # Add pieces based on orientation
        if orientation == "vertical":
            for piece_type, col_offset in pieces_to_add:
                self.add_piece(
                    Piece(
                        piece_type,
                        player_id,
                        Position(king_pos.row, base_col + col_offset),
                    )
                )

            for col_offset in range(8):
                col = base_col + col_offset
                self.add_piece(
                    Piece("pawn", player_id, Position(front_pawn_line, col), origin=col)
                )
                self.add_piece(
                    Piece("pawn", player_id, Position(back_pawn_line, col), origin=col)
                )
        else:  # horizontal
            for piece_type, row_offset in pieces_to_add:
                self.add_piece(
                    Piece(
                        piece_type,
                        player_id,
                        Position(base_row + row_offset, piece_col),
                    )
                )

            for row_offset in range(8):
                row = base_row + row_offset
                self.add_piece(
                    Piece("pawn", player_id, Position(row, front_pawn_line), origin=row)
                )
                self.add_piece(
                    Piece("pawn", player_id, Position(row, back_pawn_line), origin=row)
                )

        return player_id, king_pos

    def to_dict(self) -> dict[str, Any]:
        """Convert the board state to a dictionary for JSON serialization."""
        return {
            "pieces": [piece.to_dict() for piece in self.pieces.values()],
            "players": [player.to_dict() for player in self.players.values()],
            "captured_banks": dict(self.captured_banks),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Board":
        """Create a Board from a dictionary representation."""
        board = cls()

        # Restore players first (needed for add_piece to track positions)
        for player_data in data.get("players", []):
            player = Player(
                id=player_data["id"],
                orientation=player_data["orientation"],
                piece_row=player_data["piece_row"],
                piece_col=player_data["piece_col"],
                front_pawn_line=player_data["front_pawn_line"],
                back_pawn_line=player_data["back_pawn_line"],
                front_direction=tuple(player_data["front_direction"]),
                back_direction=tuple(player_data["back_direction"]),
                piece_positions=[],
                alive=player_data.get("alive", True),
            )
            board.players[player.id] = player

        # Restore pieces
        for piece_data in data.get("pieces", []):
            pos = Position(piece_data["position"]["row"], piece_data["position"]["col"])
            piece = Piece(
                type=piece_data["type"],
                player_id=piece_data["player_id"],
                position=pos,
                origin=piece_data.get("origin"),
            )
            board.pieces[pos] = piece
            # Update player's piece_positions if player exists
            if piece.player_id in board.players:
                board.players[piece.player_id].piece_positions.append(pos)

        # Restore crazyhouse captured banks
        board.captured_banks = {
            pid: list(types) for pid, types in data.get("captured_banks", {}).items()
        }

        # Rebuild spawn candidate sets from player data
        board._rebuild_spawn_candidates()

        return board

    def _rebuild_spawn_candidates(self) -> None:
        """Rebuild spawn candidate sets from existing players."""
        self.horizontal_spawn_candidates.clear()
        self.vertical_spawn_candidates.clear()
        self.occupied_king_positions.clear()

        for player in self.players.values():
            # Find the king position for this player
            king_pos = self._get_king_position_for_player(player)
            if king_pos:
                self.occupied_king_positions.add(king_pos)
                # Add neighbors to the opposite orientation's set
                opposite = (
                    "vertical" if player.orientation == "horizontal" else "horizontal"
                )
                self._add_neighbors_to_candidate_set(king_pos, opposite)

        # Remove occupied positions from candidate sets
        self.horizontal_spawn_candidates -= self.occupied_king_positions
        self.vertical_spawn_candidates -= self.occupied_king_positions

    def _get_king_position_for_player(self, player: Player) -> Position | None:
        """Get the king position for a player based on their piece_row/piece_col."""
        if player.orientation == "horizontal":
            # King is at row offset 4 from base_row
            return Position(player.piece_row + 4, player.piece_col)
        else:  # vertical
            # King is at col offset 4 from base_col
            return Position(player.piece_row, player.piece_col + 4)

    def __repr__(self) -> str:
        return f"Board(players={list(self.players.keys())}, pieces={len(self.pieces)})"
