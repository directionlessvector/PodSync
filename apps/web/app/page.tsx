import Link from "next/link"

export default function Home() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
      
      {/* Heading */}
      <h1 className="text-4xl md:text-5xl font-bold mb-4">
        🎙️ Podcast Studio
      </h1>

      <p className="text-gray-600 max-w-xl mb-8">
        Create, manage, and publish your podcasts effortlessly.
        A modern platform built for creators.
      </p>

      {/* CTA Buttons */}
      <div className="flex gap-4">
        <Link
          href="/signup"
          className="px-6 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition"
        >
          Get Started
        </Link>

        <Link
          href="/login"
          className="px-6 py-2 border rounded-md hover:bg-gray-100 transition"
        >
          Login
        </Link>
      </div>

    </div>
  )
}