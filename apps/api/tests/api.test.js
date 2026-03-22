// tests/api.test.js

const request = require('supertest')

const BASE_URL = 'http://localhost:3000'

// Increase timeout — Supabase can be slow on first run
jest.setTimeout(20000)

// These variables get filled in as tests run
// Each test builds on the previous one
let hostToken = ''
let guestToken = ''
let roomId = ''

// Unique names every test run — prevents duplicate conflicts
const roomName = `Test Podcast ${Date.now()}`
const hostEmail = `host_${Date.now()}@test.com`
const guestEmail = `guest_${Date.now()}@test.com`
const dupeEmail = `dupe_${Date.now()}@test.com`

// ─── AUTH ─────────────────────────────────────────────────────────────────────

describe('Auth', () => {

  test('POST /auth/signup — creates a new user', async () => {
    const res = await request(BASE_URL)
      .post('/auth/signup')
      .send({
        name: 'Test Host',
        email: hostEmail,
        password: 'password123',
      })

    expect(res.status).toBe(201)
  })

  test('POST /auth/signup — duplicate email returns 409', async () => {
    // First signup
    await request(BASE_URL)
      .post('/auth/signup')
      .send({
        name: 'Dupe User',
        email: dupeEmail,
        password: 'password123',
      })

    // Second signup with same email
    const res = await request(BASE_URL)
      .post('/auth/signup')
      .send({
        name: 'Dupe User',
        email: dupeEmail,
        password: 'password123',
      })

    expect(res.status).toBe(409)
  })

  test('POST /auth/signup — missing fields returns 400', async () => {
    const res = await request(BASE_URL)
      .post('/auth/signup')
      .send({
        email: 'missing@test.com',
        // no name, no password
      })

    expect(res.status).toBe(400)
  })

  test('POST /auth/login — returns token', async () => {
    const res = await request(BASE_URL)
      .post('/auth/login')
      .send({
        email: hostEmail,
        password: 'password123',
      })

    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()

    // Save token for all subsequent tests
    hostToken = res.body.token
  })

  test('POST /auth/login — wrong password returns 401', async () => {
    const res = await request(BASE_URL)
      .post('/auth/login')
      .send({
        email: hostEmail,
        password: 'wrongpassword',
      })

    expect(res.status).toBe(401)
  })

  test('GET /auth/profile — with token returns user', async () => {
    const res = await request(BASE_URL)
      .get('/auth/profile')
      .set('Authorization', `Bearer ${hostToken}`)

    expect(res.status).toBe(200)
    expect(res.body.user).toBeDefined()
    expect(res.body.user.email).toBe(hostEmail)
  })

  test('GET /auth/profile — without token returns 401', async () => {
    const res = await request(BASE_URL)
      .get('/auth/profile')

    expect(res.status).toBe(401)
  })
})

// ─── ROOMS ────────────────────────────────────────────────────────────────────

describe('Rooms', () => {

  test('POST /rooms — creates room and returns urls', async () => {
    const res = await request(BASE_URL)
      .post('/rooms')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        name: roomName,
        episodeTitle: 'Episode 1',
      })

    expect(res.status).toBe(201)
    expect(res.body.room).toBeDefined()
    expect(res.body.room.id).toBeDefined()
    expect(res.body.speakerUrl).toBeDefined()
    expect(res.body.audienceUrl).toBeDefined()

    // Save roomId — all participant tests depend on this
    roomId = res.body.room.id
  })

  test('POST /rooms — duplicate name same user returns 409', async () => {
    const res = await request(BASE_URL)
      .post('/rooms')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        name: roomName,  // same name as test above
      })

    expect(res.status).toBe(409)
    expect(res.body.error).toContain('already have a room')
  })

  test('POST /rooms — same name different user returns 201', async () => {
    // Guest signup and login first
    await request(BASE_URL)
      .post('/auth/signup')
      .send({
        name: 'Test Guest',
        email: guestEmail,
        password: 'password123',
      })

    const loginRes = await request(BASE_URL)
      .post('/auth/login')
      .send({
        email: guestEmail,
        password: 'password123',
      })

    guestToken = loginRes.body.token

    // Guest creates room with same name as host — should work
    const res = await request(BASE_URL)
      .post('/rooms')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        name: roomName,  // same name, different user — allowed
      })

    expect(res.status).toBe(201)
  })

  test('POST /rooms — without token returns 401', async () => {
    const res = await request(BASE_URL)
      .post('/rooms')
      .send({
        name: 'Should Fail',
      })

    expect(res.status).toBe(401)
  })

  test('POST /rooms — empty name returns 400', async () => {
    const res = await request(BASE_URL)
      .post('/rooms')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        name: '',
      })

    expect(res.status).toBe(400)
  })

  test('GET /rooms/:roomId — public, no token needed', async () => {
    const res = await request(BASE_URL)
      .get(`/rooms/${roomId}`)

    expect(res.status).toBe(200)
    expect(res.body.room).toBeDefined()
    expect(res.body.room.id).toBe(roomId)
  })

  test('GET /rooms/:roomId — fake room returns 404', async () => {
    const res = await request(BASE_URL)
      .get('/rooms/fake-room-that-does-not-exist')

    expect(res.status).toBe(404)
  })

  test('GET /rooms/my-rooms — returns host rooms', async () => {
    const res = await request(BASE_URL)
      .get('/rooms/my-rooms')
      .set('Authorization', `Bearer ${hostToken}`)

    expect(res.status).toBe(200)
    expect(res.body.rooms).toBeDefined()
    expect(Array.isArray(res.body.rooms)).toBe(true)
    expect(res.body.rooms.length).toBeGreaterThan(0)
  })

  test('GET /rooms/my-rooms — without token returns 401', async () => {
    const res = await request(BASE_URL)
      .get('/rooms/my-rooms')

    expect(res.status).toBe(401)
  })

  test('PATCH /rooms/:roomId/status — updates to live', async () => {
    const res = await request(BASE_URL)
      .patch(`/rooms/${roomId}/status`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ status: 'live' })

    expect(res.status).toBe(200)
  })

  test('PATCH /rooms/:roomId/status — invalid status returns 400', async () => {
    const res = await request(BASE_URL)
      .patch(`/rooms/${roomId}/status`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ status: 'WRONG_STATUS' })

    expect(res.status).toBe(400)
  })

  test('PATCH /rooms/:roomId/status — without token returns 401', async () => {
    const res = await request(BASE_URL)
      .patch(`/rooms/${roomId}/status`)
      .send({ status: 'live' })

    expect(res.status).toBe(401)
  })

  test('PATCH /rooms/:roomId/status — set back to waiting for participant tests', async () => {
    const res = await request(BASE_URL)
      .patch(`/rooms/${roomId}/status`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ status: 'waiting' })

    expect(res.status).toBe(200)
  })
})

