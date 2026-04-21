"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BarChart3, Users, BarChart2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/authStore"

interface LoginPageProps {
  onLogin: (role: "pollster" | "user") => void
}

// Inline Google "G" SVG — no external dependency, perfectly matches Google brand
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

const roles = [
  {
    id: "user" as const,
    label: "Voter",
    description: "Participate in polls",
    icon: Users,
  },
  {
    id: "pollster" as const,
    label: "Pollster",
    description: "Create & manage polls",
    icon: BarChart2,
  },
]

export default function LoginPage({ onLogin }: LoginPageProps) {
  const router = useRouter()
  const { loginWithGoogle } = useAuthStore()
  const [role, setRole] = useState<"pollster" | "user">("user")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setError(null)
    try {
      console.log("1. Initiating Firebase login...")
      await loginWithGoogle(role === "pollster" ? "pollster" : "voter")
      console.log("2. Firebase login successful!")
      router.push(role === "pollster" ? "/pollster" : "/user")
    } catch (error: any) {
      console.error("FIREBASE/BACKEND ERROR:", error)
      setError(error.message || "Sign-in failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }


  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 font-sans">
      {/* Ambient glow blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-10%] left-[-5%] w-[520px] h-[520px] rounded-full bg-primary/[0.07] blur-[130px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[480px] h-[480px] rounded-full bg-accent/[0.06] blur-[130px]" />
      </div>

      <div className="relative w-full max-w-[420px] flex flex-col items-center gap-8">

        {/* Logo lockup */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary shadow-lg shadow-primary/30">
            <BarChart3 className="w-6 h-6 text-primary-foreground" strokeWidth={2.2} />
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold tracking-tight text-foreground">PollPulse</p>
            <p className="text-sm text-muted-foreground mt-0.5">Real-time polling, simplified</p>
          </div>
        </div>

        {/* Card */}
        <div className="w-full rounded-2xl border border-border bg-card shadow-2xl shadow-black/40 overflow-hidden">

          {/* Card header strip */}
          <div className="px-8 pt-7 pb-6 border-b border-border">
            <h1 className="text-lg font-semibold text-foreground tracking-tight text-balance">
              Sign in to your account
            </h1>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Choose your role, then continue with Google.
            </p>
          </div>

          {/* Card body */}
          <div className="px-8 py-7 flex flex-col gap-6">

            {/* Role selector label */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                I am a...
              </p>

              {/* Segmented role toggle */}
              <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Select your role">
                {roles.map(({ id, label, description, icon: Icon }) => {
                  const active = role === id
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setRole(id)}
                      className={cn(
                        "relative flex flex-col items-start gap-1.5 rounded-xl border px-4 py-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                        active
                          ? "border-primary bg-primary/10 shadow-sm shadow-primary/20"
                          : "border-border bg-muted/50 hover:border-border/80 hover:bg-muted"
                      )}
                    >
                      {/* Active indicator dot */}
                      <span
                        className={cn(
                          "absolute top-3 right-3 w-2 h-2 rounded-full transition-all duration-200",
                          active ? "bg-primary scale-100" : "bg-muted-foreground/30 scale-75"
                        )}
                        aria-hidden="true"
                      />

                      <span
                        className={cn(
                          "flex items-center justify-center w-7 h-7 rounded-lg transition-colors duration-200",
                          active
                            ? "bg-primary/20 text-primary"
                            : "bg-secondary text-muted-foreground"
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" strokeWidth={2.2} />
                      </span>

                      <div>
                        <p
                          className={cn(
                            "text-sm font-semibold leading-none transition-colors duration-200",
                            active ? "text-foreground" : "text-muted-foreground"
                          )}
                        >
                          {label}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-tight">
                          {description}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3" aria-hidden="true">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">then</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Google Sign-In button */}
            {error && (
              <p className="text-xs text-destructive text-center -mb-2">{error}</p>
            )}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className={cn(
                "group relative w-full flex items-center justify-center gap-3 h-11 rounded-xl border border-border bg-secondary",
                "text-sm font-semibold text-foreground",
                "transition-all duration-200",
                "hover:border-primary/40 hover:bg-secondary/80 hover:shadow-md hover:shadow-primary/10",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                "active:scale-[0.985]",
                "disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
              )}
            >
              <GoogleIcon className="w-4.5 h-4.5 shrink-0" />
              <span>{isLoading ? "Signing in..." : "Continue with Google"}</span>
              {/* Hover shimmer */}
              <span
                className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background:
                    "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(99,102,241,0.08), transparent)",
                }}
                aria-hidden="true"
              />
            </button>
          </div>

          {/* Card footer */}
          <div className="px-8 pb-6">
            <p className="text-center text-[11px] text-muted-foreground leading-relaxed">
              By signing in you agree to our{" "}
              <button className="text-primary/80 hover:text-primary underline underline-offset-2 transition-colors">
                Terms of Service
              </button>{" "}
              and{" "}
              <button className="text-primary/80 hover:text-primary underline underline-offset-2 transition-colors">
                Privacy Policy
              </button>
              .
            </p>
          </div>
        </div>

        {/* Below-card note */}
        <p className="text-xs text-muted-foreground text-center">
          New to PollPulse?{" "}
          <button className="text-primary font-medium hover:underline underline-offset-2 transition-colors">
            Your account is created automatically.
          </button>
        </p>

      </div>
    </div>
  )
}
