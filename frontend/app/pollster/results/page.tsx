import DashboardLayout from "@/components/dashboard-layout"
import SurveyResultsList from "@/components/survey-results-list"

export default function PollsterResultsPage() {
  return (
    <DashboardLayout role="pollster">
      <SurveyResultsList />
    </DashboardLayout>
  )
}
