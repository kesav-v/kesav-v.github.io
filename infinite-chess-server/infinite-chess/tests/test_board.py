"""Unit tests for infinite chess game."""

from infinite_chess import Board, Piece, Player, Position


class TestPosition:
    """Tests for Position dataclass."""

    def test_creation(self):
        pos = Position(1, 2)
        assert pos.row == 1
        assert pos.col == 2

    def test_equality(self):
        pos1 = Position(1, 2)
        pos2 = Position(1, 2)
        pos3 = Position(1, 3)
        assert pos1 == pos2
        assert pos1 != pos3

    def test_hash(self):
        pos1 = Position(1, 2)
        pos2 = Position(1, 2)
        assert hash(pos1) == hash(pos2)
        # Can be used as dict key
        d = {pos1: "value"}
        assert d[pos2] == "value"

    def test_to_dict(self):
        pos = Position(3, 4)
        assert pos.to_dict() == {"row": 3, "col": 4}


class TestPiece:
    """Tests for Piece dataclass."""

    def test_creation(self):
        pos = Position(0, 0)
        piece = Piece("queen", "player1", pos)
        assert piece.type == "queen"
        assert piece.player_id == "player1"
        assert piece.position == pos

    def test_to_dict(self):
        pos = Position(1, 2)
        piece = Piece("knight", "player1", pos)
        assert piece.to_dict() == {
            "type": "knight",
            "player_id": "player1",
            "position": {"row": 1, "col": 2},
        }


class TestPlayer:
    """Tests for Player dataclass."""

    def test_vertical_player_pawn_direction_front(self):
        player = Player(
            id="player1",
            orientation="vertical",
            piece_row=0,
            piece_col=0,
            front_pawn_line=1,
            back_pawn_line=-1,
            front_direction=(1, 0),
            back_direction=(-1, 0),
            piece_positions=[],
        )
        # Front pawn at row 1 should move in front_direction
        assert player.get_pawn_direction(Position(1, 0)) == (1, 0)
        # Front pawn that moved to row 3 should still move forward
        assert player.get_pawn_direction(Position(3, 0)) == (1, 0)

    def test_vertical_player_pawn_direction_back(self):
        player = Player(
            id="player1",
            orientation="vertical",
            piece_row=0,
            piece_col=0,
            front_pawn_line=1,
            back_pawn_line=-1,
            front_direction=(1, 0),
            back_direction=(-1, 0),
            piece_positions=[],
        )
        # Back pawn at row -1 should move in back_direction
        assert player.get_pawn_direction(Position(-1, 0)) == (-1, 0)
        # Back pawn that moved to row -3 should still move backward
        assert player.get_pawn_direction(Position(-3, 0)) == (-1, 0)

    def test_horizontal_player_pawn_direction(self):
        player = Player(
            id="player2",
            orientation="horizontal",
            piece_row=0,
            piece_col=0,
            front_pawn_line=1,
            back_pawn_line=-1,
            front_direction=(0, 1),
            back_direction=(0, -1),
            piece_positions=[],
        )
        # Front pawn at col 1 should move right
        assert player.get_pawn_direction(Position(0, 1)) == (0, 1)
        # Back pawn at col -1 should move left
        assert player.get_pawn_direction(Position(0, -1)) == (0, -1)

    def test_is_pawn_on_starting_line_vertical(self):
        player = Player(
            id="player1",
            orientation="vertical",
            piece_row=0,
            piece_col=0,
            front_pawn_line=1,
            back_pawn_line=-1,
            front_direction=(1, 0),
            back_direction=(-1, 0),
            piece_positions=[],
        )
        assert player.is_pawn_on_starting_line(Position(1, 0)) is True
        assert player.is_pawn_on_starting_line(Position(-1, 0)) is True
        assert player.is_pawn_on_starting_line(Position(0, 0)) is False
        assert player.is_pawn_on_starting_line(Position(2, 0)) is False

    def test_is_pawn_on_starting_line_horizontal(self):
        player = Player(
            id="player2",
            orientation="horizontal",
            piece_row=0,
            piece_col=0,
            front_pawn_line=1,
            back_pawn_line=-1,
            front_direction=(0, 1),
            back_direction=(0, -1),
            piece_positions=[],
        )
        assert player.is_pawn_on_starting_line(Position(0, 1)) is True
        assert player.is_pawn_on_starting_line(Position(0, -1)) is True
        assert player.is_pawn_on_starting_line(Position(0, 0)) is False

    def test_to_dict(self):
        player = Player(
            id="player1",
            orientation="vertical",
            piece_row=0,
            piece_col=0,
            front_pawn_line=1,
            back_pawn_line=-1,
            front_direction=(1, 0),
            back_direction=(-1, 0),
            piece_positions=[],
        )
        expected = {
            "id": "player1",
            "orientation": "vertical",
            "piece_row": 0,
            "piece_col": 0,
            "front_pawn_line": 1,
            "back_pawn_line": -1,
            "front_direction": [1, 0],
            "back_direction": [-1, 0],
            "alive": True,
        }
        assert player.to_dict() == expected


