"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RefreshCcwIcon } from "lucide-react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Card className="bg-destructive/10 text-destructive">
          <CardContent className="p-6 flex flex-col items-center">
            <h2 className="text-xl font-semibold mb-4">Something went wrong</h2>
            <p className="mb-4">An error occurred while rendering this component</p>
            <Button
              variant="outline"
              onClick={() => this.setState({ hasError: false })}
              className="flex items-center gap-2"
            >
              <RefreshCcwIcon className="h-4 w-4" />
              Try again
            </Button>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}
