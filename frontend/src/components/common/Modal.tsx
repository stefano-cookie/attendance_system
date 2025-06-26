// frontend/src/components/common/Modal.tsx
import React, { ReactNode, useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'medium',
  className = ''
}) => {
  // Blocca lo scroll del body quando il modale è aperto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);
  
  // Gestisce la chiusura con il tasto ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEsc);
    
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  // Impedisce che il click sul contenuto del modale chiuda il modale
  const handleModalContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal-container ${size} ${className}`}
        onClick={handleModalContentClick}
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button 
            className="close-btn" 
            onClick={onClose}
            aria-label="Chiudi"
          >
            <span className="icon-x"></span>
          </button>
        </div>
        
        <div className="modal-body">
          {children}
        </div>
        
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;