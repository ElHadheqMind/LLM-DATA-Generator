import React, { useState } from 'react';
import { Download, FileSpreadsheet, X, Settings } from 'lucide-react';
import { DocumentInfo } from '../types/api';

interface BatchExportDialogProps {
  isOpen: boolean;
  documents: DocumentInfo[];
  onClose: () => void;
  onExport: (options: BatchExportOptions) => void;
  isExporting: boolean;
}

export interface BatchExportOptions {
  format: 'combined' | 'separate' | 'multi-sheet';
  selectedDocuments: string[];
  includeSourceInfo: boolean;
  filename: string;
}

const BatchExportDialog: React.FC<BatchExportDialogProps> = ({
  isOpen,
  documents,
  onClose,
  onExport,
  isExporting,
}) => {
  const [exportOptions, setExportOptions] = useState<BatchExportOptions>({
    format: 'combined',
    selectedDocuments: documents.filter(doc => doc.status === 'completed').map(doc => doc.id),
    includeSourceInfo: true,
    filename: 'batch_export',
  });

  const completedDocuments = documents.filter(doc => 
    doc.status === 'completed' && doc.processedData
  );

  const handleDocumentToggle = (documentId: string) => {
    setExportOptions(prev => ({
      ...prev,
      selectedDocuments: prev.selectedDocuments.includes(documentId)
        ? prev.selectedDocuments.filter(id => id !== documentId)
        : [...prev.selectedDocuments, documentId],
    }));
  };

  const handleSelectAll = () => {
    setExportOptions(prev => ({
      ...prev,
      selectedDocuments: prev.selectedDocuments.length === completedDocuments.length
        ? []
        : completedDocuments.map(doc => doc.id),
    }));
  };

  const handleExport = () => {
    if (exportOptions.selectedDocuments.length === 0) return;
    onExport(exportOptions);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const selectedCount = exportOptions.selectedDocuments.length;
  const totalEntries = completedDocuments
    .filter(doc => exportOptions.selectedDocuments.includes(doc.id))
    .reduce((sum, doc) => sum + (doc.processedData?.length || 0), 0);

  return (
    <div className="batch-export-overlay" onClick={handleBackdropClick}>
      <div className="batch-export-dialog">
        <div className="dialog-header">
          <div className="header-info">
            <FileSpreadsheet size={24} />
            <h3>Batch Export Options</h3>
          </div>
          <button onClick={onClose} className="close-button">
            <X size={20} />
          </button>
        </div>

        <div className="dialog-content">
          {/* Export Format */}
          <div className="option-section">
            <h4>Export Format</h4>
            <div className="format-options">
              <label className="format-option">
                <input
                  type="radio"
                  name="format"
                  value="combined"
                  checked={exportOptions.format === 'combined'}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as any }))}
                />
                <div className="option-content">
                  <strong>Combined File</strong>
                  <span>All data in a single Excel file with source document column</span>
                </div>
              </label>

              <label className="format-option">
                <input
                  type="radio"
                  name="format"
                  value="separate"
                  checked={exportOptions.format === 'separate'}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as any }))}
                />
                <div className="option-content">
                  <strong>Separate Files</strong>
                  <span>Individual Excel file for each document</span>
                </div>
              </label>

              <label className="format-option">
                <input
                  type="radio"
                  name="format"
                  value="multi-sheet"
                  checked={exportOptions.format === 'multi-sheet'}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as any }))}
                />
                <div className="option-content">
                  <strong>Multi-Sheet File</strong>
                  <span>Single Excel file with separate sheet for each document</span>
                </div>
              </label>
            </div>
          </div>

          {/* Document Selection */}
          <div className="option-section">
            <div className="section-header">
              <h4>Select Documents ({selectedCount} of {completedDocuments.length})</h4>
              <button onClick={handleSelectAll} className="select-all-button">
                {selectedCount === completedDocuments.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            
            <div className="document-list">
              {completedDocuments.map((document) => (
                <label key={document.id} className="document-option">
                  <input
                    type="checkbox"
                    checked={exportOptions.selectedDocuments.includes(document.id)}
                    onChange={() => handleDocumentToggle(document.id)}
                  />
                  <div className="document-info">
                    <span className="document-name">{document.name}</span>
                    <span className="document-entries">{document.processedData?.length || 0} entries</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Additional Options */}
          <div className="option-section">
            <h4>Additional Options</h4>
            
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={exportOptions.includeSourceInfo}
                onChange={(e) => setExportOptions(prev => ({ ...prev, includeSourceInfo: e.target.checked }))}
              />
              <span>Include source document information</span>
            </label>

            <div className="filename-option">
              <label htmlFor="filename">Filename:</label>
              <input
                id="filename"
                type="text"
                value={exportOptions.filename}
                onChange={(e) => setExportOptions(prev => ({ ...prev, filename: e.target.value }))}
                className="filename-input"
                placeholder="Enter filename"
              />
            </div>
          </div>

          {/* Export Summary */}
          <div className="export-summary">
            <div className="summary-item">
              <strong>Documents:</strong> {selectedCount}
            </div>
            <div className="summary-item">
              <strong>Total Entries:</strong> {totalEntries}
            </div>
            <div className="summary-item">
              <strong>Format:</strong> {exportOptions.format.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </div>
          </div>
        </div>

        <div className="dialog-actions">
          <button onClick={onClose} className="cancel-button">
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={selectedCount === 0 || isExporting || !exportOptions.filename.trim()}
            className="export-button"
          >
            <Download size={16} />
            {isExporting ? 'Exporting...' : `Export ${selectedCount} Document${selectedCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchExportDialog;
