"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { PlusCircle, Trash2, Sparkles, Send, Image as ImageIcon, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { toast } from "sonner"
import { storage } from "@/lib/firebase"
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { cn } from "@/lib/utils"

type QuestionType = "MULTIPLE_CHOICE" | "CHOICE_WITH_OTHER" | "OPEN_ENDED"

interface OptionBlock {
  text: string
  image_url?: string
  isUploading?: boolean
}

interface QuestionBlock {
  id: string
  text: string
  type: QuestionType
  options: OptionBlock[]
}

export default function CreatePollForm() {
  const router = useRouter()
  const user = useAuthStore(state => state.user)
  
  const [title, setTitle] = useState("")
  const [questions, setQuestions] = useState<QuestionBlock[]>([
    { id: "1", text: "", type: "MULTIPLE_CHOICE", options: [{ text: "" }, { text: "" }] }
  ])
  
  const [visibility, setVisibility] = useState("public")
  const [duration, setDuration] = useState("unlimited")
  const [isAnonymous, setIsAnonymous] = useState(false)
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [aiTopic, setAiTopic] = useState("")
  const [aiError, setAiError] = useState("")

  // Storage
  const [imageUrl, setImageUrl] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    const storageRef = ref(storage, `survey-images/${Date.now()}-${file.name}`)
    const uploadTask = uploadBytesResumable(storageRef, file)

    uploadTask.on(
      "state_changed",
      null,
      (error) => {
        toast.error("Görsel yüklenemedi.")
        setIsUploading(false)
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          setImageUrl(downloadURL)
          setIsUploading(false)
          toast.success("Kapak görseli yüklendi!")
        })
      }
    )
  }

  // --- Array Handlers ---
  const addQuestion = () => {
    setQuestions([
      ...questions,
      { id: Date.now().toString(), text: "", type: "MULTIPLE_CHOICE", options: [{ text: "" }, { text: "" }] }
    ])
  }

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) return
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const updateQuestionText = (index: number, text: string) => {
    const updated = [...questions]
    updated[index].text = text
    setQuestions(updated)
  }

  const updateQuestionType = (index: number, type: QuestionType) => {
    const updated = [...questions]
    updated[index].type = type
    setQuestions(updated)
  }

  const addOption = (qIndex: number) => {
    const updated = [...questions]
    if (updated[qIndex].options.length < 6) {
      updated[qIndex].options.push({ text: "" })
      setQuestions(updated)
    }
  }

  const removeOption = (qIndex: number, optIndex: number) => {
    const updated = [...questions]
    if (updated[qIndex].options.length <= 2) return
    updated[qIndex].options = updated[qIndex].options.filter((_, i) => i !== optIndex)
    setQuestions(updated)
  }

  const updateOptionText = (qIndex: number, optIndex: number, value: string) => {
    const updated = [...questions]
    updated[qIndex].options[optIndex].text = value
    setQuestions(updated)
  }

  const handleOptionImageUpload = (qIndex: number, optIndex: number, file: File) => {
    const updated = [...questions]
    updated[qIndex].options[optIndex].isUploading = true
    setQuestions(updated)

    const storageRef = ref(storage, `option-images/${Date.now()}-${file.name}`)
    const uploadTask = uploadBytesResumable(storageRef, file)

    uploadTask.on(
      "state_changed",
      null,
      (error) => {
        toast.error("Seçenek görseli yüklenemedi.")
        const failedUpdate = [...questions]
        failedUpdate[qIndex].options[optIndex].isUploading = false
        setQuestions(failedUpdate)
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          const successUpdate = [...questions]
          successUpdate[qIndex].options[optIndex].image_url = downloadURL
          successUpdate[qIndex].options[optIndex].isUploading = false
          setQuestions(successUpdate)
        })
      }
    )
  }

  const generateFromAI = async () => {
    if (!aiTopic.trim()) return
    setIsGenerating(true)
    setAiError("")
    try {
      const response = await api.post('/api/generate-ai-poll', { topic: aiTopic.trim() })
      const data = response.data
      
      if (data.title) setTitle(data.title)
      
      if (data.questions && data.questions.length > 0) {
        const generatedQs = data.questions.map((q: any, i: number) => ({
          id: Date.now().toString() + i,
          text: q.text,
          type: q.question_type || "MULTIPLE_CHOICE",
          options: q.options && q.options.length >= 2 
            ? q.options.map((o: any) => ({ text: o.text || o })) 
            : [{ text: "" }, { text: "" }]
        }))
        setQuestions(generatedQs)
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
      if (!user?.uid) throw new Error("Kullanıcı oturumu bulunamadı")

      const payload = {
        title: title, 
        pollster_id: Number(user.uid),
        image_url: imageUrl || undefined,
        is_anonymous: isAnonymous,
        questions: questions.map(q => ({
          text: q.text,
          question_type: q.type,
          options: q.type !== "OPEN_ENDED" 
            ? q.options.filter(o => o.text.trim().length > 0).map(o => ({ 
                text: o.text,
                image_url: o.image_url || undefined
              }))
            : []
        }))
      }

      await api.post('/api/surveys', payload)
      toast.success("Anket başarıyla yayınlandı!")
      router.push("/pollster")
    } catch (err: any) {
      console.error(err)
      toast.error(err.response?.data?.detail || err.message || "Anket oluşturulamadı")
    } finally {
      setIsSubmitting(false)
    }
  }

  const isValid = title.trim().length > 0 && questions.every(q => {
    if (q.text.trim().length === 0) return false
    if (q.type === "OPEN_ENDED") return true
    return q.options.filter(o => o.text.trim().length > 0).length >= 2
  })

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground text-balance">Yeni Anket Oluştur</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Kapsamlı bir anket tasarlayın. Birden fazla soru ekleyebilir ve tiplerini belirleyebilirsiniz.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">

        {/* Global Survey Settings */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-5 relative overflow-hidden transition-all">
           
           <div className="flex flex-col gap-3">
             <Label className="text-sm font-semibold text-foreground">Anket Başlığı</Label>
             <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn: 2026 Uzaktan Çalışma Trendleri"
                required
                className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-11 text-base font-medium"
              />
           </div>

           <div
             className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border bg-muted/30 px-4 py-3.5"
             role="group"
             aria-labelledby="survey-anonymous-label"
           >
             <div className="min-w-0 flex-1 pr-0 sm:pr-4">
               <Label
                 id="survey-anonymous-label"
                 htmlFor="survey-is-anonymous"
                 className="text-sm font-semibold text-foreground leading-snug cursor-pointer"
               >
                 Anonymous Survey (Participants&apos; identities will not be visible to you)
               </Label>
             </div>
             <Switch
               id="survey-is-anonymous"
               checked={isAnonymous}
               onCheckedChange={setIsAnonymous}
               aria-labelledby="survey-anonymous-label"
               className="shrink-0 sm:mt-0 mt-1 self-start sm:self-center"
             />
           </div>

           <div className="flex flex-col gap-3">
             <Label className="text-sm font-semibold text-foreground">Kapak Görseli (İsteğe Bağlı)</Label>
             <div className="flex items-center gap-4">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="Kapak" className="w-16 h-16 rounded-xl object-cover ring-1 ring-border" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center text-muted-foreground shrink-0">
                    <ImageIcon className="w-6 h-6 opacity-30" />
                  </div>
                )}
                
                <div className="flex-1 flex flex-col gap-1.5">
                   <Button 
                     type="button"
                     variant="outline"
                     disabled={isUploading}
                     onClick={() => fileInputRef.current?.click()}
                     className="w-fit gap-2 h-9 border-primary/20 hover:bg-primary/5 hover:border-primary/40 text-sm"
                   >
                     {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                     {isUploading ? "Yükleniyor..." : imageUrl ? "Değiştir" : "Görsel Seç"}
                   </Button>
                   <span className="text-xs text-muted-foreground">Kapak görseli, anketinizi daha ilgi çekici kılar. Maks: 5MB</span>
                </div>

                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
             </div>
           </div>
        </div>

        {/* AI Assistant */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-4 h-4 text-primary" />
            <Label className="text-sm font-semibold text-foreground">AI Taslak Asistanı</Label>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), generateFromAI())}
              placeholder='Örn: "Yapay Zeka ve İş Dünyası"'
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
              {isGenerating ? "Oluşturuluyor..." : "Oluştur"}
            </Button>
          </div>
          {aiError && <p className="text-xs text-destructive">{aiError}</p>}
        </div>

        {/* Dynamic Question List */}
        <div className="flex flex-col gap-6">
          {questions.map((q, qIndex) => (
            <div key={q.id} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-5 relative group transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 shadow-sm hover:border-border/80">
              
              {/* Question Header & Delete */}
              <div className="flex items-start justify-between gap-4">
                 <div className="flex-1 flex flex-col gap-2">
                   <div className="flex items-center gap-3">
                     <span className="flex items-center justify-center w-6 h-6 rounded-md bg-secondary text-xs font-bold text-muted-foreground">
                       {qIndex + 1}
                     </span>
                     <select
                        value={q.type}
                        onChange={(e) => updateQuestionType(qIndex, e.target.value as QuestionType)}
                        className="h-8 rounded-lg border border-border bg-input text-foreground text-xs px-2 focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
                      >
                        <option value="MULTIPLE_CHOICE">Çoktan Seçmeli</option>
                        <option value="CHOICE_WITH_OTHER">Seçmeli + Diğer (Metin)</option>
                        <option value="OPEN_ENDED">Açık Uçlu (Metin)</option>
                      </select>
                   </div>
                   <Input
                    value={q.text}
                    onChange={(e) => updateQuestionText(qIndex, e.target.value)}
                    placeholder="Soru metnini girin..."
                    required
                    className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-11 text-base mt-1 transition-colors"
                  />
                 </div>

                 <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeQuestion(qIndex)}
                    disabled={questions.length <= 1}
                    className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Soruyu Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
              </div>

              {/* Options Mapper */}
              <div className="flex flex-col gap-3 pl-9">
                {q.type === "OPEN_ENDED" ? (
                   <div className="w-full bg-input/50 border border-dashed border-border rounded-lg flex items-center justify-center p-6 text-muted-foreground text-sm font-medium">
                     Katılımcı kendi uzun yanıtını yazacak (Açık Uçlu mod).
                   </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-2.5">
                      {q.options.map((opt, optIndex) => (
                        <div key={optIndex} className="flex items-center gap-2 transition-all">
                          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold shrink-0">
                            {String.fromCharCode(65 + optIndex)}
                          </div>
                          
                          {/* Selected Option Image Thumbnail */}
                          {opt.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={opt.image_url} alt="Option" className="w-10 h-10 rounded-md object-cover ring-1 ring-border shrink-0" />
                          )}
                          
                          <Input
                            value={opt.text}
                            onChange={(e) => updateOptionText(qIndex, optIndex, e.target.value)}
                            placeholder={`Seçenek ${String.fromCharCode(65 + optIndex)}`}
                            className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-10 flex-1"
                          />

                          <div className="flex items-center gap-1 shrink-0">
                             <Label 
                               className={cn(
                                 "w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground transition-colors cursor-pointer",
                                 opt.isUploading ? "pointer-events-none opacity-50" : "hover:text-primary hover:bg-primary/10"
                               )}
                               title="Görsel Ekle"
                             >
                               {opt.isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                               <input 
                                 type="file" 
                                 accept="image/*" 
                                 className="hidden" 
                                 onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                      handleOptionImageUpload(qIndex, optIndex, e.target.files[0])
                                    }
                                 }}
                               />
                             </Label>
                             <button
                               type="button"
                               onClick={() => removeOption(qIndex, optIndex)}
                               disabled={q.options.length <= 2}
                               className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                             >
                               <Trash2 className="w-3.5 h-3.5" />
                             </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {q.type === "CHOICE_WITH_OTHER" && (
                       <div className="flex items-center gap-2 mt-1 opacity-70">
                          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-muted text-muted-foreground text-xs font-bold shrink-0">?</div>
                          <Input disabled value="Diğer (Açık Uçlu Metin Girişi)" className="bg-muted/30 border-dashed border-border text-muted-foreground h-10 flex-1 italic cursor-not-allowed" />
                       </div>
                    )}

                    {q.options.length < 6 && (
                      <button
                        type="button"
                        onClick={() => addOption(qIndex)}
                        className="flex items-center gap-2 w-full mt-1 px-3 py-2.5 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Seçenek Ekle
                      </button>
                    )}
                  </>
                )}
              </div>

            </div>
          ))}

          {/* Add Question Button */}
          <Button
            type="button"
            variant="outline"
            onClick={addQuestion}
            className="w-full h-12 border-dashed border-2 border-border hover:border-primary/50 text-foreground hover:text-primary bg-transparent hover:bg-primary/5 transition-all gap-2"
          >
            <Plus className="w-5 h-5" />
            Yeni Soru Ekle
          </Button>

        </div>

        {/* Global Settings */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
          <Label className="text-sm font-semibold text-foreground">Genel Ayarlar</Label>
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
          disabled={!isValid || isSubmitting || isUploading}
          className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg gap-2 mt-2 disabled:opacity-50 text-base"
        >
          <Send className="w-5 h-5" />
          {isSubmitting ? "Anket Yayınlanıyor..." : "Anketi Yayınla"}
        </Button>
      </form>
    </div>
  )
}
