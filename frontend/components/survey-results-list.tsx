"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Clock } from "lucide-react"
import { useAuthStore } from "@/store/authStore"
import { api } from "@/lib/api"

export default function SurveyResultsList() {
  const pathname = usePathname()
  const isPollster = pathname.startsWith("/pollster")
  const user = useAuthStore((s) => s.user)

  const [surveys, setSurveys] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const fetchSurveys = async () => {
      try {
        if (!user?.uid) {
          setLoading(false)
          return
        }

        const endpoint = isPollster ? `/api/surveys/user/${user.uid}` : `/api/users/${user.uid}/voted-polls`
        const res = await api.get(endpoint)
        setSurveys(res.data ?? [])
      } catch (err: any) {
        console.error("Anketler getirilemedi", err)
        setError(err.response?.data?.detail || err.message || "Anketler getirilemedi")
      } finally {
        setLoading(false)
      }
    }

    void fetchSurveys()
  }, [isPollster, user])

  if (loading) return <div className="p-8 text-center text-muted-foreground text-sm">Yükleniyor...</div>

  if (!surveys || surveys.length === 0) {
    const emptyMsg = isPollster ? "Henüz anket/sonuç bulunmuyor." : "Henüz hiçbir ankete oy vermediniz."
    return <div className="p-8 text-center text-muted-foreground text-sm">{emptyMsg}</div>
  }

  return (
    <div className="p-6 md:p-8 flex flex-col gap-8 max-w-3xl mx-auto">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Son Anketler</h2>
          <Link href={isPollster ? "/pollster/results" : "/user/results"} className="text-xs text-primary hover:underline font-medium">Tümünü gör</Link>
        </div>
        <div className="divide-y divide-border">
          {surveys.map((survey) => {
            const dateStr = survey.created_at ? new Date(survey.created_at).toLocaleDateString("tr-TR") : ""
            const status = "aktif"

            return (
              <div key={survey.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0">
                    {status === "aktif" ? <div className="w-2 h-2 rounded-full bg-green-400" /> : <div className="w-2 h-2 rounded-full bg-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{survey.title ?? survey.question ?? survey.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {dateStr}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 sm:shrink-0 pl-5 sm:pl-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status === "aktif" ? "bg-green-400/15 text-green-400" : "bg-muted text-muted-foreground"}`}>
                    {status}
                  </span>

                  <Link href={`/dashboard/surveys/${survey.id}/results`} className="text-xs text-primary hover:underline font-medium">Görüntüle</Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
