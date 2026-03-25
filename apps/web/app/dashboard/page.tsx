'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../hooks/useAuth'
import { apiGetMyRooms } from '../../lib/api'

interface Room {
  id: string
  name: string
  episodeTitle?: string
  status: 'waiting' | 'live' | 'ended'
  speakerUrl: string
  audienceUrl: string
  createdAt: string
}

export default function DashboardPage() {
  const { token, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!token) return

    const fetchRooms = async () => {
      try {
        const data = await apiGetMyRooms(token)
        setRooms(data.rooms || [])
      } catch (error) {
        console.error('Failed to fetch rooms:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRooms()
  }, [token, authLoading])

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/login')
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyFeedback(label)
      setTimeout(() => setCopyFeedback(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'bg-yellow-500'
      case 'live': return 'bg-green-500'
      case 'ended': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center">
        <div className="text-gray-500">Loading your rooms...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="sticky top-0 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="text-xl font-bold">PodSync</div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/dashboard/create')}
              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              New Room
            </button>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-900 text-sm transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">Your Rooms</h1>

        {rooms.length === 0 ? (
          <div className="text-center py-12">
            <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 max-w-md mx-auto">
              <div className="text-gray-500 text-lg mb-4">No rooms yet</div>
              <button
                onClick={() => router.push('/dashboard/create')}
                className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl transition-colors"
              >
                Create your first room
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {rooms.map((room) => (
              <div key={room.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-semibold">{room.name}</span>
                      <span className={`text-white text-xs px-2 py-0.5 rounded-full ${getStatusColor(room.status)}`}>
                        {room.status}
                      </span>
                    </div>
                    {room.episodeTitle && (
                      <div className="text-gray-500 text-sm">{room.episodeTitle}</div>
                    )}
                  </div>
                  <button
                    onClick={() => router.push(`/room/${room.id}`)}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    Enter Room
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-24 shrink-0">Speaker link</span>
                    <div className="flex-1 bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700 truncate">
                      {room.speakerUrl}
                    </div>
                    <button
                      onClick={() => copyToClipboard(room.speakerUrl, 'Speaker link')}
                      className="shrink-0 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-24 shrink-0">Audience link</span>
                    <div className="flex-1 bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700 truncate">
                      {room.audienceUrl}
                    </div>
                    <button
                      onClick={() => copyToClipboard(room.audienceUrl, 'Audience link')}
                      className="shrink-0 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Copy Feedback Toast */}
      {copyFeedback && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg text-sm">
          ✓ {copyFeedback} copied
        </div>
      )}
    </div>
  )
}