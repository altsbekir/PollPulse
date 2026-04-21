import DashboardLayout from "@/components/dashboard-layout"
import SurveyResultsList from "@/components/survey-results-list"

export default function UserResultsPage() {
  return (
    <DashboardLayout role="user">
      <SurveyResultsList />
    </DashboardLayout>
  )
}
