import axios from "axios"
import { auth } from "@/lib/firebase"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

// Intercept requests to inject the Firebase ID token
api.interceptors.request.use(
  async (config) => {
    // Attempt to get the current Firebase user
    const user = auth.currentUser
    
    if (user) {
      // Get the ID token, force refresh if needed
      const token = await user.getIdToken(false)
      config.headers.Authorization = `Bearer ${token}`
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)
