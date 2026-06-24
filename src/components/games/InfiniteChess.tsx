import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Chessboard from "./Chessboard";
import { useBoardState } from "../../hooks/board_state";
import { GameCreationDialog } from "./GameCreationDialog";
import { PublicGamesBrowser } from "./PublicGamesBrowser";
import "./InfiniteChess.scss";

const InfiniteChess: React.FC = () => {
  const navigate = useNavigate();
  const {
    gameId,
    darkSquareColor,
    players,
    isLoading,
    error,
    getPlayerColor,
    handleNewGame,
    handleCreateGameWithVisibility,
    handleJoinGameById,
    activePlayerId,
  } = useBoardState();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPublicGamesBrowser, setShowPublicGamesBrowser] = useState(false);
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const handleCreateGame = async (visibility: "public" | "unlisted") => {
    setIsCreatingGame(true);
    try {
      await handleCreateGameWithVisibility(visibility);
      setShowCreateDialog(false);
    } catch (err) {
      console.error("Error creating game:", err);
    } finally {
      setIsCreatingGame(false);
    }
  };

  const handleJoinPublicGame = (gameIdToJoin: string) => {
    handleJoinGameById(gameIdToJoin);
    setShowPublicGamesBrowser(false);
  };

  const handleShareGame = async () => {
    if (!gameId) return;
    const gameUrl = `${window.location.origin}${window.location.pathname}#/slop/infinite-chess/${gameId}`;
    try {
      await navigator.clipboard.writeText(gameUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
      // Fallback: show the URL in an alert
      alert(`Game URL: ${gameUrl}`);
    }
  };

  if (isLoading) return <div className="infinite-chess__loading">Loading game...</div>;
  if (error) {
    return (
      <div className="infinite-chess__error">
        <div>{error}</div>
        <button onClick={() => setShowCreateDialog(true)} className="error-button">
          Start New Game
        </button>
      </div>
    );
  }
  if (!gameId) {
    return (
      <div className="infinite-chess__no-game">
        <div className="infinite-chess__no-game-content">
          <h2>Infinite Chess</h2>
          <p>Create a new game or join an existing one</p>
          <div className="infinite-chess__no-game-actions">
            <button
              onClick={() => setShowPublicGamesBrowser(true)}
              className="infinite-chess__action-button"
            >
              Join Public Game
            </button>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="infinite-chess__action-button infinite-chess__action-button--primary"
            >
              Create New Game
            </button>
          </div>
        </div>
        <GameCreationDialog
          isOpen={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onCreateGame={handleCreateGame}
          isLoading={isCreatingGame}
        />
        <PublicGamesBrowser
          isOpen={showPublicGamesBrowser}
          onClose={() => setShowPublicGamesBrowser(false)}
          onJoinGame={handleJoinPublicGame}
        />
      </div>
    );
  }

  return (
    <div className="infinite-chess">
      {/* Close Button */}
      <button
        onClick={() => navigate("/slop")}
        className="infinite-chess__close-button"
      >
        ×
      </button>

      {/* Game Controls */}
      <div className="infinite-chess__controls">
        <button
          onClick={handleShareGame}
          className="infinite-chess__control-button"
          title="Copy game URL to share"
        >
          {shareCopied ? "✓ Copied!" : "Share Game"}
        </button>
        <button
          onClick={() => setShowPublicGamesBrowser(true)}
          className="infinite-chess__control-button"
        >
          Join Public Game
        </button>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="infinite-chess__control-button"
        >
          New Game
        </button>
      </div>

      {/* Fullscreen Chessboard */}
      <div className="infinite-chess__board-container">
        <Chessboard
          darkSquareColor={darkSquareColor}
          gameId={gameId}
          players={players}
          getPlayerColor={getPlayerColor}
          activePlayerId={activePlayerId}
        />
      </div>

      {/* Dialogs */}
      <GameCreationDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreateGame={handleCreateGame}
        isLoading={isCreatingGame}
      />
      <PublicGamesBrowser
        isOpen={showPublicGamesBrowser}
        onClose={() => setShowPublicGamesBrowser(false)}
        onJoinGame={handleJoinPublicGame}
      />
    </div>
  );
};

export default InfiniteChess;
