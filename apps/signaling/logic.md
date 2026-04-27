# `apps/signaling` logic (custom WebSocket control channel)

This document describes what the **signaling** service does at runtime: how clients connect, what messages exist, how state is stored, and how heartbeats/cleanup work.

## 0) What this service is

- A standalone WebSocket server built on `ws`.
- Used by the web app for **high-level control events** (currently: recording sync + ACKs + general broadcasts).
- **Not** LiveKit signaling and **not** used for A/V transport.
- Does **not** authenticate users; it trusts the `userId`, `roomId`, and `role` provided by the client.

## 1) Environment / runtime

- Entry: `apps/signaling/src/index.js`
- Env file: `apps/signaling/.env` loaded via `dotenv`.
- Port:
  - `SIGNALING_PORT` env var, else defaults to `5000`.
  - In this repo’s dev config, the web app defaults to `ws://localhost:5004`, so `SIGNALING_PORT` is typically set to `5004`.

Scripts (`apps/signaling/package.json`):

- `pnpm --filter signaling dev` → `nodemon src/index.js`
- `pnpm --filter signaling start` → `node src/index.js`

## 2) In-memory state model

File: `apps/signaling/src/state/roomRegistry.js`

- `clients: Map<userId, { ws, roomId, role, isAlive }>`
- `rooms: Map<roomId, Set<userId>>`

Functions:

- `addClient(userId, ws, roomId, role)`
  - Stores/overwrites the client record; initializes `isAlive: true`.
- `removeClient(userId)`
  - Deletes from `clients`.
- `addToRoom(roomId, userId)`
  - Ensures a `Set` exists and adds userId.
- `removeFromRoom(roomId, userId)`
  - Removes userId; deletes room if empty.
- `getRoomMembers(roomId)`
  - Returns `Set` or empty set.
- `sendTo(userId, message)`
  - Sends JSON to that user’s ws if open (`readyState === 1`).
- `broadcastToRoom(roomId, excludeUserId, message)`
  - Sends to all members in room except the excluded sender.
- Heartbeat support:
  - `getAllClients()`, `markAlive(userId)`

State lifetime:

- Purely in-memory; restarting the process clears all rooms/clients.

## 3) Connection lifecycle

File: `apps/signaling/src/index.js`

On `wss.on('connection', (ws) => ...)`:

- Logs: `new signaling connection established`.
- Registers:
  - `ws.on('pong', ...)`:
    - Finds the client record whose stored ws matches the incoming `ws` and calls `markAlive(userId)`.
  - `ws.on('message', ...)`:
    - Parses JSON
    - Routes based on `message.event`
  - `ws.on('close', ...)`:
    - Finds the matching `userId` for this `ws` and calls `handleLeave(userId)`.
  - `ws.on('error', ...)`:
    - Logs `ws error: ...`.

## 4) Message protocol (events)

All messages are JSON.

### 4.1 `room:join` (client → server)

Client sends (on ws open):

```json
{ "event": "room:join", "userId": "<id>", "roomId": "<room>", "role": "speaker|host|..." }
```

Handler:

- `apps/signaling/src/handlers/joinHandler.js` → `handleJoin(ws, message)`

Behavior:

1) Validates `userId`, `roomId`, `role` exist.
2) `addClient(userId, ws, roomId, role)`
3) `addToRoom(roomId, userId)`
4) Builds `peers` array from current room members excluding self:
   - `{ userId: memberId, role: client.role }`
5) Sends to joiner:

```json
{ "event": "room:joined", "roomId": "<roomId>", "role": "<role>", "peers": [ ... ] }
```

6) Broadcasts to other members:

```json
{ "event": "room:peer-joined", "userId": "<userId>", "role": "<role>" }
```

7) Logs:
  - `room:join - userId=..., role=..., roomId=..., peerCount=...`

### 4.2 `room:leave` (client → server)

Client can send:

```json
{ "event": "room:leave", "userId": "<id>" }
```

Server behavior:

- Calls `handleLeave(userId)` if `userId` exists.

### 4.3 `room:broadcast` (client → server → room members)

Client sends:

```json
{ "event": "room:broadcast", "userId": "<id>", "roomId": "<room>", "payload": { ... } }
```

Server behavior (`apps/signaling/src/index.js`):

1) Looks up sender by `userId`.
2) Ensures sender has a `roomId`.
3) **Recording command guard**:
   - If `message.payload.action` is a string and `includes('recording')`:
     - Only allow if sender `client.role === 'host'`.
     - Otherwise log:
       - `Unauthorized recording command dropped from <userId>`
     - And drop the message (no broadcast).
4) If allowed:
   - Broadcasts the **original `message`** to other room members.

Receiving clients (web hook) interpret this as:

```json
{ "event": "room:broadcast", "userId": "<sender>", "roomId": "<room>", "payload": { "action": "...", ... } }
```

Note: The server uses `broadcastToRoom(roomId, excludeUserId, message)` which excludes the sender from receiving its own broadcast.

### 4.4 Error messages (server → client)

When message JSON is invalid:

```json
{ "event": "error", "message": "Invalid JSON" }
```

When `event` field is missing:

```json
{ "event": "error", "message": "Missing event field" }
```

When `event` is unknown:

```json
{ "event": "error", "message": "Unknown event: <event>" }
```

## 5) Leave handling (cleanup + peer notifications)

File: `apps/signaling/src/handlers/leaveHandler.js`

`handleLeave(userId)`:

1) Loads client record: `{ roomId, role }`.
2) `removeClient(userId)`
3) `removeFromRoom(roomId, userId)`
4) Broadcasts to remaining room members:

```json
{ "event": "room:peer-left", "userId": "<userId>", "role": "<role>" }
```

5) Logs:
  - `room:leave - userId=..., role=..., roomId=...`

## 6) Heartbeat / liveness

File: `apps/signaling/src/heartbeat.js`

- Every 30 seconds:
  - For each client:
    - If `client.isAlive === false`:
      - Logs `heartbeat failed - userId=..., roomId=...`
      - Terminates socket: `ws.terminate()`
      - Calls `handleLeave(userId)` to remove from maps and broadcast `room:peer-left`
    - Else:
      - Sets `client.isAlive = false`
      - Sends `ws.ping()` (if available)
- On client `pong`, `index.js` marks that userId alive.

## 7) Important security note (current design)

- The server trusts `userId` and `role` from the client.
- The only enforcement it performs is the “recording actions require role `host`” guard, but since `role` is client-provided, it is not strong security.
- If you need real security, the server should validate `userId` + role against the API (JWT) or use LiveKit data channel where permissions are enforced by server-issued tokens.

