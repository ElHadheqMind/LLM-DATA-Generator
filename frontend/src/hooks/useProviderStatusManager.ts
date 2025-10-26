/**
 * React Hook for Provider Status Manager
 * 
 * Provides real-time provider status updates across all components
 * Automatically syncs with the centralized ProviderStatusManager
 */

import { useState, useEffect } from 'react';
import { providerStatusManager, ProviderStatusInfo } from '../utils/providerStatusManager';

interface UseProviderStatusManagerReturn {
  statuses: Record<string, ProviderStatusInfo>;
  updateStatus: (providerId: string, updates: Partial<ProviderStatusInfo>) => void;
  getStatus: (providerId: string) => ProviderStatusInfo | null;
  isConfigured: (providerId: string) => boolean;
  getAvailableProviders: () => ProviderStatusInfo[];
  saveLocalEndpoint: (providerId: string, endpoint: string, available?: boolean) => void;
  getLocalEndpoint: (providerId: string) => string | null;
  clearAll: () => void;
  clearCloudProviders: () => void;
  clearLocalProviders: () => void;
}

/**
 * Hook to use the Provider Status Manager
 * Automatically subscribes to status changes and updates component
 */
export const useProviderStatusManager = (): UseProviderStatusManagerReturn => {
  const [statuses, setStatuses] = useState<Record<string, ProviderStatusInfo>>(
    providerStatusManager.getAllStatuses()
  );

  useEffect(() => {
    // Subscribe to status changes
    const unsubscribe = providerStatusManager.subscribe((newStatuses) => {
      setStatuses(newStatuses);
    });

    // Cleanup on unmount
    return unsubscribe;
  }, []);

  return {
    statuses,
    updateStatus: (providerId, updates) => providerStatusManager.updateStatus(providerId, updates),
    getStatus: (providerId) => providerStatusManager.getStatus(providerId),
    isConfigured: (providerId) => providerStatusManager.isConfigured(providerId),
    getAvailableProviders: () => providerStatusManager.getAvailableProviders(),
    saveLocalEndpoint: (providerId, endpoint, available) => 
      providerStatusManager.saveLocalEndpoint(providerId, endpoint, available),
    getLocalEndpoint: (providerId) => providerStatusManager.getLocalEndpoint(providerId),
    clearAll: () => providerStatusManager.clearAll(),
    clearCloudProviders: () => providerStatusManager.clearCloudProviders(),
    clearLocalProviders: () => providerStatusManager.clearLocalProviders()
  };
};

export default useProviderStatusManager;

