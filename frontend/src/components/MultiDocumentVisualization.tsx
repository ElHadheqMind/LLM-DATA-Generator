import React, { useState, useMemo, useCallback } from 'react';
import {
  Search,
  Download,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Settings,
  Brain
} from 'lucide-react';
import { useToast } from './ToastContainer';
import BatchExportDialog from './BatchExportDialog';
import EnhancedExcelPreview from './EnhancedExcelPreview';
import QAExcelExport from './QAExcelExport';
import QuestionGenerationControls from './QuestionGenerationControls';
import QuestionsDashboard from './QuestionsDashboard';
import type { BatchExportOptions } from './BatchExportDialog';
import type { DocumentInfo, HierarchyData, QuestionGenerationState } from '../types/api';

interface MultiDocumentVisualizationProps {
  documents: DocumentInfo[];
  activeDocumentId: string | null;
  onDocumentSelect: (documentId: string) => void;
  onDownload: (documentId?: string) => void;
  onBatchDownload: () => void;
  onAdvancedExport: (options: BatchExportOptions) => void;
  onDocumentDataChange?: (documentId: string, newData: HierarchyData[]) => void;
  onCombinedQuestionGeneration?: (updatedData: HierarchyData[]) => void;
  questionGenerationState?: QuestionGenerationState;
  onQuestionGenerationStateChange?: (state: Partial<QuestionGenerationState>) => void;
  isDownloading: boolean;
}

