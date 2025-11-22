import React from "react";
import { Position } from "../../api/game";
import { VISIBLE_RANGE_PADDING } from "./chess-constants";
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
        left: (minCol - VISIBLE_RANGE_PADDING) * squareSize,
        top: (minRow - VISIBLE_RANGE_PADDING) * squareSize,
        width: (maxCol - minCol + 1 + 2 * VISIBLE_RANGE_PADDING) * squareSize,
        height: (maxRow - minRow + 1 + 2 * VISIBLE_RANGE_PADDING) * squareSize,
        border: `2px dashed ${getPlayerColor(playerId)}`,
      }}
    />
  );
};
