"use client"

import { useState } from "react"
import Link from "next/link"
import { Flame, CheckCircle2, Clock, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const polls = [
  {
    id: "1",
    title: "Best programming language in 2026?",
    description: "Vote for your favourite language to work with this year.",
    options: ["Python", "TypeScript", "Rust", "Go"],
    totalVotes: 1248,
    closesIn: "2 days",
    tag: "Tech",
  },
  {
    id: "2",
    title: "Preferred remote work setup?",
    description: "How do you best like to structure your remote work day?",
    options: ["Full remote", "Hybrid", "Co-working space", "Home office"],
    totalVotes: 867,
    closesIn: "5 days",
    tag: "Lifestyle",
  },
  {
    id: "3",
    title: "Most used AI tools this year?",
    description: "Which AI assistant do you rely on most in your daily workflow?",
    options: ["ChatGPT", "Claude", "Gemini", "GitHub Copilot"],
    totalVotes: 556,
    closesIn: "1 day",
    tag: "AI",
  },
  {
    id: "4",
    title: "Favorite frontend framework?",
    description: "Cast your vote for the framework you love building with.",
    options: ["React", "Vue", "Svelte", "Angular"],
    totalVotes: 2341,
    closesIn: "Closed",
    tag: "Tech",
  },
]

const TAG_COLORS: Record<string, string> = {
  Tech: "bg-blue-500/15 text-blue-400",
  Lifestyle: "bg-purple-500/15 text-purple-400",
  AI: "bg-cyan-500/15 text-cyan-400",
}

export default function UserDashboard() {
  const [voted, setVoted] = useState<Record<string, string>>({})

  const vote = (pollId: string, option: string) => {
    if (voted[pollId]) return
    setVoted((prev) => ({ ...prev, [pollId]: option }))
  }

  const streakDays = 5

  return (
    <div className="p-6 md:p-8 flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground text-balance">Your Poll Feed</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Discover and vote on trending polls
          </p>
        </div>

        {/* Streak Badge */}
        <div className="shrink-0 flex items-center gap-2 bg-orange-500/15 border border-orange-500/30 px-4 py-2 rounded-xl">
          <Flame className="w-5 h-5 text-orange-400" />
          <div>
            <p className="text-sm font-bold text-orange-400">{streakDays} Day Streak</p>
            <p className="text-xs text-orange-400/70">Keep it going!</p>
          </div>
        </div>
      </div>

      {/* Poll Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {polls.map((poll) => {
          const hasVoted = !!voted[poll.id]
          const votedOption = voted[poll.id]
          const isClosed = poll.closesIn === "Closed"

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
                        TAG_COLORS[poll.tag] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {poll.tag}
                    </span>
                    {isClosed ? (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Closed
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Closes in {poll.closesIn}
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-semibold text-foreground text-balance leading-snug">
                    {poll.title}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {poll.description}
                  </p>
                </div>
              </div>

              {/* Options */}
              <div className="flex flex-col gap-2">
                {poll.options.map((opt) => {
                  const isSelected = votedOption === opt
                  return (
                    <button
                      key={opt}
                      onClick={() => vote(poll.id, opt)}
                      disabled={hasVoted || isClosed}
                      className={cn(
                        "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border text-sm font-medium text-left transition-all duration-150",
                        isSelected
                          ? "border-primary bg-primary/15 text-primary"
                          : hasVoted || isClosed
                          ? "border-border bg-muted/30 text-muted-foreground cursor-not-allowed"
                          : "border-border bg-muted/20 text-foreground hover:border-primary/60 hover:bg-primary/8"
                      )}
                    >
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
                      {opt}
                    </button>
                  )
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">
                  {poll.totalVotes.toLocaleString()} votes
                </span>
                {hasVoted && (
                  <Link
                    href={`/user/results?poll=${poll.id}`}
                    className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                  >
                    See results
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
