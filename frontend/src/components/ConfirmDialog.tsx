import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'warning' | 'danger' | 'info';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  type = 'warning',
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const getTypeClass = () => {
    switch (type) {
      case 'danger':
        return 'confirm-dialog-danger';
      case 'info':
        return 'confirm-dialog-info';
      case 'warning':
      default:
        return 'confirm-dialog-warning';
    }
  };

  return (
    <div className="confirm-dialog-overlay" onClick={handleBackdropClick}>
      <div className={`confirm-dialog ${getTypeClass()}`}>
        <div className="confirm-dialog-header">
          <div className="confirm-dialog-icon">
            <AlertTriangle size={24} />
          </div>
          <h3 className="confirm-dialog-title">{title}</h3>
          <button onClick={onCancel} className="confirm-dialog-close">
            <X size={20} />
          </button>
        </div>
        
        <div className="confirm-dialog-content">
          <p className="confirm-dialog-message">{message}</p>
        </div>
        
        <div className="confirm-dialog-actions">
          <button onClick={onCancel} className="confirm-dialog-cancel">
            {cancelText}
          </button>
          <button onClick={onConfirm} className="confirm-dialog-confirm">
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
