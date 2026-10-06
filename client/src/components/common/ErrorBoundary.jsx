import { Component } from 'react';

/**
 * Error boundary.
 *
 * A render crash in one widget must not blank the whole site mid-match — the score
 * is the thing people came for. This catches the error, shows a readable fallback,
 * and logs it so the problem is not silently swallowed.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Kept as a console error on purpose: there is no error-reporting service wired
    // up yet, and a silent catch would hide real bugs during the season.
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="container-page flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
        <h1 className="text-2xl font-bold text-content-primary">কিছু একটা ভুল হয়েছে</h1>
        <p className="mt-1 text-lg font-medium text-content-secondary">Something went wrong</p>

        <p className="mt-4 max-w-prose text-sm text-content-muted">
          পেজটি লোড করা যায়নি। আবার চেষ্টা করুন।
          <br />
          This page could not be loaded. Please try again.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand"
          >
            আবার চেষ্টা করুন / Retry
          </button>
          <button
            type="button"
            onClick={() => window.location.assign('/')}
            className="rounded-pill border border-surface-border px-5 py-2.5 text-sm font-semibold text-content-secondary transition hover:bg-surface-sunken"
          >
            হোম / Home
          </button>
        </div>
      </div>
    );
  }
}
