import React, { useState, useEffect } from 'react';
import { Brain, Eye, EyeOff, Copy, Check, Download, Search, Filter, RefreshCw, FileSpreadsheet, Table } from 'lucide-react';
import { HierarchyData } from '../types/api';
import QAExcelExport from './QAExcelExport';
import QAExcelPreview from './QAExcelPreview';
import './QuestionsDashboard.css';

interface QuestionsDashboardProps {
  data: HierarchyData[];
  onRefresh?: () => void;
}

interface QuestionItem {
  id: string;
  question: string;
  answer?: string;
  content: string;
  section: string;
  subsection: string;
  subsubsection: string;
  subsubsubsection: string;
  timestamp: Date;
}

const QuestionsDashboard: React.FC<QuestionsDashboardProps> = ({ data, onRefresh }) => {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSection, setFilterSection] = useState('all');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'excel'>('excel');

  // Extract questions from data with enhanced logging and immediate updates
  useEffect(() => {
    console.log('🔍 QuestionsDashboard: Processing data update...');
    console.log('🔍 Data received:', data);
    console.log('🔍 Data length:', data?.length);

    if (!data || data.length === 0) {
      console.log('⚠️ No data provided to QuestionsDashboard');
      setQuestions([]);
      return;
    }

    const extractedQuestions: QuestionItem[] = data
      .filter(item => {
        const hasQuestion = item.question && item.question_generated;
        console.log(`🔍 Item ${data.indexOf(item)}: hasQuestion=${hasQuestion}, question="${item.question?.substring(0, 50)}..."`);
        return hasQuestion;
      })
      .map((item, index) => ({
        id: `q-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        question: item.question!,
        answer: item.answer,
        content: item.content,
        section: item.section || '',
        subsection: item.subsection || '',
        subsubsection: item.subsubsection || '',
        subsubsubsection: item.subsubsubsection || '',
        timestamp: new Date()
      }));

    console.log('✅ QuestionsDashboard: Extracted Q&A pairs count:', extractedQuestions.length);
    console.log('✅ QuestionsDashboard: Q&A pairs:', extractedQuestions.map(q => ({
      id: q.id,
      question: q.question.substring(0, 50) + '...',
      answer: q.answer ? q.answer.substring(0, 50) + '...' : 'No answer',
      section: q.section
    })));

    // Detect new Q&A pairs for real-time feedback
    const previousCount = questions.length;
    const newCount = extractedQuestions.length;

    if (newCount > previousCount) {
      console.log(`🆕 Real-time update: ${newCount - previousCount} new Q&A pairs detected!`);
    }

    setQuestions(extractedQuestions);

    // Force expand all items when new questions are added
    if (extractedQuestions.length > 0) {
      const allIds = new Set(extractedQuestions.map(q => q.id));
      setExpandedItems(allIds);
      console.log('✅ Auto-expanded all question items for immediate visibility');

      // If there are new questions, scroll to show the latest additions
      if (newCount > previousCount) {
        setTimeout(() => {
          const questionsContainer = document.querySelector('.questions-list');
          if (questionsContainer) {
            questionsContainer.scrollTop = questionsContainer.scrollHeight;
            console.log('📍 Scrolled to show latest questions');
          }
        }, 100);
      }
    }
  }, [data]);

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(id);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const getHierarchyPath = (item: QuestionItem) => {
    const parts = [item.section, item.subsection, item.subsubsection, item.subsubsubsection]
      .filter(part => part && part.trim() !== '');
    return parts.length > 0 ? parts.join(' > ') : 'No section';
  };

  // Filter questions based on search and section
  const filteredQuestions = questions.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSection = filterSection === 'all' || 
      item.section.toLowerCase().includes(filterSection.toLowerCase());
    
    return matchesSearch && matchesSection;
  });

  // Get unique sections for filter
  const sections = ['all', ...new Set(questions.map(q => q.section).filter(s => s))];

  return (
    <div className="questions-dashboard">
      <div className="dashboard-header">
        <div className="title-section">
          <Brain size={24} />
          <h2>Generated Questions Dashboard</h2>
          <span className="count-badge">
            {questions.length} Q&A pairs generated
          </span>
          {questions.length > 0 && (
            <span className="live-indicator" title="Question-Answer pairs updated in real-time">
              🔴 LIVE
            </span>
          )}
        </div>
        
        <div className="header-actions">
          <div className="view-toggle">
            <button
              onClick={() => setViewMode('excel')}
              className={`view-button ${viewMode === 'excel' ? 'active' : ''}`}
              title="Excel View"
            >
              <Table size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`view-button ${viewMode === 'list' ? 'active' : ''}`}
              title="List View"
            >
              <Eye size={16} />
            </button>
          </div>
          <button
            onClick={() => setShowExportDialog(true)}
            className="export-button"
            title="Export Q&A Dataset"
            disabled={questions.length === 0}
          >
            <FileSpreadsheet size={16} />
          </button>
          <button onClick={onRefresh} className="refresh-button" title="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {questions.length === 0 && (
        <div className="no-questions-state">
          <Brain size={64} className="text-gray-400" />
          <h3>No Questions Generated Yet</h3>
          <p>Upload a PDF document and use the question generation feature to see questions here.</p>
        </div>
      )}

      {questions.length > 0 && (
        <>
          {viewMode === 'list' ? (
            <>
              <div className="dashboard-controls">
                <div className="search-box">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search questions or content..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="filter-box">
                  <Filter size={16} />
                  <select
                    value={filterSection}
                    onChange={(e) => setFilterSection(e.target.value)}
                  >
                    {sections.map(section => (
                      <option key={section} value={section}>
                        {section === 'all' ? 'All Sections' : section}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="questions-stats">
                <div className="stat-item">
                  <span className="stat-label">Total Q&A Pairs:</span>
                  <span className="stat-value">{questions.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Filtered Results:</span>
                  <span className="stat-value">{filteredQuestions.length}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="excel-view-container">
              <QAExcelPreview
                data={data}
                className="qa-excel-preview-dashboard"
                maxHeight="70vh"
              />
            </div>
          )}

          {viewMode === 'list' && (
            <div className="questions-list">
            {filteredQuestions.map((item) => {
              const isExpanded = expandedItems.has(item.id);
              const hierarchyPath = getHierarchyPath(item);

              return (
                <div key={item.id} className="question-card">
                  <div className="question-header" onClick={() => toggleExpanded(item.id)}>
                    <div className="question-preview">
                      <div className="hierarchy-path">{hierarchyPath}</div>
                      <div className="question-text-preview">
                        <strong>Q:</strong> {item.question.substring(0, 80)}
                        {item.question.length > 80 && '...'}
                      </div>
                      {item.answer && (
                        <div className="answer-text-preview">
                          <strong>A:</strong> {item.answer.substring(0, 80)}
                          {item.answer.length > 80 && '...'}
                        </div>
                      )}
                    </div>
                    <div className="header-actions">
                      <button className="expand-button">
                        {isExpanded ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="question-details">
                      <div className="question-section">
                        <div className="section-header">
                          <Brain size={16} />
                          <span>Generated Question</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(item.question, `q-${item.id}`);
                            }}
                            className="copy-button"
                            title="Copy question"
                          >
                            {copiedIndex === `q-${item.id}` ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                        <div className="question-text">
                          {item.question}
                        </div>
                      </div>

                      {item.answer && (
                        <div className="answer-section">
                          <div className="section-header">
                            <span>Generated Answer</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(item.answer!, `a-${item.id}`);
                              }}
                              className="copy-button"
                              title="Copy answer"
                            >
                              {copiedIndex === `a-${item.id}` ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                          </div>
                          <div className="answer-text">
                            {item.answer}
                          </div>
                        </div>
                      )}

                      <div className="content-section">
                        <div className="section-header">
                          <span>Source Content</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(item.content, `c-${item.id}`);
                            }}
                            className="copy-button"
                            title="Copy content"
                          >
                            {copiedIndex === `c-${item.id}` ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                        <div className="content-text">
                          {item.content}
                        </div>
                      </div>

                      <div className="qa-pair-section">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const answer = item.answer || item.content;
                            const qaPair = `Q: ${item.question}\nA: ${answer}`;
                            copyToClipboard(qaPair, `qa-${item.id}`);
                          }}
                          className="copy-qa-button"
                        >
                          {copiedIndex === `qa-${item.id}` ? <Check size={16} /> : <Copy size={16} />}
                          Copy Q&A Pair
                        </button>
                      </div>

                      <div className="question-metadata">
                        <span className="timestamp">
                          Generated: {item.timestamp.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          )}
        </>
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <div className="export-dialog-overlay" onClick={() => setShowExportDialog(false)}>
          <div className="export-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="export-dialog-header">
              <h3>Export Question-Answer Dataset</h3>
              <button
                className="close-button"
                onClick={() => setShowExportDialog(false)}
                title="Close"
              >
                ×
              </button>
            </div>
            <div className="export-dialog-content">
              <QAExcelExport
                data={data}
                filename="questions_dataset"
                className="export-component"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionsDashboard;
