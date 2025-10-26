import React, { useState } from 'react';
import { Download, FileSpreadsheet, CheckCircle, AlertCircle, Brain, HelpCircle, FileJson, FileText } from 'lucide-react';
import { HierarchyData } from '../types/api';
import { useToast } from './ToastContainer';
import ApiService from '../services/api';
import './QAExcelExport.css';

interface QAExcelExportProps {
  data: HierarchyData[];
  filename?: string;
  className?: string;
  isMultiDocument?: boolean; // Indicates if this is multi-document data
}

interface DownloadState {
  isDownloading: boolean;
  downloadSuccess: boolean;
  downloadError: string | null;
}

type ExportFormat = 'excel' | 'csv' | 'json';

const QAExcelExport: React.FC<QAExcelExportProps> = ({
  data,
  filename = 'qa_dataset',
  className = '',
  isMultiDocument = false
}) => {
  const [downloadState, setDownloadState] = useState<DownloadState>({
    isDownloading: false,
    downloadSuccess: false,
    downloadError: null,
  });
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('excel');

  const { showSuccess, showError } = useToast();

  // Filter data to get only items with questions
  const qaData = data.filter(item => item.question && item.question_generated);
  const totalQuestions = qaData.length;

  // Check if data has multiple documents
  const hasMultipleDocuments = isMultiDocument || qaData.some(item => item.source_document);
  const uniqueDocuments = hasMultipleDocuments
    ? [...new Set(qaData.map(item => item.source_document).filter(Boolean))]
    : [];
  const documentCount = uniqueDocuments.length;

  const downloadBase64File = (base64Data: string, filename: string, mimeType: string) => {
    try {
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      throw new Error('Failed to download file');
    }
  };

  const downloadTextFile = (content: string, filename: string, mimeType: string) => {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      throw new Error('Failed to download file');
    }
  };

  const handleDownload = async () => {
    if (totalQuestions === 0) {
      showError('No Questions Available', 'No question-answer pairs found. Please generate questions first.');
      return;
    }

    setDownloadState({
      isDownloading: true,
      downloadSuccess: false,
      downloadError: null,
    });

    try {
      let response: any;
      let downloadFilename: string;
      let formatLabel: string;

      if (selectedFormat === 'excel') {
        response = await ApiService.downloadQAExcel({
          data: qaData,
          filename: filename,
        });

        if (response.success && response.file_data) {
          downloadBase64File(
            response.file_data,
            response.filename,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          );
          downloadFilename = response.filename;
          formatLabel = 'Excel';
        } else {
          throw new Error(response.error || 'Failed to generate Excel file');
        }
      } else if (selectedFormat === 'csv') {
        response = await ApiService.downloadQACSV({
          data: qaData,
          filename: filename,
        });

        if (response.success && response.file_data) {
          downloadBase64File(
            response.file_data,
            response.filename,
            'text/csv'
          );
          downloadFilename = response.filename;
          formatLabel = 'CSV';
        } else {
          throw new Error(response.error || 'Failed to generate CSV file');
        }
      } else if (selectedFormat === 'json') {
        response = await ApiService.downloadQAJSON({
          data: qaData,
          filename: filename,
        });

        if (response.success && response.file_data) {
          downloadTextFile(
            response.file_data,
            response.filename,
            'application/json'
          );
          downloadFilename = response.filename;
          formatLabel = 'JSON';
        } else {
          throw new Error(response.error || 'Failed to generate JSON file');
        }
      }

      setDownloadState({
        isDownloading: false,
        downloadSuccess: true,
        downloadError: null,
      });

      const successMessage = response.is_multi_document
        ? `Successfully downloaded ${response.total_qa_pairs} question-answer pairs from ${response.document_count} documents as ${downloadFilename}`
        : `Successfully downloaded ${response.total_qa_pairs} question-answer pairs as ${downloadFilename}`;

      showSuccess(`Q&A Dataset Downloaded (${formatLabel})`, successMessage);
    } catch (error: any) {
      setDownloadState({
        isDownloading: false,
        downloadSuccess: false,
        downloadError: error.message,
      });
      showError('Download Failed', error.message);
    }
  };

  return (
    <div className={`qa-excel-export ${className}`}>
      <div className="export-section">
        <div className="export-header">
          <div className="header-icon">
            <Brain size={32} className="text-blue-600" />
            {selectedFormat === 'excel' && <FileSpreadsheet size={24} className="text-green-600 ml-2" />}
            {selectedFormat === 'csv' && <FileText size={24} className="text-green-600 ml-2" />}
            {selectedFormat === 'json' && <FileJson size={24} className="text-green-600 ml-2" />}
          </div>
          <div className="header-content">
            <h3>Question-Answer Dataset Export</h3>
            <p>Download your generated questions and answers in your preferred format for ML training</p>
          </div>
        </div>

        <div className="export-info">
          <div className="info-grid">
            <div className="info-item">
              <span className="label">
                <HelpCircle size={16} className="inline mr-1" />
                Available Q&A Pairs:
              </span>
              <span className={`value ${totalQuestions > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                {totalQuestions}
              </span>
            </div>
            {hasMultipleDocuments && (
              <div className="info-item">
                <span className="label">Documents:</span>
                <span className="value">{documentCount} documents</span>
              </div>
            )}
            <div className="info-item">
              <span className="label">Filename:</span>
              <span className="value">
                {filename}_qa_dataset.{selectedFormat === 'excel' ? 'xlsx' : selectedFormat === 'csv' ? 'csv' : 'json'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Format:</span>
              <span className="value">
                {selectedFormat === 'excel' ? 'Excel (.xlsx)' : selectedFormat === 'csv' ? 'CSV (.csv)' : 'JSON (.json)'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Columns:</span>
              <span className="value">
                {hasMultipleDocuments
                  ? 'Document Name, Question, Answer, Context'
                  : 'Question, Answer, Content'
                }
              </span>
            </div>
          </div>

          {totalQuestions === 0 && (
            <div className="warning-message">
              <AlertCircle size={20} className="text-orange-500" />
              <div>
                <p className="font-medium">No questions available for export</p>
                <p className="text-sm text-gray-600">
                  Generate questions first using the question generation feature to create a dataset.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Format Selection */}
        <div className="format-selection">
          <label className="format-label">Select Export Format:</label>
          <div className="format-buttons">
            <button
              onClick={() => setSelectedFormat('excel')}
              className={`format-button ${selectedFormat === 'excel' ? 'active' : ''}`}
              disabled={downloadState.isDownloading}
            >
              <FileSpreadsheet size={18} />
              Excel
            </button>
            <button
              onClick={() => setSelectedFormat('csv')}
              className={`format-button ${selectedFormat === 'csv' ? 'active' : ''}`}
              disabled={downloadState.isDownloading}
            >
              <FileText size={18} />
              CSV
            </button>
            <button
              onClick={() => setSelectedFormat('json')}
              className={`format-button ${selectedFormat === 'json' ? 'active' : ''}`}
              disabled={downloadState.isDownloading}
            >
              <FileJson size={18} />
              JSON
            </button>
          </div>
        </div>

        <div className="export-actions">
          <button
            onClick={handleDownload}
            disabled={downloadState.isDownloading || totalQuestions === 0}
            className={`download-button ${downloadState.isDownloading ? 'loading' : ''} ${
              totalQuestions === 0 ? 'disabled' : ''
            }`}
          >
            <Download size={20} />
            {downloadState.isDownloading
              ? `Generating ${selectedFormat.toUpperCase()}...`
              : `Download Q&A Dataset (${selectedFormat.toUpperCase()})`}
          </button>
        </div>

        {downloadState.downloadSuccess && (
          <div className="status-message success">
            <CheckCircle size={20} />
            <span>Q&A dataset downloaded successfully!</span>
          </div>
        )}

        {downloadState.downloadError && (
          <div className="status-message error">
            <AlertCircle size={20} />
            <span>{downloadState.downloadError}</span>
          </div>
        )}
      </div>


    </div>
  );
};

export default QAExcelExport;
