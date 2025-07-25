import { SearchTabs } from "@/components/search-tabs"
import { HeroSection } from "@/components/hero-section"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"

export default function Home() {
  // Check if OpenAI API key is configured
  const isApiKeyConfigured = Boolean(process.env.OPENAI_API_KEY)

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 lg:p-24">
      <HeroSection />

      {!isApiKeyConfigured && (
        <div className="w-full max-w-4xl mx-auto mt-8">
          <Alert
            variant="warning"
            className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
          >
            <InfoIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertTitle>OpenAI API Key Not Configured</AlertTitle>
            <AlertDescription>
              The application is running without an OpenAI API key. LLM-based fuzzy matching will be unavailable, and
              only basic matching will be used. To enable advanced matching, please set the OPENAI_API_KEY environment
              variable.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="w-full max-w-4xl mx-auto mt-8">
        <SearchTabs />
      </div>
    </main>
  )
}
