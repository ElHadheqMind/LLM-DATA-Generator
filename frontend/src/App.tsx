import React, { useState, useEffect } from 'react';
import { FileText, AlertCircle, CheckCircle, Loader, Settings, Sparkles, Github, MessageSquare, Globe, Heart } from 'lucide-react';
import MultiPdfUpload from './components/MultiPdfUpload';
import MultiDocumentVisualization from './components/MultiDocumentVisualization';
import ConfirmDialog from './components/ConfirmDialog';
import type { BatchExportOptions } from './components/BatchExportDialog';
import QuestionGenerationControls from './components/QuestionGenerationControls';

import QuestionsDashboard from './components/QuestionsDashboard';
import DatasetExportDialog from './components/DatasetExportDialog';
import AIProviderManagement from './components/AIProviderManagement';
import { useToast } from './components/ToastContainer';
import ApiService from './services/api';
import { downloadBase64File, generateSafeFilename } from './utils/fileUtils';
import { saveAppState, loadAppState, isStorageAvailable, clearStoredData } from './utils/storage';
import { saveProviderCredentials } from './utils/credentialStorage';
import { useProviderStatusManager } from './hooks/useProviderStatusManager';
import type { AppState, DocumentInfo, HierarchyData, UploadProgress } from './types/api';
import './App.css';

