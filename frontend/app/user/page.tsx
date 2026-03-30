import DashboardLayout from "@/components/dashboard-layout"
import UserDashboard from "@/components/user-dashboard"

export default function UserPage() {
  return (
    <DashboardLayout role="user">
      <UserDashboard />
    </DashboardLayout>
  )
}
