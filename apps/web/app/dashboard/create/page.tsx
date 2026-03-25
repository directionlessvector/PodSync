'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../hooks/useAuth'
import { apiCreateRoom } from '../../../lib/api'

interface CreatedRoom {
  roomId: string
  speakerUrl: string
  audienceUrl: string
  name: string
}

export default function CreateRoomPage() {
  const { token } = useAuth()
  const router = useRouter()

  const [name, setName] = useState('')
  const [episodeTitle, setEpisodeTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdRoom, setCreatedRoom] = useState<CreatedRoom | null>(null)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!token) return
    if (!name.trim()) {
      setError('Room name is required')
      return
    }

    setCreating(true)
    setError(null)

    try {
      const data = await apiCreateRoom(token, {
        name: name.trim(),
        episodeTitle: episodeTitle || undefined,
      })

      if (data.error) {
        setError(data.error)
      } else {
        setCreatedRoom({
          roomId: data.room.id,
          speakerUrl: data.speakerUrl,
          audienceUrl: data.audienceUrl,
          name: data.room.name,
        })
      }
    } catch (err) {
      setError('Failed to create room')
    } finally {
      setCreating(false)
    }
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

  if (createdRoom) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center px-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-lg w-full space-y-6 shadow-sm">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Room Created!</h1>
            <p className="text-gray-500 text-sm">Share these links with your guests</p>
          </div>

          {copyFeedback && (
            <div className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm text-center">
              ✓ {copyFeedback} copied
            </div>
          )}

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Speaker link</span>
                <span className="text-xs text-gray-500">Share with co-hosts only</span>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 truncate">
                  {createdRoom.speakerUrl}
                </div>
                <button
                  onClick={() => copyToClipboard(createdRoom.speakerUrl, 'Speaker link')}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Audience link</span>
                <span className="text-xs text-gray-500">Share publicly — no login needed</span>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 truncate">
                  {createdRoom.audienceUrl}
                </div>
                <button
                  onClick={() => copyToClipboard(createdRoom.audienceUrl, 'Audience link')}
                  className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-medium transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => router.push(`/room/${createdRoom.roomId}`)}
              className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-medium transition-colors"
            >
              Enter Room →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center px-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-md w-full space-y-6 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-500 hover:text-gray-900 text-sm transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold">Create a Room</h1>
        </div>

        <p className="text-gray-500 text-sm">Set up your podcast recording session</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Podcast name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. The Tech Talk Show"
              className="w-full bg-white border border-gray-300 focus:border-purple-500 text-gray-900 placeholder-gray-400 px-4 py-3 rounded-xl outline-none transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Episode title <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={episodeTitle}
              onChange={(e) => setEpisodeTitle(e.target.value)}
              placeholder="e.g. Episode 5 — AI in 2025"
              className="w-full bg-white border border-gray-300 focus:border-purple-500 text-gray-900 placeholder-gray-400 px-4 py-3 rounded-xl outline-none transition-colors"
            />
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={creating || !name.trim()}
          className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-colors"
        >
          {creating ? 'Creating...' : 'Create Room'}
        </button>
      </div>
    </div>
  )
}
