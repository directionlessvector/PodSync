# `apps/web` logic (Next.js client)

This document describes what the **web** app does at runtime: routes/pages, API calls, LiveKit integration, and signaling interactions as implemented in this repo.

## 0) What this app is

- Next.js App Router frontend running on port `3001` in dev (`apps/web/package.json` script `next dev --port 3001`).
- Stores an auth JWT in `localStorage` key `token`.
- Talks to:
  - **API** (Fastify) over HTTP: `NEXT_PUBLIC_API_URL` (default `http://localhost:3000`).
  - **Signaling** (custom WebSocket) for control events: `NEXT_PUBLIC_SIGNALING_URL` (default `ws://localhost:5004`).
  - **LiveKit SFU** for A/V media: `NEXT_PUBLIC_LIVEKIT_URL` (default `ws://localhost:7880`, but typically `wss://<project>.livekit.cloud`).

## 1) Environment / configuration

- `NEXT_PUBLIC_API_URL`
  - Used in `apps/web/lib/api.ts` as `BASE_URL`.
  - Used directly in `apps/web/app/room/[roomId]/page.tsx` polling.
- `NEXT_PUBLIC_SIGNALING_URL`
  - Used in `apps/web/hooks/useWebRTC.ts` as `SIGNALING_URL`.
- `NEXT_PUBLIC_LIVEKIT_URL`
  - Used in `apps/web/app/room/[roomId]/page.tsx` as `LiveKitRoom.serverUrl`.

## 2) Auth model

### Token storage

- JWT is stored in browser `localStorage` under key `token`.
- Pages that require auth either:
  - call `useAuth()` to redirect to `/login`, or
  - manually check `localStorage.getItem('token')`.

### `useAuth()` hook

File: `apps/web/hooks/useAuth.ts`

- On mount:
  - Reads `localStorage.token`.
  - If missing → `router.push('/login')`.
  - Else → sets `token` state.
- Returns `{ token, isLoading }`.

### `AuthError` flow (401 handling)

File: `apps/web/lib/api.ts`

- `request(url, options)`:
  - `fetch(...)`.
  - If status `401`:
    - Removes `localStorage.token`.
    - Throws `new AuthError()`.
  - Else returns `response.json()`.

Consumers typically catch `AuthError` and redirect to `/login`.

## 3) HTTP API calls made by this app

File: `apps/web/lib/api.ts`

All URLs are relative to `BASE_URL = NEXT_PUBLIC_API_URL || 'http://localhost:3000'`.

### `POST /auth/login`

- Function: `apiLogin(email, password)`
- Headers: `Content-Type: application/json`
- Body:
  - `{ "email": string, "password": string }`
- Returns JSON (usually `{ token }` or `{ error }`).

### `POST /auth/signup`

- Function: `apiSignup(name, email, password)`
- Headers: `Content-Type: application/json`
- Body:
  - `{ "name": string, "email": string, "password": string }`
- Returns JSON (usually `{ message }` or `{ error }`).

### `GET /auth/profile` (auth)

- Function: `apiGetProfile(token)`
- Headers:
  - `Authorization: Bearer <token>`
- Used by the room page to get `user.id` and by the watch page when a token exists.

### `GET /rooms/my-rooms` (auth)

- Function: `apiGetMyRooms(token)`
- Headers:
  - `Authorization: Bearer <token>`

### `GET /rooms/:roomId` (public)

- Function: `apiGetRoom(roomId)` (does not use `request()`)
- Used on the room page + watch page to load public room metadata.

### `POST /rooms` (auth)

- Function: `apiCreateRoom(token, { name, episodeTitle? })`
- Headers:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- Body:
  - `{ "name": string, "episodeTitle"?: string }`
- Returns `{ success, room, speakerUrl }` on success.

### `PATCH /rooms/:roomId/status` (auth; host-only on backend)

- Function: `apiUpdateRoomStatus(token, roomId, { status })`
- Headers:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- Body:
  - `{ "status": "waiting" | "live" | "ended" }`

