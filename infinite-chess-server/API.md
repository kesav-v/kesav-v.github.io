# Infinite Chess Server — API Reference

Multiplayer backend for [infinite-chess](https://github.com/kesav-v/infinite-chess). Clients connect over **WebSocket** for gameplay; a small **HTTP** surface covers health checks and admin.

**Production base URL:** `https://infinite-chess.viswanadha.com`

---

## Overview

| Transport | Path | Purpose |
|-----------|------|---------|
| HTTP | `GET /` | Service metadata |
| HTTP | `GET /health` | Liveness check |
| HTTP | `POST /admin/clear` | Reset world (admin only) |
| WebSocket | `/ws` | Join, moves, state sync |

All request and response bodies are **JSON**. WebSocket messages are JSON objects with a `type` field on server → client messages, and an `action` field on client → server messages.

The server broadcasts world state to all connected clients after joins, reconnects, successful moves/drops, disconnects, and admin clears.

---

## HTTP API

### `GET /`

Service metadata.

**Response `200`**

```json
{
  "name": "infinite-chess-server",
  "version": "0.1.0",
  "websocket": "/ws",
  "admin": "/admin/clear"
}
```

---

### `GET /health`

Liveness probe.

**Response `200`**

```json
{
  "status": "ok"
}
```

---

### `POST /admin/clear`

Clears the entire world: empty board, all player sessions removed, persisted save reset. Broadcasts a fresh `state` message to all WebSocket clients.

**Authentication:** required header `X-Admin-Secret` matching the server's `ADMIN_SECRET` env var. If `ADMIN_SECRET` is not configured, always returns **403**.

**Request headers**

| Header | Required | Description |
|--------|----------|-------------|
| `X-Admin-Secret` | yes | Shared admin secret |

**Response `200`**

```json
{
  "status": "ok",
  "message": "World state cleared"
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| `403` | Secret not configured, missing, or wrong |

---

## WebSocket API

**URL:** `ws(s)://<host>/ws`

Connect with a standard WebSocket client. The server accepts the connection immediately; the client must send `join` or `reconnect` to authenticate.

### Authentication model

- **`join`** — creates a new player, spawns a full piece set on the board, returns a session **token**.
- **`reconnect`** — resumes an existing session using a saved token (e.g. from `localStorage`).

After a successful `join` or `reconnect`, the connection is bound to that `player_id`. Actions `move` and `drop` require this binding; otherwise the server returns `{ "type": "error", "error": "Not authenticated" }`.

The token is a UUID hex string. Store it client-side to survive page reloads.

---

### Client → server messages

All messages are JSON objects. Every message must include `"action"`.

#### `join`

Register a new player in the shared world.

**Request**

```json
{
  "action": "join",
  "name": "Alice"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | string | yes | — | `"join"` |
| `name` | string | no | `"Anonymous"` | Display name |

**Response:** `joined` (to sender), then `state` (broadcast to all clients)

---

#### `reconnect`

Resume a previous session.

**Request**

```json
{
  "action": "reconnect",
  "token": "<session-token>"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | yes | `"reconnect"` |
| `token` | string | yes | Token from a prior `joined` response |

**Response:** `reconnected` (to sender), then `state` (broadcast), or `error` if token is invalid.

---

#### `state`

Request a snapshot of the current world. Does not require authentication.

**Request**

```json
{
  "action": "state"
}
```

**Response:** `state` (to sender only)

---

#### `select`

Query legal moves for a piece at a square. Does not require authentication (read-only).

**Request**

```json
{
  "action": "select",
  "row": 0,
  "col": 0
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | yes | `"select"` |
| `row` | integer | yes | Board row |
| `col` | integer | yes | Board column |

**Response:** `selection`

---

#### `move`

Move one of your pieces. Requires prior `join` or `reconnect`.

**Request**

```json
{
  "action": "move",
  "from_row": 0,
  "from_col": 0,
  "to_row": 1,
  "to_col": 0,
  "promotion": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | yes | `"move"` |
| `from_row` | integer | yes | Source row |
| `from_col` | integer | yes | Source column |
| `to_row` | integer | yes | Destination row |
| `to_col` | integer | yes | Destination column |
| `promotion` | string \| null | no | `"queen"`, `"rook"`, `"bishop"`, or `"knight"` when promotion is required |

**Response:** `move_result` (to sender). On success, `state` is broadcast to all clients. Only the active player may move; others get `"Not your turn"`.

**Promotion flow:** if a pawn reaches its promotion rank, the server returns `success: false` with `promotion_available: true` and `error: "Promotion piece required"`. Re-send the same move with `promotion` set to a valid piece type.

---

#### `drop`

Crazyhouse-style drop: place a captured piece from your bank onto an empty square. Requires prior `join` or `reconnect`.

**Request**

```json
{
  "action": "drop",
  "piece_type": "knight",
  "row": 2,
  "col": 0
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | yes | `"drop"` |
| `piece_type` | string | yes | `"pawn"`, `"knight"`, `"bishop"`, `"rook"`, or `"queen"` |
| `row` | integer | yes | Drop target row |
| `col` | integer | yes | Drop target column |

Pawns may only be dropped on the player's second rank (see `pawn_drop_rank_info` in player state).

**Response:** `move_result` (to sender). On success, `state` is broadcast to all clients.

---

### Server → client messages

All messages include `"type"`.

#### `joined`

Sent after a successful `join`.

```json
{
  "type": "joined",
  "player_id": "p1",
  "token": "a1b2c3d4e5f6...",
  "display_name": "Alice",
  "king_pos": { "row": 0, "col": 0 }
}
```

Persist `token` for reconnection.

---

#### `reconnected`

Sent after a successful `reconnect`.

```json
{
  "type": "reconnected",
  "player_id": "p1",
  "display_name": "Alice"
}
```

---

#### `state`

Full world snapshot. Sent in response to `state`, and broadcast after joins, reconnects, moves, drops, disconnects, and admin clears.

```json
{
  "type": "state",
  "pieces": [
    { "row": 0, "col": 0, "type": "king", "player_id": "p1" }
  ],
  "players": [
    {
      "id": "p1",
      "display_name": "Alice",
      "orientation": "vertical",
      "alive": true,
      "connected": true,
      "is_turn": true,
      "bank": ["knight", "pawn"],
      "pawn_drop_rank_info": {
        "orientation": "vertical",
        "front_pawn_line": 1,
        "back_pawn_line": -1
      }
    }
  ],
  "turn": {
    "player_id": "p1",
    "deadline": 1719500000.0,
    "seconds_remaining": 7.3,
    "turn_seconds": 10
  }
}
```

`turn` is omitted when no turn is active (empty world). Each player object includes `is_turn: true` for the active player.

---

#### `turn_passed`

Broadcast when a player's turn timer expires but they have no legal moves or drops.

```json
{
  "type": "turn_passed",
  "success": true,
  "player_id": "p1",
  "reason": "no_legal_actions"
}
```

---

#### `selection`

Sent in response to `select`.

**Success**

```json
{
  "type": "selection",
  "success": true,
  "piece": {
    "type": "knight",
    "player_id": "p1",
    "row": 0,
    "col": 1
  },
  "legal_moves": [
    { "row": 2, "col": 0 },
    { "row": 2, "col": 2 }
  ]
}
```

**Failure**

```json
{
  "type": "selection",
  "success": false,
  "error": "No piece at that position"
}
```

---

#### `move_result`

Sent in response to `move` or `drop`.

**Success (move)**

```json
{
  "type": "move_result",
  "success": true,
  "promotion_available": false,
  "moved_piece_type": "knight",
  "spawned_pawn": false,
  "spawn_position": null
}
```

When a pawn promotes, `spawned_pawn` may be `true` and `spawn_position` may be `{ "row": ..., "col": ... }` for a newly spawned pawn at the pawn's origin.

**Success (drop)**

```json
{
  "type": "move_result",
  "success": true
}
```

**Failure**

```json
{
  "type": "move_result",
  "success": false,
  "error": "Illegal move"
}
```

Common error strings:

| Error | Cause |
|-------|-------|
| `"Not your turn"` | Move/drop attempted out of turn |
| `"Illegal move"` | Move not in legal move set |
| `"You don't have a {type} in your bank"` | Invalid drop from bank |
| `"Square is not empty"` | Drop target occupied |
| `"Pawns must be dropped on your second rank..."` | Invalid pawn drop square |
| `"Drops not supported"` | Engine build without drop support |

**Promotion pending**

```json
{
  "type": "move_result",
  "success": false,
  "promotion_available": true,
  "error": "Promotion piece required"
}
```

---

#### `error`

Generic error (bad action, auth failure, etc.).

```json
{
  "type": "error",
  "error": "Not authenticated"
}
```

```json
{
  "type": "error",
  "error": "Invalid token"
}
```

```json
{
  "type": "error",
  "error": "Unknown action: foo"
}
```

---

## Shared data types

### Coordinates

Board positions use unbounded integer coordinates `(row, col)`. There is no fixed board edge; the world grows as players spawn and move.

### Piece (in `state.pieces`)

| Field | Type | Description |
|-------|------|-------------|
| `row` | integer | Row |
| `col` | integer | Column |
| `type` | string | `"king"`, `"queen"`, `"rook"`, `"bishop"`, `"knight"`, or `"pawn"` |
| `player_id` | string | Owner |

### Player (in `state.players`)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Player ID (e.g. `"p1"`) |
| `display_name` | string | Name from `join` |
| `orientation` | string | `"vertical"` or `"horizontal"` — affects pawn movement and drop ranks |
| `alive` | boolean | Whether the player still has a king on the board |
| `connected` | boolean | Whether a WebSocket is currently open for this player |
| `bank` | string[] | Captured pieces available to drop (Crazyhouse); no kings |
| `pawn_drop_rank_info` | object \| omitted | Where pawns may be dropped |

### `pawn_drop_rank_info`

| Field | Type | Description |
|-------|------|-------------|
| `orientation` | string | `"vertical"` or `"horizontal"` |
| `front_pawn_line` | integer | Row (vertical) or col (horizontal) of front pawn rank |
| `back_pawn_line` | integer | Row (vertical) or col (horizontal) of back pawn rank |

For vertical players, valid pawn drop squares have `row` equal to `front_pawn_line` or `back_pawn_line`. For horizontal players, valid pawn drop squares have `col` equal to one of those lines.

---

## Turn-based play

Alive players take turns in join order. Default: **10 seconds per turn** (`TURN_SECONDS` env or `--turn-seconds` CLI).

- Only the active player may `move` or `drop`. Others receive `"Not your turn"`.
- A successful move or drop ends the turn and starts the next alive player's timer.
- If the timer expires, the server picks a **random legal move or drop** for that player and broadcasts `move_result` with `"auto": true`.
- If there are no legal actions, the turn passes (`turn_passed` message) and the next player goes.

Turn info is included in every `state` message:

| Field | Type | Description |
|-------|------|-------------|
| `turn.player_id` | string | Who may act now |
| `turn.deadline` | number | Unix timestamp when the turn expires |
| `turn.seconds_remaining` | number | Seconds left (approximate) |
| `turn.turn_seconds` | number | Configured turn length |

Each player in `state.players` also has `is_turn: boolean`.

---

## CORS

The server sends CORS headers for cross-origin HTTP clients. Default allowed origin is `*`. Production deployments may restrict this via the `CORS_ORIGINS` env var (comma-separated list).

WebSocket connections are not subject to CORS preflight, but browsers still enforce same-origin policy for the initial HTTP upgrade unless the server accepts the connection (which it does for all origins).

---

## Recommended client flow

```
1. Open WebSocket → wss://infinite-chess.viswanadha.com/ws
2. If saved token exists → send reconnect
   Else → send join with display name
3. On joined/reconnected → save token locally
4. Handle state messages → render board and player list
5. On piece click → send select → highlight legal_moves
6. On destination click → send move (with promotion if needed)
7. On bank piece click → send drop
8. On disconnect → reconnect WebSocket and send reconnect with saved token
```

### Example: join and listen for state

```javascript
const ws = new WebSocket("wss://infinite-chess.viswanadha.com/ws");

ws.onopen = () => {
  const token = localStorage.getItem("chess_token");
  if (token) {
    ws.send(JSON.stringify({ action: "reconnect", token }));
  } else {
    ws.send(JSON.stringify({ action: "join", name: "Alice" }));
  }
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  switch (msg.type) {
    case "joined":
      localStorage.setItem("chess_token", msg.token);
      break;
    case "state":
      renderBoard(msg.pieces, msg.players);
      break;
    case "selection":
      highlightMoves(msg.legal_moves);
      break;
    case "move_result":
      if (!msg.success && msg.promotion_available) {
        promptPromotion(msg);
      }
      break;
    case "error":
      console.error(msg.error);
      break;
  }
};
```

---

## Persistence

The server persists the world to disk after every join, move, and drop. Sessions survive server restarts; clients should `reconnect` with their token after a restart.

---

## Optional dev-only routes

When `SERVE_STATIC=1` is set on the server:

| Route | Description |
|-------|-------------|
| `GET /play` | Bundled browser client |
| `GET /static/*` | Static assets |

These routes are **not** enabled on the production deployment at `infinite-chess.viswanadha.com`.
