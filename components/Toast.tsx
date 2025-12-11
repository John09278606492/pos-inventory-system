
import React, { useEffect, useRef } from 'react';
import { ToastMessage } from '../types';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

interface ToastProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

const ToastContainer: React.FC<ToastProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col-reverse gap-3 pointer-events-none w-full max-w-sm px-4 sm:px-0">
      {toasts.map(toast => (
        <Toast key={toast.id} message={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const Toast: React.FC<{ message: ToastMessage; onClose: () => void }> = ({ message, onClose }) => {
  // Use a ref to keep track of the latest onClose function without triggering effect re-runs
  const onCloseRef = useRef(onClose);

  // Update the ref whenever onClose changes
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    // Set timeout exactly once on mount
    const timer = setTimeout(() => {
      onCloseRef.current();
    }, 4000); // Auto dismiss after 4 seconds
    
    // Cleanup timer if component unmounts manually before timeout
    return () => clearTimeout(timer);
  }, []); 

  const getStyles = () => {
    switch (message.type) {
      case 'SUCCESS':
        return 'bg-emerald-600 text-white shadow-emerald-500/30';
      case 'ERROR':
        return 'bg-red-600 text-white shadow-red-500/30';
      case 'INFO':
        return 'bg-blue-600 text-white shadow-blue-500/30';
      default:
        return 'bg-slate-800 text-white shadow-slate-500/30';
    }
  };

  const getIcon = () => {
    switch (message.type) {
      case 'SUCCESS': return <CheckCircle size={20} className="mr-3 shrink-0" />;
      case 'ERROR': return <AlertCircle size={20} className="mr-3 shrink-0" />;
      default: return <Info size={20} className="mr-3 shrink-0" />;
    }
  };

  return (
    <div className={`pointer-events-auto flex items-center p-3 pl-4 rounded-lg shadow-xl border-0 transition-all transform hover:scale-[1.02] animate-in slide-in-from-right-10 fade-in duration-300 w-full ${getStyles()}`}>
      {getIcon()}
      <span className="font-medium text-sm flex-1 mr-4 leading-tight">{message.message}</span>
      
      {/* Close Button with subtle countdown timer */}
      <div className="relative w-6 h-6 flex items-center justify-center shrink-0 cursor-pointer opacity-80 hover:opacity-100 transition-opacity" onClick={onClose} title="Dismiss">
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 32 32">
             {/* Background Circle */}
             <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" fill="none" className="opacity-20" />
             {/* Progress Circle */}
             <circle 
                cx="16" cy="16" r="14" 
                stroke="currentColor" strokeWidth="2" fill="none" 
                strokeDasharray="87.96" /* 2 * PI * 14 */
                strokeDashoffset="0"
                className="opacity-50"
                style={{ animation: 'countdown 4s linear forwards' }} 
             />
          </svg>
          <X size={14} className="relative z-10" />
      </div>

      <style>{`
        @keyframes countdown {
            from { stroke-dashoffset: 0; }
            to { stroke-dashoffset: 87.96; }
        }
      `}</style>
    </div>
  );
};

export default ToastContainer;
