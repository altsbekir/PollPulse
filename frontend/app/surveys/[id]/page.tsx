"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ChevronLeft, Send, AlertCircle, Clock } from "lucide-react"
import Link from "next/link"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export default function TakeSurveyPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const user = useAuthStore(state => state.user)
  
  const [survey, setSurvey] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Map of question_id -> answer state
  // For MULTIPLE_CHOICE: stores option_id (number)
  // For OPEN_ENDED: stores text (string)
  // For CHOICE_WITH_OTHER: stores option_id OR { otherText: "..." }
  const [answers, setAnswers] = useState<Record<number, any>>({})

  useEffect(() => {
    const fetchSurvey = async () => {
      try {
        const res = await api.get(`/api/surveys/${id}`)
        setSurvey(res.data)
      } catch (err: any) {
        if (err.response?.status === 404) {
          setError("Bu anket bulunamadı veya silinmiş olabilir.")
        } else {
          setError("Anket yüklenirken bir hata oluştu.")
        }
      } finally {
        setLoading(false)
      }
    }
    fetchSurvey()
  }, [id])

  const handleOptionChange = (questionId: number, optionId: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: { option_id: optionId } }))
  }

  const handleTextChange = (questionId: number, text: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: { answer_text: text } }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user?.uid) {
      toast.error("Ankete katılmak için giriş yapmalısınız.")
      return
    }

    // Validate that all questions are answered
    if (!survey?.questions) return
    const unanswered = survey.questions.filter((q: any) => !answers[q.id])
    if (unanswered.length > 0) {
      toast.error("Lütfen tüm soruları yanıtlayın.")
      return
    }

    setSubmitting(true)

    try {
      // Map to backend expected format: List of { question_id, option_id, answer_text }
      const formattedAnswers = Object.entries(answers).map(([qId, ans]) => ({
        question_id: parseInt(qId),
        option_id: ans.option_id || null,
        answer_text: ans.answer_text || null,
      }))

      const payload = {
        survey_id: parseInt(id),
        user_id: parseInt(user.uid),
        answers: formattedAnswers,
      }

      await api.post(`/api/surveys/${id}/submit`, payload)
      
      toast.success("Yanıtlarınız başarıyla kaydedildi!")
      router.push("/user")
    } catch (err: any) {
      console.error(err)
      toast.error(err.response?.data?.detail || "Yanıtlar gönderilemedi.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
           <Clock className="w-8 h-8 animate-spin text-primary opacity-50" />
           <p className="text-sm font-medium">Anket yükleniyor...</p>
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
          <Link href="/user">Ana sayfaya dön</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex justify-center p-6 md:p-12">
      <div className="w-full max-w-3xl flex flex-col gap-6">
        
        {/* Header Navigation */}
        <div className="flex items-center justify-between">
          <Link href="/user" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Anketlere dön
          </Link>
        </div>

        {/* Survey Container */}
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          
          {/* Survey Header */}
          <div className="p-6 md:p-8 bg-muted/20 border-b border-border">
             <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-snug">
               {survey.title}
             </h1>
             <p className="text-sm text-muted-foreground mt-2 font-medium">
               Aşağıdaki soruları yanıtlayarak fikirlerinizi paylaşın.
             </p>
          </div>

          {/* Survey Questions */}
          <div className="p-6 md:p-8 flex flex-col gap-10">
            {survey.questions?.map((q: any, i: number) => {
              const qType = q.question_type;
              
              return (
                <div key={q.id} className="flex flex-col gap-4">
                  <Label className="text-base md:text-lg font-semibold text-foreground leading-relaxed flex gap-2">
                    <span className="text-primary">{i + 1}.</span> 
                    {q.text}
                  </Label>
                  
                  {/* MULTIPLE CHOICE RENDERING */}
                  {(qType === "MULTIPLE_CHOICE" || qType === "CHOICE_WITH_OTHER") && (
                    <div className="flex flex-col gap-2.5 mt-1">
                      {q.options?.map((opt: any) => {
                        const isSelected = answers[q.id]?.option_id === opt.id;
                        return (
                          <label
                            key={opt.id}
                            className={cn(
                              "flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border text-sm transition-all duration-150 cursor-pointer group",
                              isSelected
                                ? "border-primary bg-primary/10 text-primary shadow-sm"
                                : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted/50"
                            )}>
                            <div
                              className={cn(
                                "flex items-center justify-center w-5 h-5 rounded-full border-2 shrink-0 transition-colors",
                                isSelected ? "border-primary" : "border-muted-foreground/40 group-hover:border-primary/50"
                              )}
                            >
                              {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                            </div>
                            
                            <input
                              type="radio"
                              name={`question-${q.id}`}
                              value={opt.id}
                              checked={isSelected}
                              onChange={() => handleOptionChange(q.id, opt.id)}
                              className="hidden"
                            />
                            <span className="font-medium text-base select-none">{opt.text}</span>
                          </label>
                        )
                      })}
                    </div>
                  )}

                  {/* OPEN ENDED RENDERING */}
                  {qType === "OPEN_ENDED" && (
                     <div className="mt-1">
                       <Textarea 
                         placeholder="Yanıtınızı buraya yazın..."
                         value={answers[q.id]?.answer_text || ""}
                         onChange={(e) => handleTextChange(q.id, e.target.value)}
                         className="min-h-[120px] bg-card text-base p-4 resize-y border-border focus-visible:ring-primary/50"
                       />
                     </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Survey Footer */}
          <div className="p-6 md:p-8 bg-muted/20 border-t border-border flex justify-end">
             <Button
               type="submit"
               disabled={submitting}
               className="w-full sm:w-auto px-8 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl gap-2 shadow-sm"
             >
               <Send className="w-4 h-4" />
               {submitting ? "Gönderiliyor..." : "Yanıtları Gönder"}
             </Button>
          </div>
        </form>

      </div>
    </div>
  )
}
