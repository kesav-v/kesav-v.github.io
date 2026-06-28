import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChessWebSocketClient } from "../api/chessWebSocket";
import {
  MoveResult,
  Piece,
  Position,
  SelectionResult,
  ServerPlayer,
  buildPawnDirections,
  normalizePieces,
} from "../api/game";
import { getWebSocketUrl } from "../config";

const PLAYER_COLORS = [
  "#4169E1",
  "#32CD32",
  "#FFD700",
  "#FF69B4",
  "#9370DB",
  "#20B2AA",
] as const;

const DARK_SQUARE_COLOR = "#695695";
const COOLDOWN_WINDOW_SECONDS = 10;

export const useBoardState = () => {
  const clientRef = useRef<ChessWebSocketClient | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [players, setPlayers] = useState<ServerPlayer[]>([]);
  const [pawnDirections, setPawnDirections] = useState<
    Record<string, Position>
  >({});
  const [activePlayerId, setActivePlayerId] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [selectedBankPiece, setSelectedBankPiece] = useState<
    Piece["type"] | null
  >(null);

  const getPlayerColor = useCallback(
    (playerId: string): string => {
      const index = players.findIndex((player) => player.id === playerId);
      return PLAYER_COLORS[index >= 0 ? index % PLAYER_COLORS.length : 0];
    },
    [players]
  );

  const activePlayer = useMemo(
    () => players.find((player) => player.id === activePlayerId),
    [players, activePlayerId]
  );

  const bank = activePlayer?.bank ?? [];

  useEffect(() => {
    if (cooldownRemaining <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setCooldownRemaining((current) => Math.max(0, current - 0.05));
    }, 50);

    return () => clearInterval(interval);
  }, [cooldownRemaining]);

  useEffect(() => {
    const client = new ChessWebSocketClient(getWebSocketUrl());
    clientRef.current = client;

    client.setHandlers({
      onConnection: (connected) => {
        setIsConnected(connected);
        if (connected) {
          setError(null);
        }
      },
      onAuth: ({ authenticated, playerId, displayName: name }) => {
        setIsAuthenticated(authenticated);
        setActivePlayerId(playerId ?? "");
        setDisplayName(name ?? "");
        setIsLoading(false);
      },
      onState: (state) => {
        setPieces(normalizePieces(state.pieces));
        setPlayers(state.players);
        setPawnDirections(buildPawnDirections(state.pieces, state.players));
        setIsLoading(false);
      },
      onError: (message) => {
        if (message !== "Invalid token") {
          setStatusMessage(message);
        }
      },
    });

    client.connect();

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, []);

  const join = useCallback((name: string) => {
    setIsLoading(true);
    setError(null);
    clientRef.current?.join(name.trim() || "Anonymous");
  }, []);

  const startNewSession = useCallback(() => {
    setSelectedBankPiece(null);
    setStatusMessage(null);
    setError(null);
    clientRef.current?.resetConnection();
  }, []);

  const select = useCallback(
    async (row: number, col: number): Promise<SelectionResult> => {
      return clientRef.current?.select(row, col) ?? Promise.resolve({ success: false });
    },
    []
  );

  const move = useCallback(
    async (
      from: Position,
      to: Position,
      promotionPiece?: string
    ): Promise<MoveResult> => {
      const result =
        (await clientRef.current?.move(
          from.row,
          from.col,
          to.row,
          to.col,
          promotionPiece as Piece["type"] | undefined
        )) ?? { success: false };

      if (
        !result.success &&
        result.error?.toLowerCase().includes("cooldown")
      ) {
        setCooldownRemaining(COOLDOWN_WINDOW_SECONDS);
      }

      if (result.error) {
        setStatusMessage(result.error);
      } else if (result.success) {
        setStatusMessage(null);
      }

      return result;
    },
    []
  );

  const drop = useCallback(
    async (pieceType: Piece["type"], row: number, col: number) => {
      const result =
        (await clientRef.current?.drop(pieceType, row, col)) ??
        { success: false };

      if (
        !result.success &&
        result.error?.toLowerCase().includes("cooldown")
      ) {
        setCooldownRemaining(COOLDOWN_WINDOW_SECONDS);
      }

      if (result.error) {
        setStatusMessage(result.error);
      } else if (result.success) {
        setStatusMessage(null);
        setSelectedBankPiece(null);
      }

      return result;
    },
    []
  );

  return {
    pieces,
    players,
    pawnDirections,
    activePlayerId,
    displayName,
    bank,
    selectedBankPiece,
    setSelectedBankPiece,
    isConnected,
    isAuthenticated,
    isLoading,
    error,
    statusMessage,
    cooldownRemaining,
    darkSquareColor: DARK_SQUARE_COLOR,
    getPlayerColor,
    join,
    startNewSession,
    select,
    move,
    drop,
  };
};