class TestBoardBasicOperations:
    """Tests for Board basic operations."""

    def test_empty_board(self):
        board = Board()
        assert len(board.pieces) == 0
        assert len(board.players) == 0

    def test_get_piece_empty(self):
        board = Board()
        assert board.get_piece(Position(0, 0)) is None

    def test_get_board_bounds_empty(self):
        board = Board()
        min_pos, max_pos = board.get_board_bounds()
        assert min_pos == Position(0, 0)
        assert max_pos == Position(0, 0)

    def test_get_board_bounds_with_pieces(self):
        board = Board()
        board.spawn_player()
        min_pos, max_pos = board.get_board_bounds()
        # First player is vertical with king at (0,0): rows -1 to 1, cols -4 to 3
        assert min_pos.row == -1
        assert max_pos.row == 1
        assert min_pos.col == -4
        assert max_pos.col == 3

    def test_get_pieces_in_range(self):
        board = Board()
        board.spawn_player()
        # Get pieces in a small range - first player is vertical with king at (0,0)
        # Pieces are arranged horizontally from col -4 to col 3
        pieces = board.get_pieces_in_range(Position(0, -4), Position(0, -2))
        assert len(pieces) == 3  # rook, knight, bishop in row 0

    def test_get_player_pieces_nonexistent(self):
        board = Board()
        assert board.get_player_pieces("nonexistent") == []

    def test_to_dict(self):
        board = Board()
        board.spawn_player()
        d = board.to_dict()
        assert "pieces" in d
        assert "players" in d
        assert len(d["pieces"]) == 24
        assert len(d["players"]) == 1


