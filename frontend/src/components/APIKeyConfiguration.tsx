import React, { useState, useEffect } from 'react';
import { X, Save, Eye, EyeOff, CheckCircle, AlertCircle, Loader, Key, Cloud, Server, Info, Download, Upload } from 'lucide-react';
import { useToast } from './ToastContainer';
import ApiService from '../services/api';
import {
  saveProviderCredentials,
  getProviderCredentials,
  getMaskedCredentials,
  deleteProviderCredentials,
  getAllMaskedCredentials,
  validateCredentials,
  exportCredentials,
  importCredentials
} from '../utils/credentialStorage';
import './APIKeyConfiguration.css';

interface ProviderConfig {
  provider_id: string;
  api_key?: string;
  endpoint?: string;
  deployment_name?: string;
  api_version?: string;
  model_name?: string;
  region?: string;
  project_id?: string;
  access_key_id?: string;
  secret_access_key?: string;
  service_account_json?: string;
}

interface APIKeyConfigurationProps {
  onClose: () => void;
  onSave?: () => void;
}

const APIKeyConfiguration: React.FC<APIKeyConfigurationProps> = ({ onClose, onSave }) => {
  const { showSuccess, showError, showInfo } = useToast();
  const [activeTab, setActiveTab] = useState<string>('openai');
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  // Form states for each provider
  const [openaiConfig, setOpenaiConfig] = useState<ProviderConfig>({
    provider_id: 'openai',
    api_key: '',
    endpoint: 'https://api.openai.com/v1',
    model_name: 'gpt-4o'
  });
  
  const [azureOpenaiConfig, setAzureOpenaiConfig] = useState<ProviderConfig>({
    provider_id: 'azure_openai',
    api_key: '',
    endpoint: '',
    deployment_name: '',
    api_version: '2024-02-01'
  });
  
  const [awsBedrockConfig, setAwsBedrockConfig] = useState<ProviderConfig>({
    provider_id: 'aws_bedrock',
    access_key_id: '',
    secret_access_key: '',
    region: 'us-east-1',
    model_name: 'anthropic.claude-3-sonnet-20240229-v1:0'
  });
  
  const [googleVertexConfig, setGoogleVertexConfig] = useState<ProviderConfig>({
    provider_id: 'google_vertex_ai',
    project_id: '',
    region: 'us-central1',
    service_account_json: '',
    model_name: 'gemini-1.5-pro'
  });

  useEffect(() => {
    loadExistingCredentials();
  }, []);

  const loadExistingCredentials = () => {
    try {
      // Load credentials from localStorage (browser-local storage)
      const allCredentials = getAllMaskedCredentials();

      // Load existing credentials (they will be masked)
      if (allCredentials.openai) {
        setOpenaiConfig(prev => ({ ...prev, ...allCredentials.openai }));
      }
      if (allCredentials.azure_openai) {
        setAzureOpenaiConfig(prev => ({ ...prev, ...allCredentials.azure_openai }));
      }
      if (allCredentials.aws_bedrock) {
        setAwsBedrockConfig(prev => ({ ...prev, ...allCredentials.aws_bedrock }));
      }
      if (allCredentials.google_vertex_ai) {
        setGoogleVertexConfig(prev => ({ ...prev, ...allCredentials.google_vertex_ai }));
      }

      console.log('✅ Loaded credentials from browser localStorage');
    } catch (error: any) {
      console.error('Failed to load credentials from localStorage:', error);
    }
  };

  const toggleSecretVisibility = (field: string) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSave = async (providerId: string, config: ProviderConfig) => {
    setIsSaving(true);
    try {
      // Validate credentials before saving
      const validation = validateCredentials(providerId, config);
      if (!validation.valid) {
        showError('Validation failed', validation.errors.join(', '));
        setIsSaving(false);
        return;
      }

      // Save credentials to localStorage (browser-local storage only)
      const success = saveProviderCredentials(providerId, config);

      if (success) {
        showSuccess(`${getProviderDisplayName(providerId)} credentials saved in memory (temporary)!`);
        showInfo('⚠️ IMPORTANT: Credentials are stored in memory ONLY and will be lost on page refresh!');
        showInfo('🔒 Maximum security: No localStorage, no sessionStorage, no persistence');

        // Immediately reload credentials to get the masked version
        loadExistingCredentials();

        // Notify parent component to refresh provider status
        onSave?.();
      } else {
        showError('Failed to save credentials', 'Could not save credentials');
      }
    } catch (error: any) {
      showError('Failed to save credentials', error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async (providerId: string) => {
    setIsTesting(true);
    try {
      const response = await ApiService.testAIProvider(providerId);
      if (response.success) {
        showSuccess(`${getProviderDisplayName(providerId)} connection successful!`);
      } else {
        showError(`${getProviderDisplayName(providerId)} connection failed`, response.error || 'Unknown error');
      }
    } catch (error: any) {
      showError('Connection test failed', error.message);
    } finally {
      setIsTesting(false);
    }
  };

  const getProviderDisplayName = (providerId: string): string => {
    const names: Record<string, string> = {
      'openai': 'OpenAI',
      'azure_openai': 'Azure OpenAI',
      'aws_bedrock': 'AWS Bedrock',
      'google_vertex_ai': 'Google Vertex AI'
    };
    return names[providerId] || providerId;
  };

  const renderOpenAIForm = () => (
    <div className="provider-form">
      <div className="form-header">
        <Cloud className="provider-icon" />
        <div>
          <h3>OpenAI API Configuration</h3>
          <p>Configure your standard OpenAI API credentials</p>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="openai-api-key">
          <Key size={16} />
          API Key *
        </label>
        <div className="input-with-toggle">
          <input
            id="openai-api-key"
            type={showSecrets['openai-api-key'] ? 'text' : 'password'}
            value={openaiConfig.api_key}
            onChange={(e) => setOpenaiConfig({ ...openaiConfig, api_key: e.target.value })}
            placeholder="sk-..."
          />
          <button
            type="button"
            onClick={() => toggleSecretVisibility('openai-api-key')}
            className="toggle-visibility"
          >
            {showSecrets['openai-api-key'] ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <small>Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI Platform</a></small>
      </div>

      <div className="form-group">
        <label htmlFor="openai-endpoint">API Endpoint</label>
        <input
          id="openai-endpoint"
          type="text"
          value={openaiConfig.endpoint}
          onChange={(e) => setOpenaiConfig({ ...openaiConfig, endpoint: e.target.value })}
          placeholder="https://api.openai.com/v1"
        />
      </div>

      <div className="form-group">
        <label htmlFor="openai-model">Model Name</label>
        <input
          id="openai-model"
          type="text"
          value={openaiConfig.model_name}
          onChange={(e) => setOpenaiConfig({ ...openaiConfig, model_name: e.target.value })}
          placeholder="e.g., gpt-4o, gpt-4-turbo, gpt-3.5-turbo"
        />
        <small>Enter the exact model name from OpenAI's documentation</small>
      </div>

      <div className="form-actions">
        <button
          onClick={() => handleTest('openai')}
          disabled={!openaiConfig.api_key || isTesting}
          className="btn btn-secondary"
        >
          {isTesting ? <Loader className="spinning" size={16} /> : <CheckCircle size={16} />}
          Test Connection
        </button>
        <button
          onClick={() => handleSave('openai', openaiConfig)}
          disabled={!openaiConfig.api_key || isSaving}
          className="btn btn-primary"
        >
          {isSaving ? <Loader className="spinning" size={16} /> : <Save size={16} />}
          Save Configuration
        </button>
      </div>
    </div>
  );

  const renderAzureOpenAIForm = () => (
    <div className="provider-form">
      <div className="form-header">
        <Cloud className="provider-icon azure" />
        <div>
          <h3>Azure OpenAI Configuration</h3>
          <p>Configure your Azure OpenAI Service credentials</p>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="azure-endpoint">
          Azure Endpoint *
        </label>
        <input
          id="azure-endpoint"
          type="text"
          value={azureOpenaiConfig.endpoint}
          onChange={(e) => setAzureOpenaiConfig({ ...azureOpenaiConfig, endpoint: e.target.value })}
          placeholder="https://your-resource.openai.azure.com/"
        />
      </div>

      <div className="form-group">
        <label htmlFor="azure-api-key">
          <Key size={16} />
          API Key *
        </label>
        <div className="input-with-toggle">
          <input
            id="azure-api-key"
            type={showSecrets['azure-api-key'] ? 'text' : 'password'}
            value={azureOpenaiConfig.api_key}
            onChange={(e) => setAzureOpenaiConfig({ ...azureOpenaiConfig, api_key: e.target.value })}
            placeholder="Your Azure OpenAI API key"
          />
          <button
            type="button"
            onClick={() => toggleSecretVisibility('azure-api-key')}
            className="toggle-visibility"
          >
            {showSecrets['azure-api-key'] ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="azure-deployment">Deployment Name *</label>
        <input
          id="azure-deployment"
          type="text"
          value={azureOpenaiConfig.deployment_name}
          onChange={(e) => setAzureOpenaiConfig({ ...azureOpenaiConfig, deployment_name: e.target.value })}
          placeholder="gpt-4o"
        />
      </div>

      <div className="form-group">
        <label htmlFor="azure-api-version">API Version</label>
        <input
          id="azure-api-version"
          type="text"
          value={azureOpenaiConfig.api_version}
          onChange={(e) => setAzureOpenaiConfig({ ...azureOpenaiConfig, api_version: e.target.value })}
          placeholder="2024-02-01"
        />
      </div>

      <div className="form-actions">
        <button
          onClick={() => handleTest('azure_openai')}
          disabled={!azureOpenaiConfig.endpoint || !azureOpenaiConfig.deployment_name || isTesting}
          className="btn btn-secondary"
        >
          {isTesting ? <Loader className="spinning" size={16} /> : <CheckCircle size={16} />}
          Test Connection
        </button>
        <button
          onClick={() => handleSave('azure_openai', azureOpenaiConfig)}
          disabled={!azureOpenaiConfig.endpoint || !azureOpenaiConfig.deployment_name || isSaving}
          className="btn btn-primary"
        >
          {isSaving ? <Loader className="spinning" size={16} /> : <Save size={16} />}
          Save Configuration
        </button>
      </div>
    </div>
  );

  return (
    <div className="api-key-configuration-overlay">
      <div className="api-key-configuration">
        <div className="config-header">
          <h2>
            <Key size={24} />
            API Key Configuration
          </h2>
          <button onClick={onClose} className="close-button">
            <X size={24} />
          </button>
        </div>

        {/* Prominent Warning Banner */}
        <div style={{
          backgroundColor: '#fff3cd',
          border: '2px solid #ffc107',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <AlertCircle size={24} color="#856404" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#856404', fontSize: '16px' }}>⚠️ TEMPORARY STORAGE - Credentials Lost on Refresh</strong>
            <p style={{ margin: '8px 0 0 0', color: '#856404', fontSize: '14px' }}>
              Your API keys are stored <strong>in memory only</strong> for maximum security.
              They will be <strong>automatically deleted when you refresh the page or close the browser</strong>.
              This protects against XSS attacks and browser storage vulnerabilities.
            </p>
            <p style={{ margin: '8px 0 0 0', color: '#856404', fontSize: '14px' }}>
              💡 <strong>You'll need to re-enter your API keys after each page refresh.</strong>
              This is intentional for your security and privacy.
            </p>
          </div>
        </div>

        <div className="config-tabs">
          <button
            className={`tab active`}
          >
            <Cloud size={16} />
            OpenAI
          </button>
        </div>

        <div className="config-content">
          {renderOpenAIForm()}
        </div>

        <div className="config-footer">
          <div className="info-box" style={{ backgroundColor: '#fff3cd', borderColor: '#ffc107' }}>
            <Info size={16} />
            <div>
              <strong>⚠️ TEMPORARY IN-MEMORY STORAGE (Maximum Security):</strong>
              <br />
              <small>• ✅ Credentials stored in memory ONLY (not localStorage, not sessionStorage)</small>
              <br />
              <small>• ⚠️ Credentials will be LOST on page refresh - this is intentional for security</small>
              <br />
              <small>• 🔒 Maximum protection against XSS attacks and browser storage vulnerabilities</small>
              <br />
              <small>• ❌ Keys are NEVER sent to or stored on our servers</small>
              <br />
              <small>• 💡 You'll need to re-enter your API keys after each page refresh</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APIKeyConfiguration;

