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

function SpeakerTile({ stream, label }: { stream: MediaStream; label: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasVideo, setHasVideo] = useState(false)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return

    el.srcObject = stream
    const active = stream.getVideoTracks().some(t => t.readyState !== 'ended')
    setHasVideo(active)

    // autoPlay attribute only fires on first load — explicitly call play() every
    // time srcObject changes so the browser actually starts rendering frames.
    el.play().then(() => setBlocked(false)).catch(() => setBlocked(true))
  }, [stream])

  const handleUnblock = () => {
    videoRef.current?.play().then(() => setBlocked(false)).catch(() => {})
  }

  return (
    <div className="relative bg-gray-900 rounded-2xl overflow-hidden aspect-video flex items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${hasVideo ? 'opacity-100' : 'opacity-0'}`}
      />

      {!hasVideo && (
        <div className="relative z-10 flex flex-col items-center gap-2 text-gray-400">
          <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl font-semibold text-white">
            {label.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm">{label}</span>
        </div>
      )}

      {/* Shown when browser blocks autoplay — one tap/click unblocks everything */}
      {blocked && (
        <button
          onClick={handleUnblock}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 gap-2"
        >
          <span className="text-3xl">▶</span>
          <span className="text-white text-sm font-medium">Click to play</span>
        </button>
      )}

      <div className="absolute bottom-2 left-3 z-10 text-white text-xs font-medium drop-shadow">
        {label}
      </div>
      <div className="absolute top-2 right-2 z-10">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      </div>
    </div>
  )
}

function getGuestId(): string {
  const key = 'podcast_guest_id'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = `guest_${Math.random().toString(36).slice(2, 10)}`
    sessionStorage.setItem(key, id)
  }
  return id
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export default function WatchPage() {
  const params = useParams()
  const roomId = params.roomId as string

  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [userId, setUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchRoom = async () => {
    try {
      const res = await fetch(`${API}/rooms/${roomId}`)
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

  useEffect(() => {
    const token = localStorage.getItem('token')

    const resolveUser = async () => {
      if (token) {
        try {
          const res = await fetch(`${API}/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const data = await res.json()
          const uid = data?.user?.id || data?.id
          if (uid) {
            setUserId(uid)
            fetch(`${API}/rooms/${roomId}/join`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            }).catch(() => {})
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

    Promise.all([resolveUser(), fetchRoom()]).finally(() => setLoading(false))
  }, [roomId])

  // Poll room status every 8 seconds so the UI updates when host goes live or ends session
  useEffect(() => {
    if (!room) return
    if (room.status === 'ended') return // no point polling after it's over
    const id = setInterval(fetchRoom, 8000)
    return () => clearInterval(id)
  }, [room?.status])

  const rtcEnabled = !loading && !!userId && !!room && room.status !== 'ended'

  const { remoteStreams, peers, connected, error: rtcError } = useWebRTC({
    userId,
    roomId,
    role: 'audience',
    enabled: rtcEnabled,
  })

  const speakers = peers.filter(p => p.role === 'speaker')
  const audienceCount = peers.filter(p => p.role === 'audience').length + 1

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Joining room...</div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-red-400">{loadError}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="font-semibold truncate max-w-xs">{room?.name}</span>
            {room?.episodeTitle && (
              <span className="text-gray-500 text-sm hidden sm:block">— {room.episodeTitle}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={room?.status ?? 'waiting'} />
            <ConnectionDot connected={connected} />
          </div>
        </div>
      </header>

      {rtcError && (
        <div className="bg-red-900/50 border-b border-red-800 text-red-300 px-6 py-2 text-sm text-center">
          {rtcError}
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-6">
        {room?.status === 'ended' ? (
          /* Session over — no point keeping connections */
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <div className="text-5xl mb-4">🎙</div>
            <div className="text-xl font-semibold text-white mb-2">Session ended</div>
            <div className="text-sm">This podcast session has wrapped up.</div>
          </div>
        ) : remoteStreams.size > 0 ? (
          /* Streams are live — show video grid regardless of room.status */
          <>
            <div
              className={`grid gap-4 ${
                remoteStreams.size === 1
                  ? 'grid-cols-1 max-w-2xl mx-auto'
                  : remoteStreams.size === 2
                  ? 'grid-cols-2'
                  : remoteStreams.size <= 4
                  ? 'grid-cols-2'
                  : 'grid-cols-3'
              }`}
            >
              {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
                <SpeakerTile
                  key={peerId}
                  stream={stream}
                  label={`Speaker ${peerId.slice(0, 6)}`}
                />
              ))}
            </div>

            {/* Speakers whose connections are still establishing */}
            {speakers
              .filter(p => !remoteStreams.has(p.userId))
              .map(peer => (
                <div key={peer.userId} className="mt-3 text-sm text-gray-500 text-center">
                  Speaker {peer.userId.slice(0, 6)} — connecting...
                </div>
              ))}
          </>
        ) : speakers.length > 0 ? (
          /* We know speakers are in the room but streams haven't arrived yet */
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <div className="animate-pulse text-4xl mb-4">🎙</div>
            <div className="text-lg font-semibold text-white mb-2">
              {speakers.length} speaker{speakers.length !== 1 ? 's' : ''} connected
            </div>
            <div className="text-sm">Waiting for audio stream...</div>
            <div className="mt-4 space-y-1">
              {speakers.map(p => (
                <div key={p.userId} className="text-xs text-gray-600 text-center">
                  Speaker {p.userId.slice(0, 6)} — connecting...
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Nobody here yet */
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <div className="text-4xl mb-4 animate-pulse">
              {room?.status === 'waiting' ? '⏳' : '🎙'}
            </div>
            <div className="text-lg font-semibold text-white mb-2">
              {room?.status === 'waiting'
                ? 'Waiting for host to start'
                : 'No speakers yet'}
            </div>
            <div className="text-sm">
              {room?.status === 'waiting'
                ? 'Sit tight — the session will begin shortly.'
                : 'The host hasn\'t joined yet.'}
            </div>
          </div>
        )}

        {/* Footer stats */}
        {room?.status !== 'ended' && (
          <div className="mt-6 text-center text-xs text-gray-600">
            {audienceCount} listener{audienceCount !== 1 ? 's' : ''}
            {speakers.length > 0 && ` · ${speakers.length} speaker${speakers.length !== 1 ? 's' : ''}`}
          </div>
        )}
      </main>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    waiting: 'bg-yellow-900/60 text-yellow-400',
    live: 'bg-green-900/60 text-green-400',
    ended: 'bg-gray-800 text-gray-500',
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
      <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-600'}`} />
      {connected ? 'Watching' : 'Connecting...'}
    </div>
  )
}
