'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const SIGNALING_URL = process.env.NEXT_PUBLIC_SIGNALING_URL || 'ws://localhost:5004'
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

type Role = 'speaker' | 'audience'

export interface Peer {
  userId: string
  role: Role
}

interface UseWebRTCOptions {
  userId: string
  roomId: string
  role: Role
  enabled: boolean
}

export function useWebRTC({ userId, roomId, role, enabled }: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  const [peers, setPeers] = useState<Peer[]>([])
  const [connected, setConnected] = useState(false)
  const [micMuted, setMicMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const wsRef = useRef<WebSocket | null>(null)

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const track = stream.getAudioTracks()[0]
    if (track) {
      track.enabled = !track.enabled
      setMicMuted(!track.enabled)
    }
  }, [])

  useEffect(() => {
    if (!enabled || !userId || !roomId) return

    let mounted = true

    function send(msg: object) {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(msg))
      }
    }

    function getPc(peerId: string): RTCPeerConnection {
      if (peerConnectionsRef.current.has(peerId)) {
        return peerConnectionsRef.current.get(peerId)!
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

      // Add local audio tracks if I'm a speaker
      if (role === 'speaker' && localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!)
        })
      }

      pc.ontrack = (event) => {
        if (!mounted) return
        const stream = event.streams[0]
        if (stream) {
          setRemoteStreams(prev => new Map(prev).set(peerId, stream))
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          send({
            event: 'signal:ice-candidate',
            userId,
            payload: { targetUserId: peerId, candidate: event.candidate },
          })
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          peerConnectionsRef.current.delete(peerId)
          if (mounted) {
            setRemoteStreams(prev => {
              const next = new Map(prev)
              next.delete(peerId)
              return next
            })
          }
        }
      }

      peerConnectionsRef.current.set(peerId, pc)
      return pc
    }

    // Initiates a WebRTC offer to peerId.
    // Audience adds recvonly transceiver so the speaker can push audio back.
    async function sendOffer(peerId: string) {
      const pc = getPc(peerId)
      if (role === 'audience') {
        pc.addTransceiver('audio', { direction: 'recvonly' })
      }
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      send({ event: 'signal:offer', userId, payload: { targetUserId: peerId, sdp: offer } })
    }

    async function handleOffer(fromUserId: string, sdp: RTCSessionDescriptionInit) {
      const pc = getPc(fromUserId)
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      send({ event: 'signal:answer', userId, payload: { targetUserId: fromUserId, sdp: answer } })
    }

    async function handleAnswer(fromUserId: string, sdp: RTCSessionDescriptionInit) {
      const pc = peerConnectionsRef.current.get(fromUserId)
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp))
    }

    async function handleIceCandidate(fromUserId: string, candidate: RTCIceCandidateInit) {
      const pc = peerConnectionsRef.current.get(fromUserId)
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch {
          // Safe to ignore — can happen during normal teardown
        }
      }
    }

    function removePeer(peerId: string) {
      const pc = peerConnectionsRef.current.get(peerId)
      if (pc) { pc.close(); peerConnectionsRef.current.delete(peerId) }
      if (mounted) {
        setRemoteStreams(prev => { const n = new Map(prev); n.delete(peerId); return n })
        setPeers(prev => prev.filter(p => p.userId !== peerId))
      }
    }

    const init = async () => {
      // Speakers must capture mic before connecting
      if (role === 'speaker') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          if (!mounted) { stream.getTracks().forEach(t => t.stop()); return }
          localStreamRef.current = stream
          setLocalStream(stream)
        } catch {
          if (mounted) setError('Microphone access denied. Please allow microphone access and refresh.')
          return
        }
      }

      const ws = new WebSocket(SIGNALING_URL)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mounted) return
        setConnected(true)
        ws.send(JSON.stringify({ event: 'room:join', userId, roomId, role }))
      }

      ws.onclose = () => { if (mounted) setConnected(false) }
      ws.onerror = () => { if (mounted) setError('Could not connect to signaling server') }

      ws.onmessage = async (raw) => {
        if (!mounted) return
        let msg: any
        try { msg = JSON.parse(raw.data) } catch { return }

        switch (msg.event) {
          case 'room:joined': {
            const existingPeers: Peer[] = msg.peers || []
            setPeers(existingPeers)
            // New joiner sends offers to all existing peers.
            // Speakers connect to everyone; audience only connects to speakers.
            for (const peer of existingPeers) {
              if (role === 'speaker' || peer.role === 'speaker') {
                await sendOffer(peer.userId)
              }
            }
            break
          }

          case 'room:peer-joined': {
            // New peer joined — they will send us offers. Just track them.
            setPeers(prev => [
              ...prev.filter(p => p.userId !== msg.userId),
              { userId: msg.userId, role: msg.role },
            ])
            break
          }

          case 'room:peer-left': {
            removePeer(msg.userId)
            break
          }

          case 'signal:offer': {
            await handleOffer(msg.fromUserId, msg.payload.sdp)
            break
          }

          case 'signal:answer': {
            await handleAnswer(msg.fromUserId, msg.payload.sdp)
            break
          }

          case 'signal:ice-candidate': {
            await handleIceCandidate(msg.fromUserId, msg.payload.candidate)
            break
          }
        }
      }
    }

    init()

    return () => {
      mounted = false
      localStreamRef.current?.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
      peerConnectionsRef.current.forEach(pc => pc.close())
      peerConnectionsRef.current.clear()
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [enabled, userId, roomId, role])

  return { localStream, remoteStreams, peers, connected, micMuted, toggleMic, error }
}
