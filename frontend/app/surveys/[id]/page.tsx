"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import { ChevronLeft, Send, AlertCircle, Clock, AlertTriangle, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { api } from "@/lib/api"
import { auth } from "@/lib/firebase"
import { useAuthStore } from "@/store/authStore"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type QuestionType = "MULTIPLE_CHOICE" | "OPEN_ENDED" | "CHOICE_WITH_OTHER"

interface SurveyOption {
  id: number
  text: string
  image_url?: string | null
}

interface SurveyQuestion {
  id: number
  text: string
  question_type: QuestionType
  options: SurveyOption[]
}

interface SurveyPayload {
  id: number
  title: string
  image_url?: string | null
  is_anonymous: boolean
  questions: SurveyQuestion[]
}

/** Per-question answer while editing */
type AnswerValue =
  | { kind: "choice"; optionId: number; otherText?: string }
  | { kind: "open"; text: string }

function optionLooksLikeOther(label: string): boolean {
  const t = label.trim().toLowerCase()
  if (!t) return false
  if (t === "other" || t === "diğer" || t === "diger") return true
  if (t.startsWith("other ") || t.startsWith("other:") || t.startsWith("other(")) return true
  if (t.startsWith("diğer ") || t.startsWith("diğer:") || t.startsWith("diğer(")) return true
  if (t.startsWith("diger ") || t.startsWith("diger:") || t.startsWith("diger(")) return true
  return false
}

function getApiDetail(err: unknown): string {
  const d = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof d === "string") return d
  if (Array.isArray(d)) {
    return d
      .map((item) => (typeof item === "object" && item && "msg" in item ? String((item as { msg: string }).msg) : String(item)))
      .join(" ")
  }
  return ""
}

