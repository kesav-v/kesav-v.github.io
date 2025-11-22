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
import { VISIBLE_RANGE_PADDING, PIECE_SVGS } from "./chess-constants";
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
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const [legalMoves, setLegalMoves] = useState<LegalMove[]>([]);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [queuedMoves, setQueuedMoves] = useState<Array<{
    from: Position;
    to: Position;
  }>>([]);
  const MAX_QUEUED_MOVES = 10;
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
        // Fetch legal moves for the active player
        const moves = await gameApi.getLegalMoves(gameId, activePlayerId);
        setLegalMoves(moves);
      }
    };

    // Reset initial centering when game changes
    hasInitialCentered.current = false;
    fetchBoardState();
  }, [gameId, activePlayerId]);

  // Poll for cooldown updates and execute queued moves
  useEffect(() => {
    const updateCooldown = async () => {
      const result = await gameApi.getCooldown(gameId, activePlayerId);
      if (result?.success) {
        const previousCooldown = previousCooldownRef.current;
        const newCooldown = result.cooldown_remaining;
        previousCooldownRef.current = newCooldown;
        setCooldownRemaining(newCooldown);

        // If cooldown just expired and we have queued moves, execute only the first one
        // But only if we're not waiting for a promotion dialog
        if (previousCooldown > 0 && newCooldown === 0 && !promotionDialog) {
          // Use a callback to get the latest queuedMoves state
          setQueuedMoves((currentQueuedMoves) => {
            if (currentQueuedMoves.length > 0) {
              // Execute only the first move in the queue
              const firstMove = currentQueuedMoves[0];
              setTimeout(async () => {
                const result = await makeMove(firstMove.from, firstMove.to);
                // Only remove from queue if move completed without promotion
                // If promotion is needed, handlePromotion will remove it after promotion
                if (result?.success && !result.promotion_available) {
                  setQueuedMoves((prev) => {
                    // Remove the first move that matches
                    if (prev.length > 0) {
                      const first = prev[0];
                      if (
                        first.from.row === firstMove.from.row &&
                        first.from.col === firstMove.from.col &&
                        first.to.row === firstMove.to.row &&
                        first.to.col === firstMove.to.col
                      ) {
                        return prev.slice(1);
                      }
                    }
                    return prev;
                  });
                }
              }, 50);
              // Don't remove from queue yet - wait to see if promotion is needed
              return currentQueuedMoves;
            }
            return currentQueuedMoves;
          });
        }
      }
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 50); // Update every 50ms for smooth animation

    return () => clearInterval(interval);
  }, [gameId, activePlayerId, promotionDialog]);

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
        const viewportHeight = wrapper ? wrapper.clientHeight : window.innerHeight;
        
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
      const viewportHeight = wrapper ? wrapper.clientHeight : window.innerHeight;
      
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

  const getVisibleRange = () => {
    // Group pieces by player
    const piecesByPlayer: { [playerId: string]: Position[] } = {};
    pieces.forEach((piece) => {
      if (!piecesByPlayer[piece.player_id]) {
        piecesByPlayer[piece.player_id] = [];
      }
      piecesByPlayer[piece.player_id].push(piece.position);
    });

    // Calculate visible range for active player
    const positions = piecesByPlayer[activePlayerId] || [];
    if (positions.length === 0) {
      const player = players.find((p) => p.id === activePlayerId);
      if (player) {
        positions.push(player.spawnPosition);
      }
    }

    if (positions.length === 0) {
      return {
        minRow: 0,
        maxRow: 7,
        minCol: 0,
        maxCol: 7,
      };
    }

    const minPieceRow = Math.min(...positions.map((p) => p.row));
    const maxPieceRow = Math.max(...positions.map((p) => p.row));
    const minPieceCol = Math.min(...positions.map((p) => p.col));
    const maxPieceCol = Math.max(...positions.map((p) => p.col));

    console.log("visible range", {
      minRow: minPieceRow - VISIBLE_RANGE_PADDING,
      maxRow: maxPieceRow + VISIBLE_RANGE_PADDING,
      minCol: minPieceCol - VISIBLE_RANGE_PADDING,
      maxCol: maxPieceCol + VISIBLE_RANGE_PADDING,
    });

    return {
      minRow: minPieceRow - VISIBLE_RANGE_PADDING,
      maxRow: maxPieceRow + VISIBLE_RANGE_PADDING,
      minCol: minPieceCol - VISIBLE_RANGE_PADDING,
      maxCol: maxPieceCol + VISIBLE_RANGE_PADDING,
    };
  };

  const handleSquareClick = async (row: number, col: number) => {
    const pieceAtPosition = pieces.find(
      (p) => p.position.row === row && p.position.col === col
    );

    // If there are queued moves and user clicks on a queued destination, remove that specific move
    if (queuedMoves.length > 0 && cooldownRemaining > 0) {
      const clickedOnQueuedDestination = queuedMoves.some(
        (move) => move.to.row === row && move.to.col === col
      );
      if (clickedOnQueuedDestination) {
        // Remove the clicked queued move
        setQueuedMoves((prev) =>
          prev.filter((move) => !(move.to.row === row && move.to.col === col))
        );
        setSelectedPiece(null);
        return;
      }
    }

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
        
        // If on cooldown, queue the move for later (up to MAX_QUEUED_MOVES)
        if (cooldownRemaining > 0) {
          setQueuedMoves((prev) => {
            if (prev.length >= MAX_QUEUED_MOVES) {
              return prev; // Don't add if at max capacity
            }
            return [...prev, { from: selectedPiece.position, to: moveTo }];
          });
          setSelectedPiece(null);
          return;
        }

        // Otherwise, make the move immediately
        const result = await makeMove(selectedPiece.position, moveTo);
        if (!result?.success) {
          if (result?.cooldown_remaining) {
            setCooldownRemaining(result.cooldown_remaining);
          }
          setSelectedPiece(null);
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
    const result = await gameApi.makeMove(gameId, activePlayerId, from, to, promotionPiece);

    if (result?.success) {
      // If promotion is available and no promotion piece was specified, show the dialog
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

      // Get the updated board state
      const boardState = await gameApi.getBoardState(gameId);
      if (boardState?.success) {
        // First update the pieces
        setPieces(boardState.pieces);
        // Clear selected piece and legal moves before fetching new ones
        // Don't clear queued moves - they'll execute one by one as cooldowns expire
        setSelectedPiece(null);
        setLegalMoves([]);

        // Then fetch legal moves for the active player
        const moves = await gameApi.getLegalMoves(gameId, activePlayerId);
        setLegalMoves(moves);
        
        // Update cooldown
        const cooldownResult = await gameApi.getCooldown(gameId, activePlayerId);
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
      const result = await makeMove(promotionDialog.from, promotionDialog.to, piece);
      setPromotionDialog(null);
      
      // After promotion is handled, remove the first move from queue if it matches
      if (result?.success) {
        setQueuedMoves((prev) => {
          if (prev.length > 0) {
            const firstMove = prev[0];
            if (
              firstMove.from.row === promotionDialog.from.row &&
              firstMove.from.col === promotionDialog.from.col &&
              firstMove.to.row === promotionDialog.to.row &&
              firstMove.to.col === promotionDialog.to.col
            ) {
              return prev.slice(1);
            }
          }
          return prev;
        });
      }
    }
  };

  const renderBoard = () => {
    const squares = [];
    const visibleRange = getVisibleRange();

    for (let row = visibleRange.minRow; row <= visibleRange.maxRow; row++) {
      for (let col = visibleRange.minCol; col <= visibleRange.maxCol; col++) {
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
        const isQueuedMoveDestination = queuedMoves.some(
          (move) => move.to.row === row && move.to.col === col
        );
        const hasLegalMoves =
          piece &&
          legalMoves.some(
            (move) =>
              move.from.row === piece.position.row &&
              move.from.col === piece.position.col
          );

        squares.push(
          <ChessSquare
            key={`${row}-${col}`}
            row={row}
            col={col}
            squareSize={squareSize}
            piece={piece}
            isSelected={isSelected}
            isLegalMove={!!isLegalMove}
            isQueuedMove={!!isQueuedMoveDestination}
            hasLegalMoves={!!hasLegalMoves}
            lightSquareColor={lightSquareColor}
            darkSquareColor={darkSquareColor}
            getPlayerColor={getPlayerColor}
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

  const cooldownProgress = cooldownRemaining > 0 ? (cooldownRemaining / 3.0) * 100 : 0;

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (queuedMoves.length > 0) {
      setQueuedMoves([]);
      setSelectedPiece(null);
    }
  };

  return (
    <div 
      className="chessboard" 
      ref={wrapperRef}
      onContextMenu={handleRightClick}
    >
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
        minScale={0.1}
        maxScale={10}
        centerOnInit={false}
        limitToBounds={false}
        doubleClick={{ disabled: true }}
        onInit={(ref) => {
          // Ensure transform ref is set
          if (ref) {
            transformComponentRef.current = ref;
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
