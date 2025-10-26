import React, { useState } from 'react';
import { HelpCircle, FileText, Eye, EyeOff, Copy, Check, Download } from 'lucide-react';
import { HierarchyData } from '../types/api';

interface QuestionAnswerViewerProps {
  data: HierarchyData[];
  showQuestions?: boolean;
  onExportDataset?: () => void;
}

const QuestionAnswerViewer: React.FC<QuestionAnswerViewerProps> = ({
  data,
  showQuestions = true,
  onExportDataset
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'both' | 'questions' | 'content'>('both');

  // Debug logging to check answer field
  React.useEffect(() => {
    console.log('🔍 QuestionAnswerViewer data received:', data);
    console.log('🔍 Data length:', data?.length);

    if (data && data.length > 0) {
      const itemsWithQuestions = data.filter(item => item.question_generated);
      console.log('🔍 Items with questions:', itemsWithQuestions.length);

      itemsWithQuestions.forEach((item, index) => {
        console.log(`🔍 Item ${index + 1}:`, {
          question: item.question ? `${item.question.substring(0, 50)}...` : 'No question',
          answer: item.answer ? `${item.answer.substring(0, 50)}...` : 'No answer',
          content: item.content ? `${item.content.substring(0, 50)}...` : 'No content',
          hasAnswer: !!item.answer,
          answerLength: item.answer ? item.answer.length : 0,
          allKeys: Object.keys(item)
        });
      });
    }
  }, [data]);

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const getHierarchyPath = (item: HierarchyData) => {
    const parts = [];
    if (item.section) parts.push(item.section);
    if (item.subsection) parts.push(item.subsection);
    if (item.subsubsection) parts.push(item.subsubsection);
    if (item.subsubsubsection) parts.push(item.subsubsubsection);
    return parts.join(' > ');
  };

  const questionsWithData = data.filter(item => item.question && item.question_generated);
  const questionsCount = questionsWithData.length;
  const totalCount = data.length;

  return (
    <div className="question-answer-viewer">
      <div className="viewer-header">
        <div className="title-section">
          <HelpCircle size={20} />
          <h3>Question-Answer Pairs</h3>
          <span className="count-badge">
            {questionsCount} / {totalCount} questions generated
          </span>
        </div>

        <div className="viewer-controls">
          <div className="view-mode-selector">
            <button
              onClick={() => setViewMode('both')}
              className={viewMode === 'both' ? 'active' : ''}
            >
              Both
            </button>
            <button
              onClick={() => setViewMode('questions')}
              className={viewMode === 'questions' ? 'active' : ''}
            >
              Questions Only
            </button>
            <button
              onClick={() => setViewMode('content')}
              className={viewMode === 'content' ? 'active' : ''}
            >
              Content Only
            </button>
          </div>

          {onExportDataset && questionsCount > 0 && (
            <button onClick={onExportDataset} className="export-button">
              <Download size={16} />
              Export Dataset
            </button>
          )}
        </div>
      </div>

      {questionsCount === 0 && showQuestions && (
        <div className="no-questions-message">
          <HelpCircle size={48} className="text-gray-400" />
          <h4>No Questions Generated Yet</h4>
          <p>Use the question generation controls to create training questions for your extracted content.</p>
        </div>
      )}

      <div className="qa-list">
        {data.map((item, index) => {
          const hasQuestion = item.question && item.question_generated;
          const isExpanded = expandedItems.has(index);
          const hierarchyPath = getHierarchyPath(item);

          // Filter based on view mode
          if (viewMode === 'questions' && !hasQuestion) return null;

          return (
            <div key={index} className={`qa-item ${hasQuestion ? 'has-question' : 'no-question'}`}>
              <div className="qa-header" onClick={() => toggleExpanded(index)}>
                <div className="hierarchy-path">
                  {hierarchyPath && <span className="path">{hierarchyPath}</span>}
                </div>
                <div className="expand-controls">
                  {hasQuestion && (
                    <span className="question-indicator">
                      <HelpCircle size={14} />
                      Question Available
                    </span>
                  )}
                  <button className="expand-button">
                    {isExpanded ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="qa-content">
                  {(viewMode === 'both' || viewMode === 'questions') && hasQuestion && (
                    <div className="question-section">
                      <div className="section-header">
                        <HelpCircle size={16} />
                        <span>Training Question</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(item.question!, index);
                          }}
                          className="copy-button"
                          title="Copy question"
                        >
                          {copiedIndex === index ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                      <div className="question-text">
                        {item.question}
                      </div>
                    </div>
                  )}

                  {(viewMode === 'both' || viewMode === 'content') && (
                    <div className="answer-section">
                      <div className="section-header">
                        <FileText size={16} />
                        <span>Answer Content</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(item.answer || item.content, index + 1000);
                          }}
                          className="copy-button"
                          title="Copy answer"
                        >
                          {copiedIndex === index + 1000 ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                      <div className="answer-text">
                        {/* Debug info */}
                        <div style={{ fontSize: '10px', color: '#666', marginBottom: '5px' }}>
                          DEBUG: answer={item.answer ? 'YES' : 'NO'} | length={item.answer?.length || 0} | content={item.content ? 'YES' : 'NO'}
                        </div>
                        {item.answer || item.content}
                      </div>
                    </div>
                  )}

                  {viewMode === 'both' && hasQuestion && (
                    <div className="qa-pair-actions">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const qaPair = `Q: ${item.question}\nA: ${item.answer || item.content}`;
                          copyToClipboard(qaPair, index + 2000);
                        }}
                        className="copy-pair-button"
                      >
                        {copiedIndex === index + 2000 ? <Check size={14} /> : <Copy size={14} />}
                        Copy Q&A Pair
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {questionsCount > 0 && (
        <div className="viewer-footer">
          <div className="statistics">
            <div className="stat">
              <span className="label">Total Items:</span>
              <span className="value">{totalCount}</span>
            </div>
            <div className="stat">
              <span className="label">Questions Generated:</span>
              <span className="value">{questionsCount}</span>
            </div>
            <div className="stat">
              <span className="label">Success Rate:</span>
              <span className="value">{Math.round((questionsCount / totalCount) * 100)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionAnswerViewer;
