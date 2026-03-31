"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Flame, CheckCircle2, Clock, BarChart3, ChevronLeft } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

const TAG_COLORS: Record<string, string> = {
  Teknoloji: "bg-blue-500/15 text-blue-400",
  "Yaşam Tarzı": "bg-purple-500/15 text-purple-400",
  "Yapay Zekâ": "bg-cyan-500/15 text-cyan-400",
}

export default function SinglePollPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [user, setUser] = useState<any>(null)
  const [poll, setPoll] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [votedOptionId, setVotedOptionId] = useState<number | null>(null)

  const fetchPoll = async () => {
    try {
      const res = await fetch(`${API_URL}/api/polls/single/${id}`)
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Bu anket bulunamadı veya süresi dolmuş olabilir.")
        }
        throw new Error("Anket getirilemedi")
      }
      const data = await res.json()
      setPoll(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const userStr = localStorage.getItem("user")
    let currentUser = null
    if (userStr) {
      currentUser = JSON.parse(userStr)
      setUser(currentUser)
    }
    fetchPoll()

    // Check if user already voted on this poll
    if (currentUser) {
      fetch(`${API_URL}/api/users/${currentUser.id}/votes`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            const vote = data.find((v: any) => v.poll_id.toString() === id)
            if (vote) setVotedOptionId(vote.option_id)
          }
        })
        .catch((err) => console.error("Oylar getirilemedi:", err))
    }
  }, [id])

  const handleVote = async (optionId: number) => {
    if (!user) {
      alert("Lütfen önce giriş yapın.")
      router.push('/?redirect=/anket/' + id)
      return
    }

    try {
      const payload = {
        user_id: user.id,
        poll_id: parseInt(id),
        option_id: optionId,
      }

      const res = await fetch(`${API_URL}/api/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        if (res.status === 400) {
          alert("Bu ankete zaten oy verdiniz!")
          setVotedOptionId(optionId)
        } else {
          throw new Error("Oy verme işlemi başarısız oldu.")
        }
        return
      }

      setVotedOptionId(optionId)
      await fetchPoll()
    } catch (err: any) {
      alert(err.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      </div>
    )
  }

  if (error || !poll) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 gap-4">
        <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-2">
          <Flame className="w-6 h-6 text-destructive" />
        </div>
        <p className="text-foreground font-medium text-center">{error || "Anket bulunamadı."}</p>
        <Link href="/" className="text-sm text-primary hover:underline mt-2">
          Ana sayfaya dön
        </Link>
      </div>
    )
  }

  const hasVoted = votedOptionId !== null
  const isClosed = false
  const totalVotes = poll.options?.reduce((sum: number, o: any) => sum + o.votes, 0) || 0
  const dateStr = new Date(poll.created_at).toLocaleDateString("tr-TR")

  return (
    <div className="min-h-screen bg-background flex justify-center p-6 md:p-12">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        {/* Simple Header */}
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Geri dön
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded bg-primary">
              <BarChart3 className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm tracking-tight text-foreground">PollPulse</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
          {/* Poll header */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", TAG_COLORS["Teknoloji"] || "bg-blue-500/15 text-blue-400")}>
                Genel
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {dateStr}
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground leading-snug">
              {poll.question}
            </h1>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-3">
            {poll.options?.map((opt: any) => {
              const isSelected = votedOptionId === opt.id
              const percentage = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0
              return (
                <button
                  key={opt.id}
                  onClick={() => handleVote(opt.id)}
                  disabled={hasVoted || isClosed || !user}
                  className={cn(
                    "flex items-center justify-between w-full px-4 py-3.5 rounded-xl border text-sm font-medium transition-all duration-150",
                    isSelected
                      ? "border-primary bg-primary/15 text-primary shadow-sm"
                      : hasVoted || isClosed || !user
                      ? "border-border bg-muted/30 text-muted-foreground cursor-not-allowed"
                      : "border-border bg-card text-foreground hover:border-primary/60 hover:bg-primary/5 active:scale-[0.99]"
                  )}
                >
                  <div className="flex items-center gap-3 text-left">
                    {isSelected ? (
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    ) : (
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 shrink-0",
                          hasVoted || isClosed || !user ? "border-muted-foreground/30" : "border-muted-foreground/50"
                        )}
                      />
                    )}
                    <span className="flex items-center gap-2 text-base">
                      {hasVoted && (
                        <span className="font-bold min-w-[3rem] inline-block">{`%${percentage}`}</span>
                      )}
                      <span>{opt.text}</span>
                    </span>
                  </div>
                  {hasVoted && (
                    <span className="text-sm text-muted-foreground opacity-80 shrink-0">
                      {opt.votes} oy
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {!user && (
            <div className="pt-2">
              <Link 
                href={`/?redirect=/anket/${id}`}
                className="flex items-center justify-center w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm transition-colors shadow-sm"
              >
                Oy kullanmak için Giriş Yap veya Kayıt Ol
              </Link>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
            {hasVoted ? (
              <span className="text-sm font-medium text-muted-foreground">
                Toplam {totalVotes.toLocaleString()} oy
              </span>
            ) : user ? (
              <span className="text-sm text-muted-foreground">Oy vermek için bir seçenek işaretleyin</span>
            ) : (
              <span className="text-sm text-muted-foreground">Oy vermek için oturum açın</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
