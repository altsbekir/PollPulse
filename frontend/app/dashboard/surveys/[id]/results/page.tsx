"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  ArrowLeft,
  BarChart3,
  Loader2,
  MessageSquare,
  Shield,
  ShieldOff,
  Users,
} from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import { api } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type QuestionType = "MULTIPLE_CHOICE" | "OPEN_ENDED" | "CHOICE_WITH_OTHER"

interface ChartPoint {
  id: number
  name: string
  value: number
}

interface OptionResult {
  id: number
  text: string
  count: number
}

interface Respondent {
  name?: string | null
  email: string
}

interface AnswerDetail {
  respondent: Respondent
  option_id?: number | null
  option_text?: string | null
  answer_text?: string | null
}

interface QuestionResult {
  id: number
  text: string
  question_type: QuestionType
  total_answers: number
  options: OptionResult[]
  open_texts: string[]
  chart_series: ChartPoint[]
  answer_details: AnswerDetail[]
  gender_distribution?: { name: string; value: number }[]
}

interface SurveyResultsPayload {
  survey_id: number
  title: string
  is_anonymous: boolean
  total_participants: number
  questions: QuestionResult[]
}

const PIE_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#3b82f6",
  "#06b6d4",
  "#eab308",
  "#10b981",
  "#f43f5e",
  "#a855f7",
]

function chartDataFromQuestion(q: QuestionResult): ChartPoint[] {
  if (q.chart_series?.length) return q.chart_series
  return (q.options ?? []).map((o) => ({
    id: o.id,
    name: o.text,
    value: o.count,
  }))
}

function SurveyResultsContent() {
  const params = useParams()
  const id = params.id as string

  const [data, setData] = useState<SurveyResultsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError("")
      try {
        const res = await api.get<SurveyResultsPayload>(`/api/surveys/${id}/results`)
        setData(res.data)
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number; data?: { detail?: string } } }).response?.status
        const detail = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
        if (status === 403) {
          setError(detail || "You do not have permission to view these results.")
        } else if (status === 404) {
          setError("Survey not found.")
        } else if (status === 401) {
          setError("Please sign in to view survey results.")
        } else {
          setError(detail || "Could not load results.")
        }
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary/70" />
        <p className="text-sm font-medium">Loading survey results…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-xl border border-border bg-card/50 p-8 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button asChild variant="outline" className="rounded-lg">
          <Link href="/pollster">Kontrol Paneline Dön</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <Button variant="ghost" size="sm" className="w-fit gap-2 text-muted-foreground hover:text-foreground -ml-2" asChild>
          <Link href="/pollster">
            <ArrowLeft className="h-4 w-4" />
            Kontrol Paneline Dön
          </Link>
        </Button>
      </div>

      <header className="space-y-3 border-b border-border pb-8">
        <div className="flex flex-wrap items-center gap-2">
          {data.is_anonymous ? (
            <Badge variant="secondary" className="gap-1 rounded-md border border-border bg-muted/60 font-normal text-muted-foreground">
              <Shield className="h-3 w-3" />
              Anonymous responses
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1 rounded-md border border-border bg-muted/60 font-normal text-muted-foreground">
              <ShieldOff className="h-3 w-3" />
              Kimliği Belirli Yanıtlar
            </Badge>
          )}
        </div>
        <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{data.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-foreground">
            <Users className="h-4 w-4 text-primary" />
            Toplam Yanıt:{" "}
            <span className="tabular-nums text-foreground">{data.total_participants}</span>
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-8">
        {data.questions.map((q, index) => (
          <QuestionAnalysisCard
            key={q.id}
            index={index}
            question={q}
            surveyAnonymous={data.is_anonymous}
          />
        ))}
      </div>

      {data.questions.length === 0 && (
        <Card className="border-dashed border-border bg-muted/20">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">No questions in this survey.</CardContent>
        </Card>
      )}
    </div>
  )
}

