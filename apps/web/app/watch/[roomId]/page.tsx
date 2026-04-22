'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useWebRTC } from '../../../hooks/useWebRTC'

interface RoomInfo {
  id: string
  name: string
  episodeTitle?: string
  status: 'waiting' | 'live' | 'ended'
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return <audio ref={ref} autoPlay playsInline />
}

// Generate a stable guest ID for this browser session
function getGuestId(): string {
  const key = 'podcast_guest_id'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = `guest_${Math.random().toString(36).slice(2, 10)}`
    sessionStorage.setItem(key, id)
  }
  return id
}

export default function WatchPage() {
  const params = useParams()
  const roomId = params.roomId as string

  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [userId, setUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    // Determine userId — use logged-in user if available, otherwise a guest ID
    const token = localStorage.getItem('token')
    const resolveUser = async () => {
      if (token) {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/auth/profile`,
            { headers: { Authorization: `Bearer ${token}` } },
          )
          const data = await res.json()
          const uid = data?.user?.id || data?.id
          if (uid) {
            setUserId(uid)
            // Register as audience in the DB (best-effort, not blocking)
            fetch(
              `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/rooms/${roomId}/join`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
              },
            ).catch(() => {})
          } else {
            setUserId(getGuestId())
          }
        } catch {
          setUserId(getGuestId())
        }
      } else {
        setUserId(getGuestId())
      }
    }

    const loadRoom = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/rooms/${roomId}`,
        )
        const data = await res.json()
        if (data.room) {
          setRoom({
            id: roomId,
            name: data.room.name,
            status: data.room.status,
            episodeTitle: data.room.episode_title,
          })
        } else {
          setLoadError('Room not found.')
        }
      } catch {
        setLoadError('Could not load room.')
      }
    }

    Promise.all([resolveUser(), loadRoom()]).finally(() => setLoading(false))
  }, [roomId])

  const rtcEnabled = !loading && !!userId && !!room

  const { remoteStreams, peers, connected, error: rtcError } = useWebRTC({
    userId,
    roomId,
    role: 'audience',
    enabled: rtcEnabled,
  })

  const speakers = peers.filter(p => p.role === 'speaker')
  const activeSpeakerCount = remoteStreams.size

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Joining room...</div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-500">{loadError}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Hidden audio elements — this is how audience hears speakers */}
      {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
        <RemoteAudio key={peerId} stream={stream} />
      ))}

      {/* Header */}
      <header className="sticky top-0 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="font-semibold truncate max-w-xs">{room?.name}</span>
            {room?.episodeTitle && (
              <span className="text-gray-500 text-sm truncate hidden sm:block">
                — {room.episodeTitle}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={room?.status ?? 'waiting'} />
            <ConnectionDot connected={connected} />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        {/* Error banner */}
        {rtcError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {rtcError}
          </div>
        )}

        {/* Listening card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
          {room?.status === 'ended' ? (
            <>
              <div className="text-4xl mb-4">🎙</div>
              <div className="text-xl font-semibold mb-2">Session ended</div>
              <div className="text-gray-500 text-sm">This podcast session has wrapped up.</div>
            </>
          ) : room?.status === 'waiting' ? (
            <>
              <div className="text-4xl mb-4 animate-pulse">⏳</div>
              <div className="text-xl font-semibold mb-2">Waiting for host to start</div>
              <div className="text-gray-500 text-sm">
                Sit tight — the session will begin shortly.
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                <AudioVisualiser active={activeSpeakerCount > 0} />
              </div>
              <div className="text-xl font-semibold mb-2">
                {activeSpeakerCount > 0 ? 'You are live listening' : 'Waiting for audio...'}
              </div>
              <div className="text-gray-500 text-sm">
                {activeSpeakerCount > 0
                  ? `${activeSpeakerCount} speaker${activeSpeakerCount > 1 ? 's' : ''} connected`
                  : 'No audio streams yet'}
              </div>
            </>
          )}
        </div>

        {/* Speakers list */}
        {speakers.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="font-semibold mb-4 text-sm text-gray-600 uppercase tracking-wide">
              On air
            </div>
            <div className="space-y-3">
              {speakers.map(peer => (
                <div key={peer.userId} className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      remoteStreams.has(peer.userId) ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                    }`}
                  />
                  <span className="text-sm text-gray-700">
                    Speaker {peer.userId.slice(0, 6)}
                  </span>
                  {remoteStreams.has(peer.userId) && (
                    <span className="text-xs text-green-600 ml-auto">● audio</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audience count */}
        {peers.filter(p => p.role === 'audience').length > 0 && (
          <div className="text-center text-sm text-gray-400">
            {peers.filter(p => p.role === 'audience').length + 1} listener
            {peers.filter(p => p.role === 'audience').length + 1 !== 1 ? 's' : ''} including you
          </div>
        )}
      </main>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    waiting: 'bg-yellow-100 text-yellow-700',
    live: 'bg-green-100 text-green-700',
    ended: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${colors[status] ?? colors.ended}`}>
      {status === 'live' ? '● Live' : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function ConnectionDot({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500">
      <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
      {connected ? 'Connected' : 'Connecting...'}
    </div>
  )
}

function AudioVisualiser({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-1 h-10">
      {[3, 5, 4, 6, 3, 7, 4, 5, 3].map((h, i) => (
        <div
          key={i}
          style={{ height: active ? `${h * 4}px` : '4px' }}
          className={`w-1.5 rounded-full transition-all duration-300 ${
            active ? 'bg-purple-500' : 'bg-gray-300'
          }`}
        />
      ))}
    </div>
  )
}
