interface Position {
  row: number;
  col: number;
}

interface GameResponse {
  success: boolean;
  gameId: string;
}


interface Piece {
  type: "pawn" | "rook" | "knight" | "bishop" | "queen" | "king";
  position: Position;
  player_id: string;
}

interface BoardStateResponse {
  success: boolean;
  pieces: Piece[];
  pawn_directions?: { [playerId: string]: { row: number; col: number } };
}

interface LegalMove {
  from: Position;
  to: Position;
}

interface MakeMoveResponse {
  success: boolean;
  moved_piece_type?: Piece["type"];
  spawned_pawn?: boolean;
  spawn_position?: Position;
  error?: string;
  promotion_available?: boolean;
  cooldown_remaining?: number;
}

interface CooldownResponse {
  success: boolean;
  cooldown_remaining: number;
}

interface JoinGameResponse {
  success: boolean;
  playerId?: string;
  spawnPosition?: Position;
  error?: string;
}

import { API_BASE_URL } from "../config";

export const gameApi = {
  createNewGame: async (): Promise<string | null> => {
    const response = await fetch(`${API_BASE_URL}/start_new_game`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Failed to start new game");
    }

    const result: GameResponse = await response.json();
    if (result.success) {
      return result.gameId;
    }
    return null;
  },

  getLegalMoves: async (
    gameId: string,
    playerId: string
  ): Promise<LegalMove[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/legal_moves`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameId,
          playerId,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch legal moves");
      }
      return await response.json();
    } catch (error) {
      console.error("Error getting legal moves:", error);
      return [];
    }
  },

  getBoardState: async (gameId: string): Promise<BoardStateResponse | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/get_board_state`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ gameId }),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch board state");
      }
      const result: BoardStateResponse = await response.json();
      if (result.success) {
        return result;
      }
      return null;
    } catch (error) {
      console.error("Error fetching board state:", error);
      return null;
    }
  },

  makeMove: async (
    gameId: string,
    playerId: string,
    from: Position,
    to: Position,
    promotionPiece?: string
  ): Promise<MakeMoveResponse | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/make_move`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameId,
          playerId,
          from,
          to,
          promotionPiece,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to make move");
      }

      return await response.json();
    } catch (error) {
      console.error("Error making move:", error);
      return null;
    }
  },

  getCooldown: async (
    gameId: string,
    playerId: string
  ): Promise<CooldownResponse | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/get_cooldown`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameId,
          playerId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get cooldown");
      }

      return await response.json();
    } catch (error) {
      console.error("Error getting cooldown:", error);
      return null;
    }
  },

  joinGame: async (
    gameId: string
  ): Promise<JoinGameResponse | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/join_game`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return errorData;
      }

      return await response.json();
    } catch (error) {
      console.error("Error joining game:", error);
      return null;
    }
  },

};

export type { Position, Piece, LegalMove, MakeMoveResponse };
