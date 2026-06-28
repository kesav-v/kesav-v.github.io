import React, { useState, useEffect, useRef } from "react";
import {
  TransformWrapper,
  TransformComponent,
  ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { ChessSquare } from "./ChessSquare";
import { PromotionDialog } from "./PromotionDialog";
import { PlayerRangeIndicator } from "./PlayerRangeIndicator";
import {
  MoveResult,
  Piece,
  Position,
  SelectionResult,
  normalizePiece,
} from "../../api/game";
import { PIECE_SVGS } from "./chess-constants";
import "./Chessboard.scss";

interface ChessboardProps {
  darkSquareColor: string;
  pieces: Piece[];
  players: { id: string; spawnPosition: Position }[];
  pawnDirections: Record<string, Position>;
  getPlayerColor: (playerId: string) => string;
  activePlayerId: string;
  isMyTurn: boolean;
  turnSecondsRemaining: number;
  turnLengthSeconds: number;
  selectedBankPiece: Piece["type"] | null;
  onSelect: (row: number, col: number) => Promise<SelectionResult>;
  onMove: (
    from: Position,
    to: Position,
    promotionPiece?: string
  ) => Promise<MoveResult>;
  onDrop: (pieceType: Piece["type"], row: number, col: number) => Promise<MoveResult>;
}

const Chessboard: React.FC<ChessboardProps> = ({
  darkSquareColor,
  pieces,
  players,
  pawnDirections,
  getPlayerColor,
  activePlayerId,
  isMyTurn,
  turnSecondsRemaining,
  turnLengthSeconds,
  selectedBankPiece,
  onSelect,
  onMove,
  onDrop,
}) => {
  const squareSize = 60;
  const lightSquareColor = "#f0d9b5";
  const transformComponentRef = useRef<ReactZoomPanPinchRef>(null);
  const hasInitialCentered = useRef<boolean>(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [transformState, setTransformState] = useState<{
    positionX: number;
    positionY: number;
    scale: number;
  }>({ positionX: 0, positionY: 0, scale: 1 });
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const [legalDestinations, setLegalDestinations] = useState<Position[]>([]);
  const [promotionDialog, setPromotionDialog] = useState<{
    show: boolean;
    position: { x: number; y: number };
    from: Position;
    to: Position;
  } | null>(null);

  useEffect(() => {
    hasInitialCentered.current = false;
    setSelectedPiece(null);
    setLegalDestinations([]);
  }, [activePlayerId, isMyTurn]);

  useEffect(() => {
    if (!isMyTurn) {
      setSelectedPiece(null);
      setLegalDestinations([]);
      setPromotionDialog(null);
    }
  }, [isMyTurn]);

  useEffect(() => {
    const updateTransformState = () => {
      if (transformComponentRef.current) {
        const ref = transformComponentRef.current;
        setTransformState({
          positionX: ref.state.positionX,
          positionY: ref.state.positionY,
          scale: ref.state.scale,
        });
      }
    };

    updateTransformState();
    const interval = setInterval(updateTransformState, 50);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const centerBoard = () => {
      if (!transformComponentRef.current || hasInitialCentered.current) {
        return;
      }

      let targetPosition: Position | null = null;
      const king = pieces.find(
        (piece) => piece.type === "king" && piece.player_id === activePlayerId
      );

      if (king) {
        targetPosition = king.position;
      } else if (pieces.length > 0) {
        const activePlayerPiece = pieces.find(
          (piece) =>
            piece.player_id === activePlayerId && piece.type !== "stone"
        );
        if (activePlayerPiece) {
          targetPosition = activePlayerPiece.position;
        }
      } else {
        const player = players.find((player) => player.id === activePlayerId);
        if (player) {
          targetPosition = player.spawnPosition;
        }
      }

      if (targetPosition && transformComponentRef.current) {
        const wrapper = wrapperRef.current;
        const viewportWidth = wrapper ? wrapper.clientWidth : window.innerWidth;
        const viewportHeight = wrapper
          ? wrapper.clientHeight
          : window.innerHeight;
        const contentX = targetPosition.col * squareSize + squareSize / 2;
        const contentY = targetPosition.row * squareSize + squareSize / 2;
        const x = viewportWidth / 2 - contentX;
        const y = viewportHeight / 2 - contentY;

        try {
          transformComponentRef.current.setTransform(x, y, 1, 0);
          hasInitialCentered.current = true;
          setTransformState({
            positionX: x,
            positionY: y,
            scale: 1,
          });
        } catch (centerError) {
          console.error("Error centering board:", centerError);
        }
      }
    };

    if (pieces.length > 0 || players.length > 0) {
      const timeoutId = setTimeout(centerBoard, 200);
      return () => clearTimeout(timeoutId);
    }
  }, [pieces, players, activePlayerId, squareSize]);

  const centerOnKing = () => {
    const king = pieces.find(
      (piece) => piece.type === "king" && piece.player_id === activePlayerId
    );
    if (king && transformComponentRef.current) {
      const wrapper = wrapperRef.current;
      const viewportWidth = wrapper ? wrapper.clientWidth : window.innerWidth;
      const viewportHeight = wrapper
        ? wrapper.clientHeight
        : window.innerHeight;
      const contentX = king.position.col * squareSize + squareSize / 2;
      const contentY = king.position.row * squareSize + squareSize / 2;
      const x = viewportWidth / 2 - contentX;
      const y = viewportHeight / 2 - contentY;
      transformComponentRef.current.setTransform(x, y, 1, 300);
    }
  };

  const getVisibleBounds = () => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !transformComponentRef.current) {
      return {
        minRow: -10,
        maxRow: 10,
        minCol: -10,
        maxCol: 10,
      };
    }

    const viewportWidth = wrapper.clientWidth;
    const viewportHeight = wrapper.clientHeight;
    const { positionX, positionY, scale } = transformState;
    const left = -positionX / scale;
    const right = (viewportWidth - positionX) / scale;
    const top = -positionY / scale;
    const bottom = (viewportHeight - positionY) / scale;

    return {
      minRow: Math.floor(top / squareSize),
      maxRow: Math.ceil(bottom / squareSize),
      minCol: Math.floor(left / squareSize),
      maxCol: Math.ceil(right / squareSize),
    };
  };

  const clearSelection = () => {
    setSelectedPiece(null);
    setLegalDestinations([]);
  };

  const handleSquareClick = async (row: number, col: number) => {
    if (!isMyTurn) {
      return;
    }

    if (selectedBankPiece) {
      const pieceAtPosition = pieces.find(
        (piece) => piece.position.row === row && piece.position.col === col
      );
      if (!pieceAtPosition) {
        const result = await onDrop(selectedBankPiece, row, col);
        if (!result.success) {
          return;
        }
      }
      return;
    }

    if (selectedPiece) {
      const isLegalMove = legalDestinations.some(
        (destination) => destination.row === row && destination.col === col
      );

      if (isLegalMove) {
        const moveTo = { row, col };
        const result = await makeMove(selectedPiece.position, moveTo);
        if (!result?.success && !result?.promotion_available) {
          clearSelection();
        } else if (result.success) {
          clearSelection();
        }
      } else {
        clearSelection();
        await attemptSelect(row, col);
      }
      return;
    }

    await attemptSelect(row, col);
  };

  const attemptSelect = async (row: number, col: number) => {
    const result = await onSelect(row, col);
    if (result.success && result.piece) {
      if (
        result.piece.player_id === activePlayerId &&
        result.piece.type !== "stone"
      ) {
        setSelectedPiece(normalizePiece(result.piece));
        setLegalDestinations(result.legal_moves ?? []);
      } else {
        clearSelection();
      }
    } else {
      clearSelection();
    }
  };

  const makeMove = async (
    from: Position,
    to: Position,
    promotionPiece?: string
  ): Promise<MoveResult> => {
    const result = await onMove(from, to, promotionPiece);

    if (result.promotion_available && !promotionPiece) {
      setPromotionDialog({
        show: true,
        position: {
          x: to.col * squareSize,
          y: to.row * squareSize,
        },
        from,
        to,
      });
      return result;
    }

    return result;
  };

  const handlePromotion = async (piece: string) => {
    if (promotionDialog) {
      await makeMove(promotionDialog.from, promotionDialog.to, piece);
      setPromotionDialog(null);
      clearSelection();
    }
  };

  const renderBoard = () => {
    const squares = [];
    const bounds = getVisibleBounds();
    const activePlayerPositions = pieces
      .filter(
        (piece) =>
          piece.player_id === activePlayerId && piece.type !== "stone"
      )
      .map((piece) => piece.position);

    let borderBounds: {
      minRow: number;
      maxRow: number;
      minCol: number;
      maxCol: number;
    } | null = null;

    if (activePlayerPositions.length > 0) {
      borderBounds = {
        minRow: Math.min(...activePlayerPositions.map((position) => position.row)),
        maxRow: Math.max(...activePlayerPositions.map((position) => position.row)),
        minCol: Math.min(...activePlayerPositions.map((position) => position.col)),
        maxCol: Math.max(...activePlayerPositions.map((position) => position.col)),
      };
    }

    for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
      for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
        const piece = pieces.find(
          (candidate) =>
            candidate.position.row === row && candidate.position.col === col
        );
        const isSelected =
          selectedPiece?.position.row === row &&
          selectedPiece?.position.col === col;
        const isLegalMove =
          selectedPiece &&
          legalDestinations.some(
            (destination) => destination.row === row && destination.col === col
          );
        const canSelectOwnPiece =
          !selectedPiece &&
          !selectedBankPiece &&
          piece?.player_id === activePlayerId &&
          piece?.type !== "stone";
        const isClickable =
          isMyTurn &&
          (!!isLegalMove ||
            (!!selectedBankPiece && !piece) ||
            canSelectOwnPiece);

        const isOutsideBorder = borderBounds
          ? row < borderBounds.minRow ||
            row > borderBounds.maxRow ||
            col < borderBounds.minCol ||
            col > borderBounds.maxCol
          : false;

        squares.push(
          <ChessSquare
            key={`${row}-${col}`}
            row={row}
            col={col}
            squareSize={squareSize}
            piece={piece}
            isSelected={isSelected}
            isLegalMove={!!isLegalMove}
            isClickable={isClickable}
            lightSquareColor={lightSquareColor}
            darkSquareColor={darkSquareColor}
            getPlayerColor={getPlayerColor}
            pawnDirection={
              piece?.type === "pawn"
                ? pawnDirections[piece.player_id]
                : undefined
            }
            isOutsideBorder={isOutsideBorder}
            onClick={() => handleSquareClick(row, col)}
          />
        );
      }
    }

    return (
      <>
        {squares}
        <PlayerRangeIndicator
          key={activePlayerId}
          playerId={activePlayerId}
          positions={pieces
            .filter(
              (piece) =>
                piece.player_id === activePlayerId && piece.type !== "stone"
            )
            .map((piece) => piece.position)}
          squareSize={squareSize}
          getPlayerColor={getPlayerColor}
        />
      </>
    );
  };

  const turnProgress =
    turnLengthSeconds > 0
      ? (turnSecondsRemaining / turnLengthSeconds) * 100
      : 0;

  return (
    <div className="chessboard" ref={wrapperRef}>
      <button
        className="chessboard__center-button"
        onClick={centerOnKing}
        title="Center on King"
      >
        <svg
          width="30"
          height="30"
          viewBox="0 0 45 45"
          style={{
            width: "100%",
            height: "100%",
          }}
        >
          <path
            d={PIECE_SVGS.king}
            style={{
              fill: getPlayerColor(activePlayerId),
              stroke: "#000000",
              strokeWidth: "1.5",
              strokeLinecap: "round",
              strokeLinejoin: "round",
            }}
          />
        </svg>
      </button>
      {isMyTurn && turnSecondsRemaining > 0 && (
        <div className="chessboard__cooldown">
          <div className="chessboard__cooldown-bar">
            <div
              className="chessboard__cooldown-progress"
              style={{ width: `${turnProgress}%` }}
            />
          </div>
        </div>
      )}
      <TransformWrapper
        ref={transformComponentRef}
        initialScale={1}
        minScale={0.5}
        maxScale={2}
        centerOnInit={false}
        limitToBounds={false}
        doubleClick={{ disabled: true }}
        onInit={(ref) => {
          if (ref) {
            transformComponentRef.current = ref;
          }
        }}
        onTransformed={(ref) => {
          if (ref) {
            setTransformState({
              positionX: ref.state.positionX,
              positionY: ref.state.positionY,
              scale: ref.state.scale,
            });
          }
        }}
      >
        <TransformComponent
          wrapperStyle={{ width: "100%", height: "100%" }}
          contentStyle={{ width: "fit-content", height: "fit-content" }}
        >
          <div className="chessboard__board-container">{renderBoard()}</div>
        </TransformComponent>
      </TransformWrapper>
      {promotionDialog && (
        <PromotionDialog
          position={promotionDialog.position}
          onSelect={handlePromotion}
          onCancel={() => setPromotionDialog(null)}
        />
      )}
    </div>
  );
};

export default Chessboard;
