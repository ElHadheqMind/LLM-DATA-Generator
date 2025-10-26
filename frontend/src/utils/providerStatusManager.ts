/**
 * Provider Status Manager
 * 
 * High-quality centralized management for AI provider status and configuration.
 * 
 * Security Model:
 * - Cloud providers (OpenAI, Gemini): Credentials in memory only (cleared on refresh)
 * - Local providers (LM Studio, Ollama): Endpoints persisted in localStorage
 * - Status synchronized across all components
 * 
 * Features:
 * - Persistent local provider endpoints
 * - Session-based cloud provider credentials
 * - Real-time status synchronization
 * - Event-driven updates
 */

export interface ProviderEndpoint {
  providerId: string;
  endpoint: string;
  lastTested?: string;
  available?: boolean;
}

export interface ProviderStatusInfo {
  providerId: string;
  name: string;
  available: boolean;
  testing: boolean;
  error?: string;
  lastChecked?: string;
  isLocal: boolean;
}

type StatusChangeListener = (status: Record<string, ProviderStatusInfo>) => void;

class ProviderStatusManager {
  private static instance: ProviderStatusManager;
  private statusMap: Map<string, ProviderStatusInfo> = new Map();
  private listeners: Set<StatusChangeListener> = new Set();
  
  // Local storage key for local provider endpoints
  private readonly LOCAL_ENDPOINTS_KEY = 'ai_local_provider_endpoints';
  
  // Provider type classification
  private readonly LOCAL_PROVIDERS = ['lm_studio', 'ollama'];
  private readonly CLOUD_PROVIDERS = ['openai', 'google_gemini'];

  private constructor() {
    this.initializeProviders();
    this.loadLocalEndpoints();
  }

  static getInstance(): ProviderStatusManager {
    if (!ProviderStatusManager.instance) {
      ProviderStatusManager.instance = new ProviderStatusManager();
    }
    return ProviderStatusManager.instance;
  }

  /**
   * Initialize all providers with default status
   */
  private initializeProviders(): void {
    const allProviders = [
      { id: 'openai', name: 'OpenAI', isLocal: false },
      { id: 'google_gemini', name: 'Google Gemini', isLocal: false },
      { id: 'lm_studio', name: 'LM Studio', isLocal: true },
      { id: 'ollama', name: 'Ollama', isLocal: true }
    ];

    allProviders.forEach(provider => {
      this.statusMap.set(provider.id, {
        providerId: provider.id,
        name: provider.name,
        available: false,
        testing: false,
        isLocal: provider.isLocal
      });
    });
  }

  /**
   * Load local provider endpoints from localStorage
   */
  private loadLocalEndpoints(): void {
    try {
      const stored = localStorage.getItem(this.LOCAL_ENDPOINTS_KEY);
      if (stored) {
        const endpoints: ProviderEndpoint[] = JSON.parse(stored);
        endpoints.forEach(endpoint => {
          const status = this.statusMap.get(endpoint.providerId);
          if (status && status.isLocal) {
            // Mark as available if endpoint is configured
            status.available = endpoint.available || false;
            status.lastChecked = endpoint.lastTested;
          }
        });
      }
    } catch (error) {
      console.error('Failed to load local provider endpoints:', error);
    }
  }

  /**
   * Save local provider endpoint to localStorage
   */
  saveLocalEndpoint(providerId: string, endpoint: string, available: boolean = false): void {
    if (!this.LOCAL_PROVIDERS.includes(providerId)) {
      console.warn(`${providerId} is not a local provider. Endpoints not persisted.`);
      return;
    }

    try {
      // Load existing endpoints
      const stored = localStorage.getItem(this.LOCAL_ENDPOINTS_KEY);
      const endpoints: ProviderEndpoint[] = stored ? JSON.parse(stored) : [];
      
      // Update or add endpoint
      const existingIndex = endpoints.findIndex(e => e.providerId === providerId);
      const endpointData: ProviderEndpoint = {
        providerId,
        endpoint,
        available,
        lastTested: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        endpoints[existingIndex] = endpointData;
      } else {
        endpoints.push(endpointData);
      }

      // Save to localStorage
      localStorage.setItem(this.LOCAL_ENDPOINTS_KEY, JSON.stringify(endpoints));
      
      console.log(`✅ Local provider endpoint saved: ${providerId} -> ${endpoint}`);
    } catch (error) {
      console.error(`Failed to save local provider endpoint for ${providerId}:`, error);
    }
  }

  /**
   * Get local provider endpoint from localStorage
   */
  getLocalEndpoint(providerId: string): string | null {
    if (!this.LOCAL_PROVIDERS.includes(providerId)) {
      return null;
    }

    try {
      const stored = localStorage.getItem(this.LOCAL_ENDPOINTS_KEY);
      if (stored) {
        const endpoints: ProviderEndpoint[] = JSON.parse(stored);
        const endpoint = endpoints.find(e => e.providerId === providerId);
        return endpoint?.endpoint || null;
      }
    } catch (error) {
      console.error(`Failed to get local provider endpoint for ${providerId}:`, error);
    }

    // Return defaults
    if (providerId === 'lm_studio') return 'http://localhost:1234/v1';
    if (providerId === 'ollama') return 'http://localhost:11434';
    
    return null;
  }

