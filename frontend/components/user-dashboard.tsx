"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Clock, ChevronRight, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"

const TAG_COLORS: Record<string, string> = {
  Teknoloji: "bg-blue-500/15 text-blue-400",
  "Yaşam Tarzı": "bg-purple-500/15 text-purple-400",
  "Yapay Zekâ": "bg-cyan-500/15 text-cyan-400",
}

export default function UserDashboard() {
  const [surveys, setSurveys] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const fetchSurveys = async () => {
      try {
        const res = await api.get('/api/surveys')
        setSurveys(res.data)
      } catch (err: any) {
        setError(err.response?.data?.detail || err.message || "Anketler getirilemedi")
      } finally {
        setLoading(false)
      }
    }
    fetchSurveys()
  }, [])

  return (
    <div className="p-6 md:p-8 flex flex-col gap-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground text-balance">Mevcut Anketler</h1>
          <p className="text-sm text-muted-foreground mt-1">
            İlginizi çeken anketlere katılın ve fikirlerinizi paylaşın.
          </p>
        </div>
      </div>

      {/* Poll Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {loading && (
          <div className="col-span-1 md:col-span-2 p-12 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <Clock className="w-8 h-8 animate-spin text-primary opacity-50" />
            <p className="text-sm font-medium">Anketler yükleniyor...</p>
          </div>
        )}
        
        {error && (
          <div className="col-span-1 md:col-span-2 p-8 text-center bg-destructive/10 rounded-xl border border-destructive/20 text-destructive">
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}
        
        {!loading && !error && surveys.length === 0 && (
           <div className="col-span-1 md:col-span-2 p-12 flex flex-col items-center justify-center gap-4 text-center rounded-xl border border-border bg-card">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
                <ClipboardList className="w-6 h-6 text-muted-foreground" />
              </div>
             <h3 className="text-lg font-semibold text-foreground">Henüz anket bulunmuyor</h3>
             <p className="text-sm text-muted-foreground">Aktif bir anket yayınlandığında burada görünecektir.</p>
           </div>
        )}
        
        {!loading && !error && surveys.map((survey) => {
          const dateStr = new Date(survey.created_at).toLocaleDateString("tr-TR", { month: "short", day: "numeric", year: "numeric" })
          
          return (
            <div
              key={survey.id}
              className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 hover:border-primary/50 hover:bg-card/80 transition-all shadow-sm flex-1 group"
            >
              {/* Poll header */}
              <div className="flex flex-col flex-1 gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold",
                      TAG_COLORS["Teknoloji"]
                    )}
                  >
                    Genel Anket
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3" />
                    {dateStr}
                  </span>
                </div>
                
                <h2 className="text-lg font-bold text-foreground text-balance leading-snug line-clamp-3">
                  {survey.title}
                </h2>
                
                <p className="text-xs text-muted-foreground font-medium mt-auto">
                  Tarafından: Topluluk Anketi
                </p>
              </div>

              {/* Action Button */}
              <div className="pt-2 border-t border-border mt-auto">
                 <Button asChild className="w-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground group-hover:scale-[1.01] transition-all font-semibold rounded-lg">
                    <Link href={`/surveys/${survey.id}`}>
                      Ankete Katıl <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                 </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

