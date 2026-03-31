"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import { PlusCircle, BarChart3, Users, Activity, ArrowUpRight, CheckCircle2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const PIE_COLORS = ["#6366f1", "#8b5cf6", "#3b82f6", "#06b6d4"]





export default function PollsterDashboard() {
  const [polls, setPolls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [statsData, setStatsData] = useState<any>(null)
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null)

  useEffect(() => {
    const fetchPolls = async () => {
      try {
        const userStr = localStorage.getItem("user")
        if (!userStr) {
          setLoading(false)
          return
        }
        const user = JSON.parse(userStr)

        const [pollsRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/api/polls/${user.id}`),
          fetch(`${API_URL}/api/pollster/stats/${user.id}`),
        ])

        if (!pollsRes.ok) {
          throw new Error("Anketler alınamadı")
        }

        const data = await pollsRes.json()
        setPolls(data)

        if (statsRes.ok) {
          const stats = await statsRes.json()
          setStatsData(stats)
          if (stats.polls_list?.length) {
            setSelectedPollId(String(stats.polls_list[0].id))
          }
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchPolls()
  }, [])

  const realTotalPolls = polls.length;
  const realTotalVotes = polls.reduce((sum, poll) => {
    const pollVotes = poll.options?.reduce((acc: number, opt: any) => acc + opt.votes, 0) || 0;
    return sum + pollVotes;
  }, 0);

  const DAY_NAMES = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"]
  const dynamicBarData = statsData?.weekly_votes
    ? (statsData.weekly_votes as number[]).map((votes, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        return { name: DAY_NAMES[d.getDay()], votes }
      })
    : Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        return { name: DAY_NAMES[d.getDay()], votes: 0 }
      })

  const dynamicStats = [
    { label: "Toplam Anket", value: realTotalPolls.toString(), icon: BarChart3, change: "Tüm zamanlar" },
    { label: "Toplam Oy", value: realTotalVotes.toLocaleString("tr-TR"), icon: Activity, change: "Tüm zamanlar" },
    { label: "Aktif Kullanıcı", value: (statsData?.total_voters ?? 0).toLocaleString("tr-TR"), icon: Users, change: "Tüm anketlerden" },
  ];

  const selectedPoll = statsData?.polls_list?.find((p: any) => String(p.id) === selectedPollId)
  const dynamicPieData = selectedPoll?.options?.length
    ? selectedPoll.options
    : [{ name: "Veri yok", value: 1 }];

  const handleCopy = (id: number) => {
    navigator.clipboard.writeText(window.location.origin + '/anket/' + id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="p-6 md:p-8 flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground text-balance">Anketör Paneli</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Anketlerinizin ve etkileşimlerin genel görünümü
          </p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 rounded-lg w-full sm:w-auto">
          <Link href="/pollster/create">
            <PlusCircle className="w-4 h-4" />
            Anket Oluştur
          </Link>
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {dynamicStats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground font-medium">{stat.label}</span>
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-foreground">{stat.value}</div>
              <div className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                <ArrowUpRight className="w-3.5 h-3.5" />
                {stat.change}
              </div>
            </div>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Bu Haftanın Oyları</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dynamicBarData} barSize={28}>
              <XAxis
                dataKey="name"
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={36}
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
              <Bar dataKey="votes" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-semibold text-foreground shrink-0">Yanıt Dağılımı</h2>
            {statsData?.polls_list?.length > 0 && (
              <Select value={selectedPollId ?? ""} onValueChange={setSelectedPollId}>
                <SelectTrigger
                  size="sm"
                  className="h-7 max-w-[160px] text-xs border-border bg-muted/30 hover:bg-muted/50 text-muted-foreground"
                >
                  <SelectValue placeholder="Anket seçin" />
                </SelectTrigger>
                <SelectContent align="end">
                  {statsData.polls_list.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)} className="text-xs">
                      {p.question.length > 32 ? p.question.slice(0, 32) + "…" : p.question}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={dynamicPieData}
                cx="50%"
                cy="45%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {dynamicPieData.map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span style={{ color: "var(--color-muted-foreground)", fontSize: "11px" }}>
                    {value}
                  </span>
                )}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  color: "var(--color-foreground)",
                  fontSize: "12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Polls */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Son Anketler</h2>
          <Link
            href="/pollster/results"
            className="text-xs text-primary hover:underline font-medium"
          >
            Tümünü gör
          </Link>
        </div>
        <div className="divide-y divide-border">
          {loading && <p className="p-5 text-sm text-muted-foreground">Yükleniyor...</p>}
          {error && <p className="p-5 text-sm text-destructive">{error}</p>}
          {!loading && !error && polls.length === 0 && (
            <p className="p-5 text-sm text-muted-foreground">Henüz anket oluşturmadınız.</p>
          )}
          {!loading && !error && polls.map((poll) => {
            const totalVotes = poll.options?.reduce((sum: number, opt: any) => sum + opt.votes, 0) || 0;
            const dateStr = new Date(poll.created_at).toLocaleDateString("tr-TR");
            // Placeholder status mapping logic can be expanded in the future
            const status = "aktif";
            
            return (
            <div
              key={poll.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0">
                  {status === "aktif" ? (
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{poll.question}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {dateStr}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 sm:shrink-0 pl-5 sm:pl-0">
                <span className="text-sm font-semibold text-foreground">
                  {totalVotes.toLocaleString()}
                  <span className="text-xs font-normal text-muted-foreground ml-1">oy</span>
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    status === "aktif"
                      ? "bg-green-400/15 text-green-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {status}
                </span>
                <button
                  onClick={() => handleCopy(poll.id)}
                  className="text-xs px-2.5 py-1 rounded-md bg-secondary/50 text-secondary-foreground hover:bg-secondary transition-colors font-medium border border-border"
                >
                  {copiedId === poll.id ? "✅ Kopyalandı!" : "🔗 Linki Kopyala"}
                </button>
                <Link
                  href={`/pollster/results?poll=${poll.id}`}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Görüntüle
                </Link>
              </div>
            </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
