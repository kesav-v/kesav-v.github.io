import React from "react";
import { PIECE_SVGS } from "./chess-constants";
import { Piece } from "../../api/game";

interface ChessPieceProps {
  piece: Piece;
  getPlayerColor: (playerId: string) => string;
}

export const ChessPiece: React.FC<ChessPieceProps> = ({
  piece,
  getPlayerColor,
}) => {
  return (
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
          fill: getPlayerColor(piece.player_id),
          stroke: "#000000",
          strokeWidth: "1.5",
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }}
      />
    </svg>
  );
};
