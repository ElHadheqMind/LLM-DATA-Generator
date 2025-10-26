import axios, { AxiosProgressEvent, AxiosRequestConfig } from 'axios';
import {
  HealthCheckResponse,
  ProcessPdfResponse,
  ExcelDownloadResponse,
  ExcelDownloadRequest,
  QuestionGenerationRequest,
  QuestionGenerationResponse,
  QAExcelDownloadRequest,
  QAExcelDownloadResponse,
  UploadProgress
} from '../types/api';
import { getProviderCredentials, listConfiguredProviders } from '../utils/credentialStorage';

// API Configuration
const API_BASE_URL = 'http://localhost:5000/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Add credential headers to request config
 *
 * ⚠️ IMPORTANT: Credentials are retrieved from IN-MEMORY storage (not localStorage)
 * This function retrieves API keys from in-memory storage and adds them to request headers
 * Keys are NEVER stored on the backend - only sent per-request via HTTPS
 *
 * @param config - Optional axios request config to merge with
 * @returns Updated config with credential headers
 */
const addCredentialHeaders = (config: AxiosRequestConfig = {}): AxiosRequestConfig => {
  const headers = { ...config.headers };

  // Get all configured providers from IN-MEMORY storage
  const providers = listConfiguredProviders();

  // Add credentials for each provider as headers
  providers.forEach(providerId => {
    const credentials = getProviderCredentials(providerId);
    if (credentials) {
      // Add API key header for this provider
      if (credentials.api_key) {
        headers[`X-API-Key-${providerId.replace(/_/g, '-')}`] = credentials.api_key;
      }

      // Add other provider-specific headers
      if (credentials.endpoint) {
        headers[`X-Endpoint-${providerId.replace(/_/g, '-')}`] = credentials.endpoint;
      }
      if (credentials.deployment_name) {
        headers[`X-Deployment-${providerId.replace(/_/g, '-')}`] = credentials.deployment_name;
      }
      if (credentials.api_version) {
        headers[`X-API-Version-${providerId.replace(/_/g, '-')}`] = credentials.api_version;
      }
      if (credentials.model_name) {
        headers[`X-Model-${providerId.replace(/_/g, '-')}`] = credentials.model_name;
      }
      if (credentials.region) {
        headers[`X-Region-${providerId.replace(/_/g, '-')}`] = credentials.region;
      }
      if (credentials.project_id) {
        headers[`X-Project-${providerId.replace(/_/g, '-')}`] = credentials.project_id;
      }
      if (credentials.access_key_id) {
        headers[`X-Access-Key-${providerId.replace(/_/g, '-')}`] = credentials.access_key_id;
      }
      if (credentials.secret_access_key) {
        headers[`X-Secret-Key-${providerId.replace(/_/g, '-')}`] = credentials.secret_access_key;
      }
    }
  });

  return {
    ...config,
    headers,
  };
};

