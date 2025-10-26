import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from './ToastContainer';
import { validatePdfFile, formatFileSize, SUPPORTED_FORMATS } from '../utils/fileUtils';
import { UploadProgress } from '../types/api';

interface PdfUploadProps {
  onFileSelect: (file: File) => void;
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
  uploadProgress: UploadProgress | null;
  error: string | null;
  disabled?: boolean;
}

const PdfUpload: React.FC<PdfUploadProps> = ({
  onFileSelect,
  onUpload,
  isUploading,
  uploadProgress,
  error,
  disabled = false,
}) => {
  const { showSuccess, showError, showWarning } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setValidationError(null);

    if (rejectedFiles.length > 0) {
      const errorMsg = 'Please select a valid document file.';
      setValidationError(errorMsg);
      showWarning('Invalid File Type', errorMsg);
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const validation = validatePdfFile(file);

      if (!validation.isValid) {
        setValidationError(validation.error || 'Invalid file');
        showError('File Validation Failed', validation.error || 'Invalid file');
        return;
      }

      setSelectedFile(file);
      onFileSelect(file);
      showSuccess('File Selected', `${file.name} (${formatFileSize(file.size)}) is ready for processing`);
    }
  }, [onFileSelect, showSuccess, showError, showWarning]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: SUPPORTED_FORMATS,
    multiple: false,
    disabled: disabled || isUploading,
  });

  const handleUpload = async () => {
    if (selectedFile) {
      try {
        await onUpload(selectedFile);
      } catch (err) {
        // Error handling is done in parent component
        console.error('Upload failed:', err);
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setValidationError(null);
    showSuccess('File Removed', 'You can now select a different PDF file');
  };

  const currentError = error || validationError;

  return (
    <div className="pdf-upload">
      <div className="upload-section">
        <h2 className="section-title">Upload Document</h2>

        {!selectedFile ? (
          <div
            {...getRootProps()}
            className={`dropzone ${isDragActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
          >
            <input {...getInputProps()} />
            <div className="dropzone-content">
              <Upload className="upload-icon" size={48} />
              <div className="dropzone-text">
                {isDragActive ? (
                  <p>Drop the document file here...</p>
                ) : (
                  <>
                    <p className="primary-text">Drag & drop a document file here</p>
                    <p className="secondary-text">or click to select a file</p>
                  </>
                )}
              </div>
              <div className="file-requirements">
                <p>• Supported: PDF only</p>
                <p>• Maximum size: 10MB</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="file-selected">
            <div className="file-info">
              <FileText className="file-icon" size={24} />
              <div className="file-details">
                <p className="file-name">{selectedFile.name}</p>
                <p className="file-size">{formatFileSize(selectedFile.size)}</p>
              </div>
              {!isUploading && (
                <button
                  onClick={handleRemoveFile}
                  className="remove-button"
                  type="button"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {!isUploading && !uploadProgress && (
              <button
                onClick={handleUpload}
                className="upload-button"
                disabled={disabled}
              >
                Process Document
              </button>
            )}

            {isUploading && uploadProgress && (
              <div className="upload-progress">
                <div className="progress-info">
                  <span>Uploading... {uploadProgress.percentage}%</span>
                  <span>{formatFileSize(uploadProgress.loaded)} / {formatFileSize(uploadProgress.total)}</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${uploadProgress.percentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {currentError && (
          <div className="error-message">
            <AlertCircle size={20} />
            <span>{currentError}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfUpload;
