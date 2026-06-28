#!/usr/bin/env python3
"""Interactive CLI debugger for infinite chess."""

import curses
import json
import os
from .board import Board, Position, Piece

PIECE_SYMBOLS: dict[str, str] = {
    "king": "K",
    "queen": "Q",
    "rook": "R",
    "bishop": "B",
    "knight": "N",
    "pawn": "P",
    "stone": "#",
}

PLAYER_COLORS: list[int] = [
    curses.COLOR_WHITE,
    curses.COLOR_CYAN,
    curses.COLOR_YELLOW,
    curses.COLOR_GREEN,
    curses.COLOR_MAGENTA,
    curses.COLOR_RED,
    curses.COLOR_BLUE,
]


class ChessCLI:
    def __init__(self, stdscr: "curses.window") -> None:
        self.stdscr = stdscr
        self.board = Board()
        self.camera_row = 0
        self.camera_col = 0
        self.cursor_row = 0
        self.cursor_col = 0
        self.selected_pos: Position | None = None
        self.selected_piece: Piece | None = None
        self.legal_moves: list[Position] = []
        self.current_player_idx = 0
        self.status_message = "Press 'p' to spawn a player, 'q' to quit"
        self.player_ids: list[str] = []

        curses.start_color()
        curses.use_default_colors()
        for i, color in enumerate(PLAYER_COLORS):
            curses.init_pair(i + 1, color, -1)
        curses.init_pair(10, curses.COLOR_BLACK, curses.COLOR_WHITE)
        curses.init_pair(11, curses.COLOR_BLACK, curses.COLOR_GREEN)
        curses.init_pair(12, curses.COLOR_BLACK, curses.COLOR_YELLOW)

        curses.curs_set(0)
        self.stdscr.keypad(True)

    def get_player_color_pair(self, player_id: str) -> int:
        if player_id in self.player_ids:
            idx = self.player_ids.index(player_id)
            return curses.color_pair(1 + (idx % len(PLAYER_COLORS)))
        return curses.color_pair(1)

    def draw_board(self) -> None:
        self.stdscr.clear()
        height, width = self.stdscr.getmaxyx()

        board_height = height - 4
        board_width = (width - 20) // 2

        half_h = board_height // 2
        half_w = board_width // 2

        for screen_y in range(board_height):
            for screen_x in range(board_width):
                board_row = self.camera_row - half_h + screen_y
                board_col = self.camera_col - half_w + screen_x

                pos = Position(board_row, board_col)
                piece = self.board.get_piece(pos)

                is_cursor = (
                    board_row == self.cursor_row and board_col == self.cursor_col
                )
                is_selected = (
                    self.selected_pos
                    and self.selected_pos.row == board_row
                    and self.selected_pos.col == board_col
                )
                is_legal_move = pos in self.legal_moves

                display_x = screen_x * 2

                if piece:
                    symbol = PIECE_SYMBOLS.get(piece.type, "?")
                    color = self.get_player_color_pair(piece.player_id)
                    if is_cursor:
                        color = curses.color_pair(10) | curses.A_BOLD
                    elif is_selected:
                        color = curses.color_pair(12) | curses.A_BOLD
                    elif is_legal_move:
                        color = color | curses.A_REVERSE
                    try:
                        self.stdscr.addstr(screen_y, display_x, symbol, color)
                    except curses.error:
                        pass
                else:
                    if is_cursor:
                        char = "+"
                        color = curses.color_pair(10)
                    elif is_legal_move:
                        char = "·"
                        color = curses.color_pair(11)
                    else:
                        char = "·" if (board_row + board_col) % 2 == 0 else " "
                        color = curses.A_DIM
                    try:
                        self.stdscr.addstr(screen_y, display_x, char, color)
                    except curses.error:
                        pass

        info_x = board_width * 2 + 2
        try:
            self.stdscr.addstr(0, info_x, "=== Infinite Chess ===", curses.A_BOLD)
            self.stdscr.addstr(
                2, info_x, f"Cursor: ({self.cursor_row}, {self.cursor_col})"
            )
            self.stdscr.addstr(
                3, info_x, f"Camera: ({self.camera_row}, {self.camera_col})"
            )

            self.stdscr.addstr(5, info_x, "Players:", curses.A_BOLD)
            for i, pid in enumerate(self.player_ids):
                player = self.board.players.get(pid)
                if player:
                    marker = ">" if i == self.current_player_idx else " "
                    orient = "V" if player.orientation == "vertical" else "H"
                    color = self.get_player_color_pair(pid)
                    self.stdscr.addstr(
                        6 + i, info_x, f"{marker} {pid} [{orient}]", color
                    )

            if self.selected_piece and self.selected_pos:
                self.stdscr.addstr(
                    8 + len(self.player_ids), info_x, "Selected:", curses.A_BOLD
                )
                self.stdscr.addstr(
                    9 + len(self.player_ids),
                    info_x,
                    f"  {self.selected_piece.type} @ ({self.selected_pos.row}, {self.selected_pos.col})",
                )
                self.stdscr.addstr(
                    10 + len(self.player_ids),
                    info_x,
                    f"  {len(self.legal_moves)} legal moves",
                )

            controls_y = height - 5
            self.stdscr.addstr(controls_y, info_x, "Controls:", curses.A_BOLD)
            self.stdscr.addstr(controls_y + 1, info_x, "wasd=move  WASD=pan  p=spawn")
            self.stdscr.addstr(controls_y + 2, info_x, "ENTER=select/move  TAB=player")
            self.stdscr.addstr(controls_y + 3, info_x, "i=save  o=load  q=quit")

            self.stdscr.addstr(
                height - 1, 0, self.status_message[: width - 1], curses.A_REVERSE
            )
        except curses.error:
            pass

        self.stdscr.refresh()

    def spawn_player(self) -> None:
        player_id, pos = self.board.spawn_player()
        self.player_ids.append(player_id)
        self.current_player_idx = len(self.player_ids) - 1
        self.cursor_row = pos.row
        self.cursor_col = pos.col
        self.camera_row = pos.row
        self.camera_col = pos.col
        self.clear_selection()
        self.status_message = f"Spawned {player_id} at ({pos.row}, {pos.col})"

    def clear_selection(self) -> None:
        self.selected_pos = None
        self.selected_piece = None
        self.legal_moves = []

    def select_or_move(self) -> None:
        if not self.player_ids:
            self.status_message = "No players! Press 'p' to spawn one."
            return

        cursor_pos = Position(self.cursor_row, self.cursor_col)
        piece_at_cursor = self.board.get_piece(cursor_pos)

        if self.selected_piece and self.selected_pos:
            if cursor_pos in self.legal_moves:
                promotion = None
                owner = self.selected_piece.player_id
                if self.selected_piece.type == "pawn":
                    player = self.board.players.get(owner)
                    if player:
                        pawn_dir = player.get_pawn_direction(self.selected_pos)
                        row_dir, col_dir = pawn_dir

                        is_promotion = False
                        if player.orientation == "vertical":
                            if row_dir == player.front_direction[0]:
                                starting_line = player.front_pawn_line
                            else:
                                starting_line = player.back_pawn_line
                            is_promotion = cursor_pos.row == starting_line + (
                                row_dir * 6
                            )
                        else:  # horizontal
                            if col_dir == player.front_direction[1]:
                                starting_line = player.front_pawn_line
                            else:
                                starting_line = player.back_pawn_line
                            is_promotion = cursor_pos.col == starting_line + (
                                col_dir * 6
                            )

                        if is_promotion:
                            promotion = self.prompt_promotion()
                            if not promotion:
                                self.status_message = "Promotion cancelled"
                                return

                result = self.board.move_piece(
                    self.selected_pos, cursor_pos, owner, promotion
                )
                if result["success"]:
                    self.status_message = f"Moved {self.selected_piece.type} to ({cursor_pos.row}, {cursor_pos.col})"
                    if result.get("spawned_pawn"):
                        spawn_pos = result["spawn_position"]
                        self.status_message += (
                            f" | New pawn at ({spawn_pos['row']}, {spawn_pos['col']})"
                        )
                else:
                    self.status_message = (
                        f"Move failed: {result.get('error', 'unknown')}"
                    )
                self.clear_selection()
            elif piece_at_cursor:
                self.select_piece(
                    cursor_pos, piece_at_cursor, piece_at_cursor.player_id
                )
            else:
                self.clear_selection()
                self.status_message = "Selection cleared"
        else:
            if piece_at_cursor:
                self.select_piece(
                    cursor_pos, piece_at_cursor, piece_at_cursor.player_id
                )
            else:
                self.status_message = "No piece at cursor"

    def select_piece(self, pos: Position, piece: Piece, player_id: str) -> None:
        self.selected_pos = pos
        self.selected_piece = piece
        all_moves = self.board.get_legal_moves(player_id)
        self.legal_moves = all_moves.get(pos, [])
        self.status_message = (
            f"Selected {piece.type} - {len(self.legal_moves)} legal moves"
        )

    def prompt_promotion(self) -> str | None:
        height, width = self.stdscr.getmaxyx()
        prompt = "Promote to: (q)ueen (r)ook (b)ishop (n)knight"
        self.stdscr.addstr(
            height - 1, 0, prompt + " " * (width - len(prompt) - 1), curses.A_REVERSE
        )
        self.stdscr.refresh()

        while True:
            key = self.stdscr.getch()
            if key == ord("q"):
                return "queen"
            elif key == ord("r"):
                return "rook"
            elif key == ord("b"):
                return "bishop"
            elif key == ord("n"):
                return "knight"
            elif key == 27:  # ESC
                return None

    def cycle_player(self) -> None:
        if self.player_ids:
            self.current_player_idx = (self.current_player_idx + 1) % len(
                self.player_ids
            )
            self.clear_selection()
            player_id = self.player_ids[self.current_player_idx]
            self.status_message = f"Switched to {player_id}"

    def center_on_player(self) -> None:
        if not self.player_ids:
            return
        player_id = self.player_ids[self.current_player_idx]
        player = self.board.players.get(player_id)
        if player and player.piece_positions:
            rows = [p.row for p in player.piece_positions]
            cols = [p.col for p in player.piece_positions]
            self.camera_row = sum(rows) // len(rows)
            self.camera_col = sum(cols) // len(cols)
            self.cursor_row = self.camera_row
            self.cursor_col = self.camera_col

    def prompt_filename(self, prompt: str) -> str | None:
        """Prompt user for a filename."""
        height, width = self.stdscr.getmaxyx()
        self.stdscr.addstr(
            height - 1, 0, prompt + " " * (width - len(prompt) - 1), curses.A_REVERSE
        )
        self.stdscr.refresh()

        curses.echo()
        curses.curs_set(1)
        try:
            self.stdscr.move(height - 1, len(prompt))
            filename = (
                self.stdscr.getstr(height - 1, len(prompt), 60).decode("utf-8").strip()
            )
            return filename if filename else None
        finally:
            curses.noecho()
            curses.curs_set(0)

    def save_game(self) -> None:
        """Save the current game state to a JSON file."""
        filename = self.prompt_filename("Save to file: ")
        if not filename:
            self.status_message = "Save cancelled"
            return

        if not filename.endswith(".board.json"):
            filename += ".board.json"

        try:
            data = {
                "board": self.board.to_dict(),
                "camera_row": self.camera_row,
                "camera_col": self.camera_col,
                "cursor_row": self.cursor_row,
                "cursor_col": self.cursor_col,
                "current_player_idx": self.current_player_idx,
                "player_ids": self.player_ids,
            }
            with open(filename, "w") as f:
                json.dump(data, f, indent=2)
            self.status_message = f"Saved to {filename}"
        except Exception as e:
            self.status_message = f"Save failed: {e}"

    def load_game(self) -> None:
        """Load a game state from a JSON file."""
        filename = self.prompt_filename("Load from file: ")
        if not filename:
            self.status_message = "Load cancelled"
            return

        if not filename.endswith(".board.json"):
            filename += ".board.json"

        if not os.path.exists(filename):
            self.status_message = f"File not found: {filename}"
            return

        try:
            with open(filename, "r") as f:
                data = json.load(f)

            self.board = Board.from_dict(data["board"])
            self.camera_row = data.get("camera_row", 0)
            self.camera_col = data.get("camera_col", 0)
            self.cursor_row = data.get("cursor_row", 0)
            self.cursor_col = data.get("cursor_col", 0)
            self.current_player_idx = data.get("current_player_idx", 0)
            self.player_ids = data.get("player_ids", list(self.board.players.keys()))
            self.clear_selection()
            self.status_message = f"Loaded from {filename}"
        except Exception as e:
            self.status_message = f"Load failed: {e}"

    def run(self) -> None:
        while True:
            self.draw_board()
            key = self.stdscr.getch()

            if key == ord("q"):
                break
            elif key == ord("p"):
                self.spawn_player()
            elif key == ord("\t"):
                self.cycle_player()
            elif key == ord("\n") or key == ord(" "):
                self.select_or_move()
            elif key == ord("c"):
                self.center_on_player()
            # WASD movement (lowercase = cursor, uppercase = pan)
            elif key == ord("w"):
                self.cursor_row -= 1
            elif key == ord("s"):
                self.cursor_row += 1
            elif key == ord("a"):
                self.cursor_col -= 1
            elif key == ord("d"):
                self.cursor_col += 1
            elif key == ord("W"):
                self.camera_row -= 5
                self.cursor_row -= 5
            elif key == ord("S"):
                self.camera_row += 5
                self.cursor_row += 5
            elif key == ord("A"):
                self.camera_col -= 5
                self.cursor_col -= 5
            elif key == ord("D"):
                self.camera_col += 5
                self.cursor_col += 5
            # Arrow keys still work
            elif key == curses.KEY_UP:
                self.cursor_row -= 1
            elif key == curses.KEY_DOWN:
                self.cursor_row += 1
            elif key == curses.KEY_LEFT:
                self.cursor_col -= 1
            elif key == curses.KEY_RIGHT:
                self.cursor_col += 1
            elif key == ord("r"):
                self.clear_selection()
                self.status_message = "Selection cleared"
            elif key == ord("o"):
                self.load_game()
            elif key == ord("i"):
                self.save_game()


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Interactive infinite chess debugger")
    parser.add_argument("file", nargs="?", help="JSON file to load game state from")
    args = parser.parse_args()

    def run_cli(stdscr: "curses.window") -> None:
        cli = ChessCLI(stdscr)
        if args.file:
            if not os.path.exists(args.file):
                cli.status_message = f"File not found: {args.file}"
            else:
                try:
                    with open(args.file, "r") as f:
                        data = json.load(f)
                    cli.board = Board.from_dict(data["board"])
                    cli.camera_row = data.get("camera_row", 0)
                    cli.camera_col = data.get("camera_col", 0)
                    cli.cursor_row = data.get("cursor_row", 0)
                    cli.cursor_col = data.get("cursor_col", 0)
                    cli.current_player_idx = data.get("current_player_idx", 0)
                    cli.player_ids = data.get(
                        "player_ids", list(cli.board.players.keys())
                    )
                    cli.status_message = f"Loaded from {args.file}"
                except Exception as e:
                    cli.status_message = f"Load failed: {e}"
        cli.run()

    curses.wrapper(run_cli)


if __name__ == "__main__":
    main()
