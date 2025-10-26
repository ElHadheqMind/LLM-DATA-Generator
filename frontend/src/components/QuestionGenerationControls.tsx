import React, { useState, useEffect } from 'react';
import { Brain, Play, Pause, CheckCircle, AlertCircle, Loader, RefreshCw, Sliders } from 'lucide-react';
import type { QuestionGenerationState, HierarchyData, GenerationMode } from '../types/api';
import ApiService from '../services/api';
import AIProviderSelector from './AIProviderSelector';
import ModelSelector from './ModelSelector';
import AIProviderErrorDialog from './AIProviderErrorDialog';
import AIParameterControls from './AIParameterControls';
import SystemPromptEditor from './SystemPromptEditor';
import { useProviderStatusManager } from '../hooks/useProviderStatusManager';
import {
  saveSelectedProvider,
  loadSelectedProvider,
  saveSelectedModel,
  loadSelectedModel,
  saveSystemPrompt,
  loadSystemPrompt,
  saveAIParameters,
  loadAIParameters
} from '../utils/storage';
import { saveProviderCredentials, getProviderCredentials } from '../utils/credentialStorage';


interface QuestionGenerationControlsProps {
  data: HierarchyData[];
  onQuestionGeneration: (data: HierarchyData[]) => void;
  questionGenerationState: QuestionGenerationState;
  onStateChange: (state: Partial<QuestionGenerationState>) => void;
  disabled?: boolean;
}

