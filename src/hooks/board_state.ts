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
    if (urlGameId) {
      setGameId(urlGameId);
    } else {
      setGameId(null);
      setUiState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [urlGameId]);

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
    navigate("/slop/infinite-chess", { replace: true });
  };

  const handleCreateGameWithVisibility = async (visibility: "public" | "unlisted") => {
    try {
      setUiState((prev) => ({ ...prev, isLoading: true, error: null }));
      const newGameId = await gameApi.createNewGame(visibility);
      if (newGameId) {
        // Mark that we created this game and are player1
        const sessionKey = `joined_game_${newGameId}`;
        sessionStorage.setItem(sessionKey, "player1");
        navigate(`/slop/infinite-chess/${newGameId}`, { replace: true });
      } else {
        setUiState((prev) => ({
          ...prev,
          error: "Failed to create new game. Please try again.",
          isLoading: false,
        }));
      }
    } catch (error) {
      console.error("Error creating new game:", error);
      setUiState((prev) => ({
        ...prev,
        error: "Failed to create new game. Please try again.",
        isLoading: false,
      }));
    }
  };

  const handleJoinGameById = async (gameIdToJoin: string) => {
    try {
      setUiState((prev) => ({ ...prev, isLoading: true, error: null }));
      // First navigate to the game
      navigate(`/slop/infinite-chess/${gameIdToJoin}`, { replace: true });
      // Then join the game
      const result = await gameApi.joinGame(gameIdToJoin);
      if (result?.success && result.playerId) {
        // Refresh the board state to include the new player
        const boardState = await gameApi.getBoardState(gameIdToJoin);
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
            activePlayerId: result.playerId!,
          }));
        }
      } else {
        setUiState((prev) => ({
          ...prev,
          error: result?.error || "Failed to join game",
          isLoading: false,
        }));
      }
    } catch (error) {
      console.error("Error joining game:", error);
      setUiState((prev) => ({
        ...prev,
        error: "Failed to join game",
        isLoading: false,
      }));
    }
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
          // Check if we've already joined this game in this session
          const sessionKey = `joined_game_${gameId}`;
          const hasJoined = sessionStorage.getItem(sessionKey);
          
          // First check if the game exists and get initial board state
          const boardState = await gameApi.getBoardState(gameId);

          if (boardState) {
            // Get unique player IDs from the board state
            const playerIds = Array.from(
              new Set(boardState.pieces.map((piece) => piece.player_id))
            );

            // If we haven't joined yet, automatically join the game
            if (!hasJoined) {
              // Always join as a new player when visiting a game link
              // (Game creator is already marked in sessionStorage when creating)
              try {
                const joinResult = await gameApi.joinGame(gameId);
                if (joinResult?.success && joinResult.playerId) {
                  const newPlayerId = joinResult.playerId; // Extract to ensure it's defined
                  // Mark that we've joined in this session
                  sessionStorage.setItem(sessionKey, newPlayerId);
                  
                  // Refresh board state to get updated player list
                  const updatedBoardState = await gameApi.getBoardState(gameId);
                  if (updatedBoardState) {
                    const updatedPlayerIds = Array.from(
                      new Set(updatedBoardState.pieces.map((piece) => piece.player_id))
                    );
                    const players = updatedPlayerIds.map((playerId) => {
                      const playerPieces = updatedBoardState.pieces.filter(
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
                    setUiState((prev) => ({ ...prev, isLoading: false }));
                    return;
                  }
                }
              } catch (joinError) {
                console.error("Error auto-joining game:", joinError);
                // Continue to show existing game state even if join fails
              }
            } else {
              // We've already joined - use stored player ID or find it in the game
              const storedPlayerId = sessionStorage.getItem(sessionKey);
              const activeId = storedPlayerId && playerIds.includes(storedPlayerId) 
                ? storedPlayerId 
                : (playerIds[0] || "player1");
              
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
                activePlayerId: prev.activePlayerId || activeId,
              }));
            }
          } else {
            setUiState((prev) => ({ ...prev, error: "Game not found" }));
          }
        } else {
          // No game ID - user needs to create or join a game
          setUiState((prev) => ({ ...prev, isLoading: false }));
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
    handleCreateGameWithVisibility,
    handleJoinGameById,
    setActivePlayerId,
    gameId: urlGameId,
  };
};