function App() {
  const { showSuccess, showError, showInfo, showWarning } = useToast();
  const { getLocalEndpoint, getAvailableProviders } = useProviderStatusManager();

  // Initialize state with data from localStorage if available
  const [appState, setAppState] = useState<AppState>(() => {
    const savedState = loadAppState();
    return {
      isLoading: false,
      isProcessing: false,
      error: null,
      documents: savedState?.documents || [],
      activeDocumentId: savedState?.activeDocumentId || null,
      batchProcessing: {
        isActive: false,
        currentIndex: 0,
        totalCount: 0,
      },
      questionGeneration: {
        isGenerating: false,
        progress: 0,
        currentItem: 0,
        totalItems: 0,
        successCount: 0,
        errorCount: 0,
        provider: 'azure_openai',
        error: null,
        serviceAvailable: savedState?.questionGeneration?.serviceAvailable || false,
      },
      cleanOutput: savedState?.cleanOutput || false,
    };
  });

  // 🔧 CRITICAL: Initialize credentialStorage from localStorage on app startup
  // This ensures local provider endpoints (LM Studio, Ollama) are available for API calls
  useEffect(() => {
    console.log('🚀 App initializing - Loading local provider endpoints into credentialStorage');

    // Load LM Studio endpoint from localStorage
    const lmStudioEndpoint = getLocalEndpoint('lm_studio');
    if (lmStudioEndpoint) {
      console.log(`✅ Loading LM Studio endpoint: ${lmStudioEndpoint}`);
      saveProviderCredentials('lm_studio', { endpoint: lmStudioEndpoint });
    } else {
      console.log('⚠️ No LM Studio endpoint found in localStorage');
    }

    // Load Ollama endpoint from localStorage
    const ollamaEndpoint = getLocalEndpoint('ollama');
    if (ollamaEndpoint) {
      console.log(`✅ Loading Ollama endpoint: ${ollamaEndpoint}`);
      saveProviderCredentials('ollama', { endpoint: ollamaEndpoint });
    } else {
      console.log('⚠️ No Ollama endpoint found in localStorage');
    }

    console.log('✅ App initialization complete - credentialStorage synchronized');
  }, []); // Run once on app startup

  const [downloadState, setDownloadState] = useState({
    isDownloading: false,
    downloadSuccess: false,
    downloadError: null as string | null,
  });

  // Save app state to localStorage whenever it changes
  useEffect(() => {
    if (isStorageAvailable()) {
      saveAppState(appState);
    }
  }, [appState]);

  // Show notification if data was restored from localStorage
  useEffect(() => {
    const savedState = loadAppState();
    if (savedState?.documents && savedState.documents.length > 0) {
      showInfo(
        'Data Restored',
        `Restored ${savedState.documents.length} document(s) from previous session`
      );
    }
  }, []); // Only run once on mount

  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [activeMode, setActiveMode] = useState<'pdf' | 'excel'>('pdf');

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning' as 'warning' | 'danger' | 'info',
  });

  const [datasetExportDialog, setDatasetExportDialog] = useState({
    isOpen: false,
    data: [] as HierarchyData[],
    filename: '',
  });

  const [aiProviderManagement, setAiProviderManagement] = useState({
    isOpen: false,
  });

  /**
   * Check if any AI providers are configured
   * This checks both in-memory credentials and localStorage for local providers
   */
  const hasAnyProvidersConfigured = (): boolean => {
    // Check if any providers are marked as available in the provider status manager
    const availableProviders = getAvailableProviders();
    return availableProviders.length > 0;
  };

  // Check backend connection on mount
  useEffect(() => {
    checkBackendConnection();
  }, []);

  const checkBackendConnection = async () => {
    try {
      await ApiService.healthCheck();
      setBackendStatus('connected');
      showSuccess('Backend Connected', 'Successfully connected to the PDF processing service');

      // Check question generation service status
      try {
        const questionGenStatus = await ApiService.getQuestionGenerationStatus();
        handleQuestionGenerationStateChange({
          serviceAvailable: questionGenStatus.service_available,
          error: null,
        });

        // Removed notification - only show important messages
      } catch (error) {
        console.warn('Question generation service check failed:', error);
        handleQuestionGenerationStateChange({
          serviceAvailable: false,
          error: 'Question generation service unavailable',
        });
      }
    } catch (error) {
      setBackendStatus('disconnected');
      setAppState(prev => ({
        ...prev,
        error: 'Cannot connect to backend service. Please ensure the backend is running on http://localhost:5000',
      }));
      showError('Backend Connection Failed', 'Please ensure the backend service is running on http://localhost:5000');
    }
  };



  const handleDownload = async (documentId?: string) => {
    let targetDocument: DocumentInfo | undefined;

    if (documentId) {
      targetDocument = appState.documents.find(doc => doc.id === documentId);
    } else if (appState.activeDocumentId) {
      targetDocument = appState.documents.find(doc => doc.id === appState.activeDocumentId);
    }

    if (!targetDocument || !targetDocument.processedData) {
      showError('Download Failed', 'No processed data available for download');
      return;
    }

    setDownloadState(prev => ({
      ...prev,
      isDownloading: true,
      downloadError: null,
      downloadSuccess: false,
    }));

    try {
      const safeFilename = generateSafeFilename(targetDocument.name);
      const response = await ApiService.downloadExcel({
        data: targetDocument.processedData,
        filename: safeFilename,
      });

      if (response.success && response.file_data) {
        downloadBase64File(response.file_data, response.filename);
        setDownloadState(prev => ({
          ...prev,
          isDownloading: false,
          downloadSuccess: true,
        }));
        showSuccess('Excel Downloaded', `Successfully downloaded ${response.filename}`);
      } else {
        throw new Error(response.error || 'Failed to generate Excel file');
      }
    } catch (error: any) {
      setDownloadState(prev => ({
        ...prev,
        isDownloading: false,
        downloadError: error.message,
      }));
      showError('Download Failed', error.message);
    }
  };

  const handleBatchDownload = async () => {
    const completedDocuments = appState.documents.filter(doc =>
      doc.status === 'completed' && doc.processedData
    );

    if (completedDocuments.length === 0) {
      showWarning('No Data Available', 'No completed documents available for download');
      return;
    }

    setDownloadState(prev => ({
      ...prev,
      isDownloading: true,
      downloadError: null,
      downloadSuccess: false,
    }));

    try {
      // Combine all data from completed documents
      const combinedData = completedDocuments.flatMap(doc =>
        doc.processedData?.map(item => ({
          ...item,
          source_document: doc.name, // Add source document info
        })) || []
      );

      const response = await ApiService.downloadExcel({
        data: combinedData,
        filename: 'combined_documents',
      });

      if (response.success && response.file_data) {
        downloadBase64File(response.file_data, response.filename);
        setDownloadState(prev => ({
          ...prev,
          isDownloading: false,
          downloadSuccess: true,
        }));
        showSuccess('Batch Download Complete', `Downloaded combined data from ${completedDocuments.length} documents`);
      } else {
        throw new Error(response.error || 'Failed to generate Excel file');
      }
    } catch (error: any) {
      setDownloadState(prev => ({
        ...prev,
        isDownloading: false,
        downloadError: error.message,
      }));
      showError('Batch Download Failed', error.message);
    }
  };

  const handleAdvancedExport = async (options: BatchExportOptions) => {
    const selectedDocuments = appState.documents.filter(doc =>
      options.selectedDocuments.includes(doc.id) && doc.processedData
    );

    if (selectedDocuments.length === 0) {
      showError('Export Failed', 'No valid documents selected for export');
      return;
    }

    setDownloadState(prev => ({
      ...prev,
      isDownloading: true,
      downloadError: null,
      downloadSuccess: false,
    }));

    try {
      if (options.format === 'separate') {
        // Export each document as a separate file
        for (const document of selectedDocuments) {
          const response = await ApiService.downloadExcel({
            data: document.processedData!,
            filename: generateSafeFilename(document.name),
          });

          if (response.success && response.file_data) {
            downloadBase64File(response.file_data, response.filename);
          }
        }
        showSuccess('Separate Files Downloaded', `Downloaded ${selectedDocuments.length} separate Excel files`);
      } else {
        // Combined or multi-sheet export
        let exportData;

        if (options.format === 'combined') {
          exportData = selectedDocuments.flatMap(doc =>
            doc.processedData!.map(item => ({
              ...item,
              ...(options.includeSourceInfo && { source_document: doc.name }),
            }))
          );
        } else {
          // Multi-sheet format - prepare data for backend
          exportData = selectedDocuments.flatMap(doc =>
            doc.processedData!.map(item => ({
              ...item,
              source_document: doc.name,
            }))
          );
        }

        const response = await ApiService.downloadExcel({
          data: exportData,
          filename: options.filename || 'advanced_export',
          multiSheet: options.format === 'multi-sheet',
          documents: options.format === 'multi-sheet'
            ? selectedDocuments.map(doc => ({
                name: doc.name,
                data: doc.processedData!,
              }))
            : undefined,
        });

        if (response.success && response.file_data) {
          downloadBase64File(response.file_data, response.filename);
          showSuccess('Advanced Export Complete', `Downloaded ${options.format} Excel file with ${selectedDocuments.length} documents`);
        } else {
          throw new Error(response.error || 'Failed to generate Excel file');
        }
      }

      setDownloadState(prev => ({
        ...prev,
        isDownloading: false,
        downloadSuccess: true,
      }));
    } catch (error: any) {
      setDownloadState(prev => ({
        ...prev,
        isDownloading: false,
        downloadError: error.message,
      }));
      showError('Advanced Export Failed', error.message);
    }
  };

  const resetApp = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Clear All Documents',
      message: 'Are you sure you want to clear all documents? This will remove all uploaded files and processed data.',
      onConfirm: () => {
        setAppState(prev => ({
          ...prev,
          isLoading: false,
          isProcessing: false,
          error: null,
          documents: [],
          activeDocumentId: null,
          batchProcessing: {
            isActive: false,
            currentIndex: 0,
            totalCount: 0,
          },
        }));
        setDownloadState({
          isDownloading: false,
          downloadSuccess: false,
          downloadError: null,
        });
        clearStoredData(); // Clear localStorage as well
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        showSuccess('Documents Cleared', 'All documents and stored data have been cleared.');
        showInfo('Documents Cleared', 'You can now upload new PDF files for processing');
      },
      type: 'warning',
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  };

  // Document management functions
  const generateDocumentId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };

  const handleDocumentsAdd = (files: File[]) => {
    const newDocuments: DocumentInfo[] = files.map(file => ({
      id: generateDocumentId(),
      file,
      name: file.name,
      size: file.size,
      status: 'pending',
      uploadedAt: new Date(),
    }));

    setAppState(prev => ({
      ...prev,
      documents: [...prev.documents, ...newDocuments],
    }));
  };

  const handleDocumentRemove = (documentId: string) => {
    setAppState(prev => ({
      ...prev,
      documents: prev.documents.filter(doc => doc.id !== documentId),
      activeDocumentId: prev.activeDocumentId === documentId ? null : prev.activeDocumentId,
    }));
  };

  const handleDocumentRename = (documentId: string, newName: string) => {
    // Validate the new name
    if (!newName.trim()) {
      showError('Invalid Name', 'Document name cannot be empty');
      return;
    }

    if (!newName.toLowerCase().endsWith('.pdf')) {
      showError('Invalid Name', 'Document name must end with .pdf');
      return;
    }

    // Check for duplicate names
    const existingDoc = appState.documents.find(doc =>
      doc.id !== documentId && doc.name.toLowerCase() === newName.toLowerCase()
    );

    if (existingDoc) {
      showError('Duplicate Name', 'A document with this name already exists');
      return;
    }

    setAppState(prev => ({
      ...prev,
      documents: prev.documents.map(doc =>
        doc.id === documentId
          ? { ...doc, name: newName }
          : doc
      ),
    }));
  };

  const handleDocumentReorder = (fromIndex: number, toIndex: number) => {
    setAppState(prev => {
      const newDocuments = [...prev.documents];
      const [movedDocument] = newDocuments.splice(fromIndex, 1);
      newDocuments.splice(toIndex, 0, movedDocument);

      return {
        ...prev,
        documents: newDocuments,
      };
    });
  };

  const handleDocumentDataChange = (documentId: string, newData: HierarchyData[]) => {
    setAppState(prev => ({
      ...prev,
      documents: prev.documents.map(doc =>
        doc.id === documentId
          ? { ...doc, processedData: newData }
          : doc
      ),
    }));
    showSuccess('Data Updated', `Document data has been cleaned. ${newData.length} rows remaining.`);
  };

  const handleDocumentProcess = async (documentId: string) => {
    const document = appState.documents.find(doc => doc.id === documentId);
    if (!document) return;

    // Update document status to processing
    setAppState(prev => ({
      ...prev,
      isProcessing: true,
      documents: prev.documents.map(doc =>
        doc.id === documentId
          ? { ...doc, status: 'processing' as const, error: undefined }
          : doc
      ),
    }));

    try {
      const response = await ApiService.processPdf(document.file, (progress: UploadProgress) => {
        setAppState(prev => ({
          ...prev,
          documents: prev.documents.map(doc =>
            doc.id === documentId
              ? { ...doc, progress: progress.percentage }
              : doc
          ),
        }));
      }, appState.cleanOutput);

      if (response.success && response.data) {
        setAppState(prev => ({
          ...prev,
          isProcessing: false,
          documents: prev.documents.map(doc =>
            doc.id === documentId
              ? {
                  ...doc,
                  status: 'completed' as const,
                  processedData: response.data,
                  processedAt: new Date(),
                  progress: undefined,
                }
              : doc
          ),
          activeDocumentId: documentId,
        }));
        showSuccess('PDF Processed Successfully', `Extracted ${response.data.length} entries from ${document.name}`);
      } else {
        throw new Error(response.error || 'Failed to process PDF');
      }
    } catch (error: any) {
      setAppState(prev => ({
        ...prev,
        isProcessing: false,
        documents: prev.documents.map(doc =>
          doc.id === documentId
            ? {
                ...doc,
                status: 'error' as const,
                error: error.message,
                progress: undefined,
              }
            : doc
        ),
      }));
      showError('PDF Processing Failed', `${document.name}: ${error.message}`);
    }
  };

  const handleBatchProcess = async (documentIds: string[]) => {
    if (documentIds.length === 0) return;

    setAppState(prev => ({
      ...prev,
      batchProcessing: {
        isActive: true,
        currentIndex: 0,
        totalCount: documentIds.length,
      },
    }));

    showInfo('Batch Processing Started', `Processing ${documentIds.length} documents...`);

    for (let i = 0; i < documentIds.length; i++) {
      const documentId = documentIds[i];

      setAppState(prev => ({
        ...prev,
        batchProcessing: {
          ...prev.batchProcessing,
          currentIndex: i + 1,
        },
      }));

      try {
        await handleDocumentProcess(documentId);
        // Small delay between processing
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to process document ${documentId}:`, error);
        // Continue with next document even if one fails
      }
    }

    setAppState(prev => ({
      ...prev,
      batchProcessing: {
        isActive: false,
        currentIndex: 0,
        totalCount: 0,
      },
    }));

    const completedCount = appState.documents.filter(doc =>
      documentIds.includes(doc.id) && doc.status === 'completed'
    ).length;

    showSuccess('Batch Processing Complete', `Successfully processed ${completedCount} of ${documentIds.length} documents`);
  };

  // Question Generation Handlers
  const handleQuestionGenerationStateChange = (changes: Partial<typeof appState.questionGeneration>) => {
    setAppState(prev => ({
      ...prev,
      questionGeneration: {
        ...prev.questionGeneration,
        ...changes,
      },
    }));
  };

  const handleQuestionGeneration = (updatedData: HierarchyData[]) => {
    console.log('🔍 handleQuestionGeneration called with data:', updatedData);
    console.log('🔍 Active document ID:', appState.activeDocumentId);
    console.log('🔍 Updated data length:', updatedData?.length);

    if (!appState.activeDocumentId) {
      console.error('❌ No active document ID');
      return;
    }

    const successfulCount = updatedData.filter(item => item.question_generated).length;
    console.log('🔍 Successful questions count:', successfulCount);

    // Enhanced debug logging for answer field
    console.log('🔍 Questions with content and answer check:', updatedData.filter(item => item.question_generated).map(item => ({
      question: item.question ? item.question.substring(0, 50) + '...' : 'No question',
      answer: item.answer ? item.answer.substring(0, 50) + '...' : 'No answer',
      content: item.content?.substring(0, 50) + '...',
      hasAnswer: !!item.answer,
      answerLength: item.answer ? item.answer.length : 0,
      allKeys: Object.keys(item)
    })));

    // Create a completely new data array to force React re-render
    const newProcessedData = updatedData.map((item, index) => ({
      ...item,
      // Add a unique key to force re-render
      _updateKey: `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`
    }));

    // Update the active document with the new data containing questions
    setAppState(prev => {
      const newState = {
        ...prev,
        documents: prev.documents.map(doc =>
          doc.id === appState.activeDocumentId
            ? {
                ...doc,
                processedData: newProcessedData,
                questionGeneration: {
                  enabled: true,
                  status: 'completed' as const,
                  progress: 100,
                  successfulCount: successfulCount,
                  totalCount: updatedData.length,
                },
                // Add timestamp to force component updates
                lastUpdated: Date.now()
              }
            : doc
        ),
        // Force global state update
        lastQuestionUpdate: Date.now()
      };

      console.log('✅ New state after question generation:', newState);
      console.log('✅ Active document processed data:', newState.documents.find(d => d.id === appState.activeDocumentId)?.processedData);
      return newState;
    });

    console.log('✅ State updated with question generation results');

    // Multiple forced re-renders to ensure UI updates
    setTimeout(() => {
      console.log('🔄 Forcing first re-render...');
      setAppState(prev => ({ ...prev, forceUpdate: Date.now() }));
    }, 100);

    setTimeout(() => {
      console.log('🔄 Forcing second re-render...');
      setAppState(prev => ({ ...prev, forceUpdate: Date.now() }));
    }, 500);

    showSuccess(
      'Questions Generated Successfully',
      `Generated ${successfulCount} questions out of ${updatedData.length} content items`
    );
  };

  const handleCombinedQuestionGeneration = (updatedData: HierarchyData[]) => {
    console.log('🔍 handleCombinedQuestionGeneration called with data:', updatedData);
    console.log('🔍 Updated data length:', updatedData?.length);

    if (!updatedData || updatedData.length === 0) {
      console.error('❌ No updated data provided');
      return;
    }

    const successfulCount = updatedData.filter(item => item.question_generated).length;
    console.log('🔍 Successful questions count:', successfulCount);

    // Group updated data by source document
    const dataByDocument = updatedData.reduce((acc, item) => {
      const docName = item.source_document || 'Unknown Document';
      if (!acc[docName]) {
        acc[docName] = [];
      }
      acc[docName].push(item);
      return acc;
    }, {} as Record<string, HierarchyData[]>);

    console.log('🔍 Data grouped by document:', Object.keys(dataByDocument));

    // Update all affected documents
    setAppState(prev => {
      const updatedDocuments = prev.documents.map(doc => {
        const docData = dataByDocument[doc.name];
        if (docData) {
          // Update this document with the new question data
          const updatedProcessedData = doc.processedData?.map(originalItem => {
            const updatedItem = docData.find(updated =>
              (updated.content === originalItem.content && updated.section === originalItem.section)
            );
            return updatedItem || originalItem;
          }) || docData;

          const docSuccessfulCount = docData.filter(item => item.question_generated).length;

          return {
            ...doc,
            processedData: updatedProcessedData,
            questionGeneration: {
              enabled: true,
              status: 'completed' as const,
              progress: 100,
              successfulCount: docSuccessfulCount,
              totalCount: docData.length,
            },
            lastUpdated: Date.now()
          };
        }
        return doc;
      });

      return {
        ...prev,
        documents: updatedDocuments,
        lastQuestionUpdate: Date.now(),
        forceUpdate: Date.now()
      };
    });

    console.log('✅ Combined question generation state updated');

    showSuccess(
      'Combined Questions Generated Successfully',
      `Generated ${successfulCount} questions across ${Object.keys(dataByDocument).length} documents`
    );
  };

  const handleDatasetExportClose = () => {
    setDatasetExportDialog({
      isOpen: false,
      data: [],
      filename: '',
    });
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <Sparkles size={32} className="logo-icon" />
            <div className="logo-text">
              <h1>LLM DATA Generator</h1>
              <span className="logo-subtitle">Professional Data Extraction Tool</span>
            </div>
          </div>
          <div className="header-actions">
            <button
              onClick={() => setAiProviderManagement({ isOpen: true })}
              className={`ai-provider-button ${!hasAnyProvidersConfigured() ? 'needs-attention' : ''}`}
              title="Manage AI Providers & API Keys"
            >
              <Settings size={20} />
              AI Providers
              {!hasAnyProvidersConfigured() && (
                <span className="config-badge">Setup Required</span>
              )}
            </button>

            <button
              className="fine-tune-button coming-soon"
              title="Fine-tuning feature coming soon"
              disabled
            >
              <Sparkles size={18} />
              Fine Tune
              <span className="coming-soon-badge">Coming Soon</span>
            </button>

            <button
              onClick={() => window.open('https://github.com/ElHadheqMind', '_blank')}
              className="feature-request-button"
              title="Request a feature on GitHub"
            >
              <Github size={18} />
              Feature Request
            </button>
          </div>
          <div className="status-indicator">
            {backendStatus === 'checking' && (
              <div className="status checking">
                <Loader size={16} className="spinning" />
                <span>Checking connection...</span>
              </div>
            )}
            {backendStatus === 'connected' && (
              <div className="status connected">
                <CheckCircle size={16} />
                <span>Backend Connected</span>
              </div>
            )}
            {backendStatus === 'disconnected' && (
              <div className="status disconnected">
                <AlertCircle size={16} />
                <span>Backend Disconnected</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        {backendStatus === 'disconnected' && (
          <div className="connection-error">
            <AlertCircle size={48} />
            <h2>Backend Connection Failed</h2>
            <p>Please ensure the backend service is running on http://localhost:5000</p>
            <button onClick={checkBackendConnection} className="retry-button">
              Retry Connection
            </button>
          </div>
        )}

        {backendStatus === 'connected' && (
          <>
            <div className="upload-section">
              <MultiPdfUpload
                documents={appState.documents}
                onDocumentsAdd={handleDocumentsAdd}
                onDocumentRemove={handleDocumentRemove}
                onDocumentRename={handleDocumentRename}
                onDocumentReorder={handleDocumentReorder}
                onDocumentProcess={handleDocumentProcess}
                onBatchProcess={handleBatchProcess}
                isProcessing={appState.isProcessing || appState.batchProcessing.isActive}
                disabled={backendStatus !== 'connected'}
                cleanOutput={appState.cleanOutput}
                onCleanOutputChange={(enabled) => setAppState(prev => ({ ...prev, cleanOutput: enabled }))}
              />

              {appState.batchProcessing.isActive && (
                <div className="batch-processing-status">
                  <Loader size={24} className="spinning" />
                  <span>
                    Processing documents... ({appState.batchProcessing.currentIndex} of {appState.batchProcessing.totalCount})
                  </span>
                </div>
              )}
            </div>

            {/* Multi-Document Data Visualization */}
            <MultiDocumentVisualization
              documents={appState.documents}
              activeDocumentId={appState.activeDocumentId}
              onDocumentSelect={(documentId) => setAppState(prev => ({ ...prev, activeDocumentId: documentId }))}
              onDownload={handleDownload}
              onBatchDownload={handleBatchDownload}
              onAdvancedExport={handleAdvancedExport}
              onDocumentDataChange={handleDocumentDataChange}
              onCombinedQuestionGeneration={handleCombinedQuestionGeneration}
              questionGenerationState={appState.questionGeneration}
              onQuestionGenerationStateChange={handleQuestionGenerationStateChange}
              isDownloading={downloadState.isDownloading}
            />

            {/* Question Generation Section */}
            {(() => {
              const activeDocument = appState.documents.find(doc => doc.id === appState.activeDocumentId);
              const hasProcessedData = activeDocument?.processedData && activeDocument.processedData.length > 0;

              return hasProcessedData && (
                <div className="question-generation-section">
                  <QuestionGenerationControls
                    data={activeDocument.processedData || []}
                    onQuestionGeneration={handleQuestionGeneration}
                    questionGenerationState={appState.questionGeneration}
                    onStateChange={handleQuestionGenerationStateChange}
                    disabled={appState.isProcessing || appState.batchProcessing.isActive}
                  />

                  {/* Questions Dashboard - Always visible when there's processed data */}
                  <QuestionsDashboard
                    data={activeDocument.processedData || []}
                    onRefresh={() => {
                      // Force refresh by triggering a re-render
                      setAppState(prev => ({ ...prev }));
                    }}
                  />
                </div>
              );
            })()}

            {/* Actions Section */}
            {appState.documents.length > 0 && (
              <div className="actions-section">
                <button onClick={resetApp} className="reset-button">
                  Clear All Documents
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-left">
            <p className="copyright">&copy; 2025 ElHadheqMind. All rights reserved.</p>
            <p className="footer-description">LLM DATA Generator - Professional tool for extracting and generating training data from documents</p>
            <p className="footer-opensource">
              <Heart size={14} className="opensource-icon" />
              Open-source project welcoming contributions from the community
            </p>
          </div>
          <div className="footer-right">
            <a
              href="https://github.com/ElHadheqMind"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
              title="Visit our GitHub repository"
            >
              <Github size={16} />
              GitHub
            </a>
            <a
              href="http://www.elhadheqmind.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link footer-link-website"
              title="Visit our website"
            >
              <Globe size={16} />
              Website
            </a>
          </div>
        </div>
      </footer>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirmDialog}
        type={confirmDialog.type}
      />

      <DatasetExportDialog
        isOpen={datasetExportDialog.isOpen}
        onClose={handleDatasetExportClose}
        data={datasetExportDialog.data}
        filename={datasetExportDialog.filename}
      />

      {aiProviderManagement.isOpen && (
        <div className="modal-overlay">
          <AIProviderManagement
            onClose={async () => {
              setAiProviderManagement({ isOpen: false });
              // Refresh backend connection and question generation status after closing
              await checkBackendConnection();

              // Also refresh question generation status to update UI
              try {
                const questionGenStatus = await ApiService.getQuestionGenerationStatus();
                handleQuestionGenerationStateChange({
                  serviceAvailable: questionGenStatus.service_available,
                  error: null,
                });
              } catch (error) {
                console.warn('Question generation service check failed:', error);
              }
            }}
          />
        </div>
      )}

    </div>
  );
}

export default App;
