import { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { gameApi } from "../api/game";

// Types
interface Player {
  id: string;
  spawnPosition: { row: number; col: number };
}

interface GameState {
  players: Player[];
  activePlayerId: string; // The player who is currently playing (viewing the board)
}

interface UIState {
  isLoading: boolean;
  error: string | null;
}

// Constant dark square color
const DARK_SQUARE_COLOR = "#695695";

// Constants
const PLAYER_COLORS = [
  "#4169E1", // Royal Blue
  "#32CD32", // Lime Green
  "#FFD700", // Gold
  "#FF69B4", // Hot Pink
  "#9370DB", // Medium Purple
  "#20B2AA", // Light Sea Green
] as const;

export const useBoardState = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [gameId, setGameId] = useState<string | null>(null);
  const { gameId: urlGameId } = useParams<{ gameId: string }>();

  useEffect(() => {
    const initGame = async () => {
      if (!urlGameId) {
        try {
          const newGameId = await gameApi.createNewGame();
          if (newGameId) {
            navigate(`/games/infinite-chess/${newGameId}`, { replace: true });
          }
        } catch (error) {
          console.error("Error creating new game:", error);
          setUiState((prev) => ({
            ...prev,
            error: "Failed to create new game. Please try again.",
          }));
          setGameId(null);
        }
      } else {
        setGameId(urlGameId);
      }
    };
    initGame();
  }, [urlGameId, navigate]);

  // Game State
  const [gameState, setGameState] = useState<GameState>({
    players: [{ id: "player1", spawnPosition: { row: 6, col: 0 } }],
    activePlayerId: "player1", // Default to first player
  });

  // UI State
  const [uiState, setUiState] = useState<UIState>({
    isLoading: true,
    error: null,
  });

  const setActivePlayerId = (playerId: string) => {
    setGameState((prev) => ({ ...prev, activePlayerId: playerId }));
  };

  const getPlayerColor = (playerId: string): string => {
    const index = gameState.players.findIndex((p) => p.id === playerId);
    return PLAYER_COLORS[index % PLAYER_COLORS.length];
  };

  // Game Actions
  const handleNewGame = async () => {
    navigate("/games/infinite-chess", { replace: true });
  };

  const handleJoinGame = async () => {
    if (!gameId) return;
    try {
      const result = await gameApi.joinGame(gameId);
      if (result?.success && result.playerId) {
        const newPlayerId = result.playerId; // Extract to ensure it's defined
        // Refresh the board state to include the new player
        const boardState = await gameApi.getBoardState(gameId);
        if (boardState) {
          const playerIds = Array.from(
            new Set(boardState.pieces.map((piece) => piece.player_id))
          );
          const players = playerIds.map((playerId) => {
            const playerPieces = boardState.pieces.filter(
              (piece) => piece.player_id === playerId
            );
            const spawnRow = Math.max(
              ...playerPieces.map((piece) => piece.position.row)
            );
            const spawnCol =
              playerPieces.find((piece) => piece.position.row === spawnRow)
                ?.position.col || 0;
            return {
              id: playerId,
              spawnPosition: { row: spawnRow, col: spawnCol },
            };
          });
          setGameState((prev) => ({
            ...prev,
            players,
            activePlayerId: newPlayerId,
          }));
        }
      } else {
        setUiState((prev) => ({
          ...prev,
          error: result?.error || "Failed to join game",
        }));
      }
    } catch (error) {
      console.error("Error joining game:", error);
      setUiState((prev) => ({
        ...prev,
        error: "Failed to join game",
      }));
    }
  };

  // Game Initialization
  useEffect(() => {
    const initGame = async () => {
      try {
        if (gameId) {
          // First check if the game exists and get initial board state
          const boardState = await gameApi.getBoardState(gameId);

          if (boardState) {
            // Get unique player IDs from the board state
            const playerIds = Array.from(
              new Set(boardState.pieces.map((piece) => piece.player_id))
            );

            // Create player objects with their spawn positions
            // For existing players, we'll use their furthest back piece as spawn position
            const players = playerIds.map((playerId) => {
              const playerPieces = boardState.pieces.filter(
                (piece) => piece.player_id === playerId
              );
              const spawnRow = Math.max(
                ...playerPieces.map((piece) => piece.position.row)
              );
              const spawnCol =
                playerPieces.find((piece) => piece.position.row === spawnRow)
                  ?.position.col || 0;

              return {
                id: playerId,
                spawnPosition: { row: spawnRow, col: spawnCol },
              };
            });

            setGameState((prev) => ({
              ...prev,
              players,
              // Set active player to first player if not already set
              activePlayerId: prev.activePlayerId || players[0]?.id || "player1",
            }));
          } else {
            setUiState((prev) => ({ ...prev, error: "Game not found" }));
          }
        } else {
          try {
            const newGameId = await gameApi.createNewGame();
            if (newGameId) {
              navigate(`/games/infinite-chess/${newGameId}`, {
                replace: true,
              });
            }
          } catch (error) {
            console.error("Error creating new game:", error);
            setUiState((prev) => ({
              ...prev,
              error: "Failed to create new game",
            }));
          }
        }
      } catch (error) {
        console.error("Error initializing game:", error);
        setUiState((prev) => ({ ...prev, error: "Error initializing game" }));
      } finally {
        setUiState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    initGame();
  }, [location.pathname, gameId, navigate]);

  return {
    // Game State
    players: gameState.players,
    activePlayerId: gameState.activePlayerId,

    // UI State
    darkSquareColor: DARK_SQUARE_COLOR,
    isLoading: uiState.isLoading,
    error: uiState.error,

    // Actions
    getPlayerColor,
    handleNewGame,
    handleJoinGame,
    setActivePlayerId,
    gameId: urlGameId,
  };
};