class TestPlayerSpawning:
    """Tests for player spawning."""

    def test_first_player_position(self):
        board = Board()
        player_id, pos = board.spawn_player()
        assert player_id == "player1"
        assert pos == Position(0, 0)

    def test_first_player_orientation(self):
        board = Board()
        player_id, _ = board.spawn_player()
        player = board.players[player_id]
        assert player.orientation == "vertical"

    def test_first_player_piece_count(self):
        board = Board()
        player_id, _ = board.spawn_player()
        pieces = board.get_player_pieces(player_id)
        assert len(pieces) == 24  # 8 main pieces + 16 pawns

    def test_first_player_piece_types(self):
        board = Board()
        player_id, _ = board.spawn_player()
        pieces = board.get_player_pieces(player_id)
        type_counts: dict[str, int] = {}
        for p in pieces:
            type_counts[p.type] = type_counts.get(p.type, 0) + 1
        assert type_counts["pawn"] == 16
        assert type_counts["rook"] == 2
        assert type_counts["knight"] == 2
        assert type_counts["bishop"] == 2
        assert type_counts["queen"] == 1
        assert type_counts["king"] == 1

    def test_custom_player_id(self):
        board = Board()
        player_id, _ = board.spawn_player("custom_id")
        assert player_id == "custom_id"
        assert "custom_id" in board.players

    def test_second_player_different_orientation(self):
        board = Board()
        board.spawn_player()
        p2_id, _ = board.spawn_player()
        player2 = board.players[p2_id]
        assert player2.orientation == "horizontal"

    def test_second_player_spawns_at_neighbor(self):
        """Second player should spawn at one of the 4 diagonal neighbors of player 1."""
        board = Board()
        _, p1_king_pos = board.spawn_player()
        _, p2_king_pos = board.spawn_player()

        # Player 2 should be at +/- 7 in both x and y from player 1's king
        expected_neighbors = [
            Position(p1_king_pos.row - 7, p1_king_pos.col - 7),
            Position(p1_king_pos.row - 7, p1_king_pos.col + 7),
            Position(p1_king_pos.row + 7, p1_king_pos.col - 7),
            Position(p1_king_pos.row + 7, p1_king_pos.col + 7),
        ]
        assert p2_king_pos in expected_neighbors

    def test_third_player_spawns_at_neighbor_of_existing(self):
        """Third player should spawn at a neighbor of player 1 or 2."""
        board = Board()
        _, p1_king_pos = board.spawn_player()
        _, p2_king_pos = board.spawn_player()
        _, p3_king_pos = board.spawn_player()

        # Helper to get diagonal neighbors at +/- 7
        def get_neighbors(pos: Position) -> set[Position]:
            offsets = [(-7, -7), (-7, 7), (7, -7), (7, 7)]
            return {Position(pos.row + dr, pos.col + dc) for dr, dc in offsets}

        # Player 3 is vertical, should be at a neighbor of p1 or p2
        p1_neighbors = get_neighbors(p1_king_pos)
        p2_neighbors = get_neighbors(p2_king_pos)
        all_vertical_candidates = p1_neighbors | p2_neighbors
        # Remove occupied positions
        all_vertical_candidates.discard(p1_king_pos)
        all_vertical_candidates.discard(p2_king_pos)

        assert p3_king_pos in all_vertical_candidates

    def test_spawning_many_players_alternates_orientation(self):
        """Verify orientation alternates correctly for many players."""
        board = Board()
        for i in range(10):
            player_id, _ = board.spawn_player()
            player = board.players[player_id]
            expected_orientation = "vertical" if (i + 1) % 2 == 1 else "horizontal"
            assert (
                player.orientation == expected_orientation
            ), f"Player {i + 1} should be {expected_orientation}"

    def test_all_pawns_can_move(self):
        board = Board()
        player_id, _ = board.spawn_player()
        moves = board.get_legal_moves(player_id)
        player = board.players[player_id]
        pawn_positions = [
            pos
            for pos in player.piece_positions
            if (p := board.get_piece(pos)) and p.type == "pawn"
        ]
        for pawn_pos in pawn_positions:
            assert pawn_pos in moves, f"Pawn at {pawn_pos} has no legal moves"


