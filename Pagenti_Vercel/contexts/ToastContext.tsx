import React, { createContext, useContext, useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

interface Toast {
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
    duration?: number;
}

interface ToastContextType {
    showToast: (message: string, type?: Toast['type'], duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = (message: string, type: Toast['type'] = 'info', duration = 3000) => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, type, message, duration }]);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
                ))}
            </div>
        </ToastContext.Provider>
    );
};

const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onRemove(toast.id);
        }, toast.duration);
        return () => clearTimeout(timer);
    }, [toast, onRemove]);

    const icons = {
        success: <CheckCircle2 size={18} className="text-emerald-400" />,
        error: <AlertCircle size={18} className="text-red-400" />,
        info: <Info size={18} className="text-blue-400" />
    };

    const styles = {
        success: 'bg-emerald-950/90 border-emerald-500/30 text-emerald-50',
        error: 'bg-red-950/90 border-red-500/30 text-red-50',
        info: 'bg-slate-900/90 border-slate-700/50 text-slate-50'
    };

    return (
        <div className={`pointer-events-auto min-w-[300px] max-w-sm p-4 rounded-xl border backdrop-blur-md shadow-2xl shadow-black/50 flex items-start gap-3 animate-in slide-in-from-right-full fade-in duration-300 ${styles[toast.type]}`}>
            <div className="mt-0.5">{icons[toast.type]}</div>
            <div className="flex-1 text-sm font-medium">{toast.message}</div>
            <button onClick={() => onRemove(toast.id)} className="text-white/40 hover:text-white/80 transition-colors">
                <X size={14} />
            </button>
        </div>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};
