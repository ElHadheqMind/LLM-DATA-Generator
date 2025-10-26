import React from 'react';
import { Download, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';

interface ExcelDownloadProps {
  onDownload: () => void;
  isDownloading: boolean;
  downloadSuccess: boolean;
  downloadError: string | null;
  filename: string;
  totalRows: number;
}

const ExcelDownload: React.FC<ExcelDownloadProps> = ({
  onDownload,
  isDownloading,
  downloadSuccess,
  downloadError,
  filename,
  totalRows,
}) => {
  return (
    <div className="excel-download">
      <div className="download-section">
        <div className="download-header">
          <FileSpreadsheet size={32} />
          <div>
            <h3>Excel Export</h3>
            <p>Download your processed data as an Excel file</p>
          </div>
        </div>

        <div className="download-info">
          <div className="info-item">
            <span className="label">Filename:</span>
            <span className="value">{filename}_hierarchy.xlsx</span>
          </div>
          <div className="info-item">
            <span className="label">Total Rows:</span>
            <span className="value">{totalRows}</span>
          </div>
          <div className="info-item">
            <span className="label">Columns:</span>
            <span className="value">Section, Subsection, Sub-subsection, Sub-sub-subsection, Content</span>
          </div>
        </div>

        <div className="download-actions">
          <button
            onClick={onDownload}
            disabled={isDownloading}
            className={`download-button ${isDownloading ? 'loading' : ''}`}
          >
            <Download size={20} />
            {isDownloading ? 'Generating Excel...' : 'Download Excel File'}
          </button>
        </div>

        {downloadSuccess && (
          <div className="download-status success">
            <CheckCircle size={20} />
            <span>Excel file downloaded successfully!</span>
          </div>
        )}

        {downloadError && (
          <div className="download-status error">
            <AlertCircle size={20} />
            <span>{downloadError}</span>
          </div>
        )}

        <div className="download-help">
          <h4>What's included in the Excel file:</h4>
          <ul>
            <li>All extracted hierarchical data organized in columns</li>
            <li>Proper formatting with auto-adjusted column widths</li>
            <li>Headers for easy identification of data structure</li>
            <li>Compatible with Microsoft Excel, Google Sheets, and other spreadsheet applications</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ExcelDownload;
