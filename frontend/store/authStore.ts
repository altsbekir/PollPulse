import { create } from "zustand"
import { persist } from "zustand/middleware"
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth"
import { auth, googleProvider } from "@/lib/firebase"
import { api } from "@/lib/api"

export type Role = "pollster" | "voter"

interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

interface AuthState {
  user: AuthUser | null
  role: Role | null
  isAuthenticated: boolean
  isLoading: boolean

  // Actions
  loginWithGoogle: (selectedRole: Role) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: AuthUser | null) => void
  setLoading: (loading: boolean) => void
  initAuthListener: () => () => void   // returns the unsubscribe fn
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      role: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) =>
        set({ user, isAuthenticated: !!user }),

      setLoading: (isLoading) => set({ isLoading }),

      loginWithGoogle: async (selectedRole) => {
        set({ isLoading: true })
        try {
          const result = await signInWithPopup(auth, googleProvider)
          const firebaseUser: User = result.user

          // Sync with Backend
          const payload = {
            email: firebaseUser.email,
            google_uid: firebaseUser.uid,
            name: firebaseUser.displayName,
            profile_picture_url: firebaseUser.photoURL,
            role: selectedRole,
          }

          // idToken is attached automatically via the axios interceptor in lib/api
          const response = await api.post("/api/auth/google", payload)
          const backendUser = response.data

          const authUser: AuthUser = {
            uid: String(backendUser.id), // Use the backend internal ID
            email: backendUser.email,
            displayName: backendUser.name,
            photoURL: backendUser.profile_picture_url,
          }

          set({
            user: authUser,
            role: backendUser.role as Role, // Use confirmed role from DB
            isAuthenticated: true,
          })
        } catch (error: any) {
          console.error("Backend Sync Failed:", error)
          // If the backend call fails, ensure we log the user out from Firebase locally
          await signOut(auth).catch(() => {})
          set({ user: null, isAuthenticated: false })
          throw new Error(
            error.response?.data?.detail || "Giriş işlemi sırasında sunucuyla iletişim kurulamadı."
          )
        } finally {
          set({ isLoading: false })
        }
      },

      logout: async () => {
        set({ isLoading: true })
        try {
          await signOut(auth)
          set({ user: null, role: null, isAuthenticated: false })
        } finally {
          set({ isLoading: false })
        }
      },

      // Call once from the root AuthProvider.
      // Keeps isAuthenticated in sync across page refreshes.
      initAuthListener: () => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            try {
              // Attempt to quietly sync with backend to get latest profile/DB ID on refresh
              const payload = {
                email: firebaseUser.email,
                google_uid: firebaseUser.uid,
                name: firebaseUser.displayName,
                profile_picture_url: firebaseUser.photoURL,
              }
              const response = await api.post("/api/auth/google", payload)
              const backendUser = response.data

              set({
                user: {
                  uid: String(backendUser.id),
                  email: backendUser.email,
                  displayName: backendUser.name,
                  photoURL: backendUser.profile_picture_url,
                },
                role: backendUser.role as Role,
                isAuthenticated: true,
                isLoading: false,
              })
            } catch (err) {
              console.error("Auth Listener Sync Failed", err)
              // If backend is unreachable or fails, fall back to pure Firebase state
              // so the app doesn't break, but they might not have the DB ID
              set({
                user: {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  displayName: firebaseUser.displayName,
                  photoURL: firebaseUser.photoURL,
                },
                isAuthenticated: true,
                isLoading: false,
              })
            }
          } else {
            // Only clear user; preserve `role` (it's persisted from last session)
            set({ user: null, isAuthenticated: false, isLoading: false })
          }
        })
        return unsubscribe
      },
    }),
    {
      name: "pollpulse-auth",           // localStorage key
      partialize: (state) => ({         // only persist these fields
        user: state.user,
        role: state.role,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
