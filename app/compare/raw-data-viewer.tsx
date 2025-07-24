"use client"

import { useState, useEffect } from "react"
import { JsonViewer } from "@/components/json-viewer"
import { Button } from "@/components/ui/button"
import { CodeIcon } from "lucide-react"

interface RawDataViewerProps {
  doi: string
  publicationType: string
}

export function RawDataViewer({ doi, publicationType }: RawDataViewerProps) {
  const [rawData, setRawData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function fetchRawData() {
      if (!doi) return

      try {
        setIsLoading(true)
        const response = await fetch(`/api/publication-raw?doi=${encodeURIComponent(doi)}`)

        if (!response.ok) {
          throw new Error(`Error fetching raw data: ${response.status}`)
        }

        const data = await response.json()

        if (isMounted) {
          setRawData(data)
          setError(null)
        }
      } catch (err) {
        console.error("Error fetching raw data:", err)
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unknown error")
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchRawData()

    return () => {
      isMounted = false
    }
  }, [doi])

  // If we're still loading or there's an error, show a disabled button
  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled className="h-8 gap-1">
        <CodeIcon className="h-4 w-4" />
        <span>View JSON</span>
      </Button>
    )
  }

  if (error || !rawData) {
    return (
      <Button variant="ghost" size="sm" disabled className="h-8 gap-1" title={error || "Failed to load data"}>
        <CodeIcon className="h-4 w-4" />
        <span>View JSON</span>
      </Button>
    )
  }

  return <JsonViewer data={rawData} title={`Raw CrossRef Data for ${publicationType} (${doi})`} />
}