class TestPawnMoves:
    """Tests for pawn movement."""

    def test_pawn_forward_one(self):
        board = Board()
        player_id, _ = board.spawn_player()
        player = board.players[player_id]
        # First player is vertical with king at (0,0), pieces from col -4 to 3
        # Front pawn line is row 1, pawns at cols -4 to 3
        pawn_pos = Position(player.front_pawn_line, -4)
        moves = board.get_legal_moves(player_id)
        assert Position(2, -4) in moves[pawn_pos]

    def test_pawn_forward_two_from_start(self):
        board = Board()
        player_id, _ = board.spawn_player()
        player = board.players[player_id]
        pawn_pos = Position(player.front_pawn_line, -4)
        moves = board.get_legal_moves(player_id)
        assert Position(3, -4) in moves[pawn_pos]

    def test_pawn_no_forward_two_after_moving(self):
        board = Board()
        player_id, _ = board.spawn_player()
        player = board.players[player_id]
        pawn_pos = Position(player.front_pawn_line, -4)
        # Move pawn forward one
        board.move_piece(pawn_pos, Position(2, -4), player_id)
        # Now it should only be able to move one square
        moves = board.get_legal_moves(player_id)
        new_pos = Position(2, -4)
        assert new_pos in moves
        assert Position(3, -4) in moves[new_pos]
        assert Position(4, -4) not in moves[new_pos]

    def test_pawn_diagonal_capture(self):
        board = Board()
        p1, _ = board.spawn_player()
        player = board.players[p1]
        # Place enemy piece diagonally from a front pawn
        enemy_pos = Position(2, -3)
        board.pieces[enemy_pos] = Piece("pawn", "enemy", enemy_pos)

        pawn_pos = Position(player.front_pawn_line, -4)
        moves = board.get_legal_moves(p1)
        # Should be able to capture diagonally
        assert enemy_pos in moves[pawn_pos]

    def test_pawn_cannot_capture_own_piece(self):
        board = Board()
        p1, _ = board.spawn_player()
        player = board.players[p1]
        # Front pawns are all on row 1, cols -4 to 3
        pawn_pos = Position(player.front_pawn_line, -4)
        moves = board.get_legal_moves(p1)
        # Should not be able to capture adjacent friendly pawn at (1, -3)
        assert Position(player.front_pawn_line, -3) not in moves.get(pawn_pos, [])

    def test_back_pawn_moves_opposite_direction(self):
        board = Board()
        player_id, _ = board.spawn_player()
        player = board.players[player_id]
        # Back pawn at row -1 should move toward negative rows
        back_pawn_pos = Position(player.back_pawn_line, -4)
        moves = board.get_legal_moves(player_id)
        assert Position(-2, -4) in moves[back_pawn_pos]
        assert Position(-3, -4) in moves[back_pawn_pos]

    def test_pawn_continues_direction_after_move(self):
        board = Board()
        player_id, _ = board.spawn_player()
        player = board.players[player_id]
        pawn_pos = Position(player.front_pawn_line, -4)
        # Move forward 2
        board.move_piece(pawn_pos, Position(3, -4), player_id)
        # Should continue forward, not backward
        moves = board.get_legal_moves(player_id)
        new_pos = Position(3, -4)
        assert Position(4, -4) in moves[new_pos]
        assert Position(2, -4) not in moves[new_pos]


class TestKnightMoves:
    """Tests for knight movement."""

    def test_knight_l_shape_moves(self):
        board = Board()
        # Place a lone knight
        knight_pos = Position(4, 4)
        board.players["p1"] = Player(
            id="p1",
            orientation="vertical",
            piece_row=0,
            piece_col=0,
            front_pawn_line=1,
            back_pawn_line=-1,
            front_direction=(1, 0),
            back_direction=(-1, 0),
            piece_positions=[knight_pos],
        )
        board.pieces[knight_pos] = Piece("knight", "p1", knight_pos)

        moves = board.get_legal_moves("p1")
        expected = [
            Position(2, 3),
            Position(2, 5),
            Position(3, 2),
            Position(3, 6),
            Position(5, 2),
            Position(5, 6),
            Position(6, 3),
            Position(6, 5),
        ]
        for pos in expected:
            assert pos in moves[knight_pos]

    def test_knight_can_jump(self):
        board = Board()
        board.spawn_player()
        # Knights at (0, -3) and (0, 2) can jump over pawns (vertical player, king at 0,0)
        moves = board.get_legal_moves("player1")
        knight_pos = Position(0, -3)
        assert knight_pos in moves
        assert len(moves[knight_pos]) > 0


class TestRookMoves:
    """Tests for rook movement."""

    def test_rook_orthogonal_moves(self):
        board = Board()
        rook_pos = Position(4, 4)
        board.players["p1"] = Player(
            id="p1",
            orientation="vertical",
            piece_row=0,
            piece_col=0,
            front_pawn_line=1,
            back_pawn_line=-1,
            front_direction=(1, 0),
            back_direction=(-1, 0),
            piece_positions=[rook_pos],
        )
        board.pieces[rook_pos] = Piece("rook", "p1", rook_pos)

        moves = board.get_legal_moves("p1")
        # Should have 7 moves in each direction (up to 7 squares)
        assert len(moves[rook_pos]) == 28  # 7*4 directions

    def test_rook_blocked_by_piece(self):
        board = Board()
        rook_pos = Position(4, 4)
        blocker_pos = Position(4, 6)
        board.players["p1"] = Player(
            id="p1",
            orientation="vertical",
            piece_row=0,
            piece_col=0,
            front_pawn_line=1,
            back_pawn_line=-1,
            front_direction=(1, 0),
            back_direction=(-1, 0),
            piece_positions=[rook_pos, blocker_pos],
        )
        board.pieces[rook_pos] = Piece("rook", "p1", rook_pos)
        board.pieces[blocker_pos] = Piece("pawn", "p1", blocker_pos)

        moves = board.get_legal_moves("p1")
        # Can move to col 5 but not 6 or beyond (blocked by own piece)
        assert Position(4, 5) in moves[rook_pos]
        assert Position(4, 6) not in moves[rook_pos]
        assert Position(4, 7) not in moves[rook_pos]


