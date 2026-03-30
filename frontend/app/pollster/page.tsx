import DashboardLayout from "@/components/dashboard-layout"
import PollsterDashboard from "@/components/pollster-dashboard"

export default function PollsterPage() {
  return (
    <DashboardLayout role="pollster">
      <PollsterDashboard />
    </DashboardLayout>
  )
}