// API Service Class
export class ApiService {
  /**
   * Health check endpoint
   */
  static async healthCheck(): Promise<HealthCheckResponse> {
    try {
      const response = await apiClient.get<HealthCheckResponse>('/health');
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error);
      throw new Error('Failed to connect to backend service');
    }
  }

  /**
   * Upload and process PDF file
   */
  static async processPdf(
    file: File,
    onProgress?: (progress: UploadProgress) => void,
    cleanOutput?: boolean
  ): Promise<ProcessPdfResponse> {
    try {
      const formData = new FormData();
      formData.append('pdf', file);

      // Add clean output option
      if (cleanOutput !== undefined) {
        formData.append('clean_output', cleanOutput.toString());
      }

      const response = await apiClient.post<ProcessPdfResponse>('/process-pdf', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress: UploadProgress = {
              loaded: progressEvent.loaded,
              total: progressEvent.total,
              percentage: Math.round((progressEvent.loaded * 100) / progressEvent.total),
            };
            onProgress(progress);
          }
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('PDF processing failed:', error);
      
      // Handle different error types
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout. Please try again.');
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error('Cannot connect to backend service. Please ensure the backend is running.');
      } else {
        throw new Error('Failed to process PDF file');
      }
    }
  }

  /**
   * Download Excel file
   */
  static async downloadExcel(request: ExcelDownloadRequest): Promise<ExcelDownloadResponse> {
    try {
      const response = await apiClient.post<ExcelDownloadResponse>('/download-excel', request);
      return response.data;
    } catch (error: any) {
      console.error('Excel download failed:', error);

      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      } else {
        throw new Error('Failed to generate Excel file');
      }
    }
  }

  /**
   * Generate questions for extracted data
   */
  static async generateQuestions(request: QuestionGenerationRequest): Promise<QuestionGenerationResponse> {
    try {
      const config = addCredentialHeaders();
      const response = await apiClient.post<QuestionGenerationResponse>('/generate-questions', request, config);
      return response.data;
    } catch (error: any) {
      console.error('Question generation failed:', error);

      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      } else {
        throw new Error('Failed to generate questions');
      }
    }
  }

  /**
   * Download Q&A Excel file
   */
  static async downloadQAExcel(request: QAExcelDownloadRequest): Promise<QAExcelDownloadResponse> {
    try {
      const response = await apiClient.post<QAExcelDownloadResponse>('/download-qa-excel', request);
      return response.data;
    } catch (error: any) {
      console.error('Q&A Excel download failed:', error);

      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      } else {
        throw new Error('Failed to generate Q&A Excel file');
      }
    }
  }

  /**
   * Download Q&A CSV file
   */
  static async downloadQACSV(request: QAExcelDownloadRequest): Promise<QAExcelDownloadResponse> {
    try {
      const response = await apiClient.post<QAExcelDownloadResponse>('/download-qa-csv', request);
      return response.data;
    } catch (error: any) {
      console.error('Q&A CSV download failed:', error);

      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      } else {
        throw new Error('Failed to generate Q&A CSV file');
      }
    }
  }

  /**
   * Download Q&A JSON file
   */
  static async downloadQAJSON(request: QAExcelDownloadRequest): Promise<any> {
    try {
      const response = await apiClient.post<any>('/download-qa-json', request);
      return response.data;
    } catch (error: any) {
      console.error('Q&A JSON download failed:', error);

      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      } else {
        throw new Error('Failed to generate Q&A JSON file');
      }
    }
  }

  /**
   * Test endpoint for debugging
   */
  static async testConnection(): Promise<any> {
    try {
      const response = await apiClient.get('/test');
      return response.data;
    } catch (error) {
      console.error('Test connection failed:', error);
      throw new Error('Failed to connect to backend');
    }
  }





  /**
   * Get available AI providers
   */
  static async getAIProviders(): Promise<any> {
    try {
      const response = await apiClient.get('/ai-providers');
      return response.data;
    } catch (error: any) {
      console.error('Failed to get AI providers:', error);

      // Return fallback data for Azure OpenAI
      return {
        success: true,
        data: {
          azure_openai: {
            name: 'Azure OpenAI',
            available: true,
            isDefault: true
          }
        }
      };
    }
  }

  /**
   * Get current system prompt
   */
  static async getCurrentSystemPrompt(): Promise<any> {
    try {
      const response = await apiClient.get('/system-prompt');
      return response.data;
    } catch (error: any) {
      console.error('Failed to get current system prompt:', error);
      return {
        success: false,
        error: error.message || 'Failed to get system prompt',
        system_prompt: '' // No hardcoded fallback - must come from backend
      };
    }
  }

  /**
   * Generate a custom system prompt based on user's use case description
   */
  static async generateSystemPrompt(
    useCaseDescription: string,
    providerId?: string,
    modelName?: string,
    generationMode?: string
  ): Promise<any> {
    try {
      const config = addCredentialHeaders();
      const response = await apiClient.post('/generate-system-prompt', {
        use_case_description: useCaseDescription,
        provider_id: providerId,
        model_name: modelName,
        generation_mode: generationMode || 'qa_pair'
      }, config);
      return response.data;
    } catch (error: any) {
      console.error('Failed to generate system prompt:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate system prompt'
      };
    }
  }

  /**
   * Get AI providers quick status (optimized for polling, no initialization wait)
   */
  static async getAIProvidersQuickStatus(): Promise<any> {
    try {
      const response = await apiClient.get('/ai-providers/quick-status');
      return response.data;
    } catch (error: any) {
      console.error('Failed to get AI providers quick status:', error);
      return {
        success: false,
        error: error.message || 'Failed to get provider status'
      };
    }
  }

  /**
   * Test AI provider connection
   */
  static async testAIProvider(providerId: string): Promise<any> {
    try {
      const config = addCredentialHeaders();
      const response = await apiClient.post(`/ai-providers/${providerId}/test`, {}, config);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to test AI provider ${providerId}:`, error);
      throw new Error(`Failed to test ${providerId} connection`);
    }
  }

  /**
   * Get available models for a specific AI provider
   */
  static async getProviderModels(providerId: string): Promise<any> {
    try {
      // First, check what's in credentialStorage
      const { getProviderCredentials, listConfiguredProviders } = await import('../utils/credentialStorage');
      const allProviders = listConfiguredProviders();
      console.log(`📦 All configured providers in credentialStorage:`, allProviders);
      const creds = getProviderCredentials(providerId);
      console.log(`🔑 Credentials for ${providerId}:`, creds);

      const config = addCredentialHeaders();
      console.log(`📡 Fetching models for ${providerId} with config:`, config);
      console.log(`📡 Headers being sent:`, config.headers);

      const response = await apiClient.get(`/ai-providers/${providerId}/models`, config);
      console.log(`📡 Response from ${providerId}/models:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Failed to get models for provider ${providerId}:`, error);
      console.error(`❌ Error details:`, error.response?.data);

      // Return error response instead of throwing
      return {
        success: false,
        error: error.response?.data?.error || error.message || `Failed to get models for ${providerId}`,
        data: []
      };
    }
  }

  /**
   * Get question generation status
   */
  static async getQuestionGenerationStatus(): Promise<any> {
    try {
      const response = await apiClient.get('/question-generation-status');
      return response.data;
    } catch (error: any) {
      console.error('Failed to get question generation status:', error);
      return {
        enabled: false,
        service_available: false,
        configuration_valid: false,
        available_providers: [],
        primary_provider: null
      };
    }
  }

  /**
   * Get question generation progress
   */
  static async getQuestionGenerationProgress(): Promise<any> {
    try {
      const response = await apiClient.get('/question-generation-progress');
      return response.data;
    } catch (error: any) {
      console.error('Failed to get question generation progress:', error);
      return {
        progress_percent: 0,
        current_item: 0,
        total_items: 0,
        successful_count: 0,
        failed_count: 0,
        is_generating: false,
        current_status: 'idle'
      };
    }
  }

  /**
   * Generate questions with progress tracking
   */
  static async generateQuestionsWithProgress(request: any): Promise<any> {
    try {
      // Use longer timeout for question generation (10 minutes)
      const config = addCredentialHeaders({
        timeout: 600000 // 10 minutes
      });
      const response = await apiClient.post('/generate-questions-with-progress', request, config);
      return response.data;
    } catch (error: any) {
      console.error('Question generation with progress failed:', error);

      // Check if this is a provider-specific error
      if (error.response?.data?.failed_provider) {
        // Create a custom error object with provider information
        const providerError = new Error(error.response.data.error || 'Provider failed');
        (providerError as any).failed_provider = error.response.data.failed_provider;
        (providerError as any).provider_display_name = error.response.data.provider_display_name;
        throw providerError;
      }

      // Preserve the original error message if available
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      } else if (error.message) {
        throw new Error(error.message);
      } else {
        throw new Error('Failed to generate questions with progress');
      }
    }
  }


}

// Export default instance
export default ApiService;
