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
  hasLegalMoves: boolean;
  lightSquareColor: string;
  darkSquareColor: string;
  getPlayerColor: (playerId: string) => string;
  pawnDirection?: { row: number; col: number };
  isOutsideBorder?: boolean;
  onClick: () => void;
}

export const ChessSquare: React.FC<ChessSquareProps> = ({
  row,
  col,
  squareSize,
  piece,
  isSelected,
  isLegalMove,
  hasLegalMoves,
  lightSquareColor,
  darkSquareColor,
  getPlayerColor,
  pawnDirection,
  isOutsideBorder = false,
  onClick,
}) => {
  const isLight = (row + col) % 2 === 0;
  let backgroundColor = isLight ? lightSquareColor : darkSquareColor;
  
  // Darken squares outside the border
  if (isOutsideBorder) {
    // Convert hex to RGB, darken by 30%, then back to rgb
    const hex = backgroundColor.replace('#', '');
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const darkenedR = Math.max(0, Math.floor(r * 0.7));
      const darkenedG = Math.max(0, Math.floor(g * 0.7));
      const darkenedB = Math.max(0, Math.floor(b * 0.7));
      backgroundColor = `rgb(${darkenedR}, ${darkenedG}, ${darkenedB})`;
    }
  }
  const borderWeight = isSelected || isLegalMove ? 2 : 0;
  const isClickable = (piece && hasLegalMoves) || isLegalMove;

  const classes = [
    "chess-square",
    isSelected && "chess-square--selected",
    isLegalMove && "chess-square--legal-move",
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
        overflow: "visible",
      }}
      onClick={onClick}
    >
      {piece && (
        <ChessPiece 
          piece={piece} 
          getPlayerColor={getPlayerColor}
          pawnDirection={piece.type === "pawn" ? pawnDirection : undefined}
        />
      )}
    </div>
  );
};
