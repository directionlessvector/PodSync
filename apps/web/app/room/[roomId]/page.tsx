'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useWebRTC } from '../../../hooks/useWebRTC'
import { apiGetProfile, apiGetMyRole, apiUpdateRoomStatus } from '../../../lib/api'

interface RoomInfo {
  id: string
  name: string
  episodeTitle?: string
  status: 'waiting' | 'live' | 'ended'
  host_id: string
}

interface UserInfo {
  id: string
  name: string
  email: string
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return <audio ref={ref} autoPlay playsInline />
}

export default function RoomPage() {
  const router = useRouter()
  const params = useParams()
  const roomId = params.roomId as string

  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // Initialise auth and room data
  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (!storedToken) {
      router.push('/login')
      return
    }
    setToken(storedToken)

    const load = async () => {
      try {
        const [profileData, roleData] = await Promise.all([
          apiGetProfile(storedToken),
          apiGetMyRole(storedToken, roomId),
        ])

        if (profileData.error || roleData.error) {
          setAuthError('Could not load room. Please try again.')
          setLoading(false)
          return
        }

        // Only speakers can be on this page
        if (roleData.role !== 'speaker') {
          router.replace(`/watch/${roomId}`)
          return
        }

        setUser(profileData.user || profileData)
        setRoom({
          id: roomId,
          name: roleData.roomName,
          status: roleData.roomStatus,
          host_id: profileData.user?.id || profileData.id, // will be corrected below
          episodeTitle: undefined,
        })

        // Fetch full room details to get host_id
        const roomRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/rooms/${roomId}`,
        )
        const roomData = await roomRes.json()
        if (roomData.room) {
          setRoom({
            id: roomId,
            name: roomData.room.name,
            status: roomData.room.status,
            host_id: roomData.room.host_id,
            episodeTitle: roomData.room.episode_title,
          })
        }
      } catch {
        setAuthError('Failed to load room.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [roomId, router])

  const isHost = user && room && user.id === room.host_id
  const rtcEnabled = !loading && !!user && !!room

  const { remoteStreams, peers, connected, micMuted, toggleMic, error: rtcError } = useWebRTC({
    userId: user?.id ?? '',
    roomId,
    role: 'speaker',
    enabled: rtcEnabled,
  })

  const speakers = peers.filter(p => p.role === 'speaker')
  const audience = peers.filter(p => p.role === 'audience')

  const handleStatusChange = async (status: 'live' | 'ended') => {
    if (!token || !room) return
    setStatusUpdating(true)
    try {
      await apiUpdateRoomStatus(token, roomId, { status })
      setRoom(prev => prev ? { ...prev, status } : prev)
      if (status === 'ended') router.push('/dashboard')
    } finally {
      setStatusUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Setting up your studio...</div>
      </div>
    )
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-500">{authError}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Hidden audio elements for remote peers */}
      {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
        <RemoteAudio key={peerId} stream={stream} />
      ))}

      {/* Header */}
      <header className="sticky top-0 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-gray-700 text-sm"
            >
              ← Dashboard
            </button>
            <span className="text-gray-300">|</span>
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

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Error banner */}
        {(rtcError) && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {rtcError}
          </div>
        )}

        {/* Mic control */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-lg">Your mic</div>
              <div className="text-gray-500 text-sm mt-0.5">
                {micMuted ? 'Muted — others cannot hear you' : 'Live — others can hear you'}
              </div>
            </div>
            <button
              onClick={toggleMic}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-colors ${
                micMuted
                  ? 'bg-red-100 hover:bg-red-200 text-red-700'
                  : 'bg-green-100 hover:bg-green-200 text-green-700'
              }`}
            >
              {micMuted ? '🎤 Unmute' : '🎙 Muted? Unmute'}
              <span className="sr-only">{micMuted ? 'Unmute microphone' : 'Mute microphone'}</span>
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${micMuted ? 'bg-gray-300' : 'bg-green-500 animate-pulse'}`}
            />
            <span className="text-xs text-gray-500">{micMuted ? 'Mic off' : 'Broadcasting'}</span>
          </div>
        </div>

        {/* Speakers */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="font-semibold mb-4">
            Speakers{' '}
            <span className="text-gray-400 font-normal text-sm">
              ({speakers.length + 1} total — including you)
            </span>
          </div>
          <div className="space-y-3">
            {/* Self */}
            <PeerRow
              label={user?.name ?? 'You'}
              role="speaker"
              isSelf
              active={!micMuted}
            />
            {/* Other speakers */}
            {speakers.map(peer => (
              <PeerRow
                key={peer.userId}
                label={`Speaker ${peer.userId.slice(0, 6)}`}
                role="speaker"
                active
              />
            ))}
            {speakers.length === 0 && (
              <div className="text-gray-400 text-sm">No other speakers yet</div>
            )}
          </div>
        </div>

        {/* Audience */}
        {audience.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="font-semibold mb-4">
              Listeners{' '}
              <span className="text-gray-400 font-normal text-sm">({audience.length})</span>
            </div>
            <div className="space-y-2">
              {audience.map(peer => (
                <PeerRow
                  key={peer.userId}
                  label={`Listener ${peer.userId.slice(0, 6)}`}
                  role="audience"
                  active={false}
                />
              ))}
            </div>
          </div>
        )}

        {/* Host controls */}
        {isHost && room && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="font-semibold mb-4">Host controls</div>
            <div className="flex gap-3">
              {room.status === 'waiting' && (
                <button
                  onClick={() => handleStatusChange('live')}
                  disabled={statusUpdating}
                  className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-medium transition-colors"
                >
                  {statusUpdating ? 'Starting...' : 'Go Live'}
                </button>
              )}
              {room.status === 'live' && (
                <button
                  onClick={() => handleStatusChange('ended')}
                  disabled={statusUpdating}
                  className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-medium transition-colors"
                >
                  {statusUpdating ? 'Ending...' : 'End Session'}
                </button>
              )}
              {room.status === 'ended' && (
                <div className="text-gray-500 text-sm py-3">This session has ended.</div>
              )}
            </div>
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

function PeerRow({
  label,
  role,
  isSelf = false,
  active,
}: {
  label: string
  role: 'speaker' | 'audience'
  isSelf?: boolean
  active: boolean
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          role === 'speaker' && active ? 'bg-green-500' : 'bg-gray-300'
        }`}
      />
      <span className="text-sm text-gray-700">
        {label}
        {isSelf && <span className="text-gray-400 ml-1">(you)</span>}
      </span>
      {role === 'audience' && (
        <span className="text-xs text-gray-400 ml-auto">listening</span>
      )}
    </div>
  )
}
