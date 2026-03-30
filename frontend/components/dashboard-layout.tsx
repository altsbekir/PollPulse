"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  LayoutDashboard,
  PlusCircle,
  LogOut,
  Users,
  ChevronRight,
  Flame,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

const pollsterNav: NavItem[] = [
  { label: "Kontrol Paneli", href: "/pollster", icon: LayoutDashboard },
  { label: "Anket Oluştur", href: "/pollster/create", icon: PlusCircle },
  { label: "Anket Akışı", href: "/pollster/feed", icon: Flame },
  { label: "Sonuçlar", href: "/pollster/results", icon: BarChart3 },
]

const userNav: NavItem[] = [
  { label: "Anket Akışı", href: "/user", icon: LayoutDashboard },
]

interface DashboardLayoutProps {
  children: React.ReactNode
  role: "pollster" | "user"
}

export default function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const nav = role === "pollster" ? pollsterNav : userNav

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
            <BarChart3 className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground tracking-tight">PollPulse</span>
        </div>

        {/* Role badge */}
        <div className="px-5 pt-4 pb-2">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {role === "pollster" ? "Anketör" : "Katılımcı"}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pb-4 flex flex-col gap-0.5">
          {nav.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
                {active && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
