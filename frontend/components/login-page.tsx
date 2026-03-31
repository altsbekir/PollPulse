"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BarChart3, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface LoginPageProps {
  onLogin: (role: "pollster" | "user") => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get('redirect')
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"pollster" | "user">("user")
  const [isRegistering, setIsRegistering] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (isRegistering) {
      setLoading(true)
      try {
        const backendRole = role === "pollster" ? "Pollster" : "Voter"
        const res = await fetch(`${API_URL}/api/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, role: backendRole }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.detail || "Kayıt başarısız oldu.")
        }

        setIsRegistering(false)
        setEmail("")
        setPassword("")
        setError("")
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    } else {
      setLoading(true)
      try {
        const res = await fetch(`${API_URL}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.detail || "Giriş başarısız oldu.")
        }

        const data = await res.json()
        
        // Save user to localStorage
        localStorage.setItem("user", JSON.stringify(data.user))
        
        // Redirect based on role
        if (redirectUrl) {
          window.location.href = redirectUrl
        } else if (data.user.role === "Pollster") {
          router.push("/pollster")
        } else {
          router.push("/user")
        }
        
        // Optional fallback to keep prop happy if needed by parent
        if (onLogin) {
          const userRole = data.user.role.toLowerCase() === "pollster" ? "pollster" : "user"
          onLogin(userRole)
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
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
            {isRegistering ? "Hesap oluşturun" : "Tekrar hoş geldiniz"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {isRegistering
              ? "Ücretsiz hesabınızı oluşturmak için bilgilerinizi girin"
              : "Devam etmek için hesabınıza giriş yapın"}
          </p>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2 mb-4">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-sm text-foreground">
                E-posta
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="siz@ornek.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-10"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-sm text-foreground">
                Şifre
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

            {/* Role Selector (Only for Registration) */}
            {isRegistering && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm text-foreground">Rol</Label>
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
                      {r === "pollster" ? "Anketör" : "Katılımcı"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold mt-1 rounded-lg"
            >
              {loading
                ? "İşleniyor..."
                : isRegistering
                ? "Kayıt Ol"
                : "Giriş Yap"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            {isRegistering ? "Zaten hesabınız var mı?" : "Hesabınız yok mu?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering)
                setError("")
              }}
              className="text-primary hover:underline font-medium"
            >
              {isRegistering ? "Giriş yapın" : "Ücretsiz başlayın"}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