export default function TakeSurveyPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const user = useAuthStore((state) => state.user)

  const [survey, setSurvey] = useState<SurveyPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)

  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({})

  const setChoiceAnswer = useCallback((questionId: number, optionId: number, question: SurveyQuestion) => {
    const opt = question.options.find((o) => o.id === optionId)
    const isOther = opt ? optionLooksLikeOther(opt.text) : false
    setAnswers((prev) => {
      const prevAns = prev[questionId]
      const keepOtherDraft =
        isOther && prevAns?.kind === "choice" && prevAns.optionId === optionId
      return {
        ...prev,
        [questionId]: {
          kind: "choice",
          optionId,
          otherText: isOther ? (keepOtherDraft ? prevAns.otherText ?? "" : "") : undefined,
        },
      }
    })
  }, [])

  const setOpenAnswer = useCallback((questionId: number, text: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { kind: "open", text } }))
  }, [])

  const setOtherText = useCallback((questionId: number, text: string) => {
    setAnswers((prev) => {
      const cur = prev[questionId]
      if (cur?.kind !== "choice") return prev
      return { ...prev, [questionId]: { ...cur, otherText: text } }
    })
  }, [])

  useEffect(() => {
    const fetchSurvey = async () => {
      try {
        const res = await api.get<SurveyPayload>(`/api/surveys/${id}`)
        setSurvey(res.data)
      } catch (err: unknown) {
        if ((err as { response?: { status?: number } }).response?.status === 404) {
          setError("This survey could not be found or may have been removed.")
        } else {
          setError("Something went wrong while loading the survey.")
        }
      } finally {
        setLoading(false)
      }
    }
    void fetchSurvey()
  }, [id])

  const buildSubmissionAnswers = (): { question_id: number; option_id: number | null; answer_text: string | null }[] => {
    if (!survey?.questions) return []

    return survey.questions.map((q) => {
      const a = answers[q.id]
      if (q.question_type === "OPEN_ENDED") {
        const text = a?.kind === "open" ? a.text.trim() : ""
        return { question_id: q.id, option_id: null, answer_text: text || null }
      }

      if (q.question_type === "MULTIPLE_CHOICE") {
        const optionId = a?.kind === "choice" ? a.optionId : null
        return { question_id: q.id, option_id: optionId, answer_text: null }
      }

      // CHOICE_WITH_OTHER
      if (a?.kind !== "choice") {
        return { question_id: q.id, option_id: null, answer_text: null }
      }
      const opt = q.options.find((o) => o.id === a.optionId)
      const pickedOther = opt ? optionLooksLikeOther(opt.text) : false
      const otherText = (a.otherText ?? "").trim()
      if (pickedOther) {
        return { question_id: q.id, option_id: a.optionId, answer_text: otherText || null }
      }
      return { question_id: q.id, option_id: a.optionId, answer_text: null }
    })
  }

  const validateAnswers = (): boolean => {
    if (!survey?.questions) return false

    for (const q of survey.questions) {
      const a = answers[q.id]
      if (q.question_type === "OPEN_ENDED") {
        if (!a || a.kind !== "open" || !a.text.trim()) {
          toast.error("Please answer every question before submitting.")
          return false
        }
        continue
      }

      if (q.question_type === "MULTIPLE_CHOICE") {
        if (!a || a.kind !== "choice") {
          toast.error("Please answer every question before submitting.")
          return false
        }
        continue
      }

      // CHOICE_WITH_OTHER
      if (!a || a.kind !== "choice") {
        toast.error("Please answer every question before submitting.")
        return false
      }
      const opt = q.options.find((o) => o.id === a.optionId)
      if (!opt) {
        toast.error("Please answer every question before submitting.")
        return false
      }
      if (optionLooksLikeOther(opt.text)) {
        const t = (a.otherText ?? "").trim()
        if (!t) {
          toast.error("Please enter your custom answer for “Other”.")
          return false
        }
      }
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!survey) return

    if (!validateAnswers()) return

    if (!survey.is_anonymous) {
      if (!auth.currentUser) {
        toast.error("This survey is not anonymous. Please sign in to submit your responses.")
        return
      }
      if (!user?.uid) {
        toast.error("Your account could not be verified. Please sign in again.")
        return
      }
      try {
        await auth.currentUser.getIdToken(true)
      } catch {
        toast.error("Could not refresh your session. Please sign in again.")
        return
      }
    }

    setSubmitting(true)
    setAlreadySubmitted(false)

    const formattedAnswers = buildSubmissionAnswers()

    const payload: {
      survey_id: number
      user_id?: number | null
      answers: typeof formattedAnswers
    } = {
      survey_id: parseInt(id, 10),
      answers: formattedAnswers,
    }

    if (!survey.is_anonymous && user?.uid) {
      payload.user_id = parseInt(user.uid, 10)
    } else {
      payload.user_id = null
    }

    try {
      await api.post(`/api/surveys/${id}/submit`, payload, {
        headers: auth.currentUser
          ? { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` }
          : undefined,
      })

      toast.success("Your responses have been saved.")
      router.push("/user")
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status
      const detail = getApiDetail(err)

      if (status === 400 && detail.toLowerCase().includes("already submitted")) {
        setAlreadySubmitted(true)
        return
      }

      console.error(err)
      toast.error(detail || "We could not submit your responses. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Clock className="w-8 h-8 animate-spin text-primary opacity-50" />
          <p className="text-sm font-medium">Loading survey…</p>
        </div>
      </div>
    )
  }

  if (error || !survey) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 gap-4">
        <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-2 border border-destructive/20">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
        <p className="text-foreground font-medium text-center">{error}</p>
        <Button asChild variant="outline" className="mt-2">
          <Link href="/user">Back to home</Link>
        </Button>
      </div>
    )
  }

  if (alreadySubmitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 gap-5">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
          <CheckCircle2 className="w-7 h-7 text-primary" />
        </div>
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">You have already completed this survey</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your responses were recorded earlier. Thank you for participating—you cannot submit again for this survey.
          </p>
        </div>
        <Button asChild className="mt-2 rounded-xl">
          <Link href="/user">Back to surveys</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex justify-center p-4 sm:p-6 md:p-12">
      <div className="w-full max-w-3xl flex flex-col gap-4 sm:gap-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/user"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-11 sm:min-h-0"
          >
            <ChevronLeft className="w-4 h-4 shrink-0" />
            <span className="break-words">Back to surveys</span>
          </Link>
        </div>

        {!survey.is_anonymous && (
          <Alert
            variant="destructive"
            className="border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400"
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-amber-950 dark:text-amber-50 font-semibold">⚠️ This survey is NOT anonymous</AlertTitle>
            <AlertDescription className="text-amber-900/90 dark:text-amber-100/90">
              Your identity will be shared with the pollster.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 sm:p-6 md:p-8 bg-muted/20 border-b border-border">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground leading-snug text-balance">{survey.title}</h1>
            <p className="text-sm text-muted-foreground mt-2 font-medium">Answer the questions below to share your perspective.</p>
          </div>

          <div className="p-5 sm:p-6 md:p-8 flex flex-col gap-8 sm:gap-10">
            {survey.questions?.map((q, i) => {
              const qType = q.question_type
              const value = answers[q.id]

              return (
                <div key={q.id} className="flex flex-col gap-3 sm:gap-4">
                  <Label className="text-base sm:text-lg font-semibold text-foreground leading-relaxed flex gap-2 text-pretty">
                    <span className="text-primary shrink-0">{i + 1}.</span>
                    <span>{q.text}</span>
                  </Label>

                  {qType === "MULTIPLE_CHOICE" && (
                    <div className="flex flex-col gap-2.5 mt-1">
                      {q.options?.map((opt) => {
                        const isSelected = value?.kind === "choice" && value.optionId === opt.id
                        return (
                          <label
                            key={opt.id}
                            className={cn(
                              "flex flex-col sm:flex-row sm:items-stretch gap-3 w-full px-4 py-3.5 rounded-xl border text-sm transition-all duration-150 cursor-pointer group",
                              isSelected
                                ? "border-primary bg-primary/10 text-primary shadow-sm"
                                : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted/50",
                            )}
                          >
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div
                                className={cn(
                                  "flex items-center justify-center w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 transition-colors",
                                  isSelected ? "border-primary" : "border-muted-foreground/40 group-hover:border-primary/50",
                                )}
                              >
                                {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                              </div>
                              <input
                                type="radio"
                                name={`question-${q.id}`}
                                value={opt.id}
                                checked={isSelected}
                                onChange={() => setChoiceAnswer(q.id, opt.id, q)}
                                className="sr-only"
                              />
                              <span className="font-medium text-base select-none leading-snug break-words">{opt.text}</span>
                            </div>
                            {opt.image_url ? (
                              <div className="relative w-full sm:w-44 md:w-52 shrink-0 h-40 sm:h-36 rounded-lg overflow-hidden border border-border bg-muted">
                                <Image
                                  src={opt.image_url}
                                  alt={opt.text}
                                  fill
                                  className="object-cover"
                                  sizes="(max-width: 640px) 100vw, 208px"
                                  unoptimized
                                />
                              </div>
                            ) : null}
                          </label>
                        )
                      })}
                    </div>
                  )}

                  {qType === "CHOICE_WITH_OTHER" && (
                    <div className="flex flex-col gap-3 mt-1">
                      <div className="flex flex-col gap-2.5">
                        {q.options?.map((opt) => {
                          const isSelected = value?.kind === "choice" && value.optionId === opt.id
                          const isOther = optionLooksLikeOther(opt.text)
                          return (
                            <div key={opt.id} className="flex flex-col gap-2">
                              <label
                                className={cn(
                                  "flex flex-col sm:flex-row sm:items-stretch gap-3 w-full px-4 py-3.5 rounded-xl border text-sm transition-all duration-150 cursor-pointer group",
                                  isSelected
                                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                                    : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted/50",
                                )}
                              >
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                  <div
                                    className={cn(
                                      "flex items-center justify-center w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 transition-colors",
                                      isSelected ? "border-primary" : "border-muted-foreground/40 group-hover:border-primary/50",
                                    )}
                                  >
                                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                                  </div>
                                  <input
                                    type="radio"
                                    name={`question-${q.id}`}
                                    value={opt.id}
                                    checked={isSelected}
                                    onChange={() => setChoiceAnswer(q.id, opt.id, q)}
                                    className="sr-only"
                                  />
                                  <span className="font-medium text-base select-none leading-snug break-words">{opt.text}</span>
                                </div>
                                {opt.image_url ? (
                                  <div className="relative w-full sm:w-44 md:w-52 shrink-0 h-40 sm:h-36 rounded-lg overflow-hidden border border-border bg-muted">
                                    <Image
                                      src={opt.image_url}
                                      alt={opt.text}
                                      fill
                                      className="object-cover"
                                      sizes="(max-width: 640px) 100vw, 208px"
                                      unoptimized
                                    />
                                  </div>
                                ) : null}
                              </label>
                              {isSelected && isOther ? (
                                <Input
                                  placeholder="Please specify…"
                                  value={value?.kind === "choice" ? value.otherText ?? "" : ""}
                                  onChange={(e) => setOtherText(q.id, e.target.value)}
                                  className="h-11 rounded-xl border-border bg-background/80 text-base ml-0 sm:ml-8"
                                  autoComplete="off"
                                />
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {qType === "OPEN_ENDED" && (
                    <div className="mt-1">
                      <Textarea
                        placeholder="Type your answer here…"
                        value={value?.kind === "open" ? value.text : ""}
                        onChange={(e) => setOpenAnswer(q.id, e.target.value)}
                        className="min-h-[140px] sm:min-h-[160px] bg-card text-base p-4 resize-y border-border focus-visible:ring-primary/50 rounded-xl"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="p-5 sm:p-6 md:p-8 bg-muted/20 border-t border-border flex flex-col sm:flex-row sm:justify-end gap-3">
            <Button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-8 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl gap-2 shadow-sm"
            >
              <Send className="w-4 h-4 shrink-0" />
              {submitting ? "Submitting…" : "Submit Survey"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
