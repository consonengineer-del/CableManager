import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

// Simple Error Boundary for the root
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState;
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.toString() || 'Unknown Error';
      const isScriptError = errorMsg.includes('Script error');

      return (
        <div className="p-4 text-red-500 bg-slate-900 h-screen flex flex-col items-center justify-center">
          <div className="bg-slate-800 p-6 rounded-lg shadow-xl max-w-md w-full">
            <h1 className="text-xl font-bold mb-4 flex items-center">
              <span className="text-2xl mr-2">⚠️</span> 
              Đã xảy ra lỗi
            </h1>
            
            {isScriptError ? (
              <div className="mb-4 text-slate-300 text-sm">
                <p className="mb-2"><strong>Lỗi Script Error:</strong> Đây thường là sự cố khi tải tài nguyên từ máy chủ (CDN).</p>
                <p>Vui lòng thử <strong>Xóa Cache</strong> và tải lại trang.</p>
              </div>
            ) : (
               <pre className="mb-4 text-xs bg-black/50 p-2 rounded overflow-auto max-h-40 text-red-400">
                {errorMsg}
              </pre>
            )}

            <button 
              onClick={() => {
                if (window.caches) {
                   // Try to clear caches on reload if possible
                   window.caches.keys().then(names => {
                     Promise.all(names.map(name => window.caches.delete(name)))
                     .then(() => window.location.reload());
                   });
                } else {
                   window.location.reload();
                }
              }} 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
            >
              Xóa Cache & Tải Lại
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch((err) => {
        console.log('ServiceWorker registration failed: ', err);
      });
  });
}