import { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback: (error: Error, reset: () => void) => ReactNode
  resetKey?: string
}

export class ErrorBoundary extends Component<Props, { error: Error | null; key?: string }> {
  state: { error: Error | null; key?: string } = { error: null, key: this.props.resetKey }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: { error: Error | null; key?: string }) {
    if (props.resetKey !== state.key) return { error: null, key: props.resetKey }
    return null
  }

  render() {
    if (this.state.error) return this.props.fallback(this.state.error, () => this.setState({ error: null }))
    return this.props.children
  }
}
