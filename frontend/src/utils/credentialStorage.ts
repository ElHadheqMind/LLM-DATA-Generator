/**
 * Pure In-Memory Credential Storage Utility
 *
 * ⚠️ IMPORTANT: CREDENTIALS ARE STORED IN MEMORY ONLY (NOT PERSISTED)
 *
 * Security Model:
 * - ✅ Credentials stored in JavaScript memory ONLY (React state)
 * - ✅ NO localStorage, NO sessionStorage, NO cookies
 * - ✅ Credentials DISAPPEAR on page refresh/reload
 * - ✅ Maximum security - nothing to steal from browser storage
 * - ✅ XSS attacks cannot steal credentials from storage
 * - ✅ Keys are sent with each request via HTTP headers (secured by HTTPS)
 *
 * User Experience:
 * - ⚠️ Users must re-enter API keys after page refresh
 * - ⚠️ Credentials lost if browser tab is closed
 * - ✅ Maximum privacy and security
 *
 * Why In-Memory Only?
 * - localStorage/sessionStorage are vulnerable to XSS attacks
 * - Any malicious JavaScript can read browser storage
 * - In-memory storage is cleared on refresh (nothing to steal)
 */

export interface ProviderCredentials {
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
  custom_params?: Record<string, any>;
}

// ⚠️ IN-MEMORY STORAGE ONLY - No persistence
// This object is cleared when page refreshes
const IN_MEMORY_CREDENTIALS: Record<string, ProviderCredentials> = {};

/**
 * Save credentials for a specific provider to IN-MEMORY storage ONLY
 *
 * ⚠️ WARNING: Credentials are NOT persisted - they will be lost on page refresh
 * This is intentional for maximum security (no localStorage/sessionStorage vulnerabilities)
 */