// ─── PARTICIPANTS ─────────────────────────────────────────────────────────────

describe('Participants', () => {

  test('GET /rooms/:roomId/my-role — host gets speaker', async () => {
    const res = await request(BASE_URL)
      .get(`/rooms/${roomId}/my-role`)
      .set('Authorization', `Bearer ${hostToken}`)

    expect(res.status).toBe(200)
    expect(res.body.role).toBe('speaker')
    expect(res.body.roomId).toBe(roomId)
  })

  test('GET /rooms/:roomId/my-role — guest gets audience before joining', async () => {
    // Guest was created in Rooms tests but has not joined THIS room yet
    // (they created their own room with the same name — different room)
    const res = await request(BASE_URL)
      .get(`/rooms/${roomId}/my-role`)
      .set('Authorization', `Bearer ${guestToken}`)

    expect(res.status).toBe(200)
    expect(res.body.role).toBe('audience')
  })

  test('GET /rooms/:roomId/my-role — without token returns 401', async () => {
    const res = await request(BASE_URL)
      .get(`/rooms/${roomId}/my-role`)

    expect(res.status).toBe(401)
  })

  test('POST /rooms/:roomId/join — guest joins as audience', async () => {
    const res = await request(BASE_URL)
      .post(`/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({})

    expect(res.status).toBe(201)
    expect(res.body.role).toBe('audience')
    expect(res.body.roomId).toBe(roomId)
  })

  test('POST /rooms/:roomId/join — joining again returns 200 no error', async () => {
    const res = await request(BASE_URL)
      .post(`/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({})

    expect(res.status).toBe(200)
    expect(res.body.role).toBe('audience')
  })

  test('POST /rooms/:roomId/join — without token returns 401', async () => {
    const res = await request(BASE_URL)
      .post(`/rooms/${roomId}/join`)
      .send({})

    expect(res.status).toBe(401)
  })

  test('GET /rooms/:roomId/participants — public, shows both users', async () => {
    const res = await request(BASE_URL)
      .get(`/rooms/${roomId}/participants`)

    expect(res.status).toBe(200)
    expect(res.body.participants).toBeDefined()
    expect(Array.isArray(res.body.participants)).toBe(true)
    expect(res.body.participants.length).toBe(2)

    const roles = res.body.participants.map(p => p.role)
    expect(roles).toContain('speaker')
    expect(roles).toContain('audience')
  })

  test('POST /rooms/:roomId/invite — guest cannot invite, gets 403', async () => {
    const res = await request(BASE_URL)
      .post(`/rooms/${roomId}/invite`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ email: 'anyone@test.com' })

    expect(res.status).toBe(403)
  })

  test('POST /rooms/:roomId/invite — host invites guest as speaker', async () => {
    const res = await request(BASE_URL)
      .post(`/rooms/${roomId}/invite`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ email: guestEmail })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  test('GET /rooms/:roomId/my-role — guest is now speaker after invite', async () => {
    const res = await request(BASE_URL)
      .get(`/rooms/${roomId}/my-role`)
      .set('Authorization', `Bearer ${guestToken}`)

    expect(res.status).toBe(200)
    expect(res.body.role).toBe('speaker')
  })

  test('POST /rooms/:roomId/invite — unknown email returns 404', async () => {
    const res = await request(BASE_URL)
      .post(`/rooms/${roomId}/invite`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ email: 'nobody@nowhere.com' })

    expect(res.status).toBe(404)
  })

  test('PATCH /rooms/:roomId/status — guest cannot update, gets 403', async () => {
    const res = await request(BASE_URL)
      .patch(`/rooms/${roomId}/status`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ status: 'ended' })

    expect(res.status).toBe(403)
  })
})

// ─── END SESSION ──────────────────────────────────────────────────────────────

describe('End session', () => {

  test('PATCH /rooms/:roomId/status — host ends room', async () => {
    const res = await request(BASE_URL)
      .patch(`/rooms/${roomId}/status`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ status: 'ended' })

    expect(res.status).toBe(200)
    expect(res.body.room).toBeDefined()
  })

  test('POST /rooms/:roomId/join — joining ended room returns 400', async () => {
    const res = await request(BASE_URL)
      .post(`/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('ended')
  })

  test('GET /rooms/:roomId — ended room still readable publicly', async () => {
    const res = await request(BASE_URL)
      .get(`/rooms/${roomId}`)

    expect(res.status).toBe(200)
    expect(res.body.room.status).toBe('ended')
  })
})