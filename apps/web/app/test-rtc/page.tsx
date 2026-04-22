'use client'

import { useState } from 'react'
import { useWebRTC } from '../../hooks/useWebRTC'

function RemoteAudio({ stream, peerId }: { stream: MediaStream; peerId: string }) {
  const ref = (el: HTMLAudioElement | null) => {
    if (el) el.srcObject = stream
  }
  return (
    <div className="p-2 border rounded bg-gray-50 mb-2">
      <p className="text-xs font-mono">Peer: {peerId}</p>
      <audio ref={ref} autoPlay playsInline controls className="w-full h-8" />
    </div>
  )
}

export default function TestRTCPage() {
  const [userId] = useState(() => 'user-' + Math.random().toString(36).slice(2, 7))
  const [roomId, setRoomId] = useState('test-room')
  const [role, setRole] = useState<'speaker' | 'audience'>('speaker')
  const [enabled, setEnabled] = useState(false)

  const {
    localStream,
    remoteStreams,
    peers,
    connected,
    micMuted,
    toggleMic,
    error,
  } = useWebRTC({
    userId,
    roomId,
    role,
    enabled,
  })

  return (
    <div className="p-8 max-w-2xl mx-auto font-sans">
      <h1 className="text-2xl font-bold mb-6">WebRTC Verification Tool</h1>

      <div className="space-y-4 mb-8 bg-white p-6 rounded-xl border shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">User ID</label>
            <input
              type="text"
              value={userId}
              readOnly
              className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Room ID</label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              disabled={enabled}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Role</label>
          <div className="mt-2 flex gap-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                checked={role === 'speaker'}
                onChange={() => setRole('speaker')}
                disabled={enabled}
                className="form-radio"
              />
              <span className="ml-2">Speaker</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                checked={role === 'audience'}
                onChange={() => setRole('audience')}
                disabled={enabled}
                className="form-radio"
              />
              <span className="ml-2">Audience</span>
            </label>
          </div>
        </div>

        <button
          onClick={() => setEnabled(!enabled)}
          className={`w-full py-2 px-4 rounded-md font-medium text-white transition-colors ${
            enabled ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {enabled ? 'Disconnect' : 'Connect to Room'}
        </button>
      </div>

      {enabled && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">Connection Status</h2>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
              <span className="text-sm font-medium">{connected ? 'Connected to Signaling' : 'Connecting...'}</span>
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md">
                {error}
              </div>
            )}

            {role === 'speaker' && (
              <div className="p-4 bg-gray-50 rounded-lg border">
                <p className="text-sm font-medium mb-2">Local Mic Control</p>
                <button
                  onClick={toggleMic}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    micMuted ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}
                >
                  {micMuted ? '🎤 Unmute' : '🎙 Muted? Unmute'}
                </button>
                {localStream && (
                  <p className="mt-2 text-xs text-green-600">✓ Local stream captured</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">Peers in Room ({peers.length})</h2>
            <ul className="space-y-1">
              {peers.map((peer) => (
                <li key={peer.userId} className="text-sm py-1 px-2 bg-gray-50 rounded flex justify-between">
                  <span>{peer.userId}</span>
                  <span className="text-gray-400 italic">{peer.role}</span>
                </li>
              ))}
              {peers.length === 0 && <li className="text-sm text-gray-400 italic">No other peers</li>}
            </ul>

            <h2 className="text-lg font-semibold border-b pb-2 mt-6">Remote Streams</h2>
            {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
              <RemoteAudio key={peerId} stream={stream} peerId={peerId} />
            ))}
            {remoteStreams.size === 0 && <p className="text-sm text-gray-400 italic">No remote streams yet</p>}
          </div>
        </div>
      )}
    </div>
  )
}
