import React, { useState, useEffect } from 'react';
import { Settings, ChevronDown, Check, AlertCircle, Loader, Cloud, Server, Cpu } from 'lucide-react';
import ApiService from '../services/api';
import { useProviderStatus } from '../hooks/useProviderStatus';
import { useProviderStatusManager } from '../hooks/useProviderStatusManager';

interface AIProvider {
  id: string;
  name: string;
  status: 'available' | 'unavailable' | 'testing';
  isDefault?: boolean;
}

interface AIProviderSelectorProps {
  selectedProvider?: string;
  onProviderChange?: (providerId: string) => void;
  disabled?: boolean;
  className?: string;
}

const AIProviderSelector: React.FC<AIProviderSelectorProps> = ({
  selectedProvider: externalSelectedProvider,
  onProviderChange,
  disabled = false,
  className = ''
}) => {
  // Use the centralized provider status manager
  const { statuses } = useProviderStatusManager();

  // Also use the provider status hook for backend sync (optional polling)
  const {
    providers: providerStatuses,
    isLoading: isLoadingProviders
  } = useProviderStatus({
    pollingInterval: 5000,
    enablePolling: true
  });

  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>(externalSelectedProvider || '');
  const [isOpen, setIsOpen] = useState(false);

  // Update internal state when external prop changes
  useEffect(() => {
    if (externalSelectedProvider !== undefined) {
      setSelectedProvider(externalSelectedProvider);
    }
  }, [externalSelectedProvider]);

  // Convert provider statuses from centralized manager to local format
  useEffect(() => {
    // Define all available providers (always show these)
    const allProviders = [
      { id: 'openai', name: 'OpenAI', status: 'unavailable' as const, isDefault: false },
      { id: 'google_gemini', name: 'Google Gemini', status: 'unavailable' as const, isDefault: false },
      { id: 'lm_studio', name: 'LM Studio', status: 'unavailable' as const, isDefault: false },
      { id: 'ollama', name: 'Ollama', status: 'unavailable' as const, isDefault: false }
    ];

    // Merge centralized status with all providers
    const providerList: AIProvider[] = allProviders.map(provider => {
      const centralizedStatus = statuses[provider.id];
      const backendInfo = providerStatuses[provider.id];

      // Prefer centralized status, fallback to backend
      const available = centralizedStatus?.available || backendInfo?.available || false;
      const testing = centralizedStatus?.testing || false;

      return {
        id: provider.id,
        name: centralizedStatus?.name || backendInfo?.name || provider.name,
        status: testing ? 'testing' as const : (available ? 'available' as const : 'unavailable' as const),
        isDefault: backendInfo?.isDefault || false
      };
    });

    setProviders(providerList);

    // Set default provider only if no external selection is provided and providers just loaded
    if (!externalSelectedProvider && !selectedProvider && providerList.length > 0) {
      // Priority order: Gemini > OpenAI > LM Studio > Ollama
      const priorityOrder = ['google_gemini', 'openai', 'lm_studio', 'ollama'];

      // First try to find the default provider from backend
      let defaultProvider = providerList.find(p => p.isDefault);

      // If no default from backend, use priority order to find first available
      if (!defaultProvider) {
        for (const providerId of priorityOrder) {
          const provider = providerList.find(p => p.id === providerId && p.status === 'available');
          if (provider) {
            defaultProvider = provider;
            break;
          }
        }
      }

      if (defaultProvider) {
        setSelectedProvider(defaultProvider.id);
        onProviderChange?.(defaultProvider.id);
      }
    }
  }, [statuses, providerStatuses, externalSelectedProvider, selectedProvider, onProviderChange]);

  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId);
    setIsOpen(false);
    onProviderChange?.(providerId);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'testing':
        return <Loader className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="w-4 h-4 text-red-500" />;
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

  const selectedProviderData = providers.find(p => p.id === selectedProvider);

  if (isLoadingProviders) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader className="w-4 h-4 animate-spin" />
        <span className="text-sm text-gray-600">Loading providers...</span>
      </div>
    );
  }

  return (
    <div className={`ai-provider-selector-enhanced ${className}`}>
      <div className="provider-selector-header">
        <label className="provider-selector-label">
          <Settings className="w-4 h-4" />
          <span>AI Provider</span>
        </label>
      </div>

      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`provider-selector-button ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
      >
        <div className="provider-selector-content">
          <div className="provider-info">
            <div className="provider-icon">
              {selectedProviderData ? getProviderIcon(selectedProviderData.id) : <Settings className="w-5 h-5 text-gray-400" />}
            </div>
            <div className="provider-details">
              <span className="provider-name">
                {selectedProviderData?.name || 'Select Provider'}
              </span>
              {selectedProviderData?.isDefault && (
                <span className="default-badge">Default</span>
              )}
            </div>
          </div>
          <div className="provider-selector-indicators">
            {selectedProviderData && getStatusIcon(selectedProviderData.status)}
            <ChevronDown className={`chevron-icon ${isOpen ? 'rotated' : ''}`} />
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="provider-selector-dropdown">
          <div className="dropdown-content">
            {providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleProviderSelect(provider.id)}
                className={`provider-option ${selectedProvider === provider.id ? 'selected' : ''} ${provider.status === 'unavailable' ? 'unavailable' : ''}`}
              >
                <div className="provider-option-content">
                  <div className="provider-option-icon">
                    {getProviderIcon(provider.id)}
                  </div>
                  <div className="provider-option-details">
                    <div className="provider-option-header">
                      <span className="provider-option-name">{provider.name}</span>
                      {provider.isDefault && (
                        <span className="provider-default-badge">Default</span>
                      )}
                    </div>
                    <span className={`provider-status ${provider.status}`}>
                      {provider.status === 'available' ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                </div>
                <div className="provider-option-meta">
                  {getStatusIcon(provider.status)}
                  {selectedProvider === provider.id && (
                    <Check className="w-4 h-4 check-icon" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIProviderSelector;
