import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, AlertCircle, Play, Pause, RotateCcw, Edit2, Check } from 'lucide-react';
import { useToast } from './ToastContainer';
import { validatePdfFile, formatFileSize, SUPPORTED_FORMATS } from '../utils/fileUtils';
import { DocumentInfo } from '../types/api';

interface MultiPdfUploadProps {
  documents: DocumentInfo[];
  onDocumentsAdd: (files: File[]) => void;
  onDocumentRemove: (documentId: string) => void;
  onDocumentRename: (documentId: string, newName: string) => void;
  onDocumentReorder: (fromIndex: number, toIndex: number) => void;
  onDocumentProcess: (documentId: string) => void;
  onBatchProcess: (documentIds: string[]) => void;
  isProcessing: boolean;
  disabled?: boolean;
  cleanOutput: boolean;
  onCleanOutputChange: (enabled: boolean) => void;
}

const MultiPdfUpload: React.FC<MultiPdfUploadProps> = ({
  documents,
  onDocumentsAdd,
  onDocumentRemove,
  onDocumentRename,
  onDocumentReorder,
  onDocumentProcess,
  onBatchProcess,
  isProcessing,
  disabled = false,
  cleanOutput,
  onCleanOutputChange,
}) => {
  const { showSuccess, showError, showWarning } = useToast();
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [editingDocument, setEditingDocument] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      showWarning('Invalid Files', `${rejectedFiles.length} files were rejected. Only supported document formats are allowed.`);
    }

    if (acceptedFiles.length > 0) {
      const validFiles: File[] = [];
      const invalidFiles: string[] = [];

      acceptedFiles.forEach(file => {
        const validation = validatePdfFile(file);
        if (validation.isValid) {
          validFiles.push(file);
        } else {
          invalidFiles.push(`${file.name}: ${validation.error}`);
        }
      });

      if (invalidFiles.length > 0) {
        showError('File Validation Failed', invalidFiles.join('\n'));
      }

      if (validFiles.length > 0) {
        onDocumentsAdd(validFiles);
        showSuccess(
          'Files Added',
          `${validFiles.length} document${validFiles.length > 1 ? 's' : ''} added successfully`
        );
      }
    }
  }, [onDocumentsAdd, showSuccess, showError, showWarning]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: SUPPORTED_FORMATS,
    multiple: true,
    disabled: disabled || isProcessing,
  });

  const handleDocumentSelect = (documentId: string, selected: boolean) => {
    const newSelected = new Set(selectedDocuments);
    if (selected) {
      newSelected.add(documentId);
    } else {
      newSelected.delete(documentId);
    }
    setSelectedDocuments(newSelected);
  };

  const handleSelectAll = () => {
    const pendingDocs = documents.filter(doc => doc.status === 'pending');
    if (selectedDocuments.size === pendingDocs.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(pendingDocs.map(doc => doc.id)));
    }
  };

  const handleBatchProcess = () => {
    if (selectedDocuments.size === 0) {
      showWarning('No Selection', 'Please select documents to process');
      return;
    }
    onBatchProcess(Array.from(selectedDocuments));
    setSelectedDocuments(new Set());
  };

  const getStatusIcon = (status: DocumentInfo['status']) => {
    switch (status) {
      case 'pending':
        return <FileText className="status-icon pending" size={16} />;
      case 'processing':
        return <div className="status-icon processing spinning" />;
      case 'completed':
        return <FileText className="status-icon completed" size={16} />;
      case 'error':
        return <AlertCircle className="status-icon error" size={16} />;
      default:
        return <FileText className="status-icon pending" size={16} />;
    }
  };

  const getStatusText = (status: DocumentInfo['status']) => {
    switch (status) {
      case 'pending':
        return 'Ready to process';
      case 'processing':
        return 'Processing...';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error occurred';
      default:
        return 'Unknown';
    }
  };

  const handleStartEdit = (document: DocumentInfo) => {
    setEditingDocument(document.id);
    setEditingName(document.name.replace('.pdf', ''));
  };

  const handleSaveEdit = (documentId: string) => {
    if (editingName.trim()) {
      const newName = editingName.trim() + '.pdf';
      onDocumentRename(documentId, newName);
      showSuccess('Document Renamed', `Document renamed to ${newName}`);
    }
    setEditingDocument(null);
    setEditingName('');
  };

  const handleCancelEdit = () => {
    setEditingDocument(null);
    setEditingName('');
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', '');
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      onDocumentReorder(draggedIndex, dropIndex);
      showSuccess('Documents Reordered', 'Document order has been updated');
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const pendingDocuments = documents.filter(doc => doc.status === 'pending');
  const processingDocuments = documents.filter(doc => doc.status === 'processing');
  const completedDocuments = documents.filter(doc => doc.status === 'completed');
  const errorDocuments = documents.filter(doc => doc.status === 'error');

  return (
    <div className="multi-pdf-upload">
      <div className="upload-section">
        <h2 className="section-title">Upload Documents</h2>

        {/* Upload Dropzone */}
        <div
          {...getRootProps()}
          className={`dropzone ${isDragActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        >
          <input {...getInputProps()} />
          <div className="dropzone-content">
            <Upload className="upload-icon" size={48} />
            <div className="dropzone-text">
              {isDragActive ? (
                <p>Drop the document files here...</p>
              ) : (
                <>
                  <p className="primary-text">Drag & drop document files here</p>
                  <p className="secondary-text">or click to select multiple files</p>
                </>
              )}
            </div>
            <div className="file-requirements">
              <p>• Supported: PDF only</p>
              <p>• Maximum size: 10MB per file</p>
              <p>• Multiple files supported</p>
            </div>
          </div>
        </div>

        {/* Processing Options */}
        <div className="processing-options">
          <div className="option-group">
            <label className="clean-option">
              <input
                type="checkbox"
                checked={cleanOutput}
                onChange={(e) => onCleanOutputChange(e.target.checked)}
                disabled={disabled || isProcessing}
              />
              <span className="checkmark"></span>
              <div className="option-content">
                <span className="option-title">Clean Output</span>
                <span className="option-description">
                  Remove extracted lines that don't contain proper section information
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Document Queue */}
        {documents.length > 0 && (
          <div className="document-queue">
            <div className="queue-header">
              <h3>Document Queue ({documents.length})</h3>
              <div className="queue-stats">
                <span className="stat pending">Pending: {pendingDocuments.length}</span>
                <span className="stat processing">Processing: {processingDocuments.length}</span>
                <span className="stat completed">Completed: {completedDocuments.length}</span>
                {errorDocuments.length > 0 && (
                  <span className="stat error">Errors: {errorDocuments.length}</span>
                )}
              </div>
            </div>

            {/* Batch Actions */}
            {pendingDocuments.length > 0 && (
              <div className="batch-actions">
                <label className="select-all">
                  <input
                    type="checkbox"
                    checked={selectedDocuments.size === pendingDocuments.length && pendingDocuments.length > 0}
                    onChange={handleSelectAll}
                  />
                  Select All ({pendingDocuments.length})
                </label>
                <button
                  onClick={handleBatchProcess}
                  disabled={selectedDocuments.size === 0 || isProcessing}
                  className="batch-process-button"
                >
                  <Play size={16} />
                  Process Selected ({selectedDocuments.size})
                </button>
              </div>
            )}

            {/* Document List */}
            <div className="document-list">
              {documents.map((document, index) => (
                <div
                  key={document.id}
                  className={`document-item ${document.status} ${
                    draggedIndex === index ? 'dragging' : ''
                  } ${
                    dragOverIndex === index ? 'drag-over' : ''
                  }`}
                  draggable={document.status !== 'processing' && editingDocument !== document.id}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="document-info">
                    {document.status === 'pending' && (
                      <input
                        type="checkbox"
                        checked={selectedDocuments.has(document.id)}
                        onChange={(e) => handleDocumentSelect(document.id, e.target.checked)}
                        className="document-checkbox"
                      />
                    )}
                    <div className="document-icon">
                      {getStatusIcon(document.status)}
                    </div>
                    <div className="document-details">
                      {editingDocument === document.id ? (
                        <div className="document-edit">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="edit-input"
                            placeholder="Enter document name"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEdit(document.id);
                              } else if (e.key === 'Escape') {
                                handleCancelEdit();
                              }
                            }}
                          />
                          <div className="edit-actions">
                            <button
                              onClick={() => handleSaveEdit(document.id)}
                              className="edit-save"
                              disabled={!editingName.trim()}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="edit-cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="document-name" title={document.name}>
                            {document.name}
                          </div>
                          <div className="document-meta">
                            <span>{formatFileSize(document.size)}</span>
                            <span>•</span>
                            <span className={`status-text ${document.status}`} title={getStatusText(document.status)}>
                              {getStatusText(document.status)}
                            </span>
                            {document.processedData && (
                              <>
                                <span>•</span>
                                <span>{document.processedData.length} entries</span>
                              </>
                            )}
                            {document.processedAt && (
                              <>
                                <span>•</span>
                                <span title={`Processed at ${document.processedAt.toLocaleString()}`}>
                                  {document.processedAt.toLocaleDateString()}
                                </span>
                              </>
                            )}
                          </div>
                          {document.error && (
                            <div className="document-error" title={document.error}>
                              {document.error}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="document-actions">
                    {document.status !== 'processing' && editingDocument !== document.id && (
                      <button
                        onClick={() => handleStartEdit(document)}
                        className="action-button edit"
                        title="Rename Document"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}

                    {document.status === 'pending' && (
                      <button
                        onClick={() => onDocumentProcess(document.id)}
                        disabled={isProcessing}
                        className="action-button process"
                        title="Process Document"
                      >
                        <Play size={16} />
                      </button>
                    )}

                    {document.status === 'error' && (
                      <button
                        onClick={() => onDocumentProcess(document.id)}
                        disabled={isProcessing}
                        className="action-button retry"
                        title="Retry Processing"
                      >
                        <RotateCcw size={16} />
                      </button>
                    )}

                    {document.status !== 'processing' && editingDocument !== document.id && (
                      <button
                        onClick={() => onDocumentRemove(document.id)}
                        className="action-button remove"
                        title="Remove Document"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiPdfUpload;
