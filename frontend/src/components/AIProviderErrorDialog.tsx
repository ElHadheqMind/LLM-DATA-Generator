import React, { useState } from 'react';
import { AlertTriangle, X, RefreshCw, Settings, Cloud, Server, Cpu } from 'lucide-react';

interface AIProviderErrorDialogProps {
  isOpen: boolean;
  failedProvider: string;
  providerDisplayName: string;
  errorMessage: string;
  availableProviders: Array<{
    id: string;
    name: string;
    status: 'available' | 'unavailable';
  }>;
  onRetry: () => void;
  onSwitchProvider: (providerId: string) => void;
  onCancel: () => void;
}

const AIProviderErrorDialog: React.FC<AIProviderErrorDialogProps> = ({
  isOpen,
  failedProvider,
  providerDisplayName,
  errorMessage,
  availableProviders,
  onRetry,
  onSwitchProvider,
  onCancel,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<string>('');

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const getProviderIcon = (providerId: string) => {
    if (providerId.includes('azure') || providerId.includes('openai')) return <Cloud className="w-4 h-4 text-blue-500" />;
    if (providerId.includes('gemini')) return <Cloud className="w-4 h-4 text-green-500" />;
    if (providerId.includes('grok')) return <Cloud className="w-4 h-4 text-orange-500" />;
    if (providerId.includes('deepseek')) return <Cloud className="w-4 h-4 text-purple-500" />;
    if (providerId.includes('lm_studio') || providerId.includes('ollama')) return <Server className="w-4 h-4 text-gray-500" />;
    return <Cpu className="w-4 h-4 text-gray-500" />;
  };

  const availableAlternatives = availableProviders.filter(
    p => p.id !== failedProvider && p.status === 'available'
  );

  const handleSwitchProvider = () => {
    if (selectedProvider) {
      onSwitchProvider(selectedProvider);
    }
  };

  return (
    <div className="ai-error-dialog-overlay" onClick={handleBackdropClick}>
      <div className="ai-error-dialog">
        <div className="ai-error-dialog-header">
          <div className="ai-error-dialog-icon">
            <AlertTriangle size={24} className="text-red-500" />
          </div>
          <h3 className="ai-error-dialog-title">AI Provider Failed</h3>
          <button onClick={onCancel} className="ai-error-dialog-close">
            <X size={20} />
          </button>
        </div>
        
        <div className="ai-error-dialog-content">
          <div className="failed-provider-info">
            <div className="provider-header">
              {getProviderIcon(failedProvider)}
              <span className="provider-name">{providerDisplayName}</span>
              <span className="provider-status error">Failed</span>
            </div>
            <div className="error-details">
              <p className="error-message">{errorMessage}</p>
            </div>
          </div>

          {availableAlternatives.length > 0 && (
            <div className="alternative-providers">
              <h4>Available Alternative Providers:</h4>
              <div className="provider-list">
                {availableAlternatives.map((provider) => (
                  <label key={provider.id} className="provider-option">
                    <input
                      type="radio"
                      name="alternative-provider"
                      value={provider.id}
                      checked={selectedProvider === provider.id}
                      onChange={(e) => setSelectedProvider(e.target.value)}
                    />
                    <div className="provider-option-content">
                      {getProviderIcon(provider.id)}
                      <span className="provider-option-name">{provider.name}</span>
                      <span className="provider-option-status available">Available</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="ai-error-dialog-actions">
          <button onClick={onCancel} className="ai-error-dialog-cancel">
            Cancel
          </button>
          <button onClick={onRetry} className="ai-error-dialog-retry">
            <RefreshCw size={16} />
            Retry with {providerDisplayName}
          </button>
          {selectedProvider && (
            <button onClick={handleSwitchProvider} className="ai-error-dialog-switch">
              <Settings size={16} />
              Switch to {availableAlternatives.find(p => p.id === selectedProvider)?.name}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIProviderErrorDialog;
