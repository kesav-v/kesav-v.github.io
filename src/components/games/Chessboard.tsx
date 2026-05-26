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
  gameApi,
  Position,
  Piece,
  LegalMove,
  MakeMoveResponse,
} from "../../api/game";
import { PIECE_SVGS } from "./chess-constants";
import "./Chessboard.scss";

interface ChessboardProps {
  darkSquareColor: string;
  gameId: string;
  players: { id: string; spawnPosition: Position }[];
  getPlayerColor: (playerId: string) => string;
  activePlayerId: string;
}

const Chessboard: React.FC<ChessboardProps> = ({
  darkSquareColor,
  gameId,
  players,
  getPlayerColor,
  activePlayerId,
}) => {
  const squareSize = 60;
  const lightSquareColor = "#f0d9b5";
  const transformComponentRef = useRef<ReactZoomPanPinchRef>(null);
  const hasInitialCentered = useRef<boolean>(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const previousCooldownRef = useRef<number>(0);
  const [transformState, setTransformState] = useState<{
    positionX: number;
    positionY: number;
    scale: number;
  }>({ positionX: 0, positionY: 0, scale: 1 });
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [pawnDirections, setPawnDirections] = useState<{
    [playerId: string]: { row: number; col: number };
  }>({});
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const [legalMoves, setLegalMoves] = useState<LegalMove[]>([]);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [promotionDialog, setPromotionDialog] = useState<{
    show: boolean;
    position: { x: number; y: number };
    from: Position;
    to: Position;
  } | null>(null);

  useEffect(() => {
    const fetchBoardState = async () => {
      const result = await gameApi.getBoardState(gameId);
      if (result?.success) {
        setPieces(result.pieces);
        if (result.pawn_directions) {
          setPawnDirections(result.pawn_directions);
        } else {
          // If no pawn_directions, initialize empty object
          setPawnDirections({});
        }
        // Fetch legal moves for the active player
        const moves = await gameApi.getLegalMoves(gameId, activePlayerId);
        setLegalMoves(moves);
      }
    };

    // Reset initial centering when game changes
    hasInitialCentered.current = false;
    fetchBoardState();
  }, [gameId, activePlayerId]);

  // Poll for cooldown updates
  useEffect(() => {
    const updateCooldown = async () => {
      const result = await gameApi.getCooldown(gameId, activePlayerId);
      if (result?.success) {
        const newCooldown = result.cooldown_remaining;
        previousCooldownRef.current = newCooldown;
        setCooldownRemaining(newCooldown);
      }
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 50); // Update every 50ms for smooth animation

    return () => clearInterval(interval);
  }, [gameId, activePlayerId]);

  // Update transform state when transform changes
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

    // Initial update
    updateTransformState();

    // Set up interval to check for transform changes
    const interval = setInterval(updateTransformState, 50);
    return () => clearInterval(interval);
  }, []);

  // Center the board on initial load
  useEffect(() => {
    const centerBoard = () => {
      if (!transformComponentRef.current || hasInitialCentered.current) {
        return;
      }

      // Find the king piece for the active player, or use the first piece, or spawn position
      let targetPosition: Position | null = null;

      const king = pieces.find(
        (p) => p.type === "king" && p.player_id === activePlayerId
      );

      if (king) {
        targetPosition = king.position;
      } else if (pieces.length > 0) {
        // Use the first piece of the active player
        const activePlayerPiece = pieces.find(
          (p) => p.player_id === activePlayerId
        );
        if (activePlayerPiece) {
          targetPosition = activePlayerPiece.position;
        }
      } else {
        // Fall back to spawn position
        const player = players.find((p) => p.id === activePlayerId);
        if (player) {
          targetPosition = player.spawnPosition;
        }
      }

      if (targetPosition && transformComponentRef.current) {
        // Get the actual wrapper dimensions instead of window dimensions
        const wrapper = wrapperRef.current;
        const viewportWidth = wrapper ? wrapper.clientWidth : window.innerWidth;
        const viewportHeight = wrapper
          ? wrapper.clientHeight
          : window.innerHeight;

        // Calculate the content position (in content coordinates)
        // The board container starts at (0,0), so squares are positioned at (col * squareSize, row * squareSize)
        const contentX = targetPosition.col * squareSize + squareSize / 2;
        const contentY = targetPosition.row * squareSize + squareSize / 2;

        // Calculate transform to center this point in the viewport
        // Transform translates the content, so to show contentX at viewport center:
        // viewportCenter = contentX + transformX
        // transformX = viewportCenter - contentX
        const x = viewportWidth / 2 - contentX;
        const y = viewportHeight / 2 - contentY;

        // Center the board without animation on initial load
        try {
          transformComponentRef.current.setTransform(x, y, 1, 0);
          hasInitialCentered.current = true;
          // Update transform state after centering
          setTransformState({
            positionX: x,
            positionY: y,
            scale: 1,
          });
        } catch (error) {
          console.error("Error centering board:", error);
        }
      }
    };

    if (pieces.length > 0 || players.length > 0) {
      // Add a delay to ensure the transform component is fully initialized and DOM is ready
      const timeoutId = setTimeout(centerBoard, 200);
      return () => clearTimeout(timeoutId);
    }
  }, [pieces, players, activePlayerId, squareSize]);

  // Function to center on the king
  const centerOnKing = () => {
    // Find the king piece for the active player
    const king = pieces.find(
      (p) => p.type === "king" && p.player_id === activePlayerId
    );
    if (king && transformComponentRef.current) {
      // Get the actual wrapper dimensions
      const wrapper = wrapperRef.current;
      const viewportWidth = wrapper ? wrapper.clientWidth : window.innerWidth;
      const viewportHeight = wrapper
        ? wrapper.clientHeight
        : window.innerHeight;

      // Calculate the content position (in content coordinates)
      const contentX = king.position.col * squareSize + squareSize / 2;
      const contentY = king.position.row * squareSize + squareSize / 2;

      // Calculate transform to center this point in the viewport
      const x = viewportWidth / 2 - contentX;
      const y = viewportHeight / 2 - contentY;

      // Pan to the king's position with animation
      transformComponentRef.current.setTransform(x, y, 1, 300); // 300ms animation
    }
  };

  const getVisibleBounds = () => {
    // Calculate which squares are visible in the viewport based on transform
    const wrapper = wrapperRef.current;
    if (!wrapper || !transformComponentRef.current) {
      // Fallback: show a default area
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

    // Calculate the visible area in content coordinates
    // The transform translates content, so visible area is:
    // left = -positionX / scale
    // right = (viewportWidth - positionX) / scale
    // top = -positionY / scale
    // bottom = (viewportHeight - positionY) / scale

    const left = -positionX / scale;
    const right = (viewportWidth - positionX) / scale;
    const top = -positionY / scale;
    const bottom = (viewportHeight - positionY) / scale;

    // Convert to row/col bounds (squares are positioned at col * squareSize, row * squareSize)
    const minCol = Math.floor(left / squareSize);
    const maxCol = Math.ceil(right / squareSize);
    const minRow = Math.floor(top / squareSize);
    const maxRow = Math.ceil(bottom / squareSize);

    return {
      minRow,
      maxRow,
      minCol,
      maxCol,
    };
  };

  const handleSquareClick = async (row: number, col: number) => {
    const pieceAtPosition = pieces.find(
      (p) => p.position.row === row && p.position.col === col
    );

    if (selectedPiece) {
      // Check if the move is legal
      const isLegalMove = legalMoves.some(
        (move) =>
          move.from.row === selectedPiece.position.row &&
          move.from.col === selectedPiece.position.col &&
          move.to.row === row &&
          move.to.col === col
      );

      if (isLegalMove) {
        const moveTo = { row, col };
        const result = await makeMove(selectedPiece.position, moveTo);
        if (!result?.success) {
          if (result?.cooldown_remaining) {
            setCooldownRemaining(result.cooldown_remaining);
          }
          // Don't clear selected piece if promotion dialog is being shown
          if (!result?.promotion_available) {
            setSelectedPiece(null);
          }
        } else if (!result.promotion_available) {
          setSelectedPiece(null);
        }
      } else {
        setSelectedPiece(null);
      }
    } else if (pieceAtPosition) {
      // Only allow selecting pieces that belong to the active player and have legal moves
      const hasLegalMoves = legalMoves.some(
        (move) =>
          move.from.row === pieceAtPosition.position.row &&
          move.from.col === pieceAtPosition.position.col
      );
      if (pieceAtPosition.player_id === activePlayerId && hasLegalMoves) {
        setSelectedPiece(pieceAtPosition);
      }
    }
  };

  const makeMove = async (
    from: Position,
    to: Position,
    promotionPiece?: string
  ): Promise<MakeMoveResponse | null> => {
    const result = await gameApi.makeMove(
      gameId,
      activePlayerId,
      from,
      to,
      promotionPiece
    );

    // If promotion is available and no promotion piece was specified, show the dialog
    // This can happen whether the move succeeded or failed (if it failed due to missing promotion piece)
    if (result?.promotion_available && !promotionPiece) {
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

    if (result?.success) {
      // Get the updated board state
      const boardState = await gameApi.getBoardState(gameId);
      if (boardState?.success) {
        // First update the pieces
        setPieces(boardState.pieces);
        if (boardState.pawn_directions) {
          setPawnDirections(boardState.pawn_directions);
        }
        // Clear selected piece and legal moves before fetching new ones
        setSelectedPiece(null);
        setLegalMoves([]);

        // Then fetch legal moves for the active player
        const moves = await gameApi.getLegalMoves(gameId, activePlayerId);
        setLegalMoves(moves);

        // Update cooldown
        const cooldownResult = await gameApi.getCooldown(
          gameId,
          activePlayerId
        );
        if (cooldownResult?.success) {
          previousCooldownRef.current = cooldownResult.cooldown_remaining;
          setCooldownRemaining(cooldownResult.cooldown_remaining);
        }
      }
    } else if (result?.cooldown_remaining) {
      previousCooldownRef.current = result.cooldown_remaining;
      setCooldownRemaining(result.cooldown_remaining);
    }

    return result;
  };

  const handlePromotion = async (piece: string) => {
    if (promotionDialog) {
      await makeMove(promotionDialog.from, promotionDialog.to, piece);
      setPromotionDialog(null);
      setSelectedPiece(null);
    }
  };

  const renderBoard = () => {
    const squares = [];
    const bounds = getVisibleBounds();

    // Calculate border bounds for active player
    const activePlayerPositions = pieces
      .filter((p) => p.player_id === activePlayerId)
      .map((p) => p.position);

    let borderBounds: {
      minRow: number;
      maxRow: number;
      minCol: number;
      maxCol: number;
    } | null = null;

    if (activePlayerPositions.length > 0) {
      borderBounds = {
        minRow: Math.min(...activePlayerPositions.map((p) => p.row)),
        maxRow: Math.max(...activePlayerPositions.map((p) => p.row)),
        minCol: Math.min(...activePlayerPositions.map((p) => p.col)),
        maxCol: Math.max(...activePlayerPositions.map((p) => p.col)),
      };
    }

    for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
      for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
        const piece = pieces.find(
          (p) => p.position.row === row && p.position.col === col
        );
        const isSelected =
          selectedPiece?.position.row === row &&
          selectedPiece?.position.col === col;
        const isLegalMove =
          selectedPiece &&
          legalMoves.some(
            (move) =>
              move.from.row === selectedPiece.position.row &&
              move.from.col === selectedPiece.position.col &&
              move.to.row === row &&
              move.to.col === col
          );
        const hasLegalMoves =
          piece &&
          legalMoves.some(
            (move) =>
              move.from.row === piece.position.row &&
              move.from.col === piece.position.col
          );

        // Check if square is outside the border
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
            hasLegalMoves={!!hasLegalMoves}
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
            .filter((p) => p.player_id === activePlayerId)
            .map((p) => p.position)}
          squareSize={squareSize}
          getPlayerColor={getPlayerColor}
        />
      </>
    );
  };

  const cooldownProgress =
    cooldownRemaining > 0 ? (cooldownRemaining / 3.0) * 100 : 0;

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
      {cooldownRemaining > 0 && (
        <div className="chessboard__cooldown">
          <div className="chessboard__cooldown-bar">
            <div
              className="chessboard__cooldown-progress"
              style={{ width: `${cooldownProgress}%` }}
            />
          </div>
        </div>
      )}
      <TransformWrapper
        ref={transformComponentRef}
        initialScale={1}
        minScale={0.5} // Maximum zoom out: 2x (1/2 = 0.5)
        maxScale={2} // Maximum zoom in: 2x
        centerOnInit={false}
        limitToBounds={false}
        doubleClick={{ disabled: true }}
        onInit={(ref) => {
          // Ensure transform ref is set
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