### `PATCH /rooms/:roomId/recording` (auth; host-only on backend)

- Function: `apiUpdateRoomRecordingStatus(token, roomId, isRecording)`
- Headers:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- Body:
  - `{ "isRecording": boolean }`
- Returns `{ success, room: { id, isRecording, recordingStartAt } }` on success.

### `GET /rooms/:roomId/my-role` (auth)

- Function: `apiGetMyRole(token, roomId)`
- Headers:
  - `Authorization: Bearer <token>`
- Returns `{ success, role, roomId, roomName, roomStatus }`.

### `POST /rooms/:roomId/join` (auth)

- Function: `apiJoinRoom(token, roomId)`
- Headers:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- Body:
  - `{}` (explicit empty JSON body)
- Intended to add the user as `audience` (server-side default) if they had no participant row.

### Other `fetch(...)` calls (not via `lib/api.ts`)

File: `apps/web/app/room/[roomId]/page.tsx`

- `POST /rooms/:roomId/join-as-speaker` (auth)
  - Called when user loads `/room/:roomId` and they are not already `host` and not already `speaker`.
  - Headers: `Authorization: Bearer <token>`
  - **No body** and **no `Content-Type` header** (important: avoids Fastify empty-JSON parse errors).
- `GET /rooms/:roomId/livekit-token` (auth)
  - Headers: `Authorization: Bearer <token>`
  - Returns `{ token }` used to connect to LiveKit.
- Polling:
  - Every 6 seconds: `GET /rooms/:roomId` to refresh `room.status`.

File: `apps/web/app/watch/[roomId]/page.tsx`

- `GET /rooms/:roomId` (public) for room metadata.
- If local auth token exists:
  - `GET /auth/profile` (auth)
  - `POST /rooms/:roomId/join` (auth, empty JSON body)

## 4) Pages (App Router)

### `/` (Home)

File: `apps/web/app/page.tsx`

- On mount:
  - If `localStorage.token` exists → `router.replace('/dashboard')`.
- Otherwise shows basic “Get Started” and “Login” links.

### `/login`

File: `apps/web/app/login/page.tsx`

- Redirects to `/dashboard` if already logged in (token exists).
- Submits email/password via `apiLogin`.
- On success:
  - Stores `token` into `localStorage`.
  - `router.push('/dashboard')`.

### `/signup`

File: `apps/web/app/signup/page.tsx`

- Redirects to `/dashboard` if already logged in.
- Validates:
  - name required
  - email contains `@`
  - password length ≥ 6
- Calls `apiSignup`.
- On success:
  - Clears form
  - After 1500ms → redirects to `/login`.

### `/dashboard`

File: `apps/web/app/dashboard/page.tsx`

- Uses `useAuth()` to require a token.
- Fetches rooms via `apiGetMyRooms(token)` and renders:
  - room name/status/episodeTitle
  - `speakerUrl` and “Copy”
  - “Enter Room” button navigates to `/room/:roomId`.
- Logout clears `localStorage.token` and navigates to `/login`.

### `/dashboard/create`

File: `apps/web/app/dashboard/create/page.tsx`

- Uses `useAuth()` for token.
- Calls `apiCreateRoom(token, { name, episodeTitle? })`.
- On success renders a “Room Created” screen with:
  - `speakerUrl` (copy button)
  - “Enter Room →” button to `/room/:roomId`.

### `/room/[roomId]` (speaker/host studio)

File: `apps/web/app/room/[roomId]/page.tsx`

This is the main LiveKit-based “studio” page.

#### 4.1 Boot / auth / authorization sequence

On mount:

1) Read `localStorage.token`.
   - If missing → `router.push('/login')`.
2) Load in parallel:
   - `apiGetProfile(token)` (auth)
   - `GET /rooms/:roomId` (public)
3) Validate room:
   - If missing → show “Room not found”.
   - If `status === 'ended'` → show “session has ended”.
