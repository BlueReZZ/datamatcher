"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronDownIcon, ChevronUpIcon, CopyIcon, CheckIcon } from "lucide-react"
import type { ResearchNode } from "@/lib/network-service"
import { formatTitle } from "@/lib/format-title"
import { FormattedTitle } from "@/components/formatted-title"

interface BibliographicCitationProps {
  network: {
    nodes: ResearchNode[]
    links: any[]
  }
}

export function BibliographicCitation({ network }: BibliographicCitationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Deduplicate nodes by DOI - keep the first occurrence of each DOI
  const deduplicatedNodes = network.nodes.reduce((acc: ResearchNode[], node) => {
    if (!node.doi) {
      // Always include nodes without DOI
      acc.push(node)
    } else {
      // Only include if we haven't seen this DOI before
      const existingNode = acc.find((existing) => existing.doi === node.doi)
      if (!existingNode) {
        acc.push(node)
      }
    }
    return acc
  }, [])

  // Find the anchor node
  const anchorNode = deduplicatedNodes.find((node) => node.isAnchor)

  if (!anchorNode) {
    return null
  }

  // Group nodes by type
  const nodesByType = deduplicatedNodes.reduce((acc: Record<string, ResearchNode[]>, node) => {
    const type = node.type || "unknown"
    if (!acc[type]) {
      acc[type] = []
    }
    acc[type].push(node)
    return acc
  }, {})

  // Format authors from the anchor node
  const formatAuthors = (authors: string[]) => {
    if (!authors || authors.length === 0) return "Unknown Authors"

    return authors
      .map((author) => {
        // Try to extract last name and initials
        const parts = author.trim().split(" ")
        if (parts.length > 1) {
          const lastName = parts[parts.length - 1]
          const initials = parts
            .slice(0, parts.length - 1)
            .map((p) => p.charAt(0))
            .join("")
          return `${lastName} ${initials}`
        }
        return author
      })
      .join(", ")
  }

  // Format a single citation
  const formatCitation = (node: ResearchNode) => {
    let citation = ""

    // Authors
    if (node.authors && node.authors.length > 0) {
      citation += `${node.authors.join(", ")}. `
    }

    // Title (we'll render this separately with HTML formatting)
    // citation += `${formatTitle(node.title)}. `

    // Publication date
    if (node.publicationDate) {
      const year = node.publicationDate.split("-")[0]
      citation += `${year}. `
    }

    // DOI
    if (node.doi) {
      citation += `DOI: ${node.doi}`
    }

    return citation
  }

  // Get all citation text for copying
  const getAllCitationsText = () => {
    let text = ""

    // Start with the anchor node
    if (anchorNode) {
      // Authors
      if (anchorNode.authors && anchorNode.authors.length > 0) {
        text += `${anchorNode.authors.join(", ")}. `
      }
      // Title (plain text for copying)
      text += `${formatTitle(anchorNode.title)}. `
      // Publication date
      if (anchorNode.publicationDate) {
        const year = anchorNode.publicationDate.split("-")[0]
        text += `${year}. `
      }
      // DOI
      if (anchorNode.doi) {
        text += `DOI: ${anchorNode.doi}`
      }
      text += "\n\n"
    }

    // Add other nodes by type
    Object.entries(nodesByType).forEach(([type, nodes]) => {
      if (type !== anchorNode.type || nodes.length > 1) {
        nodes.forEach((node) => {
          if (node.id !== anchorNode.id) {
            // Authors
            if (node.authors && node.authors.length > 0) {
              text += `${node.authors.join(", ")}. `
            }
            // Title (plain text for copying)
            text += `${formatTitle(node.title)}. `
            // Publication date
            if (node.publicationDate) {
              const year = node.publicationDate.split("-")[0]
              text += `${year}. `
            }
            // DOI
            if (node.doi) {
              text += `DOI: ${node.doi}`
            }
            text += "\n\n"
          }
        })
      }
    })

    return text
  }

  // Handle copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(getAllCitationsText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Get type label for display
  const getTypeLabel = (type: string, repository?: string): string => {
    if (type === "dataset") {
      return repository ? `Dataset (${repository})` : "Dataset"
    }

    switch (type) {
      case "posted-content":
        return "Preprint"
      case "journal-article":
        return "Article"
      case "dataset":
        return "Data"
      case "component":
        return "Software/code"
      default:
        return type.charAt(0).toUpperCase() + type.slice(1).replace(/-/g, " ")
    }
  }

  // Get badge style based on type - using the same colors as in the research network visualization
  const getBadgeStyle = (type: string): string => {
    switch (type) {
      case "posted-content":
        return "bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800"
      case "journal-article":
        return "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
      case "dataset":
        return "bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800"
      case "component":
        return "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
      default:
        return "bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-200 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800"
    }
  }

  return (
    <div className="mt-8">
      <Button variant="outline" onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center">
        <span>Show as Bibliographic Citation</span>
        {isOpen ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
      </Button>

      {isOpen && (
        <Card className="mt-4">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Bibliographic Citations</h3>
              <Button variant="outline" size="sm" onClick={handleCopy} className="flex items-center gap-2">
                {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                {copied ? "Copied" : "Copy All"}
              </Button>
            </div>

            <div className="space-y-4">
              {/* Anchor node citation */}
              {anchorNode && (
                <div className="border-b pb-4 grid grid-cols-[120px_1fr] gap-4 items-start">
                  <Badge
                    variant="outline"
                    className={`${getBadgeStyle(anchorNode.type)} text-base py-1 px-3 flex justify-center`}
                  >
                    {getTypeLabel(anchorNode.type)}
                  </Badge>
                  <div className="text-sm whitespace-pre-wrap space-y-1">
                    <div>
                      {anchorNode.authors && anchorNode.authors.length > 0 && (
                        <span>{anchorNode.authors.join(", ")}. </span>
                      )}
                      <FormattedTitle title={anchorNode.title} className="font-medium" />
                      {anchorNode.publicationDate && <span>. {anchorNode.publicationDate.split("-")[0]}.</span>}
                      {anchorNode.doi && <span> DOI: {anchorNode.doi}</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Other citations grouped by type */}
              {Object.entries(nodesByType).map(([type, nodes]) => {
                // Skip if this is just the anchor node
                if (type === anchorNode.type && nodes.length === 1) return null

                return nodes.map((node) => {
                  // Skip the anchor node as it's already displayed
                  if (node.id === anchorNode.id) return null

                  return (
                    <div key={node.id} className="pt-2 grid grid-cols-[120px_1fr] gap-4 items-start">
                      <Badge
                        variant="outline"
                        className={`${getBadgeStyle(node.type)} text-base py-1 px-3 flex justify-center`}
                      >
                        {getTypeLabel(node.type, node.repository)}
                      </Badge>
                      <div>
                        <div className="text-sm whitespace-pre-wrap space-y-1">
                          <div>
                            {node.authors && node.authors.length > 0 && <span>{node.authors.join(", ")}. </span>}
                            <FormattedTitle title={node.title} className="font-medium" />
                            {node.publicationDate && <span>. {node.publicationDate.split("-")[0]}.</span>}
                            {node.doi && <span> DOI: {node.doi}</span>}
                            {node.type === "dataset" && node.repository && !node.title.includes(node.repository) && (
                              <span> [{node.repository}]</span>
                            )}
                          </div>
                          {node.doi && (
                            <a
                              href={`https://doi.org/${node.doi}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-primary hover:underline mt-1"
                            >
                              https://doi.org/{node.doi}
                            </a>
                          )}
                          {!node.doi && node.uri && (
                            <a
                              href={node.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-primary hover:underline mt-1"
                            >
                              {node.uri}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
