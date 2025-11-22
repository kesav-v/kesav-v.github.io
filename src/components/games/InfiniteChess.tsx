import React from "react";
import { useNavigate } from "react-router-dom";
import Chessboard from "./Chessboard";
import { useBoardState } from "../../hooks/board_state";
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
    activePlayerId,
  } = useBoardState();

  if (isLoading) return <div>Loading game...</div>;
  if (error) {
    return (
      <div className="infinite-chess__error">
        <div>{error}</div>
        <button onClick={handleNewGame} className="error-button">
          Start New Game
        </button>
      </div>
    );
  }
  if (!gameId) return <div>Starting new game...</div>;

  return (
    <div className="infinite-chess">
      {/* Close Button */}
      <button
        onClick={() => navigate("/games")}
        className="infinite-chess__close-button"
      >
        ×
      </button>

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
    </div>
  );
};

export default InfiniteChess;
