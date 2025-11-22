import React from "react";
import { PIECE_SVGS } from "./chess-constants";
import "./PromotionDialog.scss";

interface PromotionDialogProps {
  onSelect: (piece: string) => void;
  onCancel: () => void;
  position: { x: number; y: number };
}

export const PromotionDialog: React.FC<PromotionDialogProps> = ({
  onSelect,
  onCancel,
  position,
}) => {
  const pieces = ["queen", "rook", "bishop", "knight"];

  return (
    <div
      className="promotion-dialog"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {pieces.map((piece) => (
        <div
          key={piece}
          onClick={() => onSelect(piece)}
          className="promotion-dialog__option"
        >
          <svg width="30" height="30" viewBox="0 0 45 45">
            <path d={PIECE_SVGS[piece as keyof typeof PIECE_SVGS]} />
          </svg>
          {piece.charAt(0).toUpperCase() + piece.slice(1)}
        </div>
      ))}
    </div>
  );
};
