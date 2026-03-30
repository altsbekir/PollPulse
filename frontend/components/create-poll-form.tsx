"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PlusCircle, Trash2, Sparkles, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const AI_QUESTIONS = [
  "Which programming paradigm do you prefer: functional or object-oriented?",
  "What is the most important skill for a software engineer in 2026?",
  "How often do you use AI tools in your daily workflow?",
  "What is your preferred method for remote team communication?",
  "Which cloud provider do you use most at work?",
]

export default function CreatePollForm() {
  const router = useRouter()
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState(["", ""])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const generateQuestion = () => {
    setIsGenerating(true)
    setTimeout(() => {
      const random = AI_QUESTIONS[Math.floor(Math.random() * AI_QUESTIONS.length)]
      setQuestion(random)
      setIsGenerating(false)
    }, 900)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setTimeout(() => {
      router.push("/pollster")
    }, 1000)
  }

  const filledOptions = options.filter((o) => o.trim().length > 0)
  const isValid = question.trim().length > 0 && filledOptions.length >= 2

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground text-balance">Create a New Poll</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add your question, define options, or let AI generate one for you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Question */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold text-foreground">Poll Question</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generateQuestion}
              disabled={isGenerating}
              className="gap-1.5 text-xs border-border text-muted-foreground hover:text-primary hover:border-primary bg-transparent"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? "animate-pulse text-primary" : ""}`} />
              {isGenerating ? "Generating..." : "AI Generate"}
            </Button>
          </div>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What do you want to ask?"
            required
            className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-11 text-base"
          />
        </div>

        {/* Options */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <Label className="text-sm font-semibold text-foreground">
            Answer Options
            <span className="ml-2 text-xs text-muted-foreground font-normal">
              (min 2, max 6)
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
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-10 flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  disabled={options.length <= 2}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Remove option"
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
              Add Option
            </button>
          )}
        </div>

        {/* Settings row */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
          <Label className="text-sm font-semibold text-foreground">Settings</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Visibility</Label>
              <select className="h-9 rounded-lg border border-border bg-input text-foreground text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary">
                <option>Public</option>
                <option>Private</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Duration</Label>
              <select className="h-9 rounded-lg border border-border bg-input text-foreground text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary">
                <option>No expiry</option>
                <option>24 hours</option>
                <option>3 days</option>
                <option>7 days</option>
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
          {isSubmitting ? "Publishing Poll..." : "Publish Poll"}
        </Button>
      </form>
    </div>
  )
}
