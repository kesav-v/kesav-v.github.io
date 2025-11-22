import React from "react";
import { ChessPiece } from "./ChessPiece";
import { Piece } from "../../api/game";
import "./ChessSquare.scss";

interface ChessSquareProps {
  row: number;
  col: number;
  squareSize: number;
  piece: Piece | undefined;
  isSelected: boolean;
  isLegalMove: boolean;
  isQueuedMove?: boolean;
  hasLegalMoves: boolean;
  lightSquareColor: string;
  darkSquareColor: string;
  getPlayerColor: (playerId: string) => string;
  onClick: () => void;
}

export const ChessSquare: React.FC<ChessSquareProps> = ({
  row,
  col,
  squareSize,
  piece,
  isSelected,
  isLegalMove,
  isQueuedMove = false,
  hasLegalMoves,
  lightSquareColor,
  darkSquareColor,
  getPlayerColor,
  onClick,
}) => {
  const isLight = (row + col) % 2 === 0;
  const backgroundColor = isLight ? lightSquareColor : darkSquareColor;
  const borderWeight = isSelected || isLegalMove || isQueuedMove ? 2 : 0;
  const isClickable = (piece && hasLegalMoves) || isLegalMove;

  const classes = [
    "chess-square",
    isSelected && "chess-square--selected",
    isLegalMove && "chess-square--legal-move",
    isQueuedMove && "chess-square--queued-move",
    isClickable ? "chess-square--clickable" : "chess-square--not-clickable",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      style={{
        width: squareSize - 2 * borderWeight,
        height: squareSize - 2 * borderWeight,
        backgroundColor,
        left: col * squareSize,
        top: row * squareSize,
      }}
      onClick={onClick}
    >
      {piece ? (
        <ChessPiece piece={piece} getPlayerColor={getPlayerColor} />
      ) : (
        `${row},${col}`
      )}
    </div>
  );
};
