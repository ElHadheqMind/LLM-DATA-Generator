/**
 * Utility functions for managing application data persistence
 */

import { AppState, DocumentInfo } from '../types/api';

const STORAGE_KEYS = {
  APP_STATE: 'pdf_extractor_app_state',
  DOCUMENTS: 'pdf_extractor_documents',
  ACTIVE_DOCUMENT_ID: 'pdf_extractor_active_document_id',
  SELECTED_PROVIDER: 'pdf_extractor_selected_provider',
  SELECTED_MODEL: 'pdf_extractor_selected_model',
  USER_INPUT: 'pdf_extractor_user_input',
  SYSTEM_PROMPT: 'pdf_extractor_system_prompt',
  AI_PARAMETERS: 'pdf_extractor_ai_parameters',
} as const;

/**
 * Save app state to localStorage
 */
export const saveAppState = (appState: AppState): void => {
  try {
    // Don't save loading/processing states or errors
    const stateToSave = {
      ...appState,
      isLoading: false,
      isProcessing: false,
      error: null,
      batchProcessing: {
        isActive: false,
        currentIndex: 0,
        totalCount: 0,
      },
      questionGeneration: {
        ...appState.questionGeneration,
        isGenerating: false,
        progress: 0,
        error: null,
      },
    };

    localStorage.setItem(STORAGE_KEYS.APP_STATE, JSON.stringify(stateToSave));
  } catch (error) {
    console.warn('Failed to save app state to localStorage:', error);
  }
};

/**
 * Load app state from localStorage
 */
export const loadAppState = (): Partial<AppState> | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.APP_STATE);
    if (!saved) return null;

    const parsedState = JSON.parse(saved);
    
    // Convert date strings back to Date objects
    if (parsedState.documents) {
      parsedState.documents = parsedState.documents.map((doc: any) => ({
        ...doc,
        uploadedAt: new Date(doc.uploadedAt),
        processedAt: doc.processedAt ? new Date(doc.processedAt) : undefined,
      }));
    }

    return parsedState;
  } catch (error) {
    console.warn('Failed to load app state from localStorage:', error);
    return null;
  }
};

/**
 * Save documents to localStorage
 */
export const saveDocuments = (documents: DocumentInfo[]): void => {
  try {
    // Convert File objects to serializable format
    const documentsToSave = documents.map(doc => ({
      ...doc,
      file: {
        name: doc.file.name,
        size: doc.file.size,
        type: doc.file.type,
        lastModified: doc.file.lastModified,
      },
    }));

    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(documentsToSave));
  } catch (error) {
    console.warn('Failed to save documents to localStorage:', error);
  }
};

/**
 * Load documents from localStorage
 */
export const loadDocuments = (): DocumentInfo[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
    if (!saved) return [];

    const parsedDocuments = JSON.parse(saved);
    
    // Convert serialized data back to proper format
    return parsedDocuments.map((doc: any) => ({
      ...doc,
      uploadedAt: new Date(doc.uploadedAt),
      processedAt: doc.processedAt ? new Date(doc.processedAt) : undefined,
      // Create a mock File object for display purposes
      file: new File([''], doc.file.name, {
        type: doc.file.type,
        lastModified: doc.file.lastModified,
      }),
    }));
  } catch (error) {
    console.warn('Failed to load documents from localStorage:', error);
    return [];
  }
};

/**
 * Save active document ID
 */
export const saveActiveDocumentId = (documentId: string | null): void => {
  try {
    if (documentId) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_DOCUMENT_ID, documentId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_DOCUMENT_ID);
    }
  } catch (error) {
    console.warn('Failed to save active document ID to localStorage:', error);
  }
};

/**
 * Load active document ID
 */
export const loadActiveDocumentId = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_DOCUMENT_ID);
  } catch (error) {
    console.warn('Failed to load active document ID from localStorage:', error);
    return null;
  }
};

/**
 * Clear all stored data
 */
export const clearStoredData = (): void => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.warn('Failed to clear stored data:', error);
  }
};

/**
 * Clear only UI state (keep documents and app state)
 */
export const clearUIState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.SELECTED_PROVIDER);
    localStorage.removeItem(STORAGE_KEYS.SELECTED_MODEL);
    localStorage.removeItem(STORAGE_KEYS.USER_INPUT);
    localStorage.removeItem(STORAGE_KEYS.SYSTEM_PROMPT);
    localStorage.removeItem(STORAGE_KEYS.AI_PARAMETERS);
  } catch (error) {
    console.warn('Failed to clear UI state:', error);
  }
};

/**
 * Check if localStorage is available
 */
export const isStorageAvailable = (): boolean => {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
};

/**
 * Get storage usage information
 */
export const getStorageInfo = (): { used: number; available: boolean } => {
  try {
    let used = 0;
    Object.values(STORAGE_KEYS).forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        used += item.length;
      }
    });

    return {
      used: Math.round(used / 1024), // KB
      available: isStorageAvailable(),
    };
  } catch {
    return {
      used: 0,
      available: false,
    };
  }
};

/**
 * Save selected provider
 */
export const saveSelectedProvider = (providerId: string | null): void => {
  try {
    if (providerId) {
      localStorage.setItem(STORAGE_KEYS.SELECTED_PROVIDER, providerId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.SELECTED_PROVIDER);
    }
  } catch (error) {
    console.warn('Failed to save selected provider:', error);
  }
};

/**
 * Load selected provider
 */
export const loadSelectedProvider = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_PROVIDER);
  } catch (error) {
    console.warn('Failed to load selected provider:', error);
    return null;
  }
};

/**
 * Save selected model
 */
export const saveSelectedModel = (modelName: string | null): void => {
  try {
    if (modelName) {
      localStorage.setItem(STORAGE_KEYS.SELECTED_MODEL, modelName);
    } else {
      localStorage.removeItem(STORAGE_KEYS.SELECTED_MODEL);
    }
  } catch (error) {
    console.warn('Failed to save selected model:', error);
  }
};

/**
 * Load selected model
 */
export const loadSelectedModel = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_MODEL);
  } catch (error) {
    console.warn('Failed to load selected model:', error);
    return null;
  }
};

/**
 * Save user input text
 */
export const saveUserInput = (input: string): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.USER_INPUT, input);
  } catch (error) {
    console.warn('Failed to save user input:', error);
  }
};

/**
 * Load user input text
 */
export const loadUserInput = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEYS.USER_INPUT) || '';
  } catch (error) {
    console.warn('Failed to load user input:', error);
    return '';
  }
};

/**
 * Save system prompt
 */
export const saveSystemPrompt = (prompt: string): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.SYSTEM_PROMPT, prompt);
  } catch (error) {
    console.warn('Failed to save system prompt:', error);
  }
};

/**
 * Load system prompt
 */
export const loadSystemPrompt = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEYS.SYSTEM_PROMPT) || '';
  } catch (error) {
    console.warn('Failed to load system prompt:', error);
    return '';
  }
};

/**
 * Save AI parameters
 */
export const saveAIParameters = (parameters: any): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.AI_PARAMETERS, JSON.stringify(parameters));
  } catch (error) {
    console.warn('Failed to save AI parameters:', error);
  }
};

/**
 * Load AI parameters
 */
export const loadAIParameters = (): any => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.AI_PARAMETERS);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.warn('Failed to load AI parameters:', error);
    return null;
  }
};