const MultiDocumentVisualization: React.FC<MultiDocumentVisualizationProps> = ({
  documents,
  activeDocumentId,
  onDocumentSelect,
  onDownload,
  onBatchDownload,
  onAdvancedExport,
  onDocumentDataChange,
  onCombinedQuestionGeneration,
  questionGenerationState,
  onQuestionGenerationStateChange,
  isDownloading,
}) => {
  const { showInfo } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'individual' | 'combined'>('individual');
  const [displayMode, setDisplayMode] = useState<'table' | 'hierarchy'>('table');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showQAExportDialog, setShowQAExportDialog] = useState(false);

  const completedDocuments = documents.filter(doc => 
    doc.status === 'completed' && doc.processedData
  );

  const activeDocument = activeDocumentId 
    ? documents.find(doc => doc.id === activeDocumentId)
    : null;

  // Combined data from all completed documents
  const combinedData = useMemo(() => {
    return completedDocuments.flatMap(doc => 
      doc.processedData?.map(item => ({
        ...item,
        source_document: doc.name,
      })) || []
    );
  }, [completedDocuments]);

  // Current data to display based on view mode
  const currentData = viewMode === 'combined' 
    ? combinedData 
    : (activeDocument?.processedData || []);

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return currentData;
    
    return currentData.filter(item =>
      Object.values(item).some(value =>
        value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [currentData, searchTerm]);

  // Group data by sections for hierarchy view
  const groupedData = useMemo(() => {
    const groups: { [key: string]: any[] } = {};

    filteredData.forEach(item => {
      const key = item.section || 'No Section';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    });

    return groups;
  }, [filteredData]);

  // Get Q&A data statistics for multi-document view
  const qaStats = useMemo(() => {
    const qaData = filteredData.filter(item => item.question && item.question_generated);
    const uniqueDocuments = viewMode === 'combined'
      ? [...new Set(qaData.map(item => item.source_document).filter(Boolean))]
      : [];

    return {
      totalQuestions: qaData.length,
      documentCount: viewMode === 'combined' ? uniqueDocuments.length : 1,
      hasQuestions: qaData.length > 0,
      isMultiDocument: viewMode === 'combined' && uniqueDocuments.length > 1
    };
  }, [filteredData, viewMode]);

  // Handle combined question generation
  const handleCombinedQuestionGeneration = useCallback((updatedData: HierarchyData[]) => {
    if (onCombinedQuestionGeneration) {
      onCombinedQuestionGeneration(updatedData);
    }
  }, [onCombinedQuestionGeneration]);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (value && filteredData.length === 0) {
      showInfo('No Results', 'No entries match your search criteria');
    }
  };

  const handleViewModeChange = (mode: 'individual' | 'combined') => {
    setViewMode(mode);
    showInfo('View Changed', `Switched to ${mode} view`);
  };

  const handleDisplayModeChange = (mode: 'table' | 'hierarchy') => {
    setDisplayMode(mode);
    showInfo('Display Changed', `Switched to ${mode} display`);
  };

  // Handle data changes from clean operations
  const handleDataChange = useCallback((newData: HierarchyData[]) => {
    if (onDocumentDataChange && activeDocumentId) {
      onDocumentDataChange(activeDocumentId, newData);
    }
  }, [onDocumentDataChange, activeDocumentId]);

  const renderTableView = () => (
    <EnhancedExcelPreview
      data={filteredData}
      showSourceColumn={viewMode === 'combined'}
      className="multi-document-table"
      onDataChange={viewMode === 'individual' ? handleDataChange : undefined}
    />
  );

  const renderHierarchyView = () => (
    <div className="hierarchy-container">
      {Object.entries(groupedData).map(([section, items]) => (
        <div key={section} className="hierarchy-section">
          <div 
            className="section-header"
            onClick={() => toggleSection(section)}
          >
            {expandedSections.has(section) ? (
              <ChevronDown size={20} />
            ) : (
              <ChevronRight size={20} />
            )}
            <h3>{section}</h3>
            <span className="item-count">({items.length} items)</span>
          </div>
          
          {expandedSections.has(section) && (
            <div className="section-content">
              {items.map((item, index) => (
                <div key={index} className="hierarchy-item">
                  {viewMode === 'combined' && (
                    <div className="source-info">
                      <FileSpreadsheet size={16} />
                      <span>{(item as any).source_document}</span>
                    </div>
                  )}
                  <div className="item-header">
                    {item.subsection && (
                      <div className="subsection">{item.subsection}</div>
                    )}
                    {item.subsubsection && (
                      <div className="subsubsection">{item.subsubsection}</div>
                    )}
                    {item.subsubsubsection && (
                      <div className="subsubsubsection">{item.subsubsubsection}</div>
                    )}
                  </div>
                  <div className="item-content">{item.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  if (completedDocuments.length === 0) {
    return (
      <div className="no-data-message">
        <FileSpreadsheet size={48} />
        <h3>No Processed Documents</h3>
        <p>Upload and process PDF documents to view extracted data here.</p>
      </div>
    );
  }

  return (
    <div className="multi-document-visualization">
      <div className="visualization-header">
        <div className="header-left">
          <BarChart3 size={24} />
          <div>
            <h2>Document Data</h2>
            <p>
              {viewMode === 'combined' 
                ? `${filteredData.length} total entries from ${completedDocuments.length} documents`
                : activeDocument 
                  ? `${filteredData.length} entries from ${activeDocument.name}`
                  : 'Select a document to view data'
              }
            </p>
          </div>
        </div>
        
        <div className="header-actions">
          <div className="search-container">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search content..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="search-input"
            />
          </div>
          
          <div className="view-controls">
            <div className="view-toggle">
              <button
                className={`toggle-button ${viewMode === 'individual' ? 'active' : ''}`}
                onClick={() => handleViewModeChange('individual')}
              >
                Individual
              </button>
              <button
                className={`toggle-button ${viewMode === 'combined' ? 'active' : ''}`}
                onClick={() => handleViewModeChange('combined')}
              >
                Combined
              </button>
            </div>
            
            <div className="display-toggle">
              <button
                className={`toggle-button ${displayMode === 'table' ? 'active' : ''}`}
                onClick={() => handleDisplayModeChange('table')}
              >
                Table
              </button>
              <button
                className={`toggle-button ${displayMode === 'hierarchy' ? 'active' : ''}`}
                onClick={() => handleDisplayModeChange('hierarchy')}
              >
                Hierarchy
              </button>
            </div>
          </div>
          
          <div className="download-actions">
            {viewMode === 'individual' && activeDocument && (
              <button
                onClick={() => onDownload(activeDocument.id)}
                disabled={isDownloading}
                className="download-button individual"
              >
                <Download size={20} />
                Download Current
              </button>
            )}
            
            <button
              onClick={onBatchDownload}
              disabled={isDownloading || completedDocuments.length === 0}
              className="download-button batch"
            >
              <Download size={20} />
              {viewMode === 'combined' ? 'Download Combined' : 'Download All'}
            </button>

            <button
              onClick={() => setShowExportDialog(true)}
              disabled={isDownloading || completedDocuments.length === 0}
              className="download-button advanced"
            >
              <Settings size={20} />
              Advanced Export
            </button>

            {qaStats.hasQuestions && (
              <button
                onClick={() => setShowQAExportDialog(true)}
                disabled={isDownloading}
                className="download-button qa-export"
                title={qaStats.isMultiDocument
                  ? `Export ${qaStats.totalQuestions} Q&A pairs from ${qaStats.documentCount} documents`
                  : `Export ${qaStats.totalQuestions} Q&A pairs`
                }
              >
                <Brain size={20} />
                Export Q&A Dataset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Document Tabs for Individual View */}
      {viewMode === 'individual' && (
        <div className="document-tabs">
          {completedDocuments.map((document) => (
            <button
              key={document.id}
              onClick={() => onDocumentSelect(document.id)}
              className={`document-tab ${activeDocumentId === document.id ? 'active' : ''}`}
            >
              <FileSpreadsheet size={16} />
              <span>{document.name}</span>
              <span className="entry-count">({document.processedData?.length || 0})</span>
            </button>
          ))}
        </div>
      )}

      {/* Combined Question Generation Controls */}
      {viewMode === 'combined' && combinedData.length > 0 && questionGenerationState && onQuestionGenerationStateChange && (
        <div className="combined-question-generation">
          <div className="section-header">
            <h3>Training Question Generation - Combined Documents</h3>
            <p>Generate questions for content from all {completedDocuments.length} documents ({combinedData.length} total items)</p>
          </div>

          <QuestionGenerationControls
            data={combinedData}
            onQuestionGeneration={handleCombinedQuestionGeneration}
            questionGenerationState={questionGenerationState}
            onStateChange={onQuestionGenerationStateChange}
            disabled={isDownloading}
          />

          {/* Combined Questions Dashboard */}
          <QuestionsDashboard
            data={combinedData}
            onRefresh={() => {
              // Force refresh by triggering a re-render
              // This will be handled by the parent component
            }}
          />
        </div>
      )}

      <div className="visualization-content">
        {displayMode === 'table' ? renderTableView() : renderHierarchyView()}
      </div>

      <BatchExportDialog
        isOpen={showExportDialog}
        documents={documents}
        onClose={() => setShowExportDialog(false)}
        onExport={(options) => {
          onAdvancedExport(options);
          setShowExportDialog(false);
        }}
        isExporting={isDownloading}
      />

      {/* Q&A Export Dialog */}
      {showQAExportDialog && (
        <div className="export-dialog-overlay" onClick={() => setShowQAExportDialog(false)}>
          <div className="export-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="export-dialog-header">
              <h3>Export Question-Answer Dataset</h3>
              <button
                className="close-button"
                onClick={() => setShowQAExportDialog(false)}
                title="Close"
              >
                ×
              </button>
            </div>
            <div className="export-dialog-content">
              <QAExcelExport
                data={filteredData}
                filename={viewMode === 'combined' ? 'multi_document_qa_dataset' : 'qa_dataset'}
                className="export-component"
                isMultiDocument={qaStats.isMultiDocument}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiDocumentVisualization;
