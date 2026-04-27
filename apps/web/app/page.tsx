'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    if (localStorage.getItem('token')) {
      router.replace('/dashboard')
    }
  }, [router])

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl md:text-5xl font-bold mb-4">
        🎙️ Podcast Studio
      </h1>
      <p className="text-gray-600 max-w-xl mb-8">
        Create, manage, and publish your podcasts effortlessly.
        A modern platform built for creators.
      </p>
      <div className="flex gap-4">
        <Link
          href="/signup"
          className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Get Started
        </Link>
        <Link
          href="/login"
          className="px-6 py-2 border rounded-lg hover:bg-gray-100 transition-colors"
        >
          Login
        </Link>
      </div>
    </div>
  )
}
