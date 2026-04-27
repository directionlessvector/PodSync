const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

// Thrown when the server returns 401 — token expired or invalid.
// Pages catch this and redirect to /login.
export class AuthError extends Error {
  constructor() { super('Session expired') }
}

async function request(url: string, options: RequestInit = {}) {
  const response = await fetch(url, options)
  if (response.status === 401) {
    // Wipe the stale token so NavBar and protected pages redirect cleanly
    if (typeof window !== 'undefined') localStorage.removeItem('token')
    throw new AuthError()
  }
  return response.json()
}

interface CreateRoomData {
  name: string
  episodeTitle?: string
}

interface UpdateStatusData {
  status: 'waiting' | 'live' | 'ended'
}

export async function apiLogin(email: string, password: string) {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return response.json()
}

export async function apiSignup(name: string, email: string, password: string) {
  const response = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  })
  return response.json()
}

export async function apiGetProfile(token: string) {
  return request(`${BASE_URL}/auth/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function apiGetMyRooms(token: string) {
  return request(`${BASE_URL}/rooms/my-rooms`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function apiGetRoom(roomId: string) {
  const response = await fetch(`${BASE_URL}/rooms/${roomId}`)
  return response.json()
}

export async function apiCreateRoom(token: string, data: CreateRoomData) {
  return request(`${BASE_URL}/rooms`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function apiUpdateRoomStatus(token: string, roomId: string, data: UpdateStatusData) {
  return request(`${BASE_URL}/rooms/${roomId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function apiUpdateRoomRecordingStatus(token: string, roomId: string, isRecording: boolean) {
  return request(`${BASE_URL}/rooms/${roomId}/recording`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ isRecording }),
  })
}

export async function apiGetMyRole(token: string, roomId: string) {
  return request(`${BASE_URL}/rooms/${roomId}/my-role`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function apiJoinRoom(token: string, roomId: string) {
  return request(`${BASE_URL}/rooms/${roomId}/join`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
}
