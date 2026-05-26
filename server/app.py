from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from board import Board, Position, Piece
import uuid
import os
from db import init_db, save_game, load_game, get_public_games
from typing import Union, Tuple, cast

app = Flask(__name__)
# Enable CORS - allow all origins for public API
# This allows requests from GitHub Pages and any other frontend
CORS(app, origins="*", allow_headers=["Content-Type"], methods=["GET", "POST", "OPTIONS"])

# Add after_request handler to ensure CORS headers are always set
@app.after_request
def after_request(response):
    # Force CORS headers on every response
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    return response

# Initialize the database
init_db()  # Database initialized


@app.route("/start_new_game", methods=["POST"])
def start_new_game() -> Response:
    data = request.get_json() or {}
    visibility = data.get("visibility", "unlisted")
    
    # Validate visibility
    if visibility not in ["public", "unlisted"]:
        return (
            cast(Response, jsonify({"success": False, "error": "Invalid visibility. Must be 'public' or 'unlisted'"})),
            400,
        )
    
    game_id = str(uuid.uuid4())
    board = Board()

    # Spawn the first player using the spawn_player method
    player_id, spawn_position = board.spawn_player()

    # Save the new game to the database with visibility
    save_game(game_id, board, visibility)

    return cast(Response, jsonify({"success": True, "gameId": game_id}))


@app.route("/join_game", methods=["POST"])
def join_game() -> Union[Response, Tuple[Response, int]]:
    """Allow a new player to join an existing game."""
    data = request.get_json()
    game_id = data.get("gameId")
    if not game_id:
        return (
            cast(Response, jsonify({"success": False, "error": "Invalid game ID"})),
            400,
        )

    board = load_game(game_id)
    if not board:
        return (
            cast(Response, jsonify({"success": False, "error": "Game not found"})),
            404,
        )

    # Spawn the new player using the Board class method
    player_id, spawn_position = board.spawn_player()

    # Save the updated game state
    save_game(game_id, board)

    return cast(
        Response,
        jsonify(
            {
                "success": True,
                "playerId": player_id,
                "spawnPosition": {"row": spawn_position.row, "col": spawn_position.col},
            }
        ),
    )


@app.route("/legal_moves", methods=["POST"])
def legal_moves() -> Union[Response, Tuple[Response, int]]:
    data = request.get_json()
    game_id = data.get("gameId")
    player_id = data.get("playerId")
    if not game_id or not player_id:
        return (
            cast(
                Response,
                jsonify({"success": False, "error": "Invalid game ID or player ID"}),
            ),
            400,
        )

    board = load_game(game_id)
    if not board:
        return (
            cast(Response, jsonify({"success": False, "error": "Game not found"})),
            404,
        )

    # Get legal moves for the specified player
    moves_dict = board.get_legal_moves(player_id)

    # Convert the moves dictionary to the format expected by the frontend
    legal_moves = [
        {
            "from": {"row": from_pos.row, "col": from_pos.col},
            "to": {"row": to_pos.row, "col": to_pos.col},
        }
        for from_pos, to_positions in moves_dict.items()
        for to_pos in to_positions
    ]

    return cast(Response, jsonify(legal_moves))


@app.route("/make_move", methods=["POST"])
def make_move() -> Union[Response, Tuple[Response, int]]:
    data = request.get_json()
    game_id = data.get("gameId")
    player_id = data.get("playerId")
    if not game_id or not player_id:
        return (
            cast(Response, jsonify({"success": False, "error": "Invalid game ID or player ID"})),
            400,
        )

    board = load_game(game_id)
    if not board:
        return (
            cast(Response, jsonify({"success": False, "error": "Game not found"})),
            404,
        )

    # Convert the request data to our internal types
    from_pos = Position(row=data["from"]["row"], col=data["from"]["col"])
    to_pos = Position(row=data["to"]["row"], col=data["to"]["col"])
    promotion_piece = data.get("promotionPiece")  # Get the promotion piece type

    # Try to make the move
    result = board.move_piece(from_pos, to_pos, player_id, promotion_piece)

    # If the move was successful, save the updated game state
    if result["success"]:
        save_game(game_id, board)

    return cast(Response, jsonify(result))


@app.route("/get_board_state", methods=["POST"])
def get_board_state() -> Union[Response, Tuple[Response, int]]:
    data = request.get_json()
    game_id = data.get("gameId")
    if not game_id:
        return (
            cast(Response, jsonify({"success": False, "error": "Invalid game ID"})),
            400,
        )

    board = load_game(game_id)
    if not board:
        return (
            cast(Response, jsonify({"success": False, "error": "Game not found"})),
            404,
        )

    pieces = []
    for pos, piece in board.pieces.items():
        pieces.append(
            {
                "type": piece.type,
                "player_id": piece.player_id,
                "position": {"row": pos.row, "col": pos.col},
            }
        )

    # Convert pawn_directions to the format expected by frontend
    # Ensure all players have pawn_directions set (fallback for old games)
    pawn_directions = {}
    
    # Get all unique player IDs from pieces
    all_player_ids = set()
    for piece in board.pieces.values():
        all_player_ids.add(piece.player_id)
    
    # Recalculate directions based on player number (spiral pattern)
    for player_id in all_player_ids:
        try:
            player_num = int(player_id.replace("player", ""))
        except ValueError:
            player_num = 1
        
        if player_num == 1:
            direction = (-1, 0)  # Upward
        else:
            ring = (player_num - 2) // 4
            side = (player_num - 2) % 4
            if side == 0:  # Right side -> Leftward
                direction = (0, -1)
            elif side == 1:  # Top side -> Downward
                direction = (1, 0)
            elif side == 2:  # Left side -> Rightward
                direction = (0, 1)
            else:  # Bottom side -> Upward
                direction = (-1, 0)
        
        # Update the board's pawn_directions if it's different
        if player_id not in board.pawn_directions or board.pawn_directions[player_id] != direction:
            board.pawn_directions[player_id] = direction
            save_game(game_id, board)  # Save the updated board with directions
        
        pawn_directions[player_id] = {"row": direction[0], "col": direction[1]}

    return cast(
        Response,
        jsonify(
            {"success": True, "pieces": pieces, "pawn_directions": pawn_directions}
        ),
    )


@app.route("/get_cooldown", methods=["POST"])
def get_cooldown() -> Union[Response, Tuple[Response, int]]:
    data = request.get_json()
    game_id = data.get("gameId")
    player_id = data.get("playerId")
    if not game_id or not player_id:
        return (
            cast(Response, jsonify({"success": False, "error": "Invalid game ID or player ID"})),
            400,
        )

    board = load_game(game_id)
    if not board:
        return (
            cast(Response, jsonify({"success": False, "error": "Game not found"})),
            404,
        )

    cooldown_remaining = board.get_cooldown_remaining(player_id)
    return cast(
        Response,
        jsonify({"success": True, "cooldown_remaining": round(cooldown_remaining, 2)}),
    )


@app.route("/list_public_games", methods=["GET"])
def list_public_games() -> Response:
    """List all public games."""
    public_games = get_public_games()
    games_list = [{"gameId": game_id, "visibility": visibility} for game_id, visibility in public_games]
    return cast(Response, jsonify({"success": True, "games": games_list}))


if __name__ == "__main__":
    # Railway provides PORT environment variable, default to 8080 for local dev
    port = int(os.environ.get("PORT", 8080))
    # Use 0.0.0.0 to bind to all interfaces (required for Railway)
    # Disable debug mode in production
    debug = os.environ.get("FLASK_ENV") == "development"
    app.run(host="0.0.0.0", port=port, debug=debug)
