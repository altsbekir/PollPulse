import DashboardLayout from "@/components/dashboard-layout"
import UserDashboard from "@/components/user-dashboard"

export default function PollsterFeedPage() {
  return (
    <DashboardLayout role="pollster">
      <UserDashboard />
    </DashboardLayout>
  )
}
