import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Chessboard from "./Chessboard";
import { useBoardState } from "../../hooks/board_state";
import { PIECE_SVGS } from "./chess-constants";
import "./InfiniteChess.scss";

const InfiniteChess: React.FC = () => {
  const navigate = useNavigate();
  const {
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
    darkSquareColor,
    getPlayerColor,
    join,
    startNewSession,
    select,
    move,
    drop,
  } = useBoardState();

  const [joinName, setJoinName] = useState("");

  const boardPlayers = useMemo(
    () =>
      players.map((player) => {
        const playerPieces = pieces.filter(
          (piece) => piece.player_id === player.id
        );
        const king = playerPieces.find((piece) => piece.type === "king");
        const spawnPosition = king?.position ??
          playerPieces[0]?.position ?? { row: 0, col: 0 };

        return {
          id: player.id,
          spawnPosition,
        };
      }),
    [players, pieces]
  );

  const handleJoin = (event: React.FormEvent) => {
    event.preventDefault();
    join(joinName.trim() || "Anonymous");
  };

  if (isLoading && !isAuthenticated) {
    return <div className="infinite-chess__loading">Connecting...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="infinite-chess__no-game">
        <button
          onClick={() => navigate("/slop")}
          className="infinite-chess__close-button"
        >
          ×
        </button>
        <div className="infinite-chess__no-game-content">
          <h2>Infinite Chess</h2>
          <p>
            Join the shared world. Your session is saved in this browser so you
            can reconnect after a refresh.
          </p>
          {!isConnected && (
            <p className="infinite-chess__connection-status">
              Connecting to server...
            </p>
          )}
          {error && <p className="infinite-chess__connection-error">{error}</p>}
          <form
            onSubmit={handleJoin}
            className="infinite-chess__join-form"
          >
            <input
              type="text"
              value={joinName}
              onChange={(event) => setJoinName(event.target.value)}
              placeholder="Display name"
              maxLength={32}
              className="infinite-chess__name-input"
              disabled={!isConnected}
            />
            <button
              type="submit"
              className="infinite-chess__action-button infinite-chess__action-button--primary"
              disabled={!isConnected}
            >
              Join World
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="infinite-chess">
      <button
        onClick={() => navigate("/slop")}
        className="infinite-chess__close-button"
      >
        ×
      </button>

      <div className="infinite-chess__sidebar">
        <div className="infinite-chess__panel">
          <h3>You</h3>
          <p>{displayName || activePlayerId}</p>
          {!isConnected && (
            <p className="infinite-chess__connection-status">Reconnecting...</p>
          )}
          {statusMessage && (
            <p className="infinite-chess__status-message">{statusMessage}</p>
          )}
          <button
            onClick={startNewSession}
            className="infinite-chess__control-button"
          >
            New Session
          </button>
        </div>

        <div className="infinite-chess__panel">
          <h3>Players ({players.length})</h3>
          <ul className="infinite-chess__player-list">
            {players.map((player) => (
              <li key={player.id}>
                <span
                  className="infinite-chess__player-dot"
                  style={{ backgroundColor: getPlayerColor(player.id) }}
                />
                {player.display_name || player.id}
                {!player.alive && " (eliminated)"}
                {!player.connected && player.alive && " (offline)"}
              </li>
            ))}
          </ul>
        </div>

        {bank.length > 0 && (
          <div className="infinite-chess__panel">
            <h3>Captured Pieces</h3>
            <p className="infinite-chess__bank-hint">
              Select a piece, then click an empty square to drop it.
            </p>
            <div className="infinite-chess__bank">
              {bank.map((pieceType, index) => (
                <button
                  key={`${pieceType}-${index}`}
                  type="button"
                  className={`infinite-chess__bank-piece${
                    selectedBankPiece === pieceType
                      ? " infinite-chess__bank-piece--selected"
                      : ""
                  }`}
                  onClick={() =>
                    setSelectedBankPiece(
                      selectedBankPiece === pieceType ? null : pieceType
                    )
                  }
                  title={`Drop ${pieceType}`}
                >
                  <svg width="28" height="28" viewBox="0 0 45 45">
                    <path
                      d={PIECE_SVGS[pieceType]}
                      fill={getPlayerColor(activePlayerId)}
                      stroke="#000000"
                      strokeWidth="1.5"
                    />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="infinite-chess__board-container">
        <Chessboard
          darkSquareColor={darkSquareColor}
          pieces={pieces}
          players={boardPlayers}
          pawnDirections={pawnDirections}
          getPlayerColor={getPlayerColor}
          activePlayerId={activePlayerId}
          cooldownRemaining={cooldownRemaining}
          selectedBankPiece={selectedBankPiece}
          onSelect={select}
          onMove={move}
          onDrop={drop}
        />
      </div>
    </div>
  );
};

export default InfiniteChess;