const QuestionGenerationControls: React.FC<QuestionGenerationControlsProps> = ({
  data,
  onQuestionGeneration,
  questionGenerationState,
  onStateChange,
  disabled = false
}) => {
  // Use the centralized provider status manager
  const { statuses, getStatus, getLocalEndpoint } = useProviderStatusManager();

  const [generationMode, setGenerationMode] = useState<GenerationMode>('qa_pair'); // Default to Q&A pair mode

  // Initialize state from localStorage
  const [selectedProvider, setSelectedProvider] = useState<string>(() => loadSelectedProvider() || '');
  const [selectedModel, setSelectedModel] = useState<string>(() => loadSelectedModel() || '');

  // AI Parameter states - load from localStorage
  const savedParams = loadAIParameters();
  const [temperature, setTemperature] = useState<number>(savedParams?.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState<number>(savedParams?.maxTokens ?? 300);
  const [topP, setTopP] = useState<number>(savedParams?.topP ?? 0.9);
  const [systemPrompt, setSystemPrompt] = useState<string>(() => loadSystemPrompt() || '');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Track current provider status during generation
  const [activeProviderStatus, setActiveProviderStatus] = useState<string>('');

  // Update active provider status when selected provider changes
  useEffect(() => {
    if (selectedProvider) {
      const status = getStatus(selectedProvider);
      if (status) {
        const statusText = status.available ? '✓ Available' : '✗ Unavailable';
        setActiveProviderStatus(statusText);
      }
    }
  }, [selectedProvider, statuses, getStatus]);



  // AI Provider Error Dialog state
  const [errorDialog, setErrorDialog] = useState({
    isOpen: false,
    failedProvider: '',
    providerDisplayName: '',
    errorMessage: '',
    availableProviders: [] as Array<{
      id: string;
      name: string;
      status: 'available' | 'unavailable';
    }>
  });

  // Save state to localStorage when it changes
  useEffect(() => {
    if (selectedProvider) {
      saveSelectedProvider(selectedProvider);

      // For local providers (LM Studio, Ollama), load endpoint from localStorage
      // and save to credentialStorage so it's sent with API requests
      if (selectedProvider === 'lm_studio' || selectedProvider === 'ollama') {
        const endpoint = getLocalEndpoint(selectedProvider);

        if (endpoint) {
          console.log(`🔧 Loading endpoint for ${selectedProvider}: ${endpoint}`);
          const existingCreds = getProviderCredentials(selectedProvider);
          saveProviderCredentials(selectedProvider, {
            ...existingCreds,
            endpoint: endpoint
          });
          console.log(`✅ Endpoint saved to credentialStorage for ${selectedProvider}`);
        } else {
          console.warn(`⚠️ No endpoint found in localStorage for ${selectedProvider}`);
        }
      }
    }
  }, [selectedProvider, getLocalEndpoint]);

  useEffect(() => {
    if (selectedModel) {
      saveSelectedModel(selectedModel);

      // Also save model to credentialStorage for the selected provider
      // This ensures the model is sent as a header to the backend
      if (selectedProvider) {
        const existingCreds = getProviderCredentials(selectedProvider);
        saveProviderCredentials(selectedProvider, {
          ...existingCreds,
          model_name: selectedModel
        });
      }
    }
  }, [selectedModel, selectedProvider]);

  useEffect(() => {
    saveSystemPrompt(systemPrompt);
  }, [systemPrompt]);

  useEffect(() => {
    saveAIParameters({
      temperature,
      maxTokens,
      topP
    });
  }, [temperature, maxTokens, topP]);

  // Helper function to load available providers for error dialog
  const loadAvailableProviders = async () => {
    try {
      const response = await ApiService.getAIProviders();
      if (response.success && response.data) {
        return Object.entries(response.data).map(([id, info]: [string, any]) => ({
          id,
          name: info.name || id,
          status: info.available ? 'available' as const : 'unavailable' as const
        }));
      }
    } catch (error) {
      console.error('Failed to load providers for error dialog:', error);
    }
    return [];
  };

  // Handle provider-specific errors by showing the error dialog
  const handleProviderError = async (failedProvider: string, providerDisplayName: string, errorMessage: string) => {
    const availableProviders = await loadAvailableProviders();

    setErrorDialog({
      isOpen: true,
      failedProvider,
      providerDisplayName,
      errorMessage,
      availableProviders
    });

    // Stop generation and reset state
    onStateChange({
      isGenerating: false,
      progress: 0,
      currentItem: 0,
      totalItems: 0,
      error: null // Don't show generic error since we're showing the dialog
    });
  };

  // Error dialog handlers
  const handleRetryWithSameProvider = () => {
    setErrorDialog(prev => ({ ...prev, isOpen: false }));
    // Retry with the same provider
    handleGenerateQuestions();
  };

  const handleSwitchProvider = (newProviderId: string) => {
    setErrorDialog(prev => ({ ...prev, isOpen: false }));
    // Update the selected provider and retry
    setSelectedProvider(newProviderId);
    // Retry with the new provider after a short delay to ensure state is updated
    setTimeout(() => {
      handleGenerateQuestions();
    }, 100);
  };

  const handleCancelError = () => {
    setErrorDialog(prev => ({ ...prev, isOpen: false }));
  };

  const handleGenerateQuestions = async () => {
    if (!data || data.length === 0) {
      onStateChange({ error: 'No data available for question generation' });
      return;
    }

    // Validate required fields
    if (!systemPrompt || !systemPrompt.trim()) {
      onStateChange({ error: 'System prompt is required. Please configure a system prompt before generating questions.' });
      return;
    }

    if (!selectedModel || !selectedModel.trim()) {
      onStateChange({ error: 'Model selection is required. Please select a model before generating questions.' });
      return;
    }

    if (!selectedProvider || !selectedProvider.trim()) {
      onStateChange({ error: 'Provider selection is required. Please select a provider before generating questions.' });
      return;
    }

    onStateChange({
      isGenerating: true,
      progress: 0,
      currentItem: 0,
      totalItems: 0,
      error: null
    });

    try {
      console.log('🚀 Starting real-time question generation...');

      // Keep track of questions we've already processed to avoid duplicates
      let processedQuestionCount = 0;
      let currentData = [...data]; // Create a working copy of the data

      // Start real-time progress tracking with live question updates
      const progressInterval = setInterval(async () => {
        try {
          const progressData = await ApiService.getQuestionGenerationProgress();
          console.log('📊 Progress update:', progressData);

          // Update progress with detailed tracking
          onStateChange({
            progress: progressData.progress_percent || questionGenerationState.progress,
            currentItem: progressData.current_item || questionGenerationState.currentItem,
            totalItems: progressData.total_items || questionGenerationState.totalItems
          });

          // Check for new questions and update UI immediately
          if (progressData.generated_questions && progressData.generated_questions.length > processedQuestionCount) {
            console.log('✨ New questions detected:', progressData.generated_questions.length - processedQuestionCount, 'new questions');

            // Process new questions since last update
            const newQuestions = progressData.generated_questions.slice(processedQuestionCount);

            for (const questionData of newQuestions) {
              const itemIndex = questionData.index;
              if (itemIndex >= 0 && itemIndex < currentData.length) {
                // Update the data item with the new question and answer
                currentData[itemIndex] = {
                  ...currentData[itemIndex],
                  question: questionData.question,
                  answer: questionData.answer || '',  // Include answer from progress data
                  question_generated: true
                };

                console.log(`✅ Real-time update: Added Q&A pair for item ${itemIndex + 1}:`);
                console.log(`   Question: ${questionData.question.substring(0, 100)}...`);
                console.log(`   Answer: ${(questionData.answer || '').substring(0, 100)}...`);
              }
            }

            // Update the UI with the new questions immediately
            console.log('🔄 Updating UI with real-time questions...');
            onQuestionGeneration([...currentData]);

            processedQuestionCount = progressData.generated_questions.length;
          }

          // Handle special status updates
          if (progressData.current_status) {
            const status = progressData.current_status;
            if (status === 'rate_limited' && progressData.rate_limit_wait > 0) {
              console.log(`🚦 Rate limit detected, waiting ${progressData.rate_limit_wait}s...`);
            } else if (status.startsWith('processing_attempt_')) {
              console.log(`🔄 Processing attempt ${status.split('_')[2]}...`);
            } else if (status === 'retrying') {
              console.log(`🔄 Retrying after failure...`);
            }
          }

          // Stop polling when generation is complete
          if (!progressData.is_generating && progressData.progress_percent === 100) {
            clearInterval(progressInterval);
            console.log('🏁 Real-time progress tracking completed');
          }
        } catch (progressError) {
          console.warn('Progress tracking error:', progressError);
        }
      }, 1000); // Poll every second for real-time updates

      // Start the actual question generation
      const response = await ApiService.generateQuestionsWithProgress({
        data,
        provider: selectedProvider || undefined,
        model: selectedModel || undefined,
        disable_fallback: true,  // Always disable fallback to show error dialog on failures
        // AI parameters
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        system_prompt: systemPrompt,
        generation_mode: generationMode
      });

      clearInterval(progressInterval);

      console.log('🔍 Question generation response:', response);
      console.log('🔍 Response success:', response.success);
      console.log('🔍 Response data length:', response.data?.length);
      console.log('🔍 Successful generations:', response.successful_generations);

      if (response.success && response.data) {
        console.log('✅ Final update with complete data:', response.data);

        // Final update with the complete response data (in case any questions were missed)
        onQuestionGeneration(response.data);

        onStateChange({
          isGenerating: false,
          progress: 100,
          error: null
        });

        console.log('✅ Question generation completed successfully');

        // Force a final progress check to ensure UI is updated
        setTimeout(async () => {
          try {
            const finalProgress = await ApiService.getQuestionGenerationProgress();
            console.log('🏁 Final progress check:', finalProgress);

            // One more final update to ensure all questions are displayed
            if (finalProgress.generated_questions && finalProgress.generated_questions.length > 0) {
              console.log('🔄 Final UI sync with all generated questions');
              onQuestionGeneration(response.data);
            }
          } catch (e) {
            console.warn('Final progress check failed:', e);
          }
        }, 500);

      } else {
        console.error('❌ Question generation failed:', response.error);

        // Check if this is a provider-specific error that should show the error dialog
        if (response.failed_provider && response.provider_display_name) {
          await handleProviderError(
            response.failed_provider,
            response.provider_display_name,
            response.error || 'Unknown error occurred'
          );
          return;
        }

        throw new Error(response.error || 'Question generation failed');
      }
    } catch (error: any) {
      console.error('Question generation failed:', error);

      // Check if this is a provider-specific error
      if (error.failed_provider && error.provider_display_name) {
        await handleProviderError(
          error.failed_provider,
          error.provider_display_name,
          error.message || 'Unknown error occurred'
        );
        return;
      }

      let errorMessage = 'Failed to generate questions';

      if (error.message.includes('503')) {
        errorMessage = 'Question generation service is temporarily unavailable';
      } else if (error.message.includes('timeout') || error.message.includes('timed out')) {
        errorMessage = 'Request timed out. Generation may still be running. Check progress or refresh the page.';
        // Don't reset progress to 0 for timeouts, keep current progress
        onStateChange({
          isGenerating: false,
          error: errorMessage
        });
        return; // Exit early to preserve progress
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'Rate limit exceeded. The system will automatically retry. Please wait.';
      } else if (error.message.includes('Network Error')) {
        errorMessage = 'Network connection error. Please check your connection and try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Check if questions were actually generated despite the error
      try {
        const finalProgress = await ApiService.getQuestionGenerationProgress();
        if (finalProgress.successful_count > 0) {
          console.log('🎯 Questions were generated despite error, updating UI...');
          // Don't show error if questions were actually generated
          onStateChange({
            isGenerating: false,
            progress: 100,
            error: null
          });
          return;
        }
      } catch (progressError) {
        console.warn('Could not check final progress:', progressError);
      }

      onStateChange({
        isGenerating: false,
        progress: 0,
        currentItem: 0,
        totalItems: 0,
        error: errorMessage
      });
    }
  };



  const getStatusIcon = () => {
    if (questionGenerationState.isGenerating) {
      return <Loader size={16} className="spinning" />;
    }
    if (questionGenerationState.error) {
      return <AlertCircle size={16} className="text-red-500" />;
    }
    if (canGenerate) {
      return <CheckCircle size={16} className="text-green-500" />;
    }
    return <AlertCircle size={16} className="text-yellow-500" />;
  };

  const getStatusText = () => {
    if (questionGenerationState.isGenerating) {
      const progress = questionGenerationState.progress || 0;
      const currentItem = questionGenerationState.currentItem || 0;
      const totalItems = questionGenerationState.totalItems || 0;

      if (totalItems > 0) {
        return `Generating questions... ${currentItem || 0}/${totalItems} (${progress}%)`;
      } else if (data && data.length > 0) {
        const estimatedCurrent = Math.ceil((progress / 100) * data.length);
        return `Generating questions... ${estimatedCurrent}/${data.length} (${progress}%)`;
      }
      return `Generating questions... ${progress}%`;
    }
    if (questionGenerationState.error) {
      // Check if it's a timeout error and provide helpful message
      if (questionGenerationState.error.includes('timeout') || questionGenerationState.error.includes('timed out')) {
        return 'Generation may still be running. Check progress or try refreshing.';
      }
      return questionGenerationState.error;
    }
    if (!systemPrompt || !systemPrompt.trim()) {
      return 'System prompt is required - please configure one above';
    }
    if (!selectedModel || !selectedModel.trim()) {
      return 'Model selection is required - please select a model';
    }
    if (!selectedProvider || !selectedProvider.trim()) {
      return 'Provider selection is required - please select a provider';
    }
    return 'Ready to generate questions';
  };

  const canGenerate = !questionGenerationState.isGenerating &&
                     !disabled &&
                     data &&
                     data.length > 0 &&
                     systemPrompt &&
                     systemPrompt.trim() !== '' &&
                     selectedModel &&
                     selectedModel.trim() !== '' &&
                     selectedProvider &&
                     selectedProvider.trim() !== '';

  const isTimeoutError = questionGenerationState.error &&
                         (questionGenerationState.error.includes('timeout') ||
                          questionGenerationState.error.includes('timed out'));

  const handleContinueMonitoring = async () => {
    console.log('🔄 Continuing to monitor progress...');
    onStateChange({
      isGenerating: true,
      error: null
    });

    // Start monitoring progress again
    const progressInterval = setInterval(async () => {
      try {
        const progressData = await ApiService.getQuestionGenerationProgress();
        console.log('📊 Continued progress update:', progressData);

        onStateChange({
          progress: progressData.progress_percent || questionGenerationState.progress,
          currentItem: progressData.current_item || questionGenerationState.currentItem,
          totalItems: progressData.total_items || questionGenerationState.totalItems
        });

        // Check for completion
        if (!progressData.is_generating && progressData.progress_percent === 100) {
          clearInterval(progressInterval);
          onStateChange({
            isGenerating: false,
            progress: 100,
            error: null
          });
          console.log('✅ Generation completed during monitoring');
        }
      } catch (progressError) {
        console.warn('Progress monitoring error:', progressError);
        clearInterval(progressInterval);
        onStateChange({
          isGenerating: false,
          error: 'Failed to monitor progress'
        });
      }
    }, 2000); // Check every 2 seconds

    // Stop monitoring after 5 minutes
    setTimeout(() => {
      clearInterval(progressInterval);
      onStateChange({
        isGenerating: false
      });
    }, 300000);
  };

  return (
    <div className="question-generation-controls">
      <div className="controls-header">
        <div className="title-section">
          <Brain size={20} />
          <h3>Training Question Generation</h3>
        </div>
      </div>

      <div className="status-section">
        <div className="status-indicator">
          {getStatusIcon()}
          <span className="status-text">{getStatusText()}</span>
        </div>

        {/* Provider Status Indicator */}
        {selectedProvider && (
          <div className="provider-status-indicator" style={{
            fontSize: '0.85rem',
            color: activeProviderStatus.includes('✓') ? '#10b981' : '#ef4444',
            marginTop: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span>Active Provider: {selectedProvider}</span>
            <span style={{ fontWeight: 'bold' }}>{activeProviderStatus}</span>
          </div>
        )}

        {questionGenerationState.isGenerating && (
          <div className="progress-section">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${questionGenerationState.progress}%` }}
              />
              <div className="progress-text">
                {questionGenerationState.totalItems > 0
                  ? `${questionGenerationState.currentItem || 0}/${questionGenerationState.totalItems} (${questionGenerationState.progress}%)`
                  : `${questionGenerationState.progress}%`
                }
              </div>
            </div>
            <div className="progress-details">
              <span className="progress-label">Real-time question generation in progress...</span>
              <span className="progress-note">Questions will appear as they are generated</span>
              <span className="progress-note">⚠️ If rate limited, the system will automatically retry</span>
            </div>
          </div>
        )}
      </div>

      <div className="settings-panel">
        <h4>Question Generation Settings</h4>

        {/* Generation Mode Selection */}
        <div className="setting-item generation-mode-selector">
          <label className="mode-label">Generation Mode:</label>
          <div className="mode-options">
            <label className={`mode-option ${generationMode === 'qa_pair' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="generationMode"
                value="qa_pair"
                checked={generationMode === 'qa_pair'}
                onChange={(e) => setGenerationMode(e.target.value as GenerationMode)}
              />
              <div className="mode-content">
                <strong>Question + Answer</strong>
                <small>Generate both custom question and custom answer using AI</small>
              </div>
            </label>
            <label className={`mode-option ${generationMode === 'question_only' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="generationMode"
                value="question_only"
                checked={generationMode === 'question_only'}
                onChange={(e) => setGenerationMode(e.target.value as GenerationMode)}
              />
              <div className="mode-content">
                <strong>Question Only</strong>
                <small>Generate only the question; answer is set to the original content</small>
              </div>
            </label>
          </div>
        </div>

        <AIProviderSelector
          selectedProvider={selectedProvider}
          onProviderChange={setSelectedProvider}
          className="provider-selector-compact"
        />

        <ModelSelector
          selectedProvider={selectedProvider}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          className="model-selector-compact"
        />
      </div>

      {/* System Prompt Editor - Always Visible */}
      <SystemPromptEditor
        systemPrompt={systemPrompt}
        onSystemPromptChange={setSystemPrompt}
        selectedProvider={selectedProvider}
        selectedModel={selectedModel}
        generationMode={generationMode}
      />

      {/* Advanced AI Parameters - Collapsible */}
      <div className="controls-section">
        <div className="advanced-settings-section">
          <button
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className="advanced-settings-toggle"
          >
            <Sliders size={16} />
            <span>Advanced AI Parameters (Temperature, Tokens, Top-P)</span>
            <span className={`chevron ${showAdvancedSettings ? 'expanded' : ''}`}>▼</span>
          </button>

          {showAdvancedSettings && (
            <AIParameterControls
              temperature={temperature}
              maxTokens={maxTokens}
              topP={topP}
              systemPrompt={systemPrompt}
              onTemperatureChange={setTemperature}
              onMaxTokensChange={setMaxTokens}
              onTopPChange={setTopP}
              onSystemPromptChange={setSystemPrompt}
            />
          )}
        </div>
      </div>

      {/* Action Buttons - Moved below settings */}
      <div className="action-buttons">
        <button
          onClick={handleGenerateQuestions}
          disabled={!canGenerate}
          className={`generate-button ${canGenerate ? 'enabled' : 'disabled'}`}
        >
          {questionGenerationState.isGenerating ? (
            <>
              <Pause size={16} />
              Generating...
            </>
          ) : (
            <>
              <Play size={16} />
              Generate Questions
            </>
          )}
        </button>

        {isTimeoutError && (
          <button
            onClick={handleContinueMonitoring}
            className="continue-monitoring-button"
            title="Continue monitoring progress in case generation is still running"
          >
            <RefreshCw size={16} />
            Continue Monitoring
          </button>
        )}

        {data && data.length > 0 && (
          <div className="data-info">
            <span>{data.length} content items ready for processing</span>
          </div>
        )}
      </div>

      {questionGenerationState.error && (
        <div className="error-message">
          <AlertCircle size={16} />
          <span>{questionGenerationState.error}</span>
        </div>
      )}

      <AIProviderErrorDialog
        isOpen={errorDialog.isOpen}
        failedProvider={errorDialog.failedProvider}
        providerDisplayName={errorDialog.providerDisplayName}
        errorMessage={errorDialog.errorMessage}
        availableProviders={errorDialog.availableProviders}
        onRetry={handleRetryWithSameProvider}
        onSwitchProvider={handleSwitchProvider}
        onCancel={handleCancelError}
      />
    </div>
  );
};

export default QuestionGenerationControls;
