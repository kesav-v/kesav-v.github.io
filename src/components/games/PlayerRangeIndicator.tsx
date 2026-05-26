import React from "react";
import { Position } from "../../api/game";
import "./PlayerRangeIndicator.scss";

interface PlayerRangeIndicatorProps {
  playerId: string;
  positions: Position[];
  squareSize: number;
  getPlayerColor: (playerId: string) => string;
}

export const PlayerRangeIndicator: React.FC<PlayerRangeIndicatorProps> = ({
  playerId,
  positions,
  squareSize,
  getPlayerColor,
}) => {
  if (positions.length === 0) return null;

  const minRow = Math.min(...positions.map((p) => p.row));
  const maxRow = Math.max(...positions.map((p) => p.row));
  const minCol = Math.min(...positions.map((p) => p.col));
  const maxCol = Math.max(...positions.map((p) => p.col));

  return (
    <div
      className="player-range-indicator"
      style={{
        left: minCol * squareSize,
        top: minRow * squareSize,
        width: (maxCol - minCol + 1) * squareSize,
        height: (maxRow - minRow + 1) * squareSize,
        border: `2px dashed ${getPlayerColor(playerId)}`,
      }}
    />
  );
};
