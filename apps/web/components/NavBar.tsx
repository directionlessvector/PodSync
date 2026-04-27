'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

// Pages that manage their own full-screen header — hide the global nav there
const HIDDEN_ON = ['/dashboard', '/room', '/watch']

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    setLoggedIn(!!localStorage.getItem('token'))
  }, [pathname]) // re-check on every navigation

  const hidden = HIDDEN_ON.some(prefix => pathname.startsWith(prefix))
  if (hidden) return null

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/')
  }

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href={loggedIn ? '/dashboard' : '/'} className="font-semibold text-lg">
          🎙️ Podcast Studio
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          {loggedIn ? (
            <>
              <Link href="/dashboard" className="hover:text-purple-600 transition-colors">
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="hover:text-red-600 transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/signup" className="hover:text-purple-600 transition-colors">
                Sign up
              </Link>
              <Link
                href="/login"
                className="px-4 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Login
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