  /**
   * Update provider status
   */
  updateStatus(providerId: string, updates: Partial<ProviderStatusInfo>): void {
    const current = this.statusMap.get(providerId);
    if (!current) {
      console.warn(`Provider ${providerId} not found in status map`);
      return;
    }

    const updated: ProviderStatusInfo = {
      ...current,
      ...updates,
      lastChecked: new Date().toISOString()
    };

    this.statusMap.set(providerId, updated);
    
    // If local provider and status changed, update localStorage
    if (current.isLocal && updates.available !== undefined) {
      const endpoint = this.getLocalEndpoint(providerId);
      if (endpoint) {
        this.saveLocalEndpoint(providerId, endpoint, updates.available);
      }
    }

    this.notifyListeners();
  }

  /**
   * Get status for a specific provider
   */
  getStatus(providerId: string): ProviderStatusInfo | null {
    return this.statusMap.get(providerId) || null;
  }

  /**
   * Get all provider statuses
   */
  getAllStatuses(): Record<string, ProviderStatusInfo> {
    const statuses: Record<string, ProviderStatusInfo> = {};
    this.statusMap.forEach((status, providerId) => {
      statuses[providerId] = status;
    });
    return statuses;
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): ProviderStatusInfo[] {
    return Array.from(this.statusMap.values()).filter(status => status.available);
  }

  /**
   * Check if provider is configured
   */
  isConfigured(providerId: string): boolean {
    const status = this.statusMap.get(providerId);
    return status?.available || false;
  }

  /**
   * Subscribe to status changes
   */
  subscribe(listener: StatusChangeListener): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of status changes
   */
  private notifyListeners(): void {
    const statuses = this.getAllStatuses();
    this.listeners.forEach(listener => {
      try {
        listener(statuses);
      } catch (error) {
        console.error('Error in status change listener:', error);
      }
    });
  }

  /**
   * Clear all cloud provider credentials (security)
   */
  clearCloudProviders(): void {
    this.CLOUD_PROVIDERS.forEach(providerId => {
      this.updateStatus(providerId, {
        available: false,
        testing: false,
        error: undefined
      });
    });
    console.log('✅ Cloud provider credentials cleared from status');
  }

  /**
   * Clear all local provider endpoints
   */
  clearLocalProviders(): void {
    try {
      localStorage.removeItem(this.LOCAL_ENDPOINTS_KEY);
      this.LOCAL_PROVIDERS.forEach(providerId => {
        this.updateStatus(providerId, {
          available: false,
          testing: false,
          error: undefined
        });
      });
      console.log('✅ Local provider endpoints cleared');
    } catch (error) {
      console.error('Failed to clear local provider endpoints:', error);
    }
  }

  /**
   * Clear all providers
   */
  clearAll(): void {
    this.clearCloudProviders();
    this.clearLocalProviders();
  }

  /**
   * Get provider type
   */
  isLocalProvider(providerId: string): boolean {
    return this.LOCAL_PROVIDERS.includes(providerId);
  }

  /**
   * Get storage info for debugging
   */
  getStorageInfo(): {
    cloudProviders: string[];
    localProviders: string[];
    availableProviders: string[];
    configuredEndpoints: ProviderEndpoint[];
  } {
    const stored = localStorage.getItem(this.LOCAL_ENDPOINTS_KEY);
    const endpoints: ProviderEndpoint[] = stored ? JSON.parse(stored) : [];

    return {
      cloudProviders: this.CLOUD_PROVIDERS,
      localProviders: this.LOCAL_PROVIDERS,
      availableProviders: this.getAvailableProviders().map(p => p.providerId),
      configuredEndpoints: endpoints
    };
  }

  /**
   * Update status from backend API response
   * This ensures synchronization between frontend status and backend reality
   */
  updateFromBackendResponse(providerId: string, response: {
    success: boolean;
    available?: boolean;
    error?: string;
  }): void {
    const updates: Partial<ProviderStatusInfo> = {
      available: response.success || response.available || false,
      testing: false,
      error: response.error
    };

    this.updateStatus(providerId, updates);

    console.log(`✅ Provider status updated from backend: ${providerId} -> ${updates.available ? 'available' : 'unavailable'}`);
  }

  /**
   * Batch update statuses from backend provider list
   */
  updateFromBackendProviderList(providers: Record<string, any>): void {
    Object.entries(providers).forEach(([providerId, providerInfo]) => {
      const updates: Partial<ProviderStatusInfo> = {
        available: providerInfo.available || false,
        error: providerInfo.error || providerInfo.last_error
      };

      // Only update if provider exists in our status map
      if (this.statusMap.has(providerId)) {
        this.updateStatus(providerId, updates);
      }
    });

    console.log('✅ Provider statuses synchronized with backend');
  }

  /**
   * Mark provider as testing (during connection test)
   */
  markTesting(providerId: string): void {
    this.updateStatus(providerId, { testing: true, error: undefined });
  }

  /**
   * Mark provider as available after successful test
   */
  markAvailable(providerId: string): void {
    this.updateStatus(providerId, {
      available: true,
      testing: false,
      error: undefined
    });
  }

  /**
   * Mark provider as unavailable after failed test
   */
  markUnavailable(providerId: string, error?: string): void {
    this.updateStatus(providerId, {
      available: false,
      testing: false,
      error
    });
  }

  /**
   * Get current active provider (first available provider)
   */
  getActiveProvider(): ProviderStatusInfo | null {
    const available = this.getAvailableProviders();
    if (available.length === 0) return null;

    // Priority order: Gemini > OpenAI > LM Studio > Ollama
    const priorityOrder = ['google_gemini', 'openai', 'lm_studio', 'ollama'];

    for (const providerId of priorityOrder) {
      const provider = available.find(p => p.providerId === providerId);
      if (provider) return provider;
    }

    return available[0];
  }
}

// Export singleton instance
export const providerStatusManager = ProviderStatusManager.getInstance();

// Export class for testing
export default ProviderStatusManager;