export const saveProviderCredentials = (providerId: string, credentials: Partial<ProviderCredentials>): boolean => {
  try {
    // Get existing credentials if any
    const existing = getProviderCredentials(providerId);

    // Merge with existing credentials
    const merged: ProviderCredentials = {
      provider_id: providerId,
      ...existing,
      ...credentials,
    };

    // Remove undefined/null values
    Object.keys(merged).forEach(key => {
      if (merged[key as keyof ProviderCredentials] === undefined || merged[key as keyof ProviderCredentials] === null) {
        delete merged[key as keyof ProviderCredentials];
      }
    });

    // Store in memory ONLY (not localStorage)
    IN_MEMORY_CREDENTIALS[providerId] = merged;

    console.log(`✅ Credentials saved in memory (temporary) for provider: ${providerId}`);
    console.warn(`⚠️ Credentials will be lost on page refresh - this is intentional for maximum security`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to save credentials for ${providerId}:`, error);
    return false;
  }
};

/**
 * Get credentials for a specific provider from IN-MEMORY storage
 *
 * ⚠️ Returns null if page was refreshed (credentials are temporary)
 */
export const getProviderCredentials = (providerId: string): ProviderCredentials | null => {
  try {
    // Get from in-memory storage only
    return IN_MEMORY_CREDENTIALS[providerId] || null;
  } catch (error) {
    console.error(`❌ Failed to get credentials for ${providerId}:`, error);
    return null;
  }
};

/**
 * Get masked credentials for display (showing only last 4 characters)
 */
export const getMaskedCredentials = (providerId: string): ProviderCredentials | null => {
  const credentials = getProviderCredentials(providerId);
  
  if (!credentials) {
    return null;
  }
  
  const masked = { ...credentials };
  
  // Mask sensitive fields
  if (masked.api_key) {
    masked.api_key = maskValue(masked.api_key);
  }
  if (masked.secret_access_key) {
    masked.secret_access_key = maskValue(masked.secret_access_key);
  }
  if (masked.service_account_json) {
    masked.service_account_json = '***CONFIGURED***';
  }
  
  return masked;
};

/**
 * Mask a sensitive value, showing only last 4 characters
 */
const maskValue = (value: string, visibleChars: number = 4): string => {
  if (!value || value.length <= visibleChars) {
    return '***';
  }
  return '*'.repeat(value.length - visibleChars) + value.slice(-visibleChars);
};

/**
 * Delete credentials for a specific provider from IN-MEMORY storage
 */
export const deleteProviderCredentials = (providerId: string): boolean => {
  try {
    delete IN_MEMORY_CREDENTIALS[providerId];
    console.log(`✅ Credentials deleted from memory for provider: ${providerId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete credentials for ${providerId}:`, error);
    return false;
  }
};

/**
 * Get list of all configured providers from IN-MEMORY storage
 */
export const listConfiguredProviders = (): string[] => {
  try {
    return Object.keys(IN_MEMORY_CREDENTIALS);
  } catch (error) {
    console.error('❌ Failed to list configured providers:', error);
    return [];
  }
};

/**
 * Get all credentials (masked) for display
 */
export const getAllMaskedCredentials = (): Record<string, ProviderCredentials> => {
  const providers = listConfiguredProviders();
  const credentials: Record<string, ProviderCredentials> = {};
  
  providers.forEach(providerId => {
    const masked = getMaskedCredentials(providerId);
    if (masked) {
      credentials[providerId] = masked;
    }
  });
  
  return credentials;
};

/**
 * Clear all stored credentials from IN-MEMORY storage
 */
export const clearAllCredentials = (): boolean => {
  try {
    Object.keys(IN_MEMORY_CREDENTIALS).forEach(key => {
      delete IN_MEMORY_CREDENTIALS[key];
    });
    console.log('✅ All credentials cleared from memory');
    return true;
  } catch (error) {
    console.error('❌ Failed to clear all credentials:', error);
    return false;
  }
};

/**
 * Check if credentials exist for a provider
 */
export const hasCredentials = (providerId: string): boolean => {
  const credentials = getProviderCredentials(providerId);
  return credentials !== null && !!credentials.api_key;
};

/**
 * Validate credentials for a provider
 */
export const validateCredentials = (providerId: string, credentials: Partial<ProviderCredentials>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Provider-specific validation
  switch (providerId) {
    case 'openai':
      if (!credentials.api_key) {
        errors.push('API Key is required for OpenAI');
      } else if (!credentials.api_key.startsWith('sk-')) {
        errors.push('OpenAI API Key should start with "sk-"');
      }
      break;
      
    case 'google_gemini':
      if (!credentials.api_key) {
        errors.push('API Key is required for Google Gemini');
      }
      break;
      
    case 'azure_openai':
      if (!credentials.api_key) {
        errors.push('API Key is required for Azure OpenAI');
      }
      if (!credentials.endpoint) {
        errors.push('Endpoint is required for Azure OpenAI');
      }
      if (!credentials.deployment_name) {
        errors.push('Deployment Name is required for Azure OpenAI');
      }
      break;
      
    case 'lm_studio':
    case 'ollama':
      // Local providers don't require API keys
      break;
      
    default:
      // Generic validation
      break;
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Export credentials for backup (user-initiated)
 *
 * ⚠️ NOTE: Since credentials are in-memory only, this exports current session credentials
 * Useful for transferring credentials to another tab/window before refresh
 */
export const exportCredentials = (): string => {
  const providers = listConfiguredProviders();
  const allCredentials: Record<string, ProviderCredentials> = {};

  providers.forEach(providerId => {
    const creds = getProviderCredentials(providerId);
    if (creds) {
      allCredentials[providerId] = creds;
    }
  });

  console.warn('⚠️ Exporting in-memory credentials - these are temporary and will be lost on refresh');
  return JSON.stringify(allCredentials, null, 2);
};

/**
 * Import credentials from backup (user-initiated)
 *
 * ⚠️ NOTE: Imported credentials are stored in-memory only and will be lost on refresh
 */
export const importCredentials = (jsonString: string): { success: boolean; imported: number; errors: string[] } => {
  const errors: string[] = [];
  let imported = 0;

  try {
    const credentials = JSON.parse(jsonString) as Record<string, ProviderCredentials>;

    Object.entries(credentials).forEach(([providerId, creds]) => {
      try {
        if (saveProviderCredentials(providerId, creds)) {
          imported++;
        } else {
          errors.push(`Failed to import credentials for ${providerId}`);
        }
      } catch (error) {
        errors.push(`Error importing ${providerId}: ${error}`);
      }
    });

    console.warn('⚠️ Imported credentials are stored in-memory only and will be lost on refresh');

    return {
      success: imported > 0,
      imported,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      imported: 0,
      errors: [`Invalid JSON format: ${error}`],
    };
  }
};

/**
 * Get storage usage information
 */
export const getCredentialStorageInfo = (): { count: number; providers: string[] } => {
  const providers = listConfiguredProviders();
  return {
    count: providers.length,
    providers,
  };
};

