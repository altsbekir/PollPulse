"use client"

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

const pollData = {
  question: "Best programming language in 2026?",
  totalVotes: 1248,
  closedAt: "March 28, 2026",
  results: [
    { option: "TypeScript", votes: 498, color: "#6366f1" },
    { option: "Python", votes: 374, color: "#8b5cf6" },
    { option: "Rust", votes: 249, color: "#3b82f6" },
    { option: "Go", votes: 127, color: "#06b6d4" },
  ],
}

export default function PollResultsView() {
  const pathname = usePathname()
  const backHref = pathname.startsWith("/pollster") ? "/pollster" : "/user"

  const maxVotes = Math.max(...pollData.results.map((r) => r.votes))
  const winner = pollData.results.find((r) => r.votes === maxVotes)!

  const chartData = pollData.results.map((r) => ({
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
        Back to Dashboard
      </Link>

      {/* Poll question */}
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-primary uppercase tracking-wider">
            Poll Results
          </span>
        </div>
        <h1 className="text-xl font-bold text-foreground text-balance leading-snug">
          {pollData.question}
        </h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {pollData.totalVotes.toLocaleString()} total votes
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span>Closed {pollData.closedAt}</span>
        </div>
      </div>

      {/* Winner highlight */}
      <div className="flex items-center gap-4 bg-primary/10 border border-primary/30 rounded-xl px-5 py-4">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
          <Trophy className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-primary font-medium uppercase tracking-wider">Top Answer</p>
          <p className="text-base font-bold text-foreground mt-0.5">{winner.option}</p>
          <p className="text-sm text-muted-foreground">
            {winner.votes.toLocaleString()} votes ·{" "}
            {((winner.votes / pollData.totalVotes) * 100).toFixed(1)}% of total
          </p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-5">Vote Breakdown</h2>
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
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Result rows */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">All Options</h2>
        </div>
        <div className="divide-y divide-border">
          {pollData.results.map((result, index) => {
            const pct = ((result.votes / pollData.totalVotes) * 100).toFixed(1)
            const isWinner = result.option === winner.option
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
                      {result.votes.toLocaleString()} votes
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