class TestBishopMoves:
    """Tests for bishop movement."""

    def test_bishop_diagonal_moves(self):
        board = Board()
        bishop_pos = Position(4, 4)
        board.players["p1"] = Player(
            id="p1",
            orientation="vertical",
            piece_row=0,
            piece_col=0,
            front_pawn_line=1,
            back_pawn_line=-1,
            front_direction=(1, 0),
            back_direction=(-1, 0),
            piece_positions=[bishop_pos],
        )
        board.pieces[bishop_pos] = Piece("bishop", "p1", bishop_pos)

        moves = board.get_legal_moves("p1")
        # 7 squares in each of 4 diagonals
        assert len(moves[bishop_pos]) == 28


class TestQueenMoves:
    """Tests for queen movement."""

    def test_queen_all_directions(self):
        board = Board()
        queen_pos = Position(4, 4)
        board.players["p1"] = Player(
            id="p1",
            orientation="vertical",
            piece_row=0,
            piece_col=0,
            front_pawn_line=1,
            back_pawn_line=-1,
            front_direction=(1, 0),
            back_direction=(-1, 0),
            piece_positions=[queen_pos],
        )
        board.pieces[queen_pos] = Piece("queen", "p1", queen_pos)

        moves = board.get_legal_moves("p1")
        # 7 squares in each of 8 directions
        assert len(moves[queen_pos]) == 56


class TestKingMoves:
    """Tests for king movement."""

    def test_king_one_square(self):
        board = Board()
        king_pos = Position(4, 4)
        board.players["p1"] = Player(
            id="p1",
            orientation="vertical",
            piece_row=0,
            piece_col=0,
            front_pawn_line=1,
            back_pawn_line=-1,
            front_direction=(1, 0),
            back_direction=(-1, 0),
            piece_positions=[king_pos],
        )
        board.pieces[king_pos] = Piece("king", "p1", king_pos)

        moves = board.get_legal_moves("p1")
        # 8 surrounding squares
        assert len(moves[king_pos]) == 8
        expected = [
            Position(3, 3),
            Position(3, 4),
            Position(3, 5),
            Position(4, 3),
            Position(4, 5),
            Position(5, 3),
            Position(5, 4),
            Position(5, 5),
        ]
        for pos in expected:
            assert pos in moves[king_pos]


class TestMoveExecution:
    """Tests for move_piece() execution."""

    def test_move_success(self):
        board = Board()
        p1, _ = board.spawn_player()
        player = board.players[p1]
        pawn_pos = Position(player.front_pawn_line, -4)
        result = board.move_piece(pawn_pos, Position(2, -4), p1)
        assert result["success"] is True
        assert board.get_piece(pawn_pos) is None
        moved_piece = board.get_piece(Position(2, -4))
        assert moved_piece is not None
        assert moved_piece.type == "pawn"

    def test_move_no_piece(self):
        board = Board()
        board.spawn_player()
        result = board.move_piece(Position(5, 5), Position(6, 5), "player1")
        assert result["success"] is False
        assert "No piece" in result["error"]

    def test_move_wrong_player(self):
        board = Board()
        p1, _ = board.spawn_player()
        player = board.players[p1]
        pawn_pos = Position(player.front_pawn_line, -4)
        result = board.move_piece(pawn_pos, Position(2, -4), "wrong_player")
        assert result["success"] is False
        assert "doesn't belong" in result["error"]

    def test_move_illegal(self):
        board = Board()
        p1, _ = board.spawn_player()
        player = board.players[p1]
        pawn_pos = Position(player.front_pawn_line, -4)
        # Try to move pawn sideways
        result = board.move_piece(pawn_pos, Position(player.front_pawn_line, -3), p1)
        assert result["success"] is False
        assert "Illegal" in result["error"]

    def test_capture_enemy_piece(self):
        board = Board()
        p1, _ = board.spawn_player()
        player = board.players[p1]
        # Place enemy piece diagonally from a front pawn
        enemy_pos = Position(2, -3)
        board.pieces[enemy_pos] = Piece("pawn", "enemy", enemy_pos)

        pawn_pos = Position(player.front_pawn_line, -4)
        result = board.move_piece(pawn_pos, enemy_pos, p1)
        assert result["success"] is True
        # Our piece should now be there
        captured_piece = board.get_piece(enemy_pos)
        assert captured_piece is not None
        assert captured_piece.player_id == p1


