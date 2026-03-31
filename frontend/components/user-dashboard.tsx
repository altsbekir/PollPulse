"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Flame, CheckCircle2, Clock, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"


const TAG_COLORS: Record<string, string> = {
  Teknoloji: "bg-blue-500/15 text-blue-400",
  "Yaşam Tarzı": "bg-purple-500/15 text-purple-400",
  "Yapay Zekâ": "bg-cyan-500/15 text-cyan-400",
}

export default function UserDashboard() {
  const [user, setUser] = useState<any>(null)
  const [polls, setPolls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [voted, setVoted] = useState<Record<number, number>>({})

  const fetchPolls = async () => {
    try {
      const res = await fetch(`${API_URL}/api/polls`)
      if (!res.ok) throw new Error("Anketler getirilemedi")
      const data = await res.json()
      setPolls(data.reverse())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const userStr = localStorage.getItem("user")
    if (userStr) {
      const parsedUser = JSON.parse(userStr)
      setUser(parsedUser)
      
      fetch(`${API_URL}/api/users/${parsedUser.id}/votes`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const voteMap: Record<number, number> = {}
            data.forEach((v: any) => {
              voteMap[v.poll_id] = v.option_id
            })
            setVoted(voteMap)
          }
        })
        .catch(err => console.error("Oylar getirilemedi:", err))
    }
    fetchPolls()
  }, [])

  const handleVote = async (pollId: number, optionId: number) => {
    if (!user) {
      alert("Lütfen önce giriş yapın.")
      return
    }

    try {
      const payload = {
        user_id: user.id,
        poll_id: pollId,
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
          setVoted((prev) => ({ ...prev, [pollId]: optionId }))
        } else {
          throw new Error("Oy verme işlemi başarısız oldu.")
        }
        return
      }

      const data = await res.json()
      if (data.streak_count !== undefined) {
        const updatedUser = { ...user, streak_count: data.streak_count }
        setUser(updatedUser)
        localStorage.setItem("user", JSON.stringify(updatedUser))
      }
      setVoted((prev) => ({ ...prev, [pollId]: optionId }))
      await fetchPolls()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="p-6 md:p-8 flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground text-balance">Anket Akışınız</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gündemdeki anketleri keşfedin ve oy verin
          </p>
        </div>

        {/* Streak Badge */}
        <div className="shrink-0 flex items-center gap-2 bg-orange-500/15 border border-orange-500/30 px-4 py-2 rounded-xl">
          <Flame className="w-5 h-5 text-orange-400" />
          <div>
            <p className="text-sm font-bold text-orange-400">{user?.streak_count ?? 0} Günlük Seri</p>
            <p className="text-xs text-orange-400/70">Devam ettirin!</p>
          </div>
        </div>
      </div>

      {/* Poll Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading && <p className="text-sm text-muted-foreground p-5">Yükleniyor...</p>}
        {error && <p className="text-sm text-destructive p-5">{error}</p>}
        {!loading && !error && polls.length === 0 && (
          <p className="text-sm text-muted-foreground p-5">Henüz anket bulunmuyor.</p>
        )}
        {!loading && !error && polls.map((poll) => {
          const hasVoted = !!voted[poll.id]
          const votedOptionId = voted[poll.id]
          const isClosed = false
          const totalVotes = poll.options?.reduce((sum: number, o: any) => sum + o.votes, 0) || 0
          const dateStr = new Date(poll.created_at).toLocaleDateString("tr-TR")

          return (
            <div
              key={poll.id}
              className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4"
            >
              {/* Poll header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        TAG_COLORS["Teknoloji"]
                      )}
                    >
                      Genel
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {dateStr}
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-foreground text-balance leading-snug">
                    {poll.question}
                  </h2>
                </div>
              </div>

              {/* Options */}
              <div className="flex flex-col gap-2">
                {poll.options?.map((opt: any) => {
                  const isSelected = votedOptionId === opt.id
                  const percentage = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleVote(poll.id, opt.id)}
                      disabled={hasVoted || isClosed}
                      className={cn(
                        "flex items-center justify-between w-full px-3 py-2.5 rounded-lg border text-sm font-medium transition-all duration-150",
                        isSelected
                          ? "border-primary bg-primary/15 text-primary"
                          : hasVoted || isClosed
                          ? "border-border bg-muted/30 text-muted-foreground cursor-not-allowed"
                          : "border-border bg-muted/20 text-foreground hover:border-primary/60 hover:bg-primary/8"
                      )}
                    >
                      <div className="flex items-center gap-3 text-left">
                        {isSelected ? (
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                        ) : (
                          <div
                            className={cn(
                              "w-4 h-4 rounded-full border-2 shrink-0",
                              hasVoted || isClosed ? "border-muted-foreground/30" : "border-muted-foreground/50"
                            )}
                          />
                        )}
                        <span className="flex items-center gap-2">
                          {hasVoted && (
                            <span className="font-bold min-w-[2.5rem] inline-block">{`%${percentage}`}</span>
                          )}
                          <span>{opt.text}</span>
                        </span>
                      </div>
                      {hasVoted && (
                        <span className="text-xs text-muted-foreground opacity-80 shrink-0">
                          {opt.votes} oy
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-1">
                {hasVoted && (
                  <span className="text-xs text-muted-foreground">
                    Toplam {totalVotes.toLocaleString()} oy
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
