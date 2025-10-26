import { useState, useEffect, useRef } from 'react';
import ApiService from '../services/api';

interface ProviderStatus {
  id: string;
  name: string;
  available: boolean;
  status: string;
  isDefault: boolean;
  models: string[];
  last_error?: string;
  error?: string;
}

interface UseProviderStatusOptions {
  pollingInterval?: number;
  enablePolling?: boolean;
  onProviderAvailable?: (providerId: string, providerName: string) => void;
  onProviderUnavailable?: (providerId: string, providerName: string) => void;
}

interface UseProviderStatusReturn {
  providers: Record<string, ProviderStatus>;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Simple hook for fetching AI provider status
 * Fetches data once on mount and provides a refresh function
 */
export const useProviderStatus = (options: UseProviderStatusOptions = {}): UseProviderStatusReturn => {
  const { pollingInterval = 3000, enablePolling = false, onProviderAvailable, onProviderUnavailable } = options;

  // State
  const [providers, setProviders] = useState<Record<string, ProviderStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousProvidersRef = useRef<Record<string, ProviderStatus>>({});

  // Fetch function - simple and straightforward
  const fetchProviders = async () => {
    try {
      const response = await ApiService.getAIProvidersQuickStatus();

      if (response && response.success && response.data) {
        // Check for availability changes
        Object.entries(response.data).forEach(([providerId, providerInfo]: [string, any]) => {
          const previous = previousProvidersRef.current[providerId];
          const nowAvailable = providerInfo.available;
          const wasAvailable = previous?.available || false;

          if (nowAvailable && !wasAvailable) {
            onProviderAvailable?.(providerId, providerInfo.name || providerId);
          } else if (!nowAvailable && wasAvailable) {
            onProviderUnavailable?.(providerId, providerInfo.name || providerId);
          }
        });

        // Update state
        setProviders(response.data);
        previousProvidersRef.current = response.data;
        setError(null);
        setIsLoading(false);
      } else {
        console.error('[useProviderStatus] Invalid response:', response);
        setError(response?.error || 'Invalid response from server');
        setProviders({});
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('[useProviderStatus] Error fetching providers:', err);
      setError(err.message || 'Failed to fetch providers');
      setProviders({});
      setIsLoading(false);
    }
  };

  // Refresh function
  const refresh = () => {
    setIsLoading(true);
    fetchProviders();
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchProviders();
  }, []); // Empty dependency array - only run once on mount

  // Polling (optional)
  useEffect(() => {
    if (enablePolling) {
      pollingIntervalRef.current = setInterval(fetchProviders, pollingInterval);

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
      };
    }
  }, [enablePolling, pollingInterval]);

  return {
    providers,
    isLoading,
    error,
    refresh
  };
};

export default useProviderStatus;

