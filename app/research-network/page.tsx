import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "lucide-react"
import { ResearchNetworkVisualization } from "@/components/research-network-visualization"
import { BibliographicCitation } from "@/components/bibliographic-citation"
import { buildResearchNetwork } from "@/lib/network-service"
import { redirect } from "next/navigation"
import { NetworkMethodToggle } from "@/components/network-method-toggle"

interface ResearchNetworkPageProps {
  searchParams: {
    anchor?: string
    related?: string
    useMatching?: string
    useRepositoryData?: string
    expandSecondLevel?: string
  }
}

export default async function ResearchNetworkPage({ searchParams }: ResearchNetworkPageProps) {
  const anchorDoi = searchParams.anchor
  const relatedDoi = searchParams.related
  const useMatching = searchParams.useMatching !== "false" // Default to true, only false if explicitly set
  const useRepositoryData = searchParams.useRepositoryData === "true" // Default to false, only true if explicitly set
  const expandSecondLevel = searchParams.expandSecondLevel === "true" // Default to false

  if (!anchorDoi) {
    redirect("/")
  }

  try {
    // Fetch the research network with the specified method
    const network = await buildResearchNetwork(anchorDoi, relatedDoi, useMatching, useRepositoryData, expandSecondLevel)

    // After building the network, check if we should disable enhanced matching
    const hasVeryHighConfidence = network.nodes.some((node) => node.metadata?.confidenceLevel === "Very High")

    // If we have Very High confidence matches, force useMatching to false
    const effectiveUseMatching = hasVeryHighConfidence ? false : useMatching

    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <a href="/" className="inline-block mb-4">
                <Button variant="outline">
                  <ArrowLeftIcon className="mr-2 h-4 w-4" />
                  Back to Search
                </Button>
              </a>
              <h1 className="text-2xl font-bold">Research Network Visualization</h1>
              <p className="text-muted-foreground">
                Explore the network of research outputs connected to this publication
              </p>
            </div>
          </div>

          <Suspense fallback={<NetworkLoadingState />}>
            {/* Add the method toggles */}
            <NetworkMethodToggle
              currentMethod={effectiveUseMatching}
              useRepositoryData={useRepositoryData}
              expandSecondLevel={expandSecondLevel}
              anchorDoi={anchorDoi}
              relatedDoi={relatedDoi}
              nodeCount={network.nodes.length}
              linkCount={network.links.length}
              hasVeryHighConfidence={hasVeryHighConfidence}
            />

            {/* Pass only the network data, not the function */}
            <ResearchNetworkVisualization network={network} />
          </Suspense>

          {/* Add the bibliographic citation component */}
          <BibliographicCitation network={network} />
        </div>
      </div>
    )
  } catch (error) {
    console.error("Error building research network:", error)
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <a href="/" className="inline-block mb-4">
              <Button variant="outline">
                <ArrowLeftIcon className="mr-2 h-4 w-4" />
                Back to Search
              </Button>
            </a>
            <h1 className="text-2xl font-bold">Research Network Visualization</h1>
          </div>

          <div className="bg-destructive/10 text-destructive p-6 rounded-md">
            <h2 className="text-lg font-semibold mb-2">Error Loading Research Network</h2>
            <p>There was a problem building the research network visualization. Please try again later.</p>
          </div>
        </div>
      </div>
    )
  }
}

// Make sure the loading state is properly implemented
function NetworkLoadingState() {
  return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Building research network visualization...</p>
      </div>
    </div>
  )
}