4) Determine host:
   - `userId = profileData.user?.id || profileData.id`
   - `hostId = roomData.room.host_id || roomData.room.hostId`
   - `isHost = hostId === userId`
5) Determine current participant role:
   - `apiGetMyRole(token, roomId)`
   - Treat as “already participant” if:
     - `isHost === true`, OR
     - role is `speaker`.
6) If not already participant:
   - `POST /rooms/:roomId/join-as-speaker` (auth)
7) After role is finalized:
   - `GET /rooms/:roomId/livekit-token` (auth)
   - If response lacks `token` → show “You are not a participant”.
8) Render `<LiveKitRoom ... token=liveKitToken ...>`.

#### 4.2 LiveKit connection and manual publish pattern

`<LiveKitRoom>` props:

- `serverUrl = NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880'`
- `token = liveKitToken`
- `connect = true`
- `video = false`, `audio = false` (disables auto-publish; manual control is used)

Inside `RoomContent`:

- Uses `useLocalParticipant()` to get `localParticipant`.
- Uses `useConnectionState()` and gates publishing behind `ConnectionState.Connected`.

Manual media acquisition/publish effect:

- When `localParticipant` exists AND `connectionState === Connected`:
  1) `getUserMedia({ audio: true, video: true })`.
  2) `setLocalStream(stream)`.
  3) For each track in stream:
     - `localParticipant.publishTrack(track)`.
  4) If that fails, fallback:
     - `getUserMedia({ audio: true, video: false })`,
     - set `camOff = true`,
     - publish tracks.
  5) On cleanup: stops tracks.

#### 4.3 UI tiles

- Local tile:
  - `LocalVideoTile` renders a `<video>` bound to `localStream` and a placeholder avatar if no active/enabled video track.
- Remote tiles:
  - Uses LiveKit component `<VideoTrack participant={participant} source={Track.Source.Camera} />`
  - Shows placeholder avatar if no subscribed camera track.
- Audio:
  - `<RoomAudioRenderer />` attaches remote audio.
  - `<StartAudio .../>` appears when the browser blocks autoplay; clicking it enables audio playback.

#### 4.4 Mic / camera toggles

- `toggleMic()` toggles `localStream.getAudioTracks()[0].enabled`
- `toggleCam()` toggles `localStream.getVideoTracks()[0].enabled`
- UI uses `ControlButton`:
  - “Mic on / Mic off”
  - “Cam on / Cam off”

#### 4.5 Host-only controls

Host controls are rendered only if `isHost === true`:

- “Record All” / “Stop Rec”
  - Calls `handleGlobalRecordToggle()` (details below).
- “Go Live”
  - Shown only when room.status is `waiting`.
  - Calls `handleStatusChange('live')`.
- “End Session”
  - Shown only when room.status is `live`.
  - Calls `handleStatusChange('ended')`.

#### 4.6 Local recording: `useMediaRecorder`

File: `apps/web/hooks/useMediaRecorder.ts`

Inputs:

- `stream: MediaStream | null`
- optional callbacks `onDataAvailable(blob)` and `onStop(blob)`

Behavior:

- `startRecording(startAt?: string)`:
  - No-op if `!stream` or already recording.
  - If `startAt` provided:
    - Computes initial `recordingTime` as `floor((Date.now() - startAt)/1000)` (for late join sync).
  - Chooses `mimeType`:
    - Prefer `'video/webm;codecs=vp9,opus'` if supported, else `'video/webm'`.
  - `MediaRecorder(stream, { mimeType })`.
  - `recorder.start(1000)` to emit chunks every 1s.
  - Maintains a timer interval to increment `recordingTime` every second.
  - On stop:
    - Creates one Blob from all chunks.
    - Stores `completedRecording = { url: objectURL, filename, blob }`.
- `stopRecording()` stops recorder and clears timer.
- `clearRecording()` revokes object URL and clears the completed recording state.

Room UI behavior:

