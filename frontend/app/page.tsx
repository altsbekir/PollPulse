"use client"

import { useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import LoginPage from "@/components/login-page"

export default function Home() {
  const router = useRouter()

  const handleLogin = (role: "pollster" | "user") => {
    // This handler will be bypassed if redirectUrl exists in LoginPage
    if (role === "pollster") {
      router.push("/pollster")
    } else {
      router.push("/user")
    }
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">Yükleniyor...</div>}>
      <LoginPage onLogin={handleLogin} />
    </Suspense>
  )
}
