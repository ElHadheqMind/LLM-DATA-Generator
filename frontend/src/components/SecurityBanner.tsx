import React, { useState } from 'react';
import { AlertCircle, X, Shield } from 'lucide-react';
import './SecurityBanner.css';

interface SecurityBannerProps {
  onDismiss?: () => void;
}

const SecurityBanner: React.FC<SecurityBannerProps> = ({ onDismiss }) => {
  const [isDismissed, setIsDismissed] = useState(() => {
    // Check if user has dismissed the banner before (session-based)
    return sessionStorage.getItem('security_banner_dismissed') === 'true';
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('security_banner_dismissed', 'true');
    onDismiss?.();
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div className="security-banner">
      <div className="security-banner-content">
        <div className="security-banner-icon">
          <Shield size={20} />
        </div>
        <div className="security-banner-text">
          <strong>🔒 Maximum Security Mode:</strong> API keys are stored in memory only and will be lost on page refresh. 
          <a href="#" onClick={(e) => { e.preventDefault(); window.open('SECURITY_NOTICE.md', '_blank'); }} style={{ marginLeft: '8px', color: '#0066cc', textDecoration: 'underline' }}>
            Learn more
          </a>
        </div>
        <button 
          className="security-banner-dismiss" 
          onClick={handleDismiss}
          title="Dismiss (this session only)"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default SecurityBanner;

