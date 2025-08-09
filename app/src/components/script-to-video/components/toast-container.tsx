'use client';

import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useVideoEditorStore } from '../store/video-editor-store';

/**
 * Toast Container - Display toast messages from the Zustand store
 * Automatically handles lifecycle and dismissal
 */
export function ToastContainer() {
  const { ui } = useVideoEditorStore();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {ui.feedback.toast_messages.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
        />
      ))}
    </div>
  );
}

interface ToastProps {
  toast: {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    duration: number;
    dismissible: boolean;
  };
}

function Toast({ toast }: ToastProps) {
  const { ui: _ui } = useVideoEditorStore();

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-blue-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const getColorClasses = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-blue-50 border-blue-200 text-blue-600';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const handleDismiss = () => {
    // Remove toast from store - we'll implement this action
    // For now, we'll let the auto-removal handle it
  };

  return (
    <Card 
      className={`p-3 shadow-lg animate-in slide-in-from-right duration-300 ${getColorClasses()}`}
    >
      <div className="flex items-start gap-2">
        {getIcon()}
        <div className="flex-1 text-sm">
          {toast.message}
        </div>
        {toast.dismissible && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-black/5"
            onClick={handleDismiss}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
    </Card>
  );
}