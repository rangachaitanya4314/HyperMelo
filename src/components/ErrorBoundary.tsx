import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            padding: '28px 24px',
            margin: '16px auto',
            maxWidth: '600px',
            borderRadius: 'var(--radius-lg, 16px)',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: 'var(--text-primary, #F4F0EB)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '14px',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)'
          }}
        >
          <AlertCircle size={32} color="#EF4444" />
          <div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 600 }}>
              {this.props.fallbackTitle || 'Something went wrong rendering this view'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted, rgba(244, 240, 235, 0.7))', maxWidth: '440px' }}>
              {this.state.error?.message || 'An unexpected render error occurred. Your session and playback remain safe.'}
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              fontSize: '0.85rem',
              marginTop: '4px'
            }}
          >
            <RotateCcw size={14} />
            <span>Try Again</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
