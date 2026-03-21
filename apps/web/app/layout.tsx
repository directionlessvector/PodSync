import type { Metadata } from "next"
import localFont from "next/font/local"
import { Geist } from "next/font/google"
import Link from "next/link"

import "./globals.css"
import { cn } from "@/lib/utils"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
})

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "Podcast Studio",
  description: "Create and manage your podcasts",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body
        className={cn(
          geistSans.variable,
          geistMono.variable,
          "min-h-screen bg-slate-50 text-slate-900"
        )}
      >
        {/* App Wrapper */}
        <div className="flex min-h-screen flex-col">
          
          {/* Navbar */}
          <header className="border-b bg-white">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
              
              {/* Logo / Brand */}
              <Link href="/" className="font-semibold text-lg">
                🎙️ Podcast Studio
              </Link>

              {/* Nav Links */}
              <nav className="flex items-center gap-4 text-sm">
                <Link href="/signup" className="hover:text-blue-600">
                  Signup
                </Link>
                <Link href="/login" className="hover:text-blue-600">
                  Login
                </Link>
              </nav>

            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1">
            {children}
          </main>

          {/* Footer (optional but nice) */}
          <footer className="border-t bg-white">
            <div className="mx-auto max-w-6xl px-4 py-4 text-sm text-gray-500">
              © {new Date().getFullYear()} Podcast Studio
            </div>
          </footer>

        </div>
      </body>
    </html>
  )
}