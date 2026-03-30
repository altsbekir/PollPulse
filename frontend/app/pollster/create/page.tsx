import DashboardLayout from "@/components/dashboard-layout"
import CreatePollForm from "@/components/create-poll-form"

export default function CreatePollPage() {
  return (
    <DashboardLayout role="pollster">
      <CreatePollForm />
    </DashboardLayout>
  )
}