function QuestionAnalysisCard({
  question: q,
  index,
  surveyAnonymous,
}: {
  question: QuestionResult
  index: number
  surveyAnonymous: boolean
}) {
  const chartData = useMemo(() => chartDataFromQuestion(q), [q])
  const isChoice =
    q.question_type === "MULTIPLE_CHOICE" || q.question_type === "CHOICE_WITH_OTHER"
  const isOpen = q.question_type === "OPEN_ENDED"
  const hasWritten =
    (q.open_texts?.length ?? 0) > 0 ||
    q.answer_details?.some((d) => (d.answer_text ?? "").trim().length > 0)

  const pieData = useMemo(
    () =>
      chartData.map((d, i) => ({
        name: d.name,
        value: d.value,
        fill: PIE_COLORS[i % PIE_COLORS.length],
      })),
    [chartData],
  )

  return (
    <Card className="overflow-hidden border-border bg-card shadow-sm">
      <CardHeader className="space-y-2 border-b border-border bg-muted/15 px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-sm font-semibold text-primary">
            {index + 1}
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg font-semibold leading-snug text-foreground">{q.text}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
              <span className="rounded-md bg-muted/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                {q.question_type === "MULTIPLE_CHOICE" ? "ÇOKTAN SEÇMELİ" : q.question_type === "OPEN_ENDED" ? "AÇIK UÇLU" : q.question_type.replace(/_/g, " ")}
              </span>
              <span className="text-muted-foreground">
                {q.total_answers} yanıt
              </span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-8 px-5 py-6 sm:px-6">
        {isChoice && chartData.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <BarChart3 className="h-4 w-4 text-primary" />
              Cinsiyet Dağılımı
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="h-[280px] w-full min-w-0 rounded-xl border border-border/80 bg-muted/10 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                  >
                    <XAxis type="number" hide={false} tick={{ fill: '#A1A1AA' }} fontSize={11} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tick={{ fill: '#A1A1AA' }}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted) / 0.25)" }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                        fontSize: "12px",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {chartData.map((_, i) => (
                        <Cell key={chartData[i].id} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="h-[280px] w-full min-w-0 rounded-xl border border-border/80 bg-muted/10 p-2 flex items-center justify-center">
                {(() => {
                  const genderRaw = (q as any).gender_distribution ?? [];
                  const mapColor = (name: string) => {
                    const n = (name || "").toString().toLowerCase();
                    if (["erkek", "male"].includes(n)) return "#3B82F6";
                    if (["kadın", "kadin", "female", "woman"].includes(n)) return "#EC4899";
                    return "#6B7280";
                  };
                  const genderData = (genderRaw as any[]).map((g) => ({ ...g, fill: mapColor(g.name) }));

                  if (!genderData || genderData.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center h-full w-full">
                        <p className="text-sm text-muted-foreground">Cinsiyet verisi bekleniyor</p>
                      </div>
                    );
                  }

                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={genderData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={88}
                          paddingAngle={2}
                        >
                          {genderData.map((entry: any, i: number) => (
                            <Cell key={`cell-${entry.name}-${i}`} fill={entry.fill} stroke="hsl(var(--background))" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "0.5rem",
                            fontSize: "12px",
                          }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                          formatter={(value) => <span className="text-muted-foreground">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </div>

            {!surveyAnonymous && q.answer_details.filter((d) => d.option_id != null).length > 0 && (
              <>
                <Separator className="bg-border" />
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">SEÇİME GÖRE YANITLAYANLAR</p>
                  <ul className="space-y-2">
                    {q.answer_details
                      .filter((d) => d.option_id != null)
                      .map((row, i) => (
                        <li
                          key={`${row.respondent.email}-${row.option_id}-${i}`}
                          className="flex flex-col gap-0.5 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="font-medium text-foreground">{row.option_text ?? "—"}</span>
                          <span className="text-xs text-muted-foreground">
                            <span className="text-foreground/90">{row.respondent.name?.trim() || "Participant"}</span>
                            <span className="mx-1.5 text-border">·</span>
                            <span className="tabular-nums">{row.respondent.email}</span>
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

        {(isOpen || (isChoice && hasWritten)) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <MessageSquare className="h-4 w-4 text-primary" />
              {isOpen ? "Text responses" : "Written responses"}
            </div>
            <OpenResponsesList question={q} surveyAnonymous={surveyAnonymous} />
          </div>
        )}

        {!isChoice && !isOpen && (
          <p className="text-sm text-muted-foreground">Unsupported question type for this view.</p>
        )}
      </CardContent>
    </Card>
  )
}

function OpenResponsesList({
  question: q,
  surveyAnonymous,
}: {
  question: QuestionResult
  surveyAnonymous: boolean
}) {
  const textRows = useMemo(() => {
    const details = q.answer_details ?? []
    const withText = details.filter((d) => (d.answer_text ?? "").trim().length > 0)
    if (!surveyAnonymous && withText.length > 0) {
      return withText.map((d, i) => ({
        key: `${d.respondent.email}-${i}`,
        text: d.answer_text!.trim(),
        respondent: d.respondent,
      }))
    }
    return (q.open_texts ?? []).map((text, i) => ({
      key: `anon-${i}`,
      text,
      respondent: null as Respondent | null,
    }))
  }, [q.answer_details, q.open_texts, surveyAnonymous])

  if (textRows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
        No written responses yet.
      </p>
    )
  }

  return (
    <ScrollArea className="max-h-[min(420px,55vh)] rounded-xl border border-border bg-muted/10 pr-3">
      <div className="space-y-2 p-3">
        {textRows.map((row) => (
          <div
            key={row.key}
            className={cn(
              "rounded-lg border border-border/90 bg-card px-4 py-3 shadow-sm",
              "transition-colors hover:border-primary/25",
            )}
          >
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{row.text}</p>
            {row.respondent && (
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="text-foreground/80">{row.respondent.name?.trim() || "Participant"}</span>
                <span className="mx-1.5 opacity-50">·</span>
                <span className="tabular-nums">{row.respondent.email}</span>
              </p>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

export default function SurveyResultsPage() {
  return (
    <DashboardLayout role="pollster">
      <SurveyResultsContent />
    </DashboardLayout>
  )
}