class TestPawnPromotion:
    """Tests for pawn promotion."""

    def test_promotion_required(self):
        board = Board()
        p1, _ = board.spawn_player()
        player = board.players[p1]

        # For vertical player, front pawns move in row direction
        # Promotion is 6 squares from front_pawn_line
        promotion_row = player.front_pawn_line + 6
        pawn_pos = Position(promotion_row - 1, -4)
        board.pieces[pawn_pos] = Piece("pawn", p1, pawn_pos, origin=-4)
        player.piece_positions.append(pawn_pos)

        # Try to move to promotion rank without specifying piece
        result = board.move_piece(pawn_pos, Position(promotion_row, -4), p1)
        assert result["success"] is False
        assert result["promotion_available"] is True

    def test_promotion_to_queen(self):
        board = Board()
        p1, _ = board.spawn_player()
        player = board.players[p1]

        promotion_row = player.front_pawn_line + 6
        pawn_pos = Position(promotion_row - 1, -4)
        board.pieces[pawn_pos] = Piece("pawn", p1, pawn_pos, origin=-4)
        player.piece_positions.append(pawn_pos)

        result = board.move_piece(
            pawn_pos, Position(promotion_row, -4), p1, promotion_piece="queen"
        )
        assert result["success"] is True
        assert result["moved_piece_type"] == "queen"
        promoted_piece = board.get_piece(Position(promotion_row, -4))
        assert promoted_piece is not None
        assert promoted_piece.type == "queen"

    def test_promotion_spawns_new_pawn(self):
        board = Board()
        p1, _ = board.spawn_player()
        player = board.players[p1]

        # Remove the pawn at front_pawn_line, col -4 first
        board.remove_piece(Position(player.front_pawn_line, -4))

        # Place a pawn ready to promote, with origin set to col -4
        promotion_row = player.front_pawn_line + 6
        pawn_pos = Position(promotion_row - 1, -4)
        board.pieces[pawn_pos] = Piece("pawn", p1, pawn_pos, origin=-4)
        player.piece_positions.append(pawn_pos)

        result = board.move_piece(
            pawn_pos, Position(promotion_row, -4), p1, promotion_piece="queen"
        )
        assert result["spawned_pawn"] is True
        # New pawn should spawn at the front pawn line at the original column
        spawned_pawn = board.get_piece(Position(player.front_pawn_line, -4))
        assert spawned_pawn is not None
        assert spawned_pawn.type == "pawn"

    def test_promotion_to_all_pieces(self):
        for promotion_type in ["queen", "rook", "bishop", "knight"]:
            board = Board()
            p1, _ = board.spawn_player()
            player = board.players[p1]

            promotion_row = player.front_pawn_line + 6
            pawn_pos = Position(promotion_row - 1, -4)
            board.pieces[pawn_pos] = Piece("pawn", p1, pawn_pos, origin=-4)
            player.piece_positions.append(pawn_pos)

            result = board.move_piece(
                pawn_pos,
                Position(promotion_row, -4),
                p1,
                promotion_piece=promotion_type,
            )
            assert result["success"] is True
            assert result["moved_piece_type"] == promotion_type

    def test_promotion_after_diagonal_capture_spawns_at_origin(self):
        """Pawn that captured diagonally should spawn new pawn at original column."""
        board = Board()
        p1, _ = board.spawn_player()
        player = board.players[p1]

        # Remove pawn at front_pawn_line, col -1 to make room for spawn
        board.remove_piece(Position(player.front_pawn_line, -1))

        # Place pawn one square from promotion with origin=-1 (simulating diagonal captures)
        promotion_row = player.front_pawn_line + 6
        pawn_pos = Position(promotion_row - 1, 0)
        board.pieces[pawn_pos] = Piece("pawn", p1, pawn_pos, origin=-1)
        player.piece_positions.append(pawn_pos)

        # Place enemy to capture diagonally at promotion rank
        enemy_pos = Position(promotion_row, 1)
        board.pieces[enemy_pos] = Piece("pawn", "enemy", enemy_pos)

        result = board.move_piece(pawn_pos, enemy_pos, p1, promotion_piece="queen")
        assert result["success"] is True
        assert result["spawned_pawn"] is True
        # New pawn should spawn at original column (-1), not current column (0 or 1)
        assert result["spawn_position"] == {"row": player.front_pawn_line, "col": -1}
        spawned = board.get_piece(Position(player.front_pawn_line, -1))
        assert spawned is not None
        assert spawned.type == "pawn"
        assert spawned.origin == -1


