import DashboardLayout from "@/components/dashboard-layout"
import PollResultsView from "@/components/poll-results-view"

export default function UserResultsPage() {
  return (
    <DashboardLayout role="user">
      <PollResultsView />
    </DashboardLayout>
  )
}
