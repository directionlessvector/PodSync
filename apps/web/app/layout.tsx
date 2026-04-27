import type { Metadata } from "next"
import localFont from "next/font/local"
import { Geist } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"
import NavBar from "@/components/NavBar"

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
        <div className="flex min-h-screen flex-col">
          <NavBar />
          <main className="flex-1">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
