"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PlusCircle, Trash2, Sparkles, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export default function CreatePollForm() {
  const router = useRouter()
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState(["", ""])
  const [visibility, setVisibility] = useState("public")
  const [duration, setDuration] = useState("unlimited")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [aiTopic, setAiTopic] = useState("")
  const [aiError, setAiError] = useState("")

  const addOption = () => {
    if (options.length < 6) setOptions([...options, ""])
  }

  const removeOption = (index: number) => {
    if (options.length <= 2) return
    setOptions(options.filter((_, i) => i !== index))
  }

  const updateOption = (index: number, value: string) => {
    const updated = [...options]
    updated[index] = value
    setOptions(updated)
  }

  const generateFromAI = async () => {
    if (!aiTopic.trim()) return
    setIsGenerating(true)
    setAiError("")
    try {
      const res = await fetch(`${API_URL}/api/generate-ai-poll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: aiTopic.trim() }),
      })
      if (!res.ok) throw new Error("AI yanıt vermedi")
      const data = await res.json()
      setQuestion(data.question ?? "")
      if (Array.isArray(data.options) && data.options.length >= 2) {
        setOptions(data.options)
      }
    } catch (err: any) {
      setAiError("Taslak oluşturulamadı. Lütfen tekrar deneyin.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const userStr = localStorage.getItem("user")
      if (!userStr) {
        throw new Error("Kullanıcı bulunamadı")
      }
      const user = JSON.parse(userStr)

      console.log("DEBUG PAYLOAD:", { question, visibility, duration });

      const payload = {
        question,
        options: options.filter(o => o.trim().length > 0).map(o => ({ text: o })),
        creator_id: user.id,
        visibility: visibility,
        duration: duration
      }

      const res = await fetch(`${API_URL}/api/polls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        throw new Error("Anket oluşturulamadı")
      }

      setQuestion("")
      setOptions(["", ""])
      router.push("/pollster")
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const filledOptions = options.filter((o) => o.trim().length > 0)
  const isValid = question.trim().length > 0 && filledOptions.length >= 2

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground text-balance">Yeni Anket Oluştur</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sorunuzu ekleyin, seçenekleri belirleyin veya yapay zekânın sizin için oluşturmasını sağlayın.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* AI Assistant Panel */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-4 h-4 text-primary" />
            <Label className="text-sm font-semibold text-foreground">AI Asistanı</Label>
            <span className="text-xs text-muted-foreground">— Konu girin, soru ve seçenekler otomatik hazırlansın</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), generateFromAI())}
              placeholder='Örn: "Yapay Zeka ve İş Dünyası", "Uzaktan Çalışma"'
              className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-10 flex-1"
            />
            <Button
              type="button"
              onClick={generateFromAI}
              disabled={isGenerating || !aiTopic.trim()}
              className="gap-1.5 h-10 px-4 shrink-0 w-full sm:w-auto bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 hover:border-primary/50"
              variant="outline"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? "animate-pulse" : ""}`} />
              {isGenerating ? "AI Düşünüyor..." : "Taslak Hazırla"}
            </Button>
          </div>
          {aiError && (
            <p className="text-xs text-destructive">{aiError}</p>
          )}
        </div>

        {/* Question */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <Label className="text-sm font-semibold text-foreground">Anket Sorusu</Label>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ne sormak istiyorsunuz?"
            required
            className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-11 text-base"
          />
        </div>

        {/* Options */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <Label className="text-sm font-semibold text-foreground">
            Yanıt Seçenekleri
            <span className="ml-2 text-xs text-muted-foreground font-normal">
              (en az 2, en fazla 6)
            </span>
          </Label>

          <div className="flex flex-col gap-2.5">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/15 text-primary text-xs font-bold shrink-0">
                  {String.fromCharCode(65 + i)}
                </div>
                <Input
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Seçenek ${String.fromCharCode(65 + i)}`}
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-10 flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  disabled={options.length <= 2}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Seçeneği kaldır"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {options.length < 6 && (
            <button
              type="button"
              onClick={addOption}
              className="flex items-center gap-2 w-full mt-1 px-3 py-2.5 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Seçenek Ekle
            </button>
          )}
        </div>

        {/* Settings row */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
          <Label className="text-sm font-semibold text-foreground">Ayarlar</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Görünürlük</Label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="h-9 rounded-lg border border-border bg-input text-foreground text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="public">Herkese Açık</option>
                <option value="private">Gizli</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Süre</Label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="h-9 rounded-lg border border-border bg-input text-foreground text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="unlimited">Süresiz</option>
                <option value="24h">24 saat</option>
                <option value="3d">3 gün</option>
                <option value="7d">7 gün</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg gap-2 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {isSubmitting ? "Anket Yayınlanıyor..." : "Anketi Yayınla"}
        </Button>
      </form>
    </div>
  )
}
