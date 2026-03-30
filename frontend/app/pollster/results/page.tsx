import DashboardLayout from "@/components/dashboard-layout"
import PollResultsView from "@/components/poll-results-view"

export default function PollsterResultsPage() {
  return (
    <DashboardLayout role="pollster">
      <PollResultsView />
    </DashboardLayout>
  )
}
