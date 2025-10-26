import React, { useState } from 'react';
import { X, Download, FileText, Loader } from 'lucide-react';
import ApiService from '../services/api';
import { downloadBase64File } from '../utils/fileUtils';
import { useToast } from './ToastContainer';
import type { HierarchyData, QAExcelDownloadRequest } from '../types/api';

interface DatasetExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: HierarchyData[];
  filename: string;
}

const DatasetExportDialog: React.FC<DatasetExportDialogProps> = ({
  isOpen,
  onClose,
  data,
  filename
}) => {
  const { showSuccess, showError } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const qaData = data.filter(item => item.question && item.question_generated);
  const hasQuestions = qaData.length > 0;

  const handleExportQAExcel = async () => {
    if (!hasQuestions) {
      showError('No question-answer pairs available for export');
      return;
    }

    setIsExporting(true);

    try {
      const request: QAExcelDownloadRequest = {
        data: qaData,
        filename: filename
      };

      const response = await ApiService.downloadQAExcel(request);

      if (response.success && response.file_data) {
        downloadBase64File(
          response.file_data, 
          response.filename, 
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        showSuccess(`Exported ${response.total_qa_pairs} question-answer pairs to Excel`);
        onClose();
      } else {
        throw new Error(response.error || 'Export failed');
      }
    } catch (error) {
      console.error('Export error:', error);
      showError(error instanceof Error ? error.message : 'Failed to export dataset');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>
            <FileText className="icon" />
            Export Training Dataset
          </h2>
          <button onClick={onClose} className="close-button">
            <X className="icon" />
          </button>
        </div>

        <div className="modal-body">
          <div className="export-info">
            <p>Export your question-answer pairs for AI model training.</p>
            
            <div className="stats">
              <div className="stat-item">
                <span className="label">Total Items:</span>
                <span className="value">{data.length}</span>
              </div>
              <div className="stat-item">
                <span className="label">Q&A Pairs:</span>
                <span className="value">{qaData.length}</span>
              </div>
            </div>

            {!hasQuestions && (
              <div className="warning">
                <p>No question-answer pairs found. Please generate questions first.</p>
              </div>
            )}
          </div>

          <div className="export-actions">
            <button
              onClick={handleExportQAExcel}
              disabled={!hasQuestions || isExporting}
              className="btn btn-primary"
            >
              {isExporting ? (
                <>
                  <Loader className="icon spinning" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="icon" />
                  Export Q&A Excel
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          border-radius: 8px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow: hidden;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h2 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
        }

        .close-button {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          border-radius: 4px;
          color: #6b7280;
        }

        .close-button:hover {
          background: #f3f4f6;
          color: #374151;
        }

        .modal-body {
          padding: 20px;
        }

        .export-info {
          margin-bottom: 20px;
        }

        .export-info p {
          margin: 0 0 16px 0;
          color: #6b7280;
        }

        .stats {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }

        .stat-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          background: #f9fafb;
          border-radius: 6px;
        }

        .label {
          color: #6b7280;
          font-weight: 500;
        }

        .value {
          color: #1f2937;
          font-weight: 600;
        }

        .warning {
          padding: 12px;
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 6px;
          color: #92400e;
        }

        .warning p {
          margin: 0;
        }

        .export-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2563eb;
        }

        .icon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }

        .icon.spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DatasetExportDialog;
