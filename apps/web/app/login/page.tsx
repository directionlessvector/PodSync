"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { apiLogin } from "@/lib/api"

export default function LoginPage() {
  const router = useRouter()

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))

    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!formData.email || !formData.password) {
      setError("All fields are required")
      return
    }

    setLoading(true)

    try {
      const data = await apiLogin(formData.email, formData.password)

      if (data.error) {
        setError(data.error)
        return
      }

      if (data.token) {
        localStorage.setItem('token', data.token)
        router.push('/dashboard')
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 shadow-lg">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome back</h1>
          <p className="text-gray-600 text-sm">
            Login to your account
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Email */}
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              name="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              name="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? "Logging in..." : "Login"}
          </Button>

        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-gray-600">
          Don’t have an account?{" "}
          <Link href="/signup" className="text-blue-600 hover:text-blue-500">
            Sign up
          </Link>
        </p>

      </Card>
    </div>
  )
}