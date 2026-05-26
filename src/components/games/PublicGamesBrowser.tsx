import React, { useState, useEffect } from "react";
import { gameApi, PublicGame } from "../../api/game";
import "./PublicGamesBrowser.scss";

interface PublicGamesBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinGame: (gameId: string) => void;
}

export const PublicGamesBrowser: React.FC<PublicGamesBrowserProps> = ({
  isOpen,
  onClose,
  onJoinGame,
}) => {
  const [games, setGames] = useState<PublicGame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPublicGames();
      // Refresh every 5 seconds while open
      const interval = setInterval(loadPublicGames, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const loadPublicGames = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const publicGames = await gameApi.listPublicGames();
      setGames(publicGames);
    } catch (err) {
      setError("Failed to load public games");
      console.error("Error loading public games:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="public-games-browser-overlay" onClick={onClose}>
      <div className="public-games-browser" onClick={(e) => e.stopPropagation()}>
        <div className="public-games-browser__header">
          <h3>Join Public Game</h3>
          <button onClick={onClose} className="public-games-browser__close">×</button>
        </div>
        <div className="public-games-browser__content">
          {isLoading && games.length === 0 ? (
            <div className="public-games-browser__loading">Loading games...</div>
          ) : error ? (
            <div className="public-games-browser__error">
              <p>{error}</p>
              <button onClick={loadPublicGames}>Retry</button>
            </div>
          ) : games.length === 0 ? (
            <div className="public-games-browser__empty">
              <p>No public games available</p>
              <button onClick={loadPublicGames}>Refresh</button>
            </div>
          ) : (
            <>
              <div className="public-games-browser__list">
                {games.map((game) => (
                  <div key={game.gameId} className="public-games-browser__game-item">
                    <div className="public-games-browser__game-info">
                      <span className="public-games-browser__game-id">
                        Game: {game.gameId.substring(0, 8)}...
                      </span>
                    </div>
                    <button
                      onClick={() => onJoinGame(game.gameId)}
                      className="public-games-browser__join-button"
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
              <div className="public-games-browser__footer">
                <button onClick={loadPublicGames} disabled={isLoading}>
                  {isLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