- When `completedRecording` exists, shows a toast with:
  - “Download File” anchor linking to `completedRecording.url` with `download=filename`
  - Dismiss button that clears recording (warning: deletes unsaved recording)

#### 4.7 Recording synchronization (custom signaling over WS)

This is **not LiveKit data messages**; it’s a separate WebSocket control channel.

Hook: `useWebRTC(...)`

File: `apps/web/hooks/useWebRTC.ts`

- Connects to `SIGNALING_URL = NEXT_PUBLIC_SIGNALING_URL || 'ws://localhost:5004'`.
- On open:
  - Sends `{ event:'room:join', userId, roomId, role }`.
- `sendSignal(payload)` sends `{ event:'room:broadcast', userId, roomId, payload }`.
- Listens for `room:broadcast` and exposes `broadcastMsg`:
  - `{ action: payload.action, payload, fromUserId }`.

Usage on room page:

- Role passed to signaling:
  - `role = isHost ? 'host' : 'speaker'` (important: host-only broadcast enforcement happens server-side).
- Incoming broadcast processing:
  - If action is `start-recording` or `stop-recording` and `fromUserId !== room.host_id`:
    - Logs warning and ignores (defense in depth).
  - `start-recording`:
    - Reads `payload.startAt`.
    - If `localStream` exists → `startRecording(startAt)` and `sendSignal({action:'recording-ack'})`.
    - Else sets `pendingRecording = startAt`.
  - `stop-recording`:
    - Calls `stopRecording()` and clears `pendingRecording`.
  - `recording-ack`:
    - Adds `fromUserId` to `recordingAcks` set.

Late join / re-sync logic:

- If `pendingRecording` exists and `localStream` becomes available:
  - starts recording and ACKs.
- If `room.isRecording` is true and local is not recording yet:
  - starts recording using `room.recordingStartAt` and ACKs.
- Host-only watchdog:
  - Every 5s while `room.isRecording`:
    - For remote participants without an ACK, re-broadcast `start-recording` with the same `startAt`.

Global recording state source of truth:

- Host toggles global state via API (`PATCH /rooms/:roomId/recording`).
- On success:
  - If starting:
    - `sendSignal({ action:'start-recording', startAt })` and `startRecording(startAt)` locally.
  - If stopping:
    - `sendSignal({ action:'stop-recording' })` and `stopRecording()` locally.
    - Clears `recordingAcks`.

#### 4.8 Room status updates

- Host updates via API (`PATCH /rooms/:roomId/status`).
- Additionally, the room page polls public room status every 6 seconds:
  - `GET /rooms/:roomId` and updates `room.status` if present.

#### 4.9 Browser autoplay policies

- Without a user gesture, browsers often block audio playback.
- This app renders `<StartAudio label="Click to enable audio" />` so users can explicitly enable audio.

### `/watch/[roomId]` (legacy watch page)

File: `apps/web/app/watch/[roomId]/page.tsx`

This file contains a “watch” experience using `useWebRTC(...)` and expects:

- `localStream`, `remoteStreams`, `peers`, `connected`, etc.

However, **the current `useWebRTC` hook in this repo only implements WebSocket broadcast control** (it returns `connected`, `sendSignal`, `broadcastMsg`, `error`). This means the watch page is currently **out of sync** with the hook implementation and likely does not build/run correctly without further work.

### `/test-rtc` (legacy verification page)

File: `apps/web/app/test-rtc/page.tsx`

Same mismatch as the watch page: it expects a P2P WebRTC hook API that is not present in `apps/web/hooks/useWebRTC.ts` anymore.

## 5) Known sharp edges (from current code)

- Host-only UI depends on correctly detecting host:
  - Backend returns `room.hostId` (camelCase) from `GET /rooms/:roomId`.
  - Room page reads `host_id || hostId` to avoid casing mismatches.
- WebSocket warnings in dev:
  - React Strict Mode may mount/unmount effects twice, creating and closing WS connections quickly.
- LiveKit audio autoplay:
  - Requires user gesture; handled by `StartAudio`.

