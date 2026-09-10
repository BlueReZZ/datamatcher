"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { RefreshCwIcon, NetworkIcon, SearchIcon, InfoIcon, DatabaseIcon } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

interface NetworkMethodToggleProps {
  currentMethod: boolean // true for matching algorithm, false for CrossRef only
  useRepositoryData?: boolean // true to include repository data
  expandSecondLevel?: boolean // true to expand second-level connections
  anchorDoi: string
  relatedDoi?: string
  nodeCount: number
  linkCount: number
  hasVeryHighConfidence?: boolean
}

export function NetworkMethodToggle({
  currentMethod,
  useRepositoryData = false,
  expandSecondLevel = false,
  anchorDoi,
  relatedDoi,
  nodeCount,
  linkCount,
  hasVeryHighConfidence = false,
}: NetworkMethodToggleProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [useMatching, setUseMatching] = useState(currentMethod)
  const [includeRepositoryData, setIncludeRepositoryData] = useState(useRepositoryData)
  const [includeSecondLevel, setIncludeSecondLevel] = useState(expandSecondLevel)

  useEffect(() => {
    setUseMatching(currentMethod)
    setIncludeRepositoryData(useRepositoryData)
    setIncludeSecondLevel(expandSecondLevel)
  }, [currentMethod, useRepositoryData, expandSecondLevel])

  useEffect(() => {
    setIsLoading(false)
  }, [currentMethod, useRepositoryData])

  const handleToggle = async (checked: boolean) => {
    setIsLoading(true)
    setUseMatching(checked)

    // Build new URL with the toggle parameter
    const params = new URLSearchParams()
    params.set("anchor", anchorDoi)
    if (relatedDoi) {
      params.set("related", relatedDoi)
    }
    if (!checked) {
      // Only add parameter when disabling enhanced mode
      params.set("useMatching", "false")
    }
    // Keep repository data parameter if it's enabled
    if (includeRepositoryData) {
      params.set("useRepositoryData", "true")
    }
    if (includeSecondLevel) {
      params.set("expandSecondLevel", "true")
    }

    // Navigate to the new URL
    router.push(`/research-network?${params.toString()}`)
  }

  const handleRepositoryToggle = async (checked: boolean) => {
    setIsLoading(true)
    setIncludeRepositoryData(checked)

    // Build new URL with the toggle parameter
    const params = new URLSearchParams()
    params.set("anchor", anchorDoi)
    if (relatedDoi) {
      params.set("related", relatedDoi)
    }
    if (!useMatching) {
      // Only add parameter when disabling enhanced mode
      params.set("useMatching", "false")
    }
    // Add repository data parameter if enabled
    if (checked) {
      params.set("useRepositoryData", "true")
    }
    if (includeSecondLevel) {
      params.set("expandSecondLevel", "true")
    }

    // Navigate to the new URL
    router.push(`/research-network?${params.toString()}`)
  }

  const handleSecondLevelToggle = async (checked: boolean) => {
    setIsLoading(true)
    setIncludeSecondLevel(checked)

    // Build new URL with the toggle parameter
    const params = new URLSearchParams()
    params.set("anchor", anchorDoi)
    if (relatedDoi) {
      params.set("related", relatedDoi)
    }
    if (!useMatching) {
      params.set("useMatching", "false")
    }
    if (includeRepositoryData) {
      params.set("useRepositoryData", "true")
    }
    if (checked) {
      params.set("expandSecondLevel", "true")
    }

    // Navigate to the new URL
    router.push(`/research-network?${params.toString()}`)
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Network Building Method</h3>
                <InfoIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="method-toggle"
                    checked={useMatching}
                    onCheckedChange={handleToggle}
                    disabled={isLoading || hasVeryHighConfidence}
                  />
                  <Label htmlFor="method-toggle" className="text-sm font-medium">
                    {hasVeryHighConfidence
                      ? "Enhanced Matching (Disabled - Very High Confidence Match Found)"
                      : useMatching
                        ? "Enhanced Matching"
                        : "CrossRef Only"}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  {useMatching ? (
                    <Badge className="bg-success text-success-foreground flex items-center gap-1">
                      <SearchIcon className="h-3 w-3" />
                      Enhanced
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <NetworkIcon className="h-3 w-3" />
                      Standard
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Include Repository Data</h3>
                <DatabaseIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="repository-toggle"
                    checked={includeRepositoryData}
                    onCheckedChange={handleRepositoryToggle}
                    disabled={isLoading}
                  />
                  <Label htmlFor="repository-toggle" className="text-sm font-medium">
                    {includeRepositoryData ? "Include Datasets" : "Exclude Datasets"}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  {includeRepositoryData ? (
                    <Badge className="bg-secondary text-secondary-foreground flex items-center gap-1">
                      <DatabaseIcon className="h-3 w-3" />
                      Datasets Included
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <DatabaseIcon className="h-3 w-3" />
                      Datasets Excluded
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Expand Second Level</h3>
                <NetworkIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="second-level-toggle"
                    checked={includeSecondLevel}
                    onCheckedChange={handleSecondLevelToggle}
                    disabled={isLoading}
                  />
                  <Label htmlFor="second-level-toggle" className="text-sm font-medium">
                    {includeSecondLevel ? "Second Level Enabled" : "First Level Only"}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  {includeSecondLevel ? (
                    <Badge className="bg-info text-info-foreground flex items-center gap-1">
                      <NetworkIcon className="h-3 w-3" />
                      Extended Network
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <NetworkIcon className="h-3 w-3" />
                      Direct Connections
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <NetworkIcon className="h-4 w-4" />
              <span>
                <strong>CrossRef Only:</strong> Uses direct relationships from CrossRef metadata
              </span>
            </div>
            <div className="flex items-center gap-2">
              <SearchIcon className="h-4 w-4" />
              <span>
                <strong>Enhanced Matching:</strong> Adds algorithmic matching to find more connections
              </span>
            </div>
            <div className="flex items-center gap-2">
              <DatabaseIcon className="h-4 w-4" />
              <span>
                <strong>Include Datasets:</strong> Searches repositories like DataDryad for related data
              </span>
            </div>
            <div className="flex items-center gap-2">
              <NetworkIcon className="h-4 w-4" />
              <span>
                <strong>Expand Second Level:</strong> Include connections from connected nodes (one level deeper)
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-sm text-muted-foreground">
              {nodeCount} nodes, {linkCount} links
            </span>

            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <RefreshCwIcon className="h-4 w-4 animate-spin" />
                <span>Rebuilding network...</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
