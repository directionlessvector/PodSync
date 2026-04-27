'use client'

import { useEffect, useRef, useState } from 'react'

const SIGNALING_URL = process.env.NEXT_PUBLIC_SIGNALING_URL || 'ws://localhost:5004'

type Role = 'speaker'

interface UseWebRTCOptions {
  userId: string
  roomId: string
  role: Role
  enabled: boolean
}

export function useWebRTC({ userId, roomId, role, enabled }: UseWebRTCOptions) {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [broadcastMsg, setBroadcastMsg] = useState<{ action: string, timestamp: number, payload?: any, fromUserId?: string } | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const sendRef = useRef<((msg: object) => void) | null>(null)

  useEffect(() => {
    if (!enabled || !userId || !roomId) return

    let mounted = true

    function send(msg: object) {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(msg))
      }
    }

    sendRef.current = send

    const ws = new WebSocket(SIGNALING_URL)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mounted) return
      setConnected(true)
      // Pass the role to the signaling server so it can enforce permissions
      ws.send(JSON.stringify({ event: 'room:join', userId, roomId, role }))
    }

    ws.onclose = () => { if (mounted) setConnected(false) }
    ws.onerror = () => { if (mounted) setError('Could not connect to signaling server') }

    ws.onmessage = async (raw) => {
      if (!mounted) return
      let msg: any
      try { msg = JSON.parse(raw.data) } catch { return }

      switch (msg.event) {
        case 'room:broadcast': {
          setBroadcastMsg({ action: msg.payload?.action, timestamp: Date.now(), payload: msg.payload, fromUserId: msg.fromUserId })
          break
        }
      }
    }

    return () => {
      mounted = false
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [enabled, userId, roomId, role])

  return {
    connected,
    sendSignal: (payload: any) => {
      if (sendRef.current) {
        sendRef.current({ event: 'room:broadcast', userId, roomId, payload })
      }
    },
    broadcastMsg,
    error,
  }
}
