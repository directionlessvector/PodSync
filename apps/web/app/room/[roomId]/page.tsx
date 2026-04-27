'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { LiveKitRoom, useLocalParticipant, useParticipants, VideoTrack, RoomAudioRenderer, useRemoteParticipant, useConnectionState } from '@livekit/components-react'
import { Track, Participant, ConnectionState } from 'livekit-client'
import { useWebRTC } from '../../../hooks/useWebRTC'
import { useMediaRecorder } from '../../../hooks/useMediaRecorder'
import { apiGetProfile, apiGetMyRole, apiUpdateRoomStatus, apiUpdateRoomRecordingStatus, AuthError } from '../../../lib/api'
import '@livekit/components-styles'

interface RoomInfo {
  id: string
  name: string
  episodeTitle?: string
  status: 'waiting' | 'live' | 'ended'
  host_id: string
  isRecording?: boolean
  recordingStartAt?: string
}

interface UserInfo {
  id: string
  name: string
  email: string
}

// Tile for local user using raw MediaStream (one source -> two consumers)
function LocalVideoTile({
  stream,
  label,
  muted = false,
  camOff = false,
}: {
  stream: MediaStream | null
  label: string
  muted?: boolean
  camOff?: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream ?? null
    if (stream) el.play().catch(() => {})
  }, [stream])

  const hasVideoTrack = stream ? stream.getVideoTracks().some(t => t.enabled) : false
  const showVideo = hasVideoTrack && !camOff

  return (
    <div className="relative bg-gray-900 rounded-2xl overflow-hidden aspect-video flex items-center justify-center border border-gray-800">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${showVideo ? 'opacity-100' : 'opacity-0'}`}
      />
      {!showVideo && (
        <div className="relative z-10 flex flex-col items-center gap-2 text-gray-400">
          <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl font-semibold text-white">
            {label.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm">{label}</span>
        </div>
      )}
      <div className="absolute bottom-2 left-3 z-10 text-white text-xs font-medium drop-shadow flex items-center gap-1.5">
        {label} <span className="text-gray-400">(you)</span>
      </div>
    </div>
  )
}

// Tile for remote users using LiveKit components
function RemoteVideoTile({
  participant,
  label,
  isRecordingAck = false,
}: {
  participant: Participant
  label: string
  isRecordingAck?: boolean
}) {
  const p = useRemoteParticipant(participant.identity) || participant
  const cameraPublication = p.getTrackPublication(Track.Source.Camera)
  const hasVideo = cameraPublication?.isSubscribed && !cameraPublication.isMuted

  return (
    <div className="relative bg-gray-900 rounded-2xl overflow-hidden aspect-video flex items-center justify-center border border-gray-800">
      {hasVideo ? (
        <VideoTrack
          participant={participant}
          source={Track.Source.Camera}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="relative z-10 flex flex-col items-center gap-2 text-gray-400">
          <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl font-semibold text-white">
            {label.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm">{label}</span>
        </div>
      )}

      <div className="absolute bottom-2 left-3 z-10 text-white text-xs font-medium drop-shadow flex items-center gap-1.5">
        {isRecordingAck && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" title="Recording locally" />}
        {label}
      </div>
    </div>
  )
}

export default function RoomPage() {
  const router = useRouter()
  const params = useParams()
  const roomId = params.roomId as string

  const [token, setToken] = useState<string | null>(null)
  const [liveKitToken, setLiveKitToken] = useState<string | null>(null)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (!storedToken) { router.push('/login'); return }
    setToken(storedToken)

    const load = async () => {
      try {
        const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

        const [profileData, roomRes] = await Promise.all([
          apiGetProfile(storedToken),
          fetch(`${API}/rooms/${roomId}`),
        ])

        if (profileData.error) {
          setAuthError('Could not load your profile. Please try again.')
          setLoading(false)
          return
        }

        const roomData = await roomRes.json()
        if (!roomData.room) {
          setAuthError('Room not found.')
          setLoading(false)
          return
        }

        if (roomData.room.status === 'ended') {
          setAuthError('This session has ended. Go back to your dashboard to create a new room.')
          setLoading(false)
          return
        }

        // Everyone arriving at /room/:id is treated as a speaker.
        // If they have no role yet (e.g. newly invited co-host), auto-join them.
        const roleData = await apiGetMyRole(storedToken, roomId)
        const userId = profileData.user?.id || profileData.id
        const isHost = roomData.room.host_id === userId
        // Host has role 'host', not 'speaker' — both skip the join-as-speaker call
        const isAlreadyParticipant = isHost || (!roleData.error && roleData.role === 'speaker')

	        if (!isAlreadyParticipant) {
	          const joinRes = await fetch(`${API}/rooms/${roomId}/join-as-speaker`, {
	            method: 'POST',
	            headers: { Authorization: `Bearer ${storedToken}` },
	          })
	          if (!joinRes.ok) {
	            const body = await joinRes.json().catch(() => ({}))
	            setAuthError(body?.error || 'Could not join room as speaker.')
	            setLoading(false)
            return
          }
        }

        // Fetch LiveKit token now that role is finalized
        const lkRes = await fetch(`${API}/rooms/${roomId}/livekit-token`, {
          headers: { Authorization: `Bearer ${storedToken}` }
        })
        const lkData = await lkRes.json()
        
        if (!lkData.token) {
          setAuthError('You are not a participant in this room.')
          setLoading(false)
          return
        }

        setUser(profileData.user || profileData)
        setLiveKitToken(lkData.token)
        setRoom({
          id: roomId,
          name: roomData.room.name,
          status: roomData.room.status,
          host_id: roomData.room.host_id,
          episodeTitle: roomData.room.episode_title,
          isRecording: roomData.room.isRecording,
          recordingStartAt: roomData.room.recordingStartAt,
        })
      } catch (err) {
        if (err instanceof AuthError) {
          router.replace('/login')
        } else {
          setAuthError('Failed to load room.')
        }
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [roomId, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Setting up your studio...</div>
      </div>
    )
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-red-400 text-sm">{authError}</div>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (!liveKitToken) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Setting up your studio...</div>
      </div>
    )
  }

  return (
    <LiveKitRoom
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880'}
      token={liveKitToken}
      connect={true}
      video={false} // Disabled for manual control
      audio={false} // Disabled for manual control
    >
      <RoomContent user={user!} room={room!} token={token!} />
    </LiveKitRoom>
  )
}

function RoomContent({ user, room: initialRoom, token }: { user: UserInfo, room: RoomInfo, token: string }) {
  const router = useRouter()
  const [room, setRoom] = useState<RoomInfo>(initialRoom)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [recordingAcks, setRecordingAcks] = useState<Set<string>>(new Set())
  const [pendingRecording, setPendingRecording] = useState<string | null>(null)

  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [micMuted, setMicMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)

  const isHost = user.id === room.host_id
  // Everyone in this room is a speaker — audience has been removed

  // LiveKit hooks
  const { localParticipant } = useLocalParticipant()
  const connectionState = useConnectionState()
  const participants = useParticipants()
  const remoteParticipants = participants.filter(p => !p.isLocal)

  // WebSocket signaling for recording controls
  const {
    connected: wsConnected,
    sendSignal,
    broadcastMsg,
  } = useWebRTC({ userId: user.id, roomId: room.id, role: 'speaker', enabled: true })

  // Integration of local recording
  const { isRecording, recordingTime, startRecording, stopRecording, completedRecording, clearRecording } = useMediaRecorder({
    stream: localStream,
  })

  // Poll room status
  useEffect(() => {
    if (room.status === 'ended') return
    const id = setInterval(async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/rooms/${room.id}`)
        const data = await res.json()
        if (data.room) setRoom(prev => ({ ...prev, status: data.room.status }))
      } catch {}
    }, 6000)
    return () => clearInterval(id)
  }, [room.id, room.status])

  // Manual Stream Acquisition & Publish (One Source -> Two Consumers)
  // Gate on ConnectionState.Connected — publishTrack will fail if the WebRTC
  // engine hasn't finished handshaking with the LiveKit server yet.
  useEffect(() => {
    if (!localParticipant) return
    if (connectionState !== ConnectionState.Connected) return

    let activeStream: MediaStream | null = null

    async function init() {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        setLocalStream(activeStream)

        activeStream.getTracks().forEach(track => {
          localParticipant.publishTrack(track).catch(err => console.error("Publish err:", err))
        })
      } catch (err) {
        console.error('Failed to get media devices:', err)
        // Fallback to audio only
        try {
          activeStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          setLocalStream(activeStream)
          setCamOff(true)
          activeStream.getTracks().forEach(track => {
            localParticipant.publishTrack(track)
          })
        } catch (audioErr) {
          console.error('Audio fallback failed:', audioErr)
        }
      }
    }

    init()

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => {
          track.stop()
        })
      }
    }
  }, [localParticipant, connectionState])

  const toggleMic = () => {
    if (!localStream) return
    const track = localStream.getAudioTracks()[0]
    if (track) {
      track.enabled = !track.enabled
      setMicMuted(!track.enabled)
    }
  }

  const toggleCam = () => {
    if (!localStream) return
    const track = localStream.getVideoTracks()[0]
    if (track) {
      track.enabled = !track.enabled
      setCamOff(!track.enabled)
    }
  }

  // Listen for host broadcast commands to start/stop local recording
  useEffect(() => {
    if (!broadcastMsg) return
    
    if (broadcastMsg.fromUserId !== room.host_id && ['start-recording', 'stop-recording'].includes(broadcastMsg.action)) {
      console.warn('Blocked unauthorized recording command from', broadcastMsg.fromUserId)
      return
    }

    if (broadcastMsg.action === 'start-recording') {
      const startAt = broadcastMsg.payload?.startAt
      if (localStream) {
        startRecording(startAt)
        sendSignal({ action: 'recording-ack' })
      } else {
        setPendingRecording(startAt)
      }
    } else if (broadcastMsg.action === 'stop-recording') {
      stopRecording()
      setPendingRecording(null)
    } else if (broadcastMsg.action === 'recording-ack' && broadcastMsg.fromUserId) {
      setRecordingAcks(prev => {
        const next = new Set(prev)
        next.add(broadcastMsg.fromUserId!)
        return next
      })
    }
  }, [broadcastMsg, startRecording, stopRecording, sendSignal, localStream, room.host_id])

  // Handle pending recording start if stream becomes available later
  useEffect(() => {
    if (pendingRecording && localStream) {
      startRecording(pendingRecording)
      sendSignal({ action: 'recording-ack' })
      setPendingRecording(null)
    }
  }, [pendingRecording, localStream, startRecording, sendSignal])

  // Signal Retry Watchdog (Host Only)
  useEffect(() => {
    if (!isHost || !room.isRecording || !room.recordingStartAt) return
    
    const interval = setInterval(() => {
      const unackedSpeakers = remoteParticipants.filter(s => !recordingAcks.has(s.identity))
      if (unackedSpeakers.length > 0) {
        sendSignal({ action: 'start-recording', startAt: room.recordingStartAt })
      }
    }, 5000)
    
    return () => clearInterval(interval)
  }, [isHost, room.isRecording, room.recordingStartAt, remoteParticipants, recordingAcks, sendSignal])

  // Sync late joiners if recording is already active
  useEffect(() => {
    if (room.isRecording && !isRecording && !pendingRecording) {
      if (localStream) {
        startRecording(room.recordingStartAt)
        sendSignal({ action: 'recording-ack' })
      } else {
        setPendingRecording(room.recordingStartAt ?? new Date().toISOString())
      }
    }
  }, [room.isRecording, room.recordingStartAt, localStream, isRecording, pendingRecording, startRecording, sendSignal])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const handleStatusChange = async (status: 'live' | 'ended') => {
    if (!token) return
    setStatusUpdating(true)
    try {
      await apiUpdateRoomStatus(token, room.id, { status })
      setRoom(prev => ({ ...prev, status }))
      if (status === 'ended') {
        sendSignal({ action: 'stop-recording' })
        router.push('/dashboard')
      }
    } finally {
      setStatusUpdating(false)
    }
  }

  const handleGlobalRecordToggle = async () => {
    if (!token) return
    try {
      const res = await apiUpdateRoomRecordingStatus(token, room.id, !isRecording)
      if (res.success) {
        if (res.room.isRecording) {
          sendSignal({ action: 'start-recording', startAt: res.room.recordingStartAt })
          startRecording(res.room.recordingStartAt)
        } else {
          sendSignal({ action: 'stop-recording' })
          stopRecording()
          setRecordingAcks(new Set())
        }
        setRoom(prev => ({ ...prev, isRecording: res.room.isRecording, recordingStartAt: res.room.recordingStartAt }))
      }
    } catch (err) {
      console.error('Failed to update global recording state:', err)
    }
  }

  // All participants in this room are speakers, so always include self in count
  const totalSpeakers = remoteParticipants.length + 1

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <RoomAudioRenderer />
      
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-500 hover:text-gray-300 text-sm"
            >
              ← Dashboard
            </button>
            <span className="text-gray-600">|</span>
            <span className="font-semibold truncate max-w-xs">{room.name}</span>
            {room.episodeTitle && (
              <span className="text-gray-500 text-sm hidden sm:block">— {room.episodeTitle}</span>
            )}
            {isRecording && (
              <span className="bg-red-900/40 border border-red-500/50 text-red-400 text-xs px-2 py-0.5 rounded flex items-center gap-1.5 ml-2 animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                REC {formatTime(recordingTime)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={room.status} />
            <ConnectionDot connected={wsConnected} />
          </div>
        </div>
      </header>

      {/* Video grid */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-6">
        <div
          className={`grid gap-4 ${
            totalSpeakers === 0
              ? 'grid-cols-1 max-w-2xl mx-auto'
              : totalSpeakers === 1
              ? 'grid-cols-2'
              : totalSpeakers <= 3
              ? 'grid-cols-2'
              : 'grid-cols-3'
          }`}
        >
          {/* Local (self) tile */}
          <LocalVideoTile
            stream={localStream}
            label={user.name}
            muted={true}
            camOff={camOff}
          />

          {/* Remote speaker tiles */}
          {remoteParticipants.map(p => (
            <RemoteVideoTile
              key={p.identity}
              participant={p}
              label={`Speaker ${p.identity.slice(0, 6)}`}
              isRecordingAck={isRecording && recordingAcks.has(p.identity)}
            />
          ))}
        </div>
      </main>

      {/* Controls bar */}
      <div className="border-t border-gray-800 bg-gray-950">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-center gap-4">
          {/* Mic */}
          <ControlButton
            active={!micMuted}
            onClick={toggleMic}
            activeLabel="Mic on"
            inactiveLabel="Mic off"
            activeIcon="🎙"
            inactiveIcon="🎤"
            activeClass="bg-gray-800 hover:bg-gray-700 text-white"
            inactiveClass="bg-red-600 hover:bg-red-500 text-white"
          />

          {/* Camera */}
          <ControlButton
            active={!camOff}
            onClick={toggleCam}
            activeLabel="Cam on"
            inactiveLabel="Cam off"
            activeIcon="📹"
            inactiveIcon="🚫"
            activeClass="bg-gray-800 hover:bg-gray-700 text-white"
            inactiveClass="bg-red-600 hover:bg-red-500 text-white"
          />

          {/* Host controls */}
          {isHost && (
            <>
              <div className="w-px h-8 bg-gray-800 mx-2" />
              <ControlButton
                active={isRecording}
                onClick={handleGlobalRecordToggle}
                activeLabel="Stop Rec"
                inactiveLabel="Record All"
                activeIcon="⏹️"
                inactiveIcon="⏺️"
                activeClass="bg-red-600 hover:bg-red-500 text-white animate-pulse"
                inactiveClass="bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-800"
              />

              <div className="w-px h-8 bg-gray-800 mx-2" />

              {room.status === 'waiting' && (
                <button
                  onClick={() => handleStatusChange('live')}
                  disabled={statusUpdating}
                  className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  {statusUpdating ? 'Starting...' : 'Go Live'}
                </button>
              )}
              {room.status === 'live' && (
                <button
                  onClick={() => handleStatusChange('ended')}
                  disabled={statusUpdating}
                  className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  {statusUpdating ? 'Ending...' : 'End Session'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Manual Download Toast */}
      {completedRecording && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl z-50 flex items-center gap-6 animate-in slide-in-from-bottom-5">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white">Recording Saved to Memory</span>
            <span className="text-xs text-gray-400">Download the file before closing this tab.</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={completedRecording.url}
              download={completedRecording.filename}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              onClick={() => setTimeout(clearRecording, 2000)}
            >
              ⬇️ Download File
            </a>
            <button 
              onClick={clearRecording} 
              className="text-gray-500 hover:text-red-400 p-2 transition-colors"
              title="Dismiss (Warning: deletes unsaved recording)"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ControlButton({
  active,
  onClick,
  activeLabel,
  inactiveLabel,
  activeIcon,
  inactiveIcon,
  activeClass,
  inactiveClass,
}: {
  active: boolean
  onClick: () => void
  activeLabel: string
  inactiveLabel: string
  activeIcon: string
  inactiveIcon: string
  activeClass: string
  inactiveClass: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${active ? activeClass : inactiveClass}`}
    >
      <span className="text-lg">{active ? activeIcon : inactiveIcon}</span>
      <span className="text-xs">{active ? activeLabel : inactiveLabel}</span>
    </button>
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
      {connected ? 'WS Connected' : 'WS Connecting...'}
    </div>
  )
}
