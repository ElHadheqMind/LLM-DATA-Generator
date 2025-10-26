import React, { useState, useEffect } from 'react';
import { X, Settings, CheckCircle, AlertCircle, Loader, Key, Eye, EyeOff, Shield, Server, Zap, Sparkles } from 'lucide-react';
import { useToast } from './ToastContainer';
import ApiService from '../services/api';
import {
  saveProviderCredentials,
  getProviderCredentials,
  validateCredentials
} from '../utils/credentialStorage';
import { useProviderStatusManager } from '../hooks/useProviderStatusManager';
import './AIProviderManagement.css';

interface ProviderConfig {
  api_key: string;
  model_name: string;
}

interface ProviderStatus {
  available: boolean;
  testing: boolean;
  error?: string;
}

interface AIProviderManagementProps {
  onClose: () => void;
}

const AIProviderManagement: React.FC<AIProviderManagementProps> = ({ onClose }) => {
  const { showSuccess, showError } = useToast();

  // Use the centralized provider status manager
  const {
    statuses,
    updateStatus,
    saveLocalEndpoint,
    getLocalEndpoint
  } = useProviderStatusManager();

  // Load existing credentials from in-memory storage on mount
  const loadedOpenai = getProviderCredentials('openai');
  const loadedGemini = getProviderCredentials('google_gemini');

  // In-memory configuration state (persists until page refresh)
  const [openaiConfig, setOpenaiConfig] = useState<ProviderConfig>({
    api_key: (loadedOpenai?.api_key as string) || '',
    model_name: (loadedOpenai?.model_name as string) || ''
  });
  const [geminiConfig, setGeminiConfig] = useState<ProviderConfig>({
    api_key: (loadedGemini?.api_key as string) || '',
    model_name: (loadedGemini?.model_name as string) || ''
  });

  // LM Studio and Ollama configurations (loaded from localStorage via manager)
  const [lmStudioEndpoint, setLmStudioEndpoint] = useState(
    getLocalEndpoint('lm_studio') || 'http://localhost:1234/v1'
  );
  const [ollamaEndpoint, setOllamaEndpoint] = useState(
    getLocalEndpoint('ollama') || 'http://localhost:11434'
  );

  // Show/hide API keys
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  // Input sanitization
  const sanitizeInput = (input: string): string => {
    return input.trim().replace(/[<>]/g, '');
  };

  // Get status from centralized manager
  const openaiStatus: ProviderStatus = {
    available: statuses.openai?.available || false,
    testing: statuses.openai?.testing || false,
    error: statuses.openai?.error
  };

  const geminiStatus: ProviderStatus = {
    available: statuses.google_gemini?.available || false,
    testing: statuses.google_gemini?.testing || false,
    error: statuses.google_gemini?.error
  };

  const lmStudioStatus: ProviderStatus = {
    available: statuses.lm_studio?.available || false,
    testing: statuses.lm_studio?.testing || false,
    error: statuses.lm_studio?.error
  };

  const ollamaStatus: ProviderStatus = {
    available: statuses.ollama?.available || false,
    testing: statuses.ollama?.testing || false,
    error: statuses.ollama?.error
  };

  // Initialize local provider endpoints in credentialStorage on mount
  // This ensures endpoints are available for API calls
  useEffect(() => {
    // Load LM Studio endpoint from localStorage and save to credentialStorage
    const lmStudioEndpointFromStorage = getLocalEndpoint('lm_studio');
    if (lmStudioEndpointFromStorage) {
      saveProviderCredentials('lm_studio', { endpoint: lmStudioEndpointFromStorage });
    }

    // Load Ollama endpoint from localStorage and save to credentialStorage
    const ollamaEndpointFromStorage = getLocalEndpoint('ollama');
    if (ollamaEndpointFromStorage) {
      saveProviderCredentials('ollama', { endpoint: ollamaEndpointFromStorage });
    }
  }, []); // Run once on mount

  // NO AUTO-TESTING on mount - only test when user explicitly clicks "Save & Test" or "Test Connection"
  // This prevents unnecessary API calls and respects user's intent

  // Test connection and update status
  const testConnection = async (providerId: string, config: ProviderConfig | { endpoint: string }) => {
    try {
      // Save to in-memory storage (or localStorage for local providers)
      saveProviderCredentials(providerId, config);

      // Mark as testing
      updateStatus(providerId, { testing: true, error: undefined });

      // Test the connection
      const response = await ApiService.testAIProvider(providerId);

      // Update status from backend response
      if (response.success) {
        updateStatus(providerId, {
          available: true,
          testing: false,
          error: undefined
        });
      } else {
        updateStatus(providerId, {
          available: false,
          testing: false,
          error: response.error || 'Connection failed'
        });
      }

      return response.success;
    } catch (error) {
      console.error(`Test failed for ${providerId}:`, error);

      // Update status on error
      updateStatus(providerId, {
        available: false,
        testing: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      });

      return false;
    }
  };

  // Handle OpenAI Save & Test
  const handleOpenAISave = async () => {
    // Sanitize inputs
    const sanitizedConfig = {
      api_key: sanitizeInput(openaiConfig.api_key),
      model_name: sanitizeInput(openaiConfig.model_name)
    };

    // Validate
    if (!sanitizedConfig.api_key || !sanitizedConfig.model_name) {
      showError('Missing fields', 'Please enter both API key and model name');
      return;
    }

    // Additional validation
    const validation = validateCredentials('openai', sanitizedConfig);
    if (!validation.valid) {
      showError('Validation failed', validation.errors.join(', '));
      return;
    }

    // Test connection (this also updates status)
    const success = await testConnection('openai', sanitizedConfig);

    if (success) {
      showSuccess('OpenAI configured and tested successfully');
      // Update state with sanitized values
      setOpenaiConfig(sanitizedConfig);
    } else {
      showError('OpenAI connection failed', 'Please check your API key and model name');
    }
  };

  // Handle Gemini Save & Test
  const handleGeminiSave = async () => {
    // Sanitize inputs
    const sanitizedConfig = {
      api_key: sanitizeInput(geminiConfig.api_key),
      model_name: sanitizeInput(geminiConfig.model_name)
    };

    // Validate
    if (!sanitizedConfig.api_key || !sanitizedConfig.model_name) {
      showError('Missing fields', 'Please enter both API key and model name');
      return;
    }

    // Additional validation
    const validation = validateCredentials('google_gemini', sanitizedConfig);
    if (!validation.valid) {
      showError('Validation failed', validation.errors.join(', '));
      return;
    }

    // Test connection (this also updates status)
    const success = await testConnection('google_gemini', sanitizedConfig);

    if (success) {
      showSuccess('Gemini configured and tested successfully');
      // Update state with sanitized values
      setGeminiConfig(sanitizedConfig);
    } else {
      showError('Gemini connection failed', 'Please check your API key and model name');
    }
  };

  // Handle LM Studio Save & Test
  const handleLMStudioSave = async () => {
    if (!lmStudioEndpoint) {
      showError('Missing endpoint', 'Please enter the LM Studio endpoint');
      return;
    }

    // Save endpoint to credentialStorage (in-memory) so it's sent as headers
    // This is required for the backend to receive the endpoint configuration
    saveProviderCredentials('lm_studio', { endpoint: lmStudioEndpoint });

    // Test connection (this also updates status)
    const success = await testConnection('lm_studio', { endpoint: lmStudioEndpoint });

    if (success) {
      // Save endpoint to localStorage with available=true
      saveLocalEndpoint('lm_studio', lmStudioEndpoint, true);
      showSuccess('LM Studio configured and tested successfully');
    } else {
      // Save endpoint to localStorage with available=false
      saveLocalEndpoint('lm_studio', lmStudioEndpoint, false);
      showError('LM Studio connection failed', 'Please check if LM Studio is running and has a model loaded');
    }
  };

  // Handle Ollama Save & Test
  const handleOllamaSave = async () => {
    if (!ollamaEndpoint) {
      showError('Missing endpoint', 'Please enter the Ollama endpoint');
      return;
    }

    // Save endpoint to credentialStorage (in-memory) so it's sent as headers
    // This is required for the backend to receive the endpoint configuration
    saveProviderCredentials('ollama', { endpoint: ollamaEndpoint });

    // Test connection (this also updates status)
    const success = await testConnection('ollama', { endpoint: ollamaEndpoint });

    if (success) {
      // Save endpoint to localStorage with available=true
      saveLocalEndpoint('ollama', ollamaEndpoint, true);
      showSuccess('Ollama configured and tested successfully');
    } else {
      // Save endpoint to localStorage with available=false
      saveLocalEndpoint('ollama', ollamaEndpoint, false);
      showError('Ollama connection failed', 'Please check if Ollama is running (try: ollama serve)');
    }
  };



  // Manual test functions (simplified - testConnection handles status updates)
  const handleOpenAITest = async () => {
    const creds = getProviderCredentials('openai');
    if (!creds || !creds.api_key) {
      showError('Not configured', 'Please save your OpenAI configuration first');
      return;
    }
    const success = await testConnection('openai', creds as ProviderConfig);
    if (success) {
      showSuccess('OpenAI connection successful');
    } else {
      showError('OpenAI connection failed');
    }
  };

  const handleGeminiTest = async () => {
    const creds = getProviderCredentials('google_gemini');
    if (!creds || !creds.api_key) {
      showError('Not configured', 'Please save your Gemini configuration first');
      return;
    }
    const success = await testConnection('google_gemini', creds as ProviderConfig);
    if (success) {
      showSuccess('Gemini connection successful');
    } else {
      showError('Gemini connection failed');
    }
  };

  const handleLMStudioTest = async () => {
    const endpoint = getLocalEndpoint('lm_studio') || lmStudioEndpoint;
    if (!endpoint) {
      showError('Not configured', 'Please save your LM Studio configuration first');
      return;
    }
    // Save to credentialStorage before testing
    saveProviderCredentials('lm_studio', { endpoint });

    const success = await testConnection('lm_studio', { endpoint });
    if (success) {
      saveLocalEndpoint('lm_studio', endpoint, true);
      showSuccess('LM Studio connection successful');
    } else {
      const endpoint = getLocalEndpoint('lm_studio') || lmStudioEndpoint;
      saveLocalEndpoint('lm_studio', endpoint, false);
      showError('LM Studio connection failed');
    }
  };

  const handleOllamaTest = async () => {
    const endpoint = getLocalEndpoint('ollama') || ollamaEndpoint;
    if (!endpoint) {
      showError('Not configured', 'Please save your Ollama configuration first');
      return;
    }
    // Save to credentialStorage before testing
    saveProviderCredentials('ollama', { endpoint });

    const success = await testConnection('ollama', { endpoint });
    if (success) {
      saveLocalEndpoint('ollama', endpoint, true);
      showSuccess('Ollama connection successful');
    } else {
      saveLocalEndpoint('ollama', endpoint, false);
      showError('Ollama connection failed');
    }
  };

  // Render professional provider card
  const renderProviderCard = (
    title: string,
    icon: React.ReactNode,
    status: ProviderStatus,
    config: ProviderConfig | { endpoint: string },
    setConfig: (config: any) => void,
    onSave: () => void,
    onTest: () => void,
    isApiKeyBased: boolean = true,
    showKey?: boolean,
    setShowKey?: (show: boolean) => void
  ) => {
    const isConfigured = isApiKeyBased
      ? !!(config as ProviderConfig).api_key && !!(config as ProviderConfig).model_name
      : !!(config as { endpoint: string }).endpoint;

    return (
      <div className={`provider-card ${status.available ? 'configured' : ''}`}>
        <div className="provider-header">
          <div className="provider-title">
            {icon}
            <h3>{title}</h3>
          </div>
          <div className="status-badge">
            {status.testing ? (
              <>
                <Loader className="icon spinning" size={16} />
                <span className="status-text testing">Testing...</span>
              </>
            ) : status.available ? (
              <>
                <CheckCircle className="icon" size={16} />
                <span className="status-text available">Connected</span>
              </>
            ) : isConfigured ? (
              <>
                <AlertCircle className="icon" size={16} />
                <span className="status-text error">Not Connected</span>
              </>
            ) : (
              <>
                <AlertCircle className="icon" size={16} />
                <span className="status-text unconfigured">Not Configured</span>
              </>
            )}
          </div>
        </div>

        <div className="form-fields">
          {isApiKeyBased ? (
            <>
              <div className="form-field">
                <label>
                  <Key size={16} />
                  API Key
                </label>
                <div className="input-with-toggle">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={(config as ProviderConfig).api_key}
                    onChange={(e) => setConfig({ ...(config as ProviderConfig), api_key: e.target.value })}
                    placeholder="Enter your API key"
                    className="input-field"
                    autoComplete="off"
                  />
                  {setShowKey && (
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="toggle-visibility"
                      title={showKey ? 'Hide API key' : 'Show API key'}
                    >
                      {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  )}
                </div>
                {(config as ProviderConfig).api_key && title === 'OpenAI' && !(config as ProviderConfig).api_key.startsWith('sk-') && (
                  <span className="field-hint error">OpenAI API keys should start with "sk-"</span>
                )}
              </div>
              <div className="form-field">
                <label>
                  <Zap size={16} />
                  Model Name
                </label>
                <input
                  type="text"
                  value={(config as ProviderConfig).model_name}
                  onChange={(e) => setConfig({ ...(config as ProviderConfig), model_name: e.target.value })}
                  placeholder={title === 'OpenAI' ? 'e.g., gpt-4o, gpt-4o-mini' : 'e.g., gemini-1.5-flash, gemini-1.5-pro'}
                  className="input-field"
                />
              </div>
            </>
          ) : (
            <div className="form-field">
              <label>
                <Server size={16} />
                Endpoint URL
              </label>
              <input
                type="text"
                value={(config as { endpoint: string }).endpoint}
                onChange={(e) => setConfig({ endpoint: e.target.value })}
                placeholder="http://localhost:..."
                className="input-field"
              />
              <span className="field-hint">Local server endpoint (no API key required)</span>
            </div>
          )}
        </div>

        {status.error && (
          <div className="error-message">
            <AlertCircle size={16} />
            <span>{status.error}</span>
          </div>
        )}

        <div className="form-actions">
          <button
            onClick={onSave}
            disabled={status.testing}
            className="btn-save"
          >
            {status.testing ? (
              <>
                <Loader className="icon spinning" size={16} />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Save & Test
              </>
            )}
          </button>
          <button
            onClick={onTest}
            disabled={status.testing || !isConfigured}
            className="btn-test"
            title={!isConfigured ? 'Please save configuration first' : 'Test connection'}
          >
            <Zap size={16} />
            Test
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="ai-provider-management">
      <div className="header">
        <div className="header-content">
          <div className="header-title">
            <Settings className="icon" size={24} />
            <div>
              <h2>AI Provider Configuration</h2>
              <p className="header-subtitle">Configure your AI providers for PDF extraction</p>
            </div>
          </div>
          <button onClick={onClose} className="close-button" title="Close">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="content">
        {/* Security Notice */}
        <div className="security-notice">
          <div className="notice-header">
            <Shield size={20} />
            <h3>Security & Privacy</h3>
          </div>
          <div className="notice-content">
            <p>
              <strong>In-Memory Storage:</strong> Your API keys are stored in browser memory only and will be cleared when you refresh the page.
            </p>
            <p>
              <strong>No Persistence:</strong> Credentials are never saved to disk, localStorage, or any persistent storage for maximum security.
            </p>
            <p>
              <strong>Secure Transmission:</strong> All API keys are sent via HTTPS headers only.
            </p>
          </div>
        </div>

        {/* Cloud Providers */}
        <div className="section">
          <div className="section-header">
            <h3>Cloud AI Providers</h3>
            <p>Configure cloud-based AI services (requires API keys)</p>
          </div>
          <div className="providers-grid">
            {renderProviderCard(
              'Google Gemini',
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22C6.486 22 2 17.514 2 12S6.486 2 12 2s10 4.486 10 10-4.486 10-10 10zm-1-17v10l8.66-5L11 5z"/>
              </svg>,
              geminiStatus,
              geminiConfig,
              setGeminiConfig,
              handleGeminiSave,
              handleGeminiTest,
              true,
              showGeminiKey,
              setShowGeminiKey
            )}

            {renderProviderCard(
              'OpenAI',
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
              </svg>,
              openaiStatus,
              openaiConfig,
              setOpenaiConfig,
              handleOpenAISave,
              handleOpenAITest,
              true,
              showOpenaiKey,
              setShowOpenaiKey
            )}
          </div>

          {/* More Providers Coming Soon Notice */}
          <div className="more-providers-notice">
            <Sparkles size={20} />
            <span>More AI providers coming soon! (Anthropic Claude, Cohere, and more)</span>
          </div>
        </div>

        {/* Local Providers */}
        <div className="section">
          <div className="section-header">
            <h3>Local AI Providers</h3>
            <p>Configure locally-hosted AI services (no API key required)</p>
          </div>
          <div className="providers-grid">
            {renderProviderCard(
              'LM Studio',
              <Server size={20} />,
              lmStudioStatus,
              { endpoint: lmStudioEndpoint },
              (config) => setLmStudioEndpoint(config.endpoint),
              handleLMStudioSave,
              handleLMStudioTest,
              false
            )}

            {renderProviderCard(
              'Ollama',
              <Server size={20} />,
              ollamaStatus,
              { endpoint: ollamaEndpoint },
              (config) => setOllamaEndpoint(config.endpoint),
              handleOllamaSave,
              handleOllamaTest,
              false
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIProviderManagement;
