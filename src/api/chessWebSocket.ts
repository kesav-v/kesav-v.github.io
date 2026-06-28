import {
  JoinedMessage,
  MoveResult,
  MoveResultMessage,
  PieceType,
  ReconnectedMessage,
  SelectionMessage,
  SelectionResult,
  ServerMessage,
  StateMessage,
} from "./game";

const TOKEN_KEY = "infinite_chess_token";

export interface AuthState {
  authenticated: boolean;
  playerId: string | null;
  displayName: string | null;
  kingPos: { row: number; col: number } | null;
}

type Pending<T> = {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

export class ChessWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private intentionalClose = false;

  private pendingSelection: Pending<SelectionResult> | null = null;
  private pendingMove: Pending<MoveResult> | null = null;

  private onState: ((state: StateMessage) => void) | null = null;
  private onAuth: ((auth: AuthState) => void) | null = null;
  private onConnection: ((connected: boolean) => void) | null = null;
  private onError: ((message: string) => void) | null = null;

  constructor(private readonly url: string) {}

  setHandlers(handlers: {
    onState?: (state: StateMessage) => void;
    onAuth?: (auth: AuthState) => void;
    onConnection?: (connected: boolean) => void;
    onError?: (message: string) => void;
  }): void {
    this.onState = handlers.onState ?? null;
    this.onAuth = handlers.onAuth ?? null;
    this.onConnection = handlers.onConnection ?? null;
    this.onError = handlers.onError ?? null;
  }

  connect(): void {
    this.clearReconnectTimer();
    this.intentionalClose = false;

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
    }

    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.onConnection?.(true);

      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        this.send({ action: "reconnect", token });
      } else {
        this.onAuth?.({
          authenticated: false,
          playerId: null,
          displayName: null,
          kingPos: null,
        });
      }
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(JSON.parse(event.data) as ServerMessage);
    };

    this.ws.onerror = () => {
      this.onError?.("WebSocket connection error");
    };

    this.ws.onclose = () => {
      this.onConnection?.(false);
      this.rejectPending(new Error("WebSocket disconnected"));
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    this.rejectPending(new Error("WebSocket disconnected"));
    this.ws?.close();
    this.ws = null;
  }

  join(name: string): void {
    this.send({ action: "join", name });
  }

  requestState(): void {
    this.send({ action: "state" });
  }

  select(row: number, col: number): Promise<SelectionResult> {
    return new Promise((resolve, reject) => {
      this.pendingSelection = { resolve, reject };
      this.send({ action: "select", row, col });
    });
  }

  move(
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number,
    promotion?: PieceType | null
  ): Promise<MoveResult> {
    return new Promise((resolve, reject) => {
      this.pendingMove = { resolve, reject };
      this.send({
        action: "move",
        from_row: fromRow,
        from_col: fromCol,
        to_row: toRow,
        to_col: toCol,
        promotion: promotion ?? null,
      });
    });
  }

  drop(pieceType: PieceType, row: number, col: number): Promise<MoveResult> {
    return new Promise((resolve, reject) => {
      this.pendingMove = { resolve, reject };
      this.send({
        action: "drop",
        piece_type: pieceType,
        row,
        col,
      });
    });
  }

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.onAuth?.({
      authenticated: false,
      playerId: null,
      displayName: null,
      kingPos: null,
    });
  }

  resetConnection(): void {
    this.clearSession();
    this.disconnect();
    this.connect();
  }

  private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case "joined":
        this.handleJoined(message);
        break;
      case "reconnected":
        this.handleReconnected(message);
        break;
      case "state":
        this.onState?.(message);
        break;
      case "selection":
        this.handleSelection(message);
        break;
      case "move_result":
        this.handleMoveResult(message);
        break;
      case "error":
        this.handleError(message.error);
        break;
      default:
        break;
    }
  }

  private handleJoined(message: JoinedMessage): void {
    localStorage.setItem(TOKEN_KEY, message.token);
    this.onAuth?.({
      authenticated: true,
      playerId: message.player_id,
      displayName: message.display_name,
      kingPos: message.king_pos,
    });
  }

  private handleReconnected(message: ReconnectedMessage): void {
    this.onAuth?.({
      authenticated: true,
      playerId: message.player_id,
      displayName: message.display_name,
      kingPos: null,
    });
  }

  private handleSelection(message: SelectionMessage): void {
    if (!this.pendingSelection) {
      return;
    }

    const { resolve } = this.pendingSelection;
    this.pendingSelection = null;
    resolve({
      success: message.success,
      piece: message.piece,
      legal_moves: message.legal_moves,
      error: message.error,
    });
  }

  private handleMoveResult(message: MoveResultMessage): void {
    if (!this.pendingMove) {
      return;
    }

    const { resolve } = this.pendingMove;
    this.pendingMove = null;
    resolve({
      success: message.success,
      moved_piece_type: message.moved_piece_type,
      spawned_pawn: message.spawned_pawn,
      spawn_position: message.spawn_position,
      error: message.error,
      promotion_available: message.promotion_available,
    });
  }

  private handleError(error: string): void {
    if (error === "Invalid token") {
      localStorage.removeItem(TOKEN_KEY);
      this.onAuth?.({
        authenticated: false,
        playerId: null,
        displayName: null,
        kingPos: null,
      });
    }

    this.onError?.(error);

    if (this.pendingSelection) {
      this.pendingSelection.reject(new Error(error));
      this.pendingSelection = null;
    }

    if (this.pendingMove) {
      this.pendingMove.reject(new Error(error));
      this.pendingMove = null;
    }
  }

  private send(payload: Record<string, unknown>): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }
    this.ws.send(JSON.stringify(payload));
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private rejectPending(error: Error): void {
    this.pendingSelection?.reject(error);
    this.pendingSelection = null;
    this.pendingMove?.reject(error);
    this.pendingMove = null;
  }
}
