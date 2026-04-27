# `apps/api` logic (Fastify backend)

This document describes what the **API** does at runtime: server setup, auth, routes, DB operations (Supabase Postgres), and LiveKit token issuance.

## 0) What this service is

- A Fastify server that exposes:
  - Auth endpoints under `/auth/*`
  - Room endpoints under `/rooms/*`
- Uses Supabase **only as a Postgres client** (`@supabase/supabase-js`), not Supabase Auth.
- Uses JWT for auth (stored client-side by `apps/web`).
- Issues LiveKit **client access tokens** via `livekit-server-sdk`.

Dev defaults:

- Listens on `http://0.0.0.0:3000` (`apps/api/index.js`).
- CORS origin hard-coded to `http://localhost:3001` (`apps/api/index.js`).

## 1) Environment variables

File: `apps/api/.env` (loaded by `dotenv` in `apps/api/index.js`)

- `SUPABASE_URL` / `SUPABASE_KEY`
  - Used by `apps/api/db.js` to create the Supabase client.
- `JWT_SECRET`
  - Required by `apps/api/middleware/authMiddleware.js` and `apps/api/controllers/loginController.js`.
- `FRONTEND_URL`
  - Used to construct `speakerUrl` returned from room creation and room lists.
  - Dev fallback: `http://localhost:3001`.
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`
  - Used by `apps/api/controllers/roomController.js` to sign LiveKit access tokens.
- `LIVEKIT_URL`
  - Present in `.env` but **not currently used** by the API code in this repo (the web client uses `NEXT_PUBLIC_LIVEKIT_URL` as the LiveKit server URL).

## 2) Server entrypoint and middleware

### Server entrypoint

File: `apps/api/index.js`

- Registers CORS:
  - `origin: 'http://localhost:3001'`
  - `methods: ['GET','POST','PUT','DELETE','PATCH']`
  - `credentials: true`
- Registers routes:
  - `fastify.register(authRoutes, { prefix: '/auth' })`
  - `fastify.register(roomRoutes)`
  - `fastify.register(participantRoutes)`
- On `fastify.ready()`: prints route table.

### Authentication middleware

File: `apps/api/middleware/authMiddleware.js`

`authenticate(request, reply)`:

1) Reads `Authorization` header and expects `Bearer <token>`.
2) Verifies JWT with `JWT_SECRET`.
3) Requires decoded payload to contain `userId`.
4) Loads user by id via `getUserById()` (Supabase `users` table).
5) Attaches:
   - `request.user = { id, email, name }`
6) On any failure:
   - returns `401 { error: 'Unauthorized' }` (or more specific 401 messages for missing/invalid header/payload).

JWT issuing:

- `apps/api/controllers/loginController.js` signs:
  - payload `{ userId: user.id, email: user.email }`
  - expiry `7d`

## 3) Database access layer

### Supabase client

File: `apps/api/db.js`

- `createClient(SUPABASE_URL, SUPABASE_KEY)`
- Disables auth session persistence/refresh:
  - `persistSession: false`
  - `autoRefreshToken: false`

### Tables assumed by code

Based on usage in services:

- `users`
  - `id`, `email`, `password`, `name`, ...
- `rooms`
  - `id`, `name`, `episode_title`, `host_id`, `status`, `created_at`, `is_recording`, `recording_start_at`, ...
- `room_participants`
  - `room_id`, `user_id`, `role`, `joined_at`, ...

## 4) Routes (HTTP API)

Routes are defined in:

- `apps/api/routes/authRoutes.js` (registers signup/login/profile routes)
- `apps/api/routes/roomRoutes.js`
- `apps/api/routes/participantRoutes.js`

### 4.1 Auth routes (`/auth/*`)

#### `POST /auth/signup`

Route file: `apps/api/routes/signupRoutes.js`

- JSON schema requires:
  - `email` (format email)
  - `password` (minLength 6)
  - `name`
- Controller: `apps/api/controllers/signupController.js`
  - Rejects missing fields → `400`
  - If email exists → `409`
  - Hashes password with bcrypt (`SALT_ROUNDS=10`)
  - Inserts into `users` table
  - Success → `201 { message: 'User created successfully' }`

#### `POST /auth/login`

Route file: `apps/api/routes/loginRoutes.js`

- JSON schema requires:
  - `email` (format email)
  - `password`
- Controller: `apps/api/controllers/loginController.js`
  1) `checkDatabaseConnection()` (selects from `users` with limit 1)
  2) Loads user by email
  3) bcrypt compares password
  4) Issues JWT (`expiresIn = '7d'`)
  5) Success → `{ token }`
  6) Invalid creds → `401`
  7) Errors → `500 { error: 'Unable to log in' }`

#### `GET /auth/profile` (auth)

Route file: `apps/api/routes/profileRoutes.js`

- preHandler: `authenticate`
- Controller: `apps/api/controllers/profileController.js`
  - Returns `{ user: request.user }`

### 4.2 Room routes (`/rooms/*`)

Route file: `apps/api/routes/roomRoutes.js`

#### `GET /rooms/my-rooms` (auth)

- Must be declared before `/rooms/:roomId`.
- Controller: `handleGetMyRooms` in `apps/api/controllers/roomController.js`
  - Queries rooms where `host_id = request.user.id`
  - Adds `speakerUrl = FRONTEND_URL + /room/:id`
  - Returns `{ success: true, rooms: [...] }`

#### `POST /rooms` (auth)

Controller: `handleCreateRoom`

- Validates body `name` exists and non-empty string.
- Calls `createRoom({ name, episodeTitle, hostId })`:
  - Checks for existing room with same `host_id` and `name`.
  - Inserts into `rooms` with:
    - `status: 'waiting'`
    - `episode_title` as given
  - Inserts host into `room_participants` with role `'speaker'`.
- Returns `201`:
  - `{ success: true, room: { id, name, status, createdAt }, speakerUrl }`

Note: the controller only returns `speakerUrl`. Some tests in `apps/api/tests/api.test.js` still expect `audienceUrl` (stale).

#### `GET /rooms/:roomId` (public)

Controller: `handleGetRoom`

- Fetches room row by id.
- Returns:
  - `{ success: true, room: { id, name, status, hostId, createdAt, isRecording, recordingStartAt } }`
  - Note the response field names are **camelCase** (e.g. `hostId`, `isRecording`) while DB columns are snake_case.

#### `PATCH /rooms/:roomId/status` (auth; host-only)

Controller: `handleUpdateRoomStatus`

- Validates `status` in `['waiting','live','ended']`.
- Calls `updateRoomStatus({ roomId, status, hostId: request.user.id })`:
  - Verifies `rooms.host_id === hostId`, else throws “Only the host…”.
  - Updates `rooms.status`.
- Returns `{ success: true, room: updatedRoomRow }` (room row is the DB shape).
- Errors:
  - Invalid status → `400`
  - Not host → `403`

#### `PATCH /rooms/:roomId/recording` (auth; host-only)

Controller: `handleUpdateRecordingState`

- Validates `isRecording` is boolean.
- Calls `updateRecordingState({ roomId, isRecording, hostId: request.user.id })`:
  - Verifies host.
  - Updates:
    - `is_recording = isRecording`
    - `recording_start_at = nowISOString` if starting else `null`
- Returns:
  - `{ success: true, room: { id, isRecording, recordingStartAt } }`

#### `GET /rooms/:roomId/livekit-token` (auth)

Controller: `handleGetLiveKitToken`

Authorization rules:

1) Must be a real room.
2) Determine role:
   - `role = getParticipantRole(roomId, userId)` from `room_participants`.
   - If `rooms.host_id === userId`, role is forced to `'host'`.
   - If no role and not host → `403`.
3) Compute:
   - `canPublish = (role === 'speaker' || role === 'host')`
4) Mint access token:
   - `new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: userId, name })`
   - Grants:
     - `roomJoin: true`
     - `room: roomId`
     - `canPublish: canPublish`
     - `canPublishData: true`
     - `canSubscribe: true`
5) Returns `{ success: true, token }`.

### 4.3 Participant routes (`/rooms/:roomId/*`)

Route file: `apps/api/routes/participantRoutes.js`

#### `GET /rooms/:roomId/my-role` (auth)

Controller: `handleGetMyRole` (`apps/api/controllers/participantController.js`)

- If room missing → `404`
- Loads role from `room_participants`
- Returns:
  - `{ success: true, role: (dbRole || 'audience'), roomId, roomName, roomStatus }`

Important: this endpoint does **not** special-case host; it just returns the participant table role or `audience`.

#### `POST /rooms/:roomId/join` (auth)

Controller: `handleJoinRoom`

- If room missing → `404`
- If room ended → `400`
- If participant row exists:
  - Returns `200 { success: true, role: existingRole, ... }`
- Else:
  - Adds participant with role `'audience'` via `addParticipant(...)`:
    - `upsert` with `ignoreDuplicates: true` to avoid downgrades.
  - Returns `201 { success: true, role: 'audience', ... }`

#### `POST /rooms/:roomId/join-as-speaker` (auth)

Controller: `handleJoinAsSpeaker`

- If room missing → `404`
- If room ended → `400`
- Calls `joinAsSpeaker({ roomId, userId })`:
  - `upsert` role `'speaker'` with `ignoreDuplicates: false` to upgrade existing audience.
- Returns `{ success: true, role: 'speaker', roomId, roomName }`

#### `POST /rooms/:roomId/invite` (auth; host-only)

Controller: `handleInviteSpeaker`

- Validates `email` string.
- Calls `inviteSpeaker({ roomId, hostId, inviteeEmail })`:
  1) Verifies requester is the host by checking `rooms.host_id`.
  2) Loads invitee in `users` table by email.
  3) Upserts into `room_participants` as `'speaker'` (upgrades audience to speaker).
- Returns `{ success: true, message, userId }`
- Errors:
  - Not host → `403`
  - No user for email → `404`

#### `GET /rooms/:roomId/participants` (public)

Controller: `handleGetParticipants`

- If room missing → `404`
- Returns `{ success: true, participants }`
  - Each participant row includes: `user_id, role, joined_at` from `room_participants`.

## 5) Services (business logic)

### `userService`

File: `apps/api/services/userService.js`

- `checkDatabaseConnection()` selects from `users` to validate connectivity.
- `createUser({ email, hashedPassword, name })` inserts into `users`.
- `getUserByEmail(email)` selects user, returns `null` for Supabase “no row” code `PGRST116`.
- `getUserById(id)` selects user, returns `null` for `PGRST116`.

### `roomService`

File: `apps/api/services/roomService.js`

- `createRoom({ name, hostId, episodeTitle })`
  - Prevents duplicates per host: checks `rooms` for `(host_id, name)` existing.
  - Inserts into `rooms`.
  - Inserts host into `room_participants` with role `speaker`.
- `getRoomById(roomId)`
  - Returns `null` for “no row” (`PGRST116`) or invalid UUID (`22P02`).
- `updateRoomStatus({ roomId, status, hostId })`
  - Verifies host matches, then updates `rooms.status`.
- `updateRecordingState({ roomId, isRecording, hostId })`
  - Verifies host matches, then updates:
    - `is_recording`
    - `recording_start_at`
- `getRoomsByHost(hostId)` returns rooms ordered by newest first.

### `participantService`

File: `apps/api/services/participantService.js`

- `getParticipantRole(roomId, userId)`
  - Selects `role` from `room_participants`.
  - Returns `null` for `PGRST116`.
- `addParticipant({ roomId, userId, role })`
  - `upsert` with `ignoreDuplicates: true` (prevents overwriting existing role).
- `joinAsSpeaker({ roomId, userId })`
  - `upsert` with `ignoreDuplicates: false` (upgrades to speaker).
- `inviteSpeaker({ roomId, hostId, inviteeEmail })`
  - Verifies host, finds invitee by email, upserts speaker role.
- `getRoomParticipants(roomId)` selects `user_id, role, joined_at`.

## 6) Test suite (exists, partially stale)

File: `apps/api/tests/api.test.js`

- Uses `supertest` against `http://localhost:3000`.
- Exercises:
  - signup/login/profile
  - create room / get room / my-rooms / status changes
  - join / invite / participants
  - end-session checks
- **Stale expectation:** it asserts `POST /rooms` returns `audienceUrl`, but `handleCreateRoom` currently returns only `speakerUrl`.

