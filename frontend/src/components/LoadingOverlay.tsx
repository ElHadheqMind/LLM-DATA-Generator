import React from 'react';
import { Loader } from 'lucide-react';

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  progress?: number;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isVisible,
  message = 'Loading...',
  progress,
}) => {
  if (!isVisible) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="loading-spinner">
          <Loader size={32} className="spinning" />
        </div>
        <div className="loading-message">{message}</div>
        {progress !== undefined && (
          <div className="loading-progress">
            <div className="loading-progress-bar">
              <div 
                className="loading-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="loading-progress-text">{progress}%</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingOverlay;
