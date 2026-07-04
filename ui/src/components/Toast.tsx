import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './Toast.css';

export interface ToastData {
  id: string;
  type: 'success' | 'error' | 'loading' | 'info';
  message: string;
  txSig?: string;
}

interface ToastProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

const icons = {
  success: '✓',
  error: '✕',
  loading: '⟳',
  info: 'ℹ',
};

const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`toast toast-${toast.type}`}
          >
            <div className={`toast-icon ${toast.type === 'loading' ? 'spinning' : ''}`}>
              {icons[toast.type]}
            </div>
            <div className="toast-content">
              <span className="toast-message">{toast.message}</span>
              {toast.txSig && (
                <a
                  href={`https://explorer.solana.com/tx/${toast.txSig}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="toast-tx"
                >
                  View TX ↗
                </a>
              )}
            </div>
            <button className="toast-close" onClick={() => onDismiss(toast.id)}>×</button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default Toast;
