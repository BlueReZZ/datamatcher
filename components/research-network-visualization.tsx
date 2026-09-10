"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ExternalLinkIcon,
  InfoIcon,
  ZoomInIcon,
  ZoomOutIcon,
  RefreshCwIcon,
  LinkIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  DatabaseIcon,
} from "lucide-react"
import type { ResearchNetwork, ResearchNode } from "@/lib/network-service"
import * as d3 from "d3"
import { useRouter } from "next/navigation"
import type { JSX } from "react"
import { FormattedTitle } from "@/components/formatted-title"
import { formatTitlePlainText } from "@/lib/format-title"

interface ResearchNetworkVisualizationProps {
  network: ResearchNetwork
}

export function ResearchNetworkVisualization({ network }: ResearchNetworkVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedNode, setSelectedNode] = useState<ResearchNode | null>(null)
  const [selectedLink, setSelectedLink] = useState<any | null>(null)
  const [zoom, setZoom] = useState(1)
  const router = useRouter()

  // Find the anchor node
  const anchorNode = network.nodes.find((node) => node.isAnchor) || null

  useEffect(() => {
    if (!svgRef.current || network.nodes.length === 0) return

    // Set initial selected node to anchor
    if (anchorNode && !selectedNode) {
      setSelectedNode(anchorNode)
    }

    const width = 800
    const height = 600

    // Clear previous visualization
    d3.select(svgRef.current).selectAll("*").remove()

    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", "100%")

    // Create a group for the visualization
    const g = svg.append("g")

    // Create a zoom behavior
    const zoomBehavior = d3
      .zoom()
      .scaleExtent([0.1, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
        setZoom(event.transform.k)
      })

    // Apply zoom behavior to the SVG
    svg.call(zoomBehavior as any)

    // Create a normalized ID to node mapping for the links
    const nodeMap = new Map()
    network.nodes.forEach((node) => {
      nodeMap.set(node.id, node)
    })

    // Process links to reference node objects directly and filter out invalid links
    const processedLinks = network.links
      .map((link) => {
        const sourceNode = nodeMap.get(link.source)
        const targetNode = nodeMap.get(link.target)

        if (!sourceNode || !targetNode) {
          console.warn(`Invalid link: ${link.source} -> ${link.target}`)
          return null
        }

        return {
          source: sourceNode,
          target: targetNode,
          type: link.type,
          label: link.label || link.type,
        }
      })
      .filter((link) => link !== null)

    // Create a force simulation
    const simulation = d3
      .forceSimulation(network.nodes)
      .force("link", d3.forceLink(processedLinks).distance(180)) // Increased distance for labels
      .force("charge", d3.forceManyBody().strength(-600)) // Stronger repulsion
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(90)) // Increased collision radius

    // Create link groups
    const linkGroup = g
      .append("g")
      .selectAll("g")
      .data(processedLinks)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (event, d) => {
        setSelectedLink(d)
        event.stopPropagation()
      })

    // Add lines for links
    linkGroup
      .append("line")
      .attr("stroke", (d) => {
        if (d.type === "confirmed-match") return "#d50072" // brand pink for confirmed matches
        if (d.type === "algorithmic-match") return "#0d9488" // teal-600 for algorithmic matches
        if (d.type === "related-dataset") return "#7c3aed" // violet-600 for dataset links
        return "#999" // gray for other links
      })
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d) => {
        if (d.type === "algorithmic-match") return 3
        if (d.type === "related-dataset") return 2.5
        return 2
      })
      .attr("stroke-dasharray", (d) => {
        if (d.type === "confirmed-match") return "none"
        if (d.type === "algorithmic-match") return "8,4" // Different dash pattern for algorithmic matches
        if (d.type === "related-dataset") return "3,3" // Dotted pattern for dataset links
        return "5,5"
      })

    // Add link labels
    linkGroup
      .append("text")
      .attr("dy", -5)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#6b5b73")
      .attr("pointer-events", "none") // Don't interfere with mouse events
      .text((d) => d.label)
      .append("textPath")
      .attr("startOffset", "50%")
      .attr("xlink:href", (d, i) => `#linkPath${i}`)

    // Add invisible wider path for better click target
    linkGroup
      .append("path")
      .attr("id", (d, i) => `linkPath${i}`)
      .attr("stroke", "transparent")
      .attr("stroke-width", 10)
      .attr("fill", "none")

    // Create a group for each node
    const node = g
      .append("g")
      .selectAll("g")
      .data(network.nodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (event, d) => {
        setSelectedNode(d)
        setSelectedLink(null) // Clear selected link when node is clicked
        event.stopPropagation()
      })
      .call(drag(simulation) as any)

    // Add rectangles for nodes
    node
      .append("rect")
      .attr("width", 160)
      .attr("height", 80)
      .attr("rx", 8)
      .attr("ry", 8)
      .attr("fill", (d) => (d.isAnchor ? "#d50072" : getColorForType(d.type, d.idType, d.statusCode)))
      .attr("stroke", (d) => (d.isAnchor ? "#440535" : getStrokeColor(d.statusCode)))
      .attr("stroke-width", 2)
      .attr("x", -80)
      .attr("y", -40)

    // Add title text - use formatTitlePlainText for SVG display
    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-15")
      .attr("fill", (d) => (d.isAnchor ? "white" : "#1b0a3c"))
      .attr("font-weight", "bold")
      .attr("font-size", "12px")
      .text((d) => truncateText(formatTitlePlainText(d.title), 20))
      .append("title")
      .text((d) => formatTitlePlainText(d.title))

    // Add type label
    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "5")
      .attr("fill", (d) => (d.isAnchor ? "white" : "#6b5b73"))
      .attr("font-size", "10px")
      .text((d) => {
        // For dataset nodes, include the repository name
        if (d.type === "dataset" && d.repository) {
          return `Dataset (${d.repository})`
        }
        return d.typeLabel || d.type
      })

    // Add author text or identifier type for non-DOI nodes
    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "20")
      .attr("fill", (d) => (d.isAnchor ? "white" : "#6b5b73"))
      .attr("font-size", "10px")
      .text((d) => {
        if (d.idType !== "doi") {
          // For URI resources, show status code if available
          if (d.idType === "uri" && d.statusCode) {
            return `Status: ${d.statusCode === 0 ? "Timeout" : d.statusCode}`
          }
          return `${d.idType.toUpperCase()} Resource`
        }
        const firstAuthor = d.authors[0] || "Unknown"
        return d.authors.length > 1 ? `${firstAuthor} et al.` : firstAuthor
      })

    // Clear selected link when clicking on the background
    svg.on("click", () => {
      setSelectedLink(null)
    })

    // Update positions on each tick
    simulation.on("tick", () => {
      // Update link lines
      linkGroup
        .selectAll("line")
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y)

      // Update link paths for labels
      linkGroup.selectAll("path").attr("d", (d: any) => {
        const dx = d.target.x - d.source.x
        const dy = d.target.y - d.source.y
        const dr = Math.sqrt(dx * dx + dy * dy)

        // Calculate midpoint with slight offset for the label
        const midX = (d.source.x + d.target.x) / 2
        const midY = (d.source.y + d.target.y) / 2 - 10 // Offset above the line

        return `M${d.source.x},${d.source.y} Q${midX},${midY} ${d.target.x},${d.target.y}`
      })

      // Update link label positions
      linkGroup
        .selectAll("text")
        .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
        .attr("y", (d: any) => (d.source.y + d.target.y) / 2 - 10)

      // Update node positions
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`)
    })

    // Cleanup
    return () => {
      simulation.stop()
    }
  }, [network, anchorNode, selectedNode])

  // Function to get color based on publication type, ID type, and status code
  function getColorForType(type: string, idType: string, statusCode?: number, repository?: string): string {
    // Special colors for dataset nodes
    if (type === "dataset") {
      return "#2dd4bf" // teal-400 for datasets
    }

    // Special colors for non-DOI resources
    if (idType !== "doi") {
      // For URI resources, color based on status code
      if (idType === "uri" && statusCode !== undefined) {
        if (statusCode >= 200 && statusCode < 300) {
          return "#86efac" // green-300 for successful responses
        } else if (statusCode >= 300 && statusCode < 400) {
          return "#fcd34d" // amber-300 for redirects
        } else if (statusCode >= 400 && statusCode < 500) {
          return "#fda4af" // rose-300 for client errors
        } else if (statusCode >= 500) {
          return "#fb7185" // rose-400 for server errors
        } else if (statusCode === 0) {
          return "#d1d5db" // gray-300 for timeouts
        }
        return "#fcd34d" // amber-300 as default for URI
      }

      const idTypeColors: Record<string, string> = {
        uri: "#fde68a", // amber-200
        isbn: "#ddd6fe", // violet-200
        issn: "#7dd3fc", // sky-300
        pmid: "#6ee7b7", // emerald-300
        pmcid: "#fda4af", // rose-300
      }
      return idTypeColors[idType] || "#d1d5db" // gray-300 as default for unknown ID types
    }

    // Regular publication type colors
    const typeColors: Record<string, string> = {
      "journal-article": "#fbcfe8", // pink-200
      "posted-content": "#99f6e4", // teal-200
      "book-chapter": "#fde68a", // amber-200
      "proceedings-article": "#ddd6fe", // violet-200
      book: "#fecdd3", // rose-200
      dataset: "#e2e8f0", // slate-200
      report: "#fef08a", // yellow-200
      "peer-review": "#a7f3d0", // emerald-200
      "journal-issue": "#e9d5ff", // purple-200
      "reference-entry": "#c7d2fe", // indigo-200
      component: "#ccfbf1", // teal-100
      monograph: "#ddd6fe", // violet-200
      dissertation: "#bae6fd", // sky-200
      standard: "#fecdd3", // rose-200
      grant: "#e9d5ff", // purple-200
      "external-resource": "#e2e8f0", // slate-200
    }

    return typeColors[type] || "#f1f5f9" // slate-100 as default
  }

  // Function to get stroke color based on status code
  function getStrokeColor(statusCode?: number): string {
    if (statusCode === undefined) return "#e2e8f0" // Default border

    if (statusCode >= 200 && statusCode < 300) {
      return "#15803d" // success (green) for successful responses
    } else if (statusCode >= 300 && statusCode < 400) {
      return "#b45309" // warning (amber) for redirects
    } else if (statusCode >= 400) {
      return "#c81e3a" // destructive (rose) for errors
    } else if (statusCode === 0) {
      return "#64748b" // slate-500 for timeouts
    }

    return "#e2e8f0" // Default border
  }

  // Function to truncate text
  function truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text
  }

  // Function to create drag behavior
  function drag(simulation: any) {
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      event.subject.fx = event.subject.x
      event.subject.fy = event.subject.y
    }

    function dragged(event: any) {
      event.subject.fx = event.x
      event.subject.fy = event.subject.y
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0)
      event.subject.fx = null
      event.subject.fy = event.subject.y
    }

    return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended)
  }

  // Function to handle zoom in
  const handleZoomIn = () => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    const currentZoom = d3.zoomTransform(svg.node() as any)
    svg
      .transition()
      .call(
        (d3.zoom() as any).transform,
        d3.zoomIdentity.scale(currentZoom.k * 1.2).translate(currentZoom.x, currentZoom.y),
      )
  }

  // Function to handle zoom out
  const handleZoomOut = () => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    const currentZoom = d3.zoomTransform(svg.node() as any)
    svg
      .transition()
      .call(
        (d3.zoom() as any).transform,
        d3.zoomIdentity.scale(currentZoom.k / 1.2).translate(currentZoom.x, currentZoom.y),
      )
  }

  // Function to handle reset
  const handleReset = () => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.transition().call((d3.zoom() as any).transform, d3.zoomIdentity)
  }

  // Function to make a node the new anchor (only for DOI nodes)
  const handleMakeAnchor = (node: ResearchNode) => {
    if (node.idType === "doi" && node.doi) {
      // Navigate to the same page with the new anchor
      router.push(`/research-network?anchor=${encodeURIComponent(node.doi)}`)
    }
  }

  // Function to get status badge for URI resources
  function getStatusBadge(statusCode?: number): JSX.Element | null {
    if (statusCode === undefined) return null

    if (statusCode >= 200 && statusCode < 300) {
      return (
        <Badge className="bg-success text-success-foreground flex items-center gap-1">
          <CheckCircleIcon className="h-3 w-3" />
          {statusCode}
        </Badge>
      )
    } else if (statusCode >= 300 && statusCode < 400) {
      return <Badge className="bg-warning text-warning-foreground">{statusCode} Redirect</Badge>
    } else if (statusCode >= 400 && statusCode < 500) {
      return (
        <Badge className="bg-destructive text-destructive-foreground flex items-center gap-1">
          <AlertTriangleIcon className="h-3 w-3" />
          {statusCode} Client Error
        </Badge>
      )
    } else if (statusCode >= 500) {
      return (
        <Badge className="bg-destructive text-destructive-foreground flex items-center gap-1">
          <AlertTriangleIcon className="h-3 w-3" />
          {statusCode} Server Error
        </Badge>
      )
    } else if (statusCode === 0) {
      return <Badge className="bg-muted text-muted-foreground">Timeout</Badge>
    } else if (statusCode === -1) {
      return <Badge className="bg-destructive text-destructive-foreground">Error</Badge>
    }

    return <Badge>{statusCode}</Badge>
  }

  // Function to render identifier information based on type
  const renderIdentifier = (node: ResearchNode) => {
    if (node.idType === "doi" && node.doi) {
      return (
        <p className="text-sm flex items-center gap-1">
          <span className="font-medium">DOI:</span>{" "}
          <a
            href={`https://doi.org/${node.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1"
          >
            {node.doi}
            <ExternalLinkIcon className="h-3 w-3" />
          </a>
        </p>
      )
    } else if (node.idType === "uri" && node.uri) {
      return (
        <p className="text-sm flex items-center gap-1">
          <span className="font-medium">URI:</span>{" "}
          <a
            href={node.uri}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1"
          >
            {truncateText(node.uri, 30)}
            <ExternalLinkIcon className="h-3 w-3" />
          </a>
        </p>
      )
    } else if (node.idType === "accession" && node[node.idType as keyof ResearchNode]) {
      const accessionNumber = node[node.idType as keyof ResearchNode] as string
      return (
        <p className="text-sm flex items-center gap-1">
          <span className="font-medium">Accession:</span>{" "}
          <a
            href={`https://www.ncbi.nlm.nih.gov/search/all/?term=${accessionNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1"
          >
            {accessionNumber}
            <ExternalLinkIcon className="h-3 w-3" />
          </a>
        </p>
      )
    } else if (node.idType && node[node.idType as keyof ResearchNode]) {
      const id = node[node.idType as keyof ResearchNode] as string

      // Check if this might be an accession number (even if not explicitly marked as such)
      const accessionPatterns = /^(PRJ|SRR|SRP|GEO|GSE|GSM|PRJNA|SAMN|SAMD)/i
      if (accessionPatterns.test(id)) {
        return (
          <p className="text-sm flex items-center gap-1">
            <span className="font-medium">{node.idType.toUpperCase()}:</span>{" "}
            <a
              href={`https://www.ncbi.nlm.nih.gov/search/all/?term=${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1"
            >
              {id}
              <ExternalLinkIcon className="h-3 w-3" />
            </a>
          </p>
        )
      }

      return (
        <p className="text-sm">
          <span className="font-medium">{node.idType.toUpperCase()}:</span> {id}
        </p>
      )
    }
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle>Research Network Visualization</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={handleZoomIn} title="Zoom In">
                    <ZoomInIcon className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleZoomOut} title="Zoom Out">
                    <ZoomOutIcon className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleReset} title="Reset View">
                    <RefreshCwIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md bg-muted h-[600px] overflow-hidden">
                <svg ref={svgRef} width="100%" height="100%" />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                <p>
                  Drag nodes to reposition. Click on a node to view details. Click on a link to see the relationship
                  type.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="w-full md:w-80">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle>{selectedLink ? "Relationship Details" : "Publication Details"}</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedLink ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">Relationship Type</h3>
                    <Badge className="mt-2 bg-info text-info-foreground">{selectedLink.label}</Badge>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Source</h4>
                    <p className="text-sm">{selectedLink.source.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedLink.source.authors[0]}
                      {selectedLink.source.authors.length > 1 ? " et al." : ""}
                    </p>

                    <h4 className="font-medium mt-4">Target</h4>
                    <p className="text-sm">{selectedLink.target.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedLink.target.authors[0]}
                      {selectedLink.target.authors.length > 1 ? " et al." : ""}
                    </p>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setSelectedNode(selectedLink.source)}
                    >
                      View Source
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setSelectedNode(selectedLink.target)}
                    >
                      View Target
                    </Button>
                  </div>
                </div>
              ) : selectedNode ? (
                <div className="space-y-4">
                  <div>
                    <FormattedTitle title={selectedNode.title} className="font-semibold text-lg" />
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={selectedNode.isAnchor ? "bg-primary/10 text-primary border-primary/30" : ""}
                      >
                        {selectedNode.typeLabel || selectedNode.type}
                      </Badge>
                      {selectedNode.isAnchor && <Badge>Anchor</Badge>}
                      {selectedNode.idType !== "doi" && (
                        <Badge className="bg-amber-500">{selectedNode.idType.toUpperCase()}</Badge>
                      )}
                      {selectedNode.idType === "uri" && getStatusBadge(selectedNode.statusCode)}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {selectedNode.idType === "doi" && (
                      <p className="text-sm">
                        <span className="font-medium">Authors:</span> {selectedNode.authors.join(", ")}
                      </p>
                    )}

                    {renderIdentifier(selectedNode)}

                    {selectedNode.publicationDate && (
                      <p className="text-sm">
                        <span className="font-medium">Publication Date:</span> {selectedNode.publicationDate}
                      </p>
                    )}

                    {selectedNode.publisher && (
                      <p className="text-sm">
                        <span className="font-medium">Publisher:</span> {selectedNode.publisher}
                      </p>
                    )}

                    {selectedNode.containerTitle && (
                      <p className="text-sm">
                        <span className="font-medium">Journal:</span> {selectedNode.containerTitle}
                      </p>
                    )}

                    {/* Always show fetched title for URI resources */}
                    {selectedNode.idType === "uri" && (
                      <p className="text-sm">
                        <span className="font-medium">Page Title:</span>{" "}
                        {selectedNode.fetchedTitle ? selectedNode.fetchedTitle : "No title found in HTML"}
                      </p>
                    )}

                    {/* Show fetch error if any */}
                    {selectedNode.fetchError && (
                      <p className="text-sm text-destructive">
                        <span className="font-medium">Error:</span> {selectedNode.fetchError}
                      </p>
                    )}

                    {selectedNode?.type === "dataset" && selectedNode.repository && (
                      <p className="text-sm flex items-center gap-1">
                        <DatabaseIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">Repository:</span> {selectedNode.repository}
                      </p>
                    )}
                  </div>

                  {!selectedNode.isAnchor && selectedNode.idType === "doi" && (
                    <Button onClick={() => handleMakeAnchor(selectedNode)} className="w-full mt-4">
                      Make This the Anchor
                    </Button>
                  )}

                  {selectedNode.idType === "uri" && selectedNode.uri && (
                    <Button
                      as="a"
                      href={selectedNode.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full mt-4 flex items-center justify-center gap-2"
                    >
                      <LinkIcon className="h-4 w-4" />
                      Visit Resource
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-8 text-center text-muted-foreground">
                  <InfoIcon className="h-12 w-12 mb-4 opacity-20" />
                  <p>Select a publication or relationship in the visualization to view its details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {network.nodes.map((node, index) => (
          <Card
            key={`${node.id}-${index}`}
            className={`cursor-pointer hover:shadow-md transition-shadow ${
              selectedNode?.id === node.id ? "ring-2 ring-primary" : ""
            } ${node.isAnchor ? "bg-primary/5" : ""}`}
            onClick={() => setSelectedNode(node)}
          >
            <CardContent className="p-3">
              <div className="space-y-1">
                <div className="flex gap-1 mb-1 flex-wrap">
                  <Badge variant="outline">{node.typeLabel || node.type}</Badge>
                  {node.idType !== "doi" && (
                    <Badge variant="secondary" className="text-xs">
                      {node.idType.toUpperCase()}
                    </Badge>
                  )}
                  {node.idType === "uri" && node.statusCode && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        node.statusCode >= 200 && node.statusCode < 300
                          ? "bg-success/10 text-success border-success/30"
                          : node.statusCode >= 400
                            ? "bg-destructive/10 text-destructive border-destructive/30"
                            : ""
                      }`}
                    >
                      {node.statusCode}
                    </Badge>
                  )}
                </div>
                <FormattedTitle title={node.title} className="font-medium text-sm line-clamp-2" maxLength={60} />
                {node.idType === "doi" ? (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {node.authors[0]}
                    {node.authors.length > 1 ? " et al." : ""}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {node.idType === "uri" ? "External Link" : `${node.idType.toUpperCase()} Resource`}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
