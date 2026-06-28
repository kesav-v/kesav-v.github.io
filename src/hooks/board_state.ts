import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChessWebSocketClient } from "../api/chessWebSocket";
import {
  MoveResult,
  Piece,
  Position,
  SelectionResult,
  ServerPlayer,
  TurnInfo,
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

export const useBoardState = () => {
  const clientRef = useRef<ChessWebSocketClient | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [players, setPlayers] = useState<ServerPlayer[]>([]);
  const [turn, setTurn] = useState<TurnInfo | null>(null);
  const [turnSecondsRemaining, setTurnSecondsRemaining] = useState(0);
  const [pawnDirections, setPawnDirections] = useState<
    Record<string, Position>
  >({});
  const [myPlayerId, setMyPlayerId] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
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

  const myPlayer = useMemo(
    () => players.find((player) => player.id === myPlayerId),
    [players, myPlayerId]
  );

  const isMyTurn = useMemo(() => {
    if (turn?.player_id) {
      return turn.player_id === myPlayerId;
    }
    return myPlayer?.is_turn ?? false;
  }, [turn, myPlayerId, myPlayer]);

  const bank = myPlayer?.bank ?? [];

  useEffect(() => {
    if (!turn) {
      setTurnSecondsRemaining(0);
      return;
    }

    setTurnSecondsRemaining(turn.seconds_remaining);

    const interval = setInterval(() => {
      const remaining = Math.max(0, turn.deadline - Date.now() / 1000);
      setTurnSecondsRemaining(remaining);
    }, 100);

    return () => clearInterval(interval);
  }, [turn]);

  useEffect(() => {
    if (!isMyTurn) {
      setSelectedBankPiece(null);
    }
  }, [isMyTurn]);

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
        setMyPlayerId(playerId ?? "");
        setDisplayName(name ?? "");
        setIsLoading(false);
      },
      onState: (state) => {
        setPieces(normalizePieces(state.pieces));
        setPlayers(state.players);
        setPawnDirections(buildPawnDirections(state.pieces, state.players));
        setTurn(state.turn ?? null);
        setIsLoading(false);
      },
      onError: (message) => {
        if (message !== "Invalid token") {
          setStatusMessage(message);
        }
      },
      onTurnPassed: (playerId, reason) => {
        setStatusMessage(
          `Turn passed for ${playerId} (${reason.replace(/_/g, " ")})`
        );
      },
      onBroadcastMoveResult: (result) => {
        if (result.auto) {
          setStatusMessage("Turn timer expired — auto move played");
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
      const result =
        (await clientRef.current?.select(row, col)) ??
        ({ success: false } as SelectionResult);

      if (!result.success && result.error) {
        setStatusMessage(result.error);
      }

      return result;
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
    turn,
    pawnDirections,
    myPlayerId,
    activePlayerId: myPlayerId,
    displayName,
    isMyTurn,
    turnSecondsRemaining,
    turnLengthSeconds: turn?.turn_seconds ?? 10,
    bank,
    selectedBankPiece,
    setSelectedBankPiece,
    isConnected,
    isAuthenticated,
    isLoading,
    error,
    statusMessage,
    darkSquareColor: DARK_SQUARE_COLOR,
    getPlayerColor,
    join,
    startNewSession,
    select,
    move,
    drop,
  };
};
