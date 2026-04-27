'use client'

import { useState, useRef, useCallback } from 'react'

interface UseMediaRecorderOptions {
  stream: MediaStream | null
  onDataAvailable?: (blob: Blob) => void
  onStop?: (blob: Blob) => void
}

export function useMediaRecorder({ stream, onDataAvailable, onStop }: UseMediaRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [completedRecording, setCompletedRecording] = useState<{ url: string, filename: string, blob: Blob } | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const startRecording = useCallback((startAt?: string) => {
    if (!stream || isRecording) return

    chunksRef.current = []
    
    let initialTime = 0;
    if (startAt) {
      const startTime = new Date(startAt).getTime();
      const now = Date.now();
      if (now > startTime) {
        initialTime = Math.floor((now - startTime) / 1000);
      }
    }
    
    setRecordingTime(initialTime)

    try {
      // Prefer high-quality video/audio containers
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm'

      const recorder = new MediaRecorder(stream, { mimeType })

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
          onDataAvailable?.(event.data)
        }
      }

      recorder.onstop = () => {
        const fullBlob = new Blob(chunksRef.current, { type: recorder.mimeType })
        onStop?.(fullBlob)
        
        // Instead of auto-downloading, store it in state so the UI can present a manual download button
        const filenameTime = startAt ? new Date(startAt).toISOString().replace(/[:.]/g, '-') : new Date().toISOString().replace(/[:.]/g, '-')
        const url = URL.createObjectURL(fullBlob)
        setCompletedRecording({
          url,
          filename: `recording-${filenameTime}.webm`,
          blob: fullBlob
        })
      }

      recorder.start(1000) // Collect chunks every second
      mediaRecorderRef.current = recorder
      setIsRecording(true)

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Failed to start recording:', err)
    }
  }, [stream, isRecording, onDataAvailable, onStop])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isRecording])

  const clearRecording = useCallback(() => {
    if (completedRecording) {
      window.URL.revokeObjectURL(completedRecording.url)
      setCompletedRecording(null)
    }
  }, [completedRecording])

  return {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    completedRecording,
    clearRecording,
  }
}