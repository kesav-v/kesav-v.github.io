import React from "react";
import { PIECE_SVGS, STONE_COLOR } from "./chess-constants";
import { Piece } from "../../api/game";
import "./ChessPiece.scss";

interface ChessPieceProps {
  piece: Piece;
  getPlayerColor: (playerId: string) => string;
  pawnDirection?: { row: number; col: number };
}

export const ChessPiece: React.FC<ChessPieceProps> = ({
  piece,
  getPlayerColor,
  pawnDirection,
}) => {
  // Calculate triangle position and rotation based on direction
  const getTriangleStyle = () => {
    if (piece.type !== "pawn") {
      return null;
    }
    
    // Default to up if no direction provided
    if (!pawnDirection) {
      return { top: "0px", left: "50%", transform: "translateX(-50%) rotate(0deg)" };
    }
    
    const { row: rowDir, col: colDir } = pawnDirection;
    
    // Directions: (-1,0)=up, (1,0)=down, (0,-1)=left, (0,1)=right
    // Triangle points up by default, so rotations: 0=up, 90=right, 180=down, -90=left
    if (rowDir === -1 && colDir === 0) {
      // Up - triangle above, pointing up
      return { top: "0px", left: "50%", transform: "translateX(-50%) rotate(0deg)" };
    } else if (rowDir === 1 && colDir === 0) {
      // Down - triangle below, pointing down
      return { bottom: "0px", left: "50%", transform: "translateX(-50%) rotate(180deg)" };
    } else if (rowDir === 0 && colDir === -1) {
      // Left - triangle to the left, pointing left (270deg counter-clockwise from up)
      return { top: "50%", left: "0px", transform: "translateY(-50%) rotate(-90deg)" };
    } else if (rowDir === 0 && colDir === 1) {
      // Right - triangle to the right, pointing right (90deg clockwise from up)
      return { top: "50%", right: "0px", transform: "translateY(-50%) rotate(90deg)" };
    }
    // Default to up
    return { top: "0px", left: "50%", transform: "translateX(-50%) rotate(0deg)" };
  };

  const triangleStyle = getTriangleStyle();
  const playerColor = getPlayerColor(piece.player_id);
  const isStone = piece.type === "stone";
  const fillColor = isStone ? STONE_COLOR : playerColor;

  return (
    <div className={`chess-piece${isStone ? " chess-piece--stone" : ""}`}>
      <svg
        width="45"
        height="45"
        viewBox="0 0 45 45"
        style={{
          width: "80%",
          height: "80%",
        }}
      >
        <path
          d={PIECE_SVGS[piece.type]}
          style={{
            fill: fillColor,
            stroke: "#000000",
            strokeWidth: "1.5",
            strokeLinecap: "round",
            strokeLinejoin: "round",
          }}
        />
      </svg>
      {piece.type === "pawn" && triangleStyle && (
        <svg
          className="chess-piece__triangle"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          style={triangleStyle}
        >
          <path
            d="M 6 1 L 11 11 L 1 11 Z"
            fill={playerColor}
          />
        </svg>
      )}
    </div>
  );
};
