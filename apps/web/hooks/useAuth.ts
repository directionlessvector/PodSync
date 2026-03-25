'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function useAuth() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (!storedToken) {
      router.push('/login')
    } else {
      setToken(storedToken)
    }
    setIsLoading(false)
  }, [router])

  return { token, isLoading }
}