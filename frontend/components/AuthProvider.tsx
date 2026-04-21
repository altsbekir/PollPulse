"use client"

import { useEffect } from "react"
import { useAuthStore } from "@/store/authStore"

/**
 * Mounts Firebase's onAuthStateChanged listener once at the root.
 * This keeps the Zustand store in sync across page refreshes and
 * tab switches without any prop-drilling.
 *
 * Renders nothing — it is a pure side-effect component.
 */
export default function AuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const initAuthListener = useAuthStore((s) => s.initAuthListener)

  useEffect(() => {
    const unsubscribe = initAuthListener()
    return () => unsubscribe()
  }, [initAuthListener])

  return <>{children}</>
}