class TestRemovePiece:
    """Tests for remove_piece()."""

    def test_remove_existing_piece(self):
        board = Board()
        board.spawn_player()
        pos = Position(0, -4)  # Rook position (vertical player, king at 0,0)
        piece = board.remove_piece(pos)
        assert piece is not None
        assert piece.type == "rook"
        assert board.get_piece(pos) is None

    def test_remove_nonexistent_piece(self):
        board = Board()
        piece = board.remove_piece(Position(99, 99))
        assert piece is None

    def test_remove_updates_player_positions(self):
        board = Board()
        p1, _ = board.spawn_player()
        player = board.players[p1]
        pos = Position(0, -4)  # Rook position
        initial_count = len(player.piece_positions)
        board.remove_piece(pos)
        assert len(player.piece_positions) == initial_count - 1
        assert pos not in player.piece_positions


class TestBoardSerialization:
    """Tests for board serialization and deserialization."""

    def test_to_dict_and_from_dict_roundtrip(self):
        board = Board()
        p1, _ = board.spawn_player()
        player = board.players[p1]
        board.spawn_player()

        # Make a move to change state
        board.move_piece(Position(player.front_pawn_line, -4), Position(2, -4), p1)

        # Serialize and deserialize
        data = board.to_dict()
        restored = Board.from_dict(data)

        # Check pieces match
        assert len(restored.pieces) == len(board.pieces)
        for pos, piece in board.pieces.items():
            assert pos in restored.pieces
            assert restored.pieces[pos].type == piece.type
            assert restored.pieces[pos].player_id == piece.player_id

        # Check players match
        assert set(restored.players.keys()) == set(board.players.keys())
        for pid in board.players:
            orig = board.players[pid]
            rest = restored.players[pid]
            assert rest.orientation == orig.orientation
            assert rest.front_direction == orig.front_direction
            assert rest.back_direction == orig.back_direction

    def test_from_dict_with_stones(self):
        board = Board()
        p1, _ = board.spawn_player()

        # Capture king to create stones (king at 0, 0 for vertical player)
        board.remove_piece(Position(0, 0))

        # Serialize and deserialize
        data = board.to_dict()
        restored = Board.from_dict(data)

        # Stones should be preserved
        stone_count = sum(1 for p in restored.pieces.values() if p.type == "stone")
        assert stone_count > 0

        # Player should be marked as dead
        assert p1 in restored.players
        assert restored.players[p1].alive is False


