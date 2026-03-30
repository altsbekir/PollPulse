"use client"

import { useState, useEffect } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { Trophy, Users, TrendingUp, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const PIE_COLORS = ["#6366f1", "#8b5cf6", "#3b82f6", "#06b6d4", "#eab308", "#10b981", "#f43f5e"]

export default function PollResultsView() {
  const pathname = usePathname()
  const backHref = pathname.startsWith("/pollster") ? "/pollster" : "/user"

  const [polls, setPolls] = useState<any[]>([])
  const [selectedPoll, setSelectedPoll] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPolls = async () => {
      try {
        const userStr = localStorage.getItem("user")
        if (!userStr) {
          setLoading(false)
          return
        }
        const user = JSON.parse(userStr)
        const res = await fetch(`http://localhost:8000/api/polls/${user.id}`)
        if (res.ok) {
          const data = await res.json()
          setPolls(data)
          if (data.length > 0) {
            setSelectedPoll(data[data.length - 1]) // Default to newest
          }
        }
      } catch (err) {
        console.error("Anketler getirilemedi", err)
      } finally {
        setLoading(false)
      }
    }
    fetchPolls()
  }, [])

  if (loading) return <div className="p-8 text-center text-muted-foreground text-sm">Yükleniyor...</div>
  if (!selectedPoll) return <div className="p-8 text-center text-muted-foreground text-sm">Henüz anket/sonuç bulunmuyor.</div>

  const totalVotes = selectedPoll.options?.reduce((sum: number, opt: any) => sum + opt.votes, 0) || 0
  const closedAt = new Date(selectedPoll.created_at).toLocaleDateString("tr-TR")

  // Map backend options to the format Recharts expects, sorted by votes
  const results = (selectedPoll.options || [])
    .map((opt: any, index: number) => ({
      option: opt.text,
      votes: opt.votes,
      color: PIE_COLORS[index % PIE_COLORS.length],
    }))
    .sort((a: any, b: any) => b.votes - a.votes)

  const maxVotes = results.length > 0 ? results[0].votes : 0
  const winner = results.length > 0 ? results[0] : null

  const chartData = results.map((r: any) => ({
    name: r.option,
    votes: r.votes,
    fill: r.color,
  }))

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto flex flex-col gap-8">
      {/* Back */}
      <Link
        href={backHref}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Kontrol Paneline Dön
      </Link>

      {polls.length > 1 && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-foreground">Görüntülenen Anketi Seçin</label>
          <select
            className="h-10 px-3 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full max-w-sm"
            value={selectedPoll?.id || ""}
            onChange={(e) => {
              const p = polls.find(poll => poll.id.toString() === e.target.value)
              if (p) setSelectedPoll(p)
            }}
          >
            {polls.map((p) => (
              <option key={p.id} value={p.id}>{p.question}</option>
            ))}
          </select>
        </div>
      )}

      {/* Poll question */}
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-primary uppercase tracking-wider">
            Anket Sonuçları
          </span>
        </div>
        <h1 className="text-xl font-bold text-foreground text-balance leading-snug">
          {selectedPoll.question}
        </h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {totalVotes.toLocaleString()} toplam oy
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span>Tarih: {closedAt}</span>
        </div>
      </div>

      {/* Winner highlight */}
      {winner && winner.votes > 0 && (
        <div className="flex items-center gap-4 bg-primary/10 border border-primary/30 rounded-xl px-5 py-4">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-primary font-medium uppercase tracking-wider">En Çok Oy Alan</p>
            <p className="text-base font-bold text-foreground mt-0.5">{winner.option}</p>
            <p className="text-sm text-muted-foreground">
              {winner.votes.toLocaleString()} oy ·{" "}
              toplamın %{((winner.votes / totalVotes) * 100).toFixed(1)}'i
            </p>
          </div>
        </div>
      )}

      {/* Bar chart */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-5">Oy Dağılımı</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barSize={36} layout="vertical">
            <XAxis
              type="number"
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: "var(--color-foreground)", fontSize: 13 }}
              axisLine={false}
              tickLine={false}
              width={100}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                color: "var(--color-foreground)",
                fontSize: "12px",
              }}
              cursor={{ fill: "var(--color-muted)" }}
            />
            <Bar dataKey="votes" radius={[0, 4, 4, 0]}>
              {chartData.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Result rows */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Tüm Seçenekler</h2>
        </div>
        <div className="divide-y divide-border">
          {results.map((result: any, index: number) => {
            const pct = totalVotes > 0 ? ((result.votes / totalVotes) * 100).toFixed(1) : "0.0"
            const isWinner = winner && result.option === winner.option && result.votes > 0
            return (
              <div key={result.option} className="px-5 py-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs text-muted-foreground w-4 text-center font-mono">
                      #{index + 1}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isWinner ? "text-primary font-semibold" : "text-foreground"
                      )}
                    >
                      {result.option}
                    </span>
                    {isWinner && (
                      <Trophy className="w-3.5 h-3.5 text-primary" />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {result.votes.toLocaleString()} oy
                    </span>
                    <span
                      className="text-sm font-bold w-12 text-right"
                      style={{ color: result.color }}
                    >
                      {pct}%
                    </span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      background: result.color,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
