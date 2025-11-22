from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from board import Board, Position, Piece
import uuid
import os
from db import init_db, save_game, load_game
from typing import Union, Tuple, cast

app = Flask(__name__)
# Enable CORS - explicitly allow GitHub Pages origin
CORS(app, origins=[
    "https://kesav-v.github.io",
    "http://localhost:3000",  # For local development
    "http://localhost:8080",  # For local development
], supports_credentials=True)

# Initialize the database
init_db()

VISIBLE_RANGE_PADDING = 7


@app.route("/start_new_game", methods=["POST"])
def start_new_game() -> Response:
    game_id = str(uuid.uuid4())
    board = Board()

    # Spawn the first player using the spawn_player method
    player_id, spawn_position = board.spawn_player(visible_range_padding=VISIBLE_RANGE_PADDING)

    # Save the new game to the database
    save_game(game_id, board)

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
    player_id, spawn_position = board.spawn_player(
        visible_range_padding=VISIBLE_RANGE_PADDING
    )

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

    return cast(
        Response,
        jsonify(
            {"success": True, "pieces": pieces}
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


if __name__ == "__main__":
    # Railway provides PORT environment variable, default to 8080 for local dev
    port = int(os.environ.get("PORT", 8080))
    # Use 0.0.0.0 to bind to all interfaces (required for Railway)
    # Disable debug mode in production
    debug = os.environ.get("FLASK_ENV") == "development"
    app.run(host="0.0.0.0", port=port, debug=debug)
