import React, { useState, useEffect } from 'react';
import { ChevronDown, Settings, Loader, AlertCircle, CheckCircle, Cpu, Check, Edit, RefreshCw } from 'lucide-react';
import { ModelInfo } from '../types/api';
import ApiService from '../services/api';

interface ModelSelectorProps {
  selectedProvider: string;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  disabled?: boolean;
  className?: string;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedProvider,
  selectedModel,
  onModelChange,
  disabled = false,
  className = ''
}) => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [manualModelName, setManualModelName] = useState<string>('');
  const [isEditingManual, setIsEditingManual] = useState(false);

  // Determine if this provider should use dropdown or text input
  const shouldUseDropdown = (provider: string): boolean => {
    // Only Ollama and LM Studio use dropdown (dynamic model discovery)
    return provider === 'ollama' || provider === 'lm_studio';
  };

  const useDropdown = shouldUseDropdown(selectedProvider);

  // Load models when provider changes (only for dropdown providers)
  useEffect(() => {
    if (selectedProvider && useDropdown) {
      loadModels();
    } else {
      setModels([]);
      setError(null);
    }
  }, [selectedProvider, useDropdown]);

  // Initialize manual model name from selected model
  useEffect(() => {
    if (!useDropdown && selectedModel) {
      setManualModelName(selectedModel);
    }
  }, [selectedModel, useDropdown]);

  const loadModels = async () => {
    if (!selectedProvider) return;

    try {
      setLoading(true);
      setError(null);

      console.log(`🔍 Loading models for provider: ${selectedProvider}`);
      const response = await ApiService.getProviderModels(selectedProvider);
      console.log(`📦 Model response for ${selectedProvider}:`, response);

      if (response.success && response.data) {
        console.log(`✅ Successfully loaded ${response.data.length} models for ${selectedProvider}`);
        setModels(response.data);

        // Auto-select first model if none selected
        if (!selectedModel && response.data.length > 0 && onModelChange) {
          console.log(`🎯 Auto-selecting first model: ${response.data[0].name}`);
          onModelChange(response.data[0].name);
        }
      } else {
        console.error(`❌ Failed to load models for ${selectedProvider}:`, response.error);
        setError(response.error || 'Failed to load models');
        setModels([]);
      }
    } catch (error: any) {
      console.error(`❌ Exception loading models for ${selectedProvider}:`, error);
      setError(error.message || 'Failed to load models');
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  const handleModelSelect = (modelName: string) => {
    setIsOpen(false);
    onModelChange?.(modelName);
  };

  const handleManualModelChange = (value: string) => {
    setManualModelName(value);
    onModelChange?.(value);
  };

  const selectedModelData = models.find(m => m.name === selectedModel);

  const getStatusIcon = () => {
    if (loading) return <Loader className="w-4 h-4 animate-spin text-blue-500" />;
    if (error) return <AlertCircle className="w-4 h-4 text-red-500" />;
    if (models.length > 0) return <CheckCircle className="w-4 h-4 text-green-500" />;
    return null;
  };

  const formatTokenCount = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`;
    }
    return tokens.toString();
  };

  const getPlaceholderText = (provider: string): string => {
    switch (provider) {
      case 'openai':
        return 'e.g., gpt-4o, gpt-4-turbo, gpt-3.5-turbo';
      case 'google_gemini':
        return 'e.g., gemini-1.5-pro, gemini-1.5-flash';
      default:
        return 'Enter model name';
    }
  };

  if (!selectedProvider) {
    return (
      <div className={`model-selector-placeholder ${className}`}>
        <div className="mb-2">
          <label className="text-sm font-medium text-gray-700">Model</label>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
          <Settings className="w-4 h-4" />
          <span className="text-sm">Select a provider first</span>
        </div>
      </div>
    );
  }

  // Render text input for OpenAI, Anthropic, and other cloud providers
  if (!useDropdown) {
    return (
      <div className={`model-selector-enhanced ${className}`}>
        <div className="model-selector-header">
          <label className="model-selector-label">
            <Cpu className="w-4 h-4" />
            <span>Model Name</span>
          </label>
        </div>

        <div className="model-input-container">
          <input
            type="text"
            value={manualModelName}
            onChange={(e) => handleManualModelChange(e.target.value)}
            placeholder={getPlaceholderText(selectedProvider)}
            disabled={disabled}
            className={`model-input-field ${disabled ? 'disabled' : ''}`}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          />
          <small style={{
            display: 'block',
            marginTop: '0.5rem',
            color: '#6b7280',
            fontSize: '0.75rem'
          }}>
            Enter the exact model name from the provider's documentation
          </small>
        </div>
      </div>
    );
  }

  // Render dropdown for Ollama and LM Studio
  return (
    <div className={`model-selector-enhanced ${className}`}>
      <div className="model-selector-header">
        <label className="model-selector-label">
          <Cpu className="w-4 h-4" />
          <span>AI Model</span>
        </label>
        {/* Add refresh button */}
        {!loading && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🔄 Manual refresh triggered');
              loadModels();
            }}
            className="model-refresh-button"
            title="Refresh models"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              color: '#6b7280'
            }}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>

      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || loading || models.length === 0}
        className={`model-selector-button ${isOpen ? 'open' : ''} ${disabled || loading || models.length === 0 ? 'disabled' : ''}`}
        title={
          disabled ? 'Model selection disabled' :
          loading ? 'Loading models...' :
          models.length === 0 ? 'No models available. Click refresh or configure provider.' :
          'Select a model'
        }
      >
        <div className="model-selector-content">
          <div className="model-info">
            <div className="model-icon">
              <Cpu className="w-5 h-5" />
            </div>
            <div className="model-details">
              <span className="model-name">
                {loading ? 'Loading models...' :
                 error ? 'Error loading models - Click refresh' :
                 models.length === 0 ? 'No models found - Click refresh' :
                 selectedModelData?.display_name || selectedModel || 'Select Model'}
              </span>
              {selectedModelData && selectedModelData.max_tokens && (
                <span className="model-tokens">
                  {formatTokenCount(selectedModelData.max_tokens)} tokens max
                </span>
              )}
            </div>
          </div>
          <div className="model-selector-indicators">
            {getStatusIcon()}
            <ChevronDown className={`chevron-icon ${isOpen ? 'rotated' : ''}`} />
          </div>
        </div>
      </button>

      {error && (
        <div className="model-selector-error">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              loadModels();
            }}
            style={{
              marginLeft: 'auto',
              padding: '4px 8px',
              fontSize: '12px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}

      {!error && !loading && models.length === 0 && (
        <div className="model-selector-info" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: '#fef3c7',
          border: '1px solid #fbbf24',
          borderRadius: '6px',
          fontSize: '13px',
          color: '#92400e',
          marginTop: '8px'
        }}>
          <AlertCircle className="w-4 h-4" />
          <span>No models discovered. Make sure {selectedProvider === 'lm_studio' ? 'LM Studio' : 'Ollama'} is running with a model loaded.</span>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              loadModels();
            }}
            style={{
              marginLeft: 'auto',
              padding: '4px 8px',
              fontSize: '12px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>
        </div>
      )}

      {isOpen && models.length > 0 && (
        <div className="model-selector-dropdown">
          <div className="dropdown-content">
            {models.map((model) => (
              <button
                key={model.name}
                onClick={() => handleModelSelect(model.name)}
                className={`model-option ${selectedModel === model.name ? 'selected' : ''}`}
              >
                <div className="model-option-content">
                  <div className="model-option-icon">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div className="model-option-details">
                    <span className="model-option-name">{model.display_name}</span>
                    {model.description && (
                      <span className="model-option-description">{model.description}</span>
                    )}
                  </div>
                </div>
                <div className="model-option-meta">
                  {model.max_tokens && (
                    <span className="token-badge">
                      {formatTokenCount(model.max_tokens)}
                    </span>
                  )}
                  {selectedModel === model.name && (
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

export default ModelSelector;
