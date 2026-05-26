import React, { useState } from "react";
import "./GameCreationDialog.scss";

interface GameCreationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGame: (visibility: "public" | "unlisted") => void;
  isLoading?: boolean;
}

export const GameCreationDialog: React.FC<GameCreationDialogProps> = ({
  isOpen,
  onClose,
  onCreateGame,
  isLoading = false,
}) => {
  const [visibility, setVisibility] = useState<"public" | "unlisted">("unlisted");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateGame(visibility);
  };

  return (
    <div className="game-creation-dialog-overlay" onClick={onClose}>
      <div className="game-creation-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="game-creation-dialog__header">
          <h3>Create New Game</h3>
          <button onClick={onClose} className="game-creation-dialog__close">×</button>
        </div>
        <form onSubmit={handleSubmit} className="game-creation-dialog__form">
          <div className="game-creation-dialog__field">
            <label>Game Visibility</label>
            <div className="game-creation-dialog__radio-group">
              <label className="game-creation-dialog__radio">
                <input
                  type="radio"
                  value="public"
                  checked={visibility === "public"}
                  onChange={(e) => setVisibility(e.target.value as "public" | "unlisted")}
                />
                <span>Public</span>
                <small>Anyone can find and join this game</small>
              </label>
              <label className="game-creation-dialog__radio">
                <input
                  type="radio"
                  value="unlisted"
                  checked={visibility === "unlisted"}
                  onChange={(e) => setVisibility(e.target.value as "public" | "unlisted")}
                />
                <span>Unlisted</span>
                <small>Only people with the link can join</small>
              </label>
            </div>
          </div>
          <div className="game-creation-dialog__actions">
            <button type="button" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Game"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

