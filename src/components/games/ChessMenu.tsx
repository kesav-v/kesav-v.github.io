import React from "react";
import "./ChessMenu.scss";

interface ChessMenuProps {
  isOpen: boolean;
  onClose: () => void;
  players: Array<{ id: string }>;
  getPlayerColor: (playerId: string) => string;
  handleNewGame: () => void;
  handleJoinGame: () => void;
  gameId: string;
  activePlayerId: string;
}

export const ChessMenu: React.FC<ChessMenuProps> = ({
  isOpen,
  onClose,
  players,
  getPlayerColor,
  handleNewGame,
  handleJoinGame,
  gameId,
  activePlayerId,
}) => {
  return (
    <div className={`chess-menu ${!isOpen ? "chess-menu--closed" : ""}`}>
      <div className="chess-menu__header">
        <h3>Game Controls</h3>
        <button onClick={onClose}>×</button>
      </div>

      <div className="chess-menu__section">
        <div className="chess-menu__current-turn">
          Active Player:{" "}
          <span style={{ color: getPlayerColor(activePlayerId) }}>
            {activePlayerId}
          </span>
        </div>
      </div>

      <div className="chess-menu__section">
        <button
          onClick={handleJoinGame}
          className="chess-menu__button chess-menu__button--join-game"
        >
          Join Game
        </button>
        <button
          onClick={handleNewGame}
          className="chess-menu__button chess-menu__button--new-game"
        >
          New Game
        </button>
      </div>

      <div className="chess-menu__game-id">
        Game ID: <code>{gameId}</code>
      </div>
    </div>
  );
};
