"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import LoginPage from "@/components/login-page"

export default function Home() {
  const router = useRouter()

  const handleLogin = (role: "pollster" | "user") => {
    if (role === "pollster") {
      router.push("/pollster")
    } else {
      router.push("/user")
    }
  }

  return <LoginPage onLogin={handleLogin} />
}
