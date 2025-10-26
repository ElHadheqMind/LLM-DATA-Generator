import React, { useState } from 'react';
import { MessageSquare, Sparkles, Info, Loader } from 'lucide-react';
import ApiService from '../services/api';
import type { GenerationMode } from '../types/api';
import './SystemPromptEditor.css';

interface SystemPromptEditorProps {
  systemPrompt: string;
  onSystemPromptChange: (prompt: string) => void;
  selectedProvider?: string;
  selectedModel?: string;
  generationMode?: GenerationMode;
}

const SystemPromptEditor: React.FC<SystemPromptEditorProps> = ({
  systemPrompt,
  onSystemPromptChange,
  selectedProvider,
  selectedModel,
  generationMode = 'qa_pair'
}) => {
  const [useCaseDescription, setUseCaseDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Single simplified template based on generation mode
  const getSimplifiedTemplate = () => {
    if (generationMode === 'question_only') {
      return 'You are an expert in generating training data for LLM fine-tuning. Generate a clear, specific question based on the provided document content. Questions should cover ALL content comprehensively. Return ONLY the question text with no formatting or explanations.';
    } else {
      return 'You are an expert in generating training data for LLM fine-tuning. Generate a question-answer pair based on the provided document content. Cover ALL content comprehensively. CRITICAL: Respond with ONLY valid JSON - no markdown, no code blocks. Format: {"question": "...", "answer": "..."}. The answer should be complete and detailed. Return ONLY this JSON object.';
    }
  };

  const handleGeneratePrompt = async () => {
    if (!useCaseDescription.trim()) {
      alert('Please describe your use case first');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await ApiService.generateSystemPrompt(
        useCaseDescription,
        selectedProvider,
        selectedModel,
        generationMode
      );
      if (response.success && response.system_prompt) {
        onSystemPromptChange(response.system_prompt);
      } else {
        alert('Failed to generate system prompt: ' + (response.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error generating system prompt:', error);
      alert('Failed to generate system prompt: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseTemplate = () => {
    onSystemPromptChange(getSimplifiedTemplate());
  };

  return (
    <div className="system-prompt-editor">
      <div className="system-prompt-header">
        <div className="header-title">
          <MessageSquare size={20} />
          <h3>System Prompt Configuration</h3>
          <span className="generation-mode-badge">
            {generationMode === 'question_only' ? '📝 Question Only Mode' : '💬 Q&A Pair Mode'}
          </span>
          <button
            className="info-button"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <Info size={14} />
          </button>
        </div>
      </div>

      {showTooltip && (
        <div className="info-tooltip">
          The system prompt defines how the AI behaves and generates {generationMode === 'question_only' ? 'questions' : 'question-answer pairs'}.
          A well-crafted system prompt significantly improves output quality and consistency.
          You can use templates, generate custom prompts, or write your own.
        </div>
      )}

      {/* AI-Powered Prompt Generator */}
      <div className="prompt-generator-section">
        <div className="generator-header">
          <Sparkles size={16} />
          <span>Generate Custom System Prompt</span>
        </div>
        <div className="generator-content">
          <textarea
            value={useCaseDescription}
            onChange={(e) => setUseCaseDescription(e.target.value)}
            className="use-case-input"
            rows={3}
            placeholder="Describe your use case... (e.g., 'I need to extract information from medical research papers about clinical trials and generate questions about treatment efficacy and patient outcomes')"
          />
          <button
            onClick={handleGeneratePrompt}
            className="generate-button"
            disabled={isGenerating || !useCaseDescription.trim()}
          >
            {isGenerating ? (
              <>
                <Loader size={16} className="spinner" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>Generate System Prompt</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Template Button */}
      <div className="template-section">
        <button
          onClick={handleUseTemplate}
          className="template-button"
        >
          <span>📋 Use Template</span>
        </button>
      </div>

      {/* System Prompt Editor */}
      <div className="prompt-editor-section">
        <div className="editor-header">
          <span>System Prompt</span>
          <span className="character-count">{systemPrompt.length} characters</span>
        </div>
        <textarea
          value={systemPrompt}
          onChange={(e) => onSystemPromptChange(e.target.value)}
          className="system-prompt-textarea"
          rows={8}
          placeholder="You are a domain expert in [YOUR DOMAIN]. CRITICAL: You MUST respond with ONLY valid JSON - no markdown formatting, no code blocks, no explanations. Generate question-answer pairs with exactly 2 keys: 'question' and 'answer'. The answer should be detailed and comprehensive. Format: {&quot;question&quot;: &quot;...&quot;, &quot;answer&quot;: &quot;...&quot;}. Return ONLY this JSON object."
        />
        <div className="editor-hint">
          💡 Tip: Use templates above or generate a custom prompt based on your use case
        </div>
      </div>
    </div>
  );
};

export default SystemPromptEditor;

