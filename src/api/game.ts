export type PieceType =
  | "pawn"
  | "rook"
  | "knight"
  | "bishop"
  | "queen"
  | "king";

export interface Position {
  row: number;
  col: number;
}

export interface ServerPiece {
  row: number;
  col: number;
  type: PieceType;
  player_id: string;
}

export interface Piece extends ServerPiece {
  position: Position;
}

export interface PawnDropRankInfo {
  orientation: "vertical" | "horizontal";
  front_pawn_line: number;
  back_pawn_line: number;
}

export interface ServerPlayer {
  id: string;
  display_name: string;
  orientation: "vertical" | "horizontal";
  alive: boolean;
  connected: boolean;
  bank: PieceType[];
  pawn_drop_rank_info?: PawnDropRankInfo;
}

export interface SelectionResult {
  success: boolean;
  piece?: ServerPiece;
  legal_moves?: Position[];
  error?: string;
}

export interface MoveResult {
  success: boolean;
  moved_piece_type?: PieceType;
  spawned_pawn?: boolean;
  spawn_position?: Position | null;
  error?: string;
  promotion_available?: boolean;
}

export interface JoinedMessage {
  type: "joined";
  player_id: string;
  token: string;
  display_name: string;
  king_pos: Position;
}

export interface ReconnectedMessage {
  type: "reconnected";
  player_id: string;
  display_name: string;
}

export interface StateMessage {
  type: "state";
  pieces: ServerPiece[];
  players: ServerPlayer[];
}

export interface SelectionMessage extends SelectionResult {
  type: "selection";
}

export interface MoveResultMessage extends MoveResult {
  type: "move_result";
}

export interface ErrorMessage {
  type: "error";
  error: string;
}

export type ServerMessage =
  | JoinedMessage
  | ReconnectedMessage
  | StateMessage
  | SelectionMessage
  | MoveResultMessage
  | ErrorMessage;

export function normalizePiece(piece: ServerPiece): Piece {
  return {
    ...piece,
    position: { row: piece.row, col: piece.col },
  };
}

export function normalizePieces(pieces: ServerPiece[]): Piece[] {
  return pieces.map(normalizePiece);
}

export function getPawnDirection(
  piece: ServerPiece,
  player: ServerPlayer | undefined
): Position | undefined {
  if (piece.type !== "pawn" || !player?.pawn_drop_rank_info) {
    return undefined;
  }

  const info = player.pawn_drop_rank_info;
  if (info.orientation === "vertical") {
    if (piece.row === info.front_pawn_line) {
      return info.front_pawn_line > info.back_pawn_line
        ? { row: 1, col: 0 }
        : { row: -1, col: 0 };
    }
    if (piece.row === info.back_pawn_line) {
      return info.front_pawn_line > info.back_pawn_line
        ? { row: -1, col: 0 }
        : { row: 1, col: 0 };
    }
  } else {
    if (piece.col === info.front_pawn_line) {
      return info.front_pawn_line > info.back_pawn_line
        ? { row: 0, col: 1 }
        : { row: 0, col: -1 };
    }
    if (piece.col === info.back_pawn_line) {
      return info.front_pawn_line > info.back_pawn_line
        ? { row: 0, col: -1 }
        : { row: 0, col: 1 };
    }
  }

  return undefined;
}

export function buildPawnDirections(
  pieces: ServerPiece[],
  players: ServerPlayer[]
): Record<string, Position> {
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const directions: Record<string, Position> = {};

  for (const piece of pieces) {
    if (piece.type !== "pawn") {
      continue;
    }
    const direction = getPawnDirection(piece, playerMap.get(piece.player_id));
    if (direction) {
      directions[piece.player_id] = direction;
    }
  }

  return directions;
}
