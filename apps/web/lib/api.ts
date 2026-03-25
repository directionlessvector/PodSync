const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

interface SignupData {
  name: string
  email: string
  password: string
}

interface LoginData {
  email: string
  password: string
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
  const response = await fetch(`${BASE_URL}/auth/profile`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
  return response.json()
}

export async function apiGetMyRooms(token: string) {
  const response = await fetch(`${BASE_URL}/rooms/my-rooms`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
  return response.json()
}

export async function apiGetRoom(roomId: string) {
  const response = await fetch(`${BASE_URL}/rooms/${roomId}`, {
    method: 'GET',
  })
  return response.json()
}

export async function apiCreateRoom(token: string, data: CreateRoomData) {
  const response = await fetch(`${BASE_URL}/rooms`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  return response.json()
}

export async function apiUpdateRoomStatus(token: string, roomId: string, data: UpdateStatusData) {
  const response = await fetch(`${BASE_URL}/rooms/${roomId}/status`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  return response.json()
}

export async function apiGetMyRole(token: string, roomId: string) {
  const response = await fetch(`${BASE_URL}/rooms/${roomId}/my-role`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
  return response.json()
}

export async function apiJoinRoom(token: string, roomId: string) {
  const response = await fetch(`${BASE_URL}/rooms/${roomId}/join`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
  return response.json()
}