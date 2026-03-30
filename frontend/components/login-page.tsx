"use client"

import { useState } from "react"
import { BarChart3, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface LoginPageProps {
  onLogin: (role: "pollster" | "user") => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"pollster" | "user">("user")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onLogin(role)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background glow */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-accent/8 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary">
            <BarChart3 className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold text-foreground tracking-tight">
            PollPulse
          </span>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl">
          <h1 className="text-xl font-semibold text-foreground mb-1">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Sign in to your account to continue
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-sm text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-10"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-sm text-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-10"
              />
            </div>

            {/* Role Selector */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm text-foreground">Role</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["pollster", "user"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      "flex items-center justify-center gap-2 h-10 rounded-lg border text-sm font-medium transition-all duration-150 capitalize",
                      role === r
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-muted text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    )}
                  >
                    <Zap
                      className={cn(
                        "w-3.5 h-3.5",
                        role === r ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    {r === "pollster" ? "Pollster" : "Voter"}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold mt-1 rounded-lg"
            >
              Sign In
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Don&apos;t have an account?{" "}
            <button className="text-primary hover:underline font-medium">
              Get started free
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