class TestKingCaptureAndStones:
    """Tests for king capture and stone conversion."""

    def test_capturing_king_converts_pieces_to_stones(self):
        board = Board()
        p1, _ = board.spawn_player()

        # Find the king position
        king_pos: Position | None = None
        for pos in board.players[p1].piece_positions:
            piece = board.get_piece(pos)
            if piece and piece.type == "king":
                king_pos = pos
                break

        # Remove the king (simulating capture)
        assert king_pos is not None
        board.remove_piece(king_pos)

        # Player should be marked as dead
        assert p1 in board.players
        assert board.players[p1].alive is False

        # All remaining pieces should be stones
        for piece in board.pieces.values():
            if piece.player_id == p1:
                assert piece.type == "stone"

    def test_stones_have_no_legal_moves(self):
        board = Board()
        p1, _ = board.spawn_player()

        # Find and remove the king (king at 0,0 for vertical player)
        king_pos = Position(0, 0)
        board.remove_piece(king_pos)

        # Player is gone, so get_legal_moves returns empty
        moves = board.get_legal_moves(p1)
        assert moves == {}

    def test_stones_can_be_captured(self):
        board = Board()
        board.spawn_player()
        p2, _ = board.spawn_player()

        # Remove p1's king to convert pieces to stones (king at 0,0)
        king_pos = Position(0, 0)
        board.remove_piece(king_pos)

        # Place a p2 piece adjacent to a stone
        stone_pos = Position(0, -4)  # Former rook, now stone
        stone = board.get_piece(stone_pos)
        assert stone is not None
        assert stone.type == "stone"

        # Place p2's rook nearby to capture
        attacker_pos = Position(0, -5)
        board.pieces[attacker_pos] = Piece("rook", p2, attacker_pos)
        board.players[p2].piece_positions.append(attacker_pos)

        # Should be able to capture the stone
        moves = board.get_legal_moves(p2)
        assert stone_pos in moves.get(attacker_pos, [])

        # Execute capture
        result = board.move_piece(attacker_pos, stone_pos, p2)
        assert result["success"] is True
        captured = board.get_piece(stone_pos)
        assert captured is not None
        assert captured.type == "rook"

    def test_own_stones_can_be_captured(self):
        board = Board()
        p1, _ = board.spawn_player()

        stone_pos = Position(0, 4)
        board.pieces[stone_pos] = Piece("stone", p1, stone_pos)
        board.players[p1].piece_positions.append(stone_pos)

        attacker_pos = Position(0, 1)
        board.pieces[attacker_pos] = Piece("rook", p1, attacker_pos)
        board.players[p1].piece_positions.append(attacker_pos)

        moves = board.get_legal_moves(p1)
        assert stone_pos in moves.get(attacker_pos, [])

        result = board.move_piece(attacker_pos, stone_pos, p1)
        assert result["success"] is True
        assert board.get_piece(stone_pos) is not None
        assert board.get_piece(stone_pos).type == "rook"

    def test_stones_block_movement(self):
        board = Board()
        board.spawn_player()
        p2, _ = board.spawn_player()

        # Remove p1's king (at 0,0)
        king_pos = Position(0, 0)
        board.remove_piece(king_pos)

        # Stone at (0, -4) should block p2's rook from sliding through
        stone_pos = Position(0, -4)
        stone = board.get_piece(stone_pos)
        assert stone is not None
        assert stone.type == "stone"

        # Place p2's rook at (0, -7)
        attacker_pos = Position(0, -7)
        board.pieces[attacker_pos] = Piece("rook", p2, attacker_pos)
        board.players[p2].piece_positions.append(attacker_pos)

        moves = board.get_legal_moves(p2)
        rook_moves = moves.get(attacker_pos, [])

        # Can move to -6, -5, and capture at -4, but not beyond
        assert Position(0, -6) in rook_moves
        assert Position(0, -5) in rook_moves
        assert Position(0, -4) in rook_moves  # Can capture stone
        assert Position(0, -3) not in rook_moves  # Blocked by stone

    def test_multiple_kings_captured_sequentially(self):
        board = Board()
        p1, _ = board.spawn_player()
        p2, _ = board.spawn_player()

        # Capture p1's king (at 0,0 for vertical player)
        board.remove_piece(Position(0, 0))
        assert board.players[p1].alive is False

        # p2 should still be active
        assert board.players[p2].alive is True

        # Capture p2's king
        p2_king_pos: Position | None = None
        for pos in list(board.players[p2].piece_positions):
            piece = board.get_piece(pos)
            if piece and piece.type == "king":
                p2_king_pos = pos
                break

        assert p2_king_pos is not None
        board.remove_piece(p2_king_pos)
        assert board.players[p2].alive is False
