# Podcast Studio — Project Context

> Last updated: 2026-04-21 | Branch: `feature/meeting-system`

---

## What This Is

A browser-based podcast recording platform. Hosts create rooms, invite co-hosts (speakers), and audience members can join to listen. The architecture is WebRTC-based: peers connect directly via a signaling server, with a REST API handling auth, rooms, and participants.

**Ports:** API=3000, Web=3001 (Next.js), Signaling=5004 (WebSocket)

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind 4, shadcn/ui |
| Backend | Fastify 5.8 (Node.js) |
| Database | Supabase PostgreSQL (custom JWT auth, not Supabase Auth) |
| Auth | JWT (1hr expiry) + bcrypt |
| Real-time | WebSocket (ws library, raw) |
| WebRTC | Planned — not yet implemented |
| Monorepo | Turborepo + pnpm |

---

## Monorepo Structure

```
apps/
  api/          Fastify REST API
    routes/     Route definitions
    controllers/ Request handlers
    services/   DB operations (userService, roomService, participantService)
    middleware/  authMiddleware.js (JWT verification)
    tests/       Jest + supertest (40+ tests)
  web/          Next.js frontend
    app/
      page.tsx            Home
      login/page.tsx      Login
      signup/page.tsx     Signup
      dashboard/page.tsx  Room list
      dashboard/create/   Create room
    lib/api.ts            Fetch-based API client
    hooks/useAuth.ts      Token management
  signaling/    WebSocket signaling server
    src/
      state/roomRegistry.js   In-memory client/room tracking
      handlers/               join, leave, signal handlers
      heartbeat.js            30s ping/pong health checks

packages/
  ui/           Shared components (button, card, input, label)
```

---

## Database Schema

```sql
users             (id, email, password, name, created_at)
rooms             (id, name, episode_title, host_id → users, status, created_at)
                  status: waiting | live | ended
room_participants  (room_id → rooms, user_id → users, role, joined_at)
                  role: speaker | audience
```

---

## What's Done

### Auth
- [x] Signup (email, password, name) with bcrypt
- [x] Login returning JWT
- [x] JWT middleware protecting routes
- [x] Profile endpoint

### Rooms API
- [x] Create room (host auto-added as speaker)
- [x] Get room by ID (public)
- [x] List my rooms
- [x] Update room status (waiting → live → ended, host-only)

### Participants API
- [x] Join room as audience
- [x] Invite speaker by email (host-only)
- [x] Get participant list
- [x] Get user's role in a room

### Signaling Server
- [x] WebSocket server on port 5004
- [x] room:join, room:leave events with peer discovery
- [x] signal:offer, signal:answer, signal:ice-candidate relay
- [x] Heartbeat (30s ping interval)
- [x] In-memory room registry

### Frontend
- [x] Home, Login, Signup pages
- [x] Dashboard (room list)
- [x] Create room form (name + episode title)
- [x] Speaker/audience invite link generation + copy-to-clipboard
- [x] Light + dark theme on dashboard/create pages

### Testing
- [x] Full API integration test suite (Jest + supertest, ~40 tests)
- [x] Smoke test script (`/testing/test.script.js`)

---

## What's NOT Done (Prioritized)

### P0 — Core Recording Flow (App Doesn't Work Without These)
- [ ] **Room page** `/room/:roomId` — speaker view with audio/video controls
- [ ] **Watch page** `/watch/:roomId` — audience view (listen only)
- [ ] **WebRTC peer connections** — RTCPeerConnection setup on join
- [ ] **getUserMedia** — capture mic/camera from speakers
- [ ] **Connect frontend to signaling server** — WebSocket client in room pages

### P1 — Real-Time UX
- [ ] Live participant list (updates when people join/leave via WebSocket)
- [ ] Room status display (waiting / live / ended) with live sync
- [ ] Speaker invitation notifications (currently fire-and-forget)
- [ ] Audience join flow via invite link (no frontend for this yet)

### P2 — Recording & Output
- [ ] Audio mixing / recording (MediaRecorder API or server-side)
- [ ] Recording export/download
- [ ] Episode metadata display (title is saved but never shown)

### P3 — Polish
- [ ] Error boundaries
- [ ] Loading skeletons
- [ ] Frontend input validation
- [ ] Rate limiting on API (imports exist but unused)
- [ ] Avatar / user profile UI
- [ ] Frontend unit tests

---

## Room Flow (Design Intent)

```
Host creates room
  → gets speaker link + audience link
  → shares audience link publicly, speaker link to co-hosts

Co-host opens speaker link → joins as speaker
  → WebSocket connects to signaling server
  → WebRTC peer connections established between speakers

Audience opens audience link → joins as audience
  → WebSocket connects, receives audio stream (listen-only)

Host starts room (status: waiting → live)
  → recording begins (TBD)

Host ends room (status: live → ended)
  → recording saved/exported (TBD)
```

---

## Key Design Decisions

- **Supabase PostgreSQL only** (not Supabase Auth) — custom JWT auth
- **Raw WebSocket** (no Socket.io) — minimal signaling surface
- **Upsert on participant join** — idempotent, handles rejoins cleanly
- **Role enforcement server-side** — only host can change room status or invite speakers
- **Separate speaker/audience URLs** — role determined by which link used

---

## Known Issues / Gotchas

- UUID was previously broken (fixed in commit `b3ee890`)
- Rate limiting package imported but not wired up
- `.gitignore` has an uncommitted modification
- Episode title stored in DB but no UI surface to display it
- No database transactions — participant + room ops are not atomic
