import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Move,
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  Settings,
  X,
  Filter,
  FilterX,
  HelpCircle,
  Brain,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { HierarchyData, QAExcelData } from '../types/api';
import { useToast } from './ToastContainer';
import { transformToQAExcelData, getQAStatistics, validateQAData } from '../utils/qaDataProcessor';

interface QAExcelPreviewProps {
  data: HierarchyData[];
  showSourceColumn?: boolean;
  className?: string;
  maxHeight?: string;
  onDataChange?: (data: HierarchyData[]) => void;
}

interface ColumnConfig {
  key: string;
  label: string;
  width: number;
  minWidth: number;
  maxWidth: number;
  resizable: boolean;
}

interface TableState {
  zoom: number;
  isFullscreen: boolean;
  selectedCells: Set<string>;
  showCleanedData: boolean;
  showOnlyWithSections: boolean;
}

const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 25;

const QAExcelPreview: React.FC<QAExcelPreviewProps> = ({
  data,
  showSourceColumn = false,
  className = '',
  maxHeight = '600px',
  onDataChange
}) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const { showSuccess, showInfo, showError } = useToast();

  const [tableState, setTableState] = useState<TableState>({
    zoom: 100,
    isFullscreen: false,
    selectedCells: new Set(),
    showCleanedData: false,
    showOnlyWithSections: false,
  });

  // Transform data to QA format
  const qaData = useMemo(() => transformToQAExcelData(data), [data]);
  
  // Get QA statistics
  const qaStats = useMemo(() => getQAStatistics(data), [data]);
  
  // Validate QA data
  const validation = useMemo(() => validateQAData(data), [data]);

  // Check if data has multiple documents
  const hasMultipleDocuments = useMemo(() =>
    qaData.some(item => item.documentName),
    [qaData]
  );

  // Column configuration for QA data (dynamic based on multi-document)
  const defaultColumns: ColumnConfig[] = useMemo(() => {
    const columns: ColumnConfig[] = [];

    // Add document name column for multi-document data
    if (hasMultipleDocuments) {
      columns.push({
        key: 'documentName',
        label: 'Document Name',
        width: 200,
        minWidth: 150,
        maxWidth: 300,
        resizable: true,
      });
    }

    // Add standard columns
    columns.push(
      {
        key: 'question',
        label: 'Question',
        width: 300,
        minWidth: 200,
        maxWidth: 400,
        resizable: true,
      },
      {
        key: 'answer',
        label: 'Answer',
        width: 300,
        minWidth: 200,
        maxWidth: 400,
        resizable: true,
      },
      {
        key: 'fullContent',
        label: hasMultipleDocuments ? 'Context' : 'Content',
        width: 400,
        minWidth: 300,
        maxWidth: 600,
        resizable: true,
      }
    );

    // Add actions column if onDataChange is available (allows deletion)
    if (onDataChange) {
      columns.push({
        key: 'actions',
        label: 'Actions',
        width: 60,
        minWidth: 60,
        maxWidth: 60,
        resizable: false,
      });
    }

    return columns;
  }, [hasMultipleDocuments, onDataChange]);

  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);

  // Display data (filtered or full)
  const displayData = useMemo(() => {
    if (tableState.showOnlyWithSections) {
      return qaData.filter(item => item.hasSection || item.hasSubsection);
    }
    return qaData;
  }, [qaData, tableState.showOnlyWithSections]);

  // Clear function to filter out items without sections
  const handleClearData = useCallback(() => {
    setTableState(prev => ({
      ...prev,
      showOnlyWithSections: !prev.showOnlyWithSections
    }));

    if (!tableState.showOnlyWithSections) {
      showInfo('Showing only Q&A pairs with section information');
    } else {
      showInfo('Showing all Q&A pairs');
    }
  }, [tableState.showOnlyWithSections, showInfo]);

  // Delete individual row function
  const handleDeleteRow = useCallback((index: number) => {
    if (!onDataChange) return;

    const newData = data.filter((_, i) => i !== index);
    onDataChange(newData);
    showSuccess('Row Deleted', 'The selected Q&A pair has been removed.');
  }, [data, onDataChange, showSuccess]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setTableState(prev => ({ ...prev, zoom: Math.min(prev.zoom + ZOOM_STEP, MAX_ZOOM) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setTableState(prev => ({ ...prev, zoom: Math.max(prev.zoom - ZOOM_STEP, MIN_ZOOM) }));
  }, []);

  const handleZoomReset = useCallback(() => {
    setTableState(prev => ({ ...prev, zoom: 100 }));
  }, []);

  // Cell selection
  const handleCellClick = useCallback((rowIndex: number, columnKey: string) => {
    const cellId = `${rowIndex}-${columnKey}`;
    setTableState(prev => {
      const newSelected = new Set(prev.selectedCells);
      if (newSelected.has(cellId)) {
        newSelected.delete(cellId);
      } else {
        newSelected.add(cellId);
      }
      return { ...prev, selectedCells: newSelected };
    });
  }, []);

  // Column resizing
  const handleMouseDown = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    setIsResizing(columnKey);
    setResizeStartX(e.clientX);
    const column = columns.find(col => col.key === columnKey);
    setResizeStartWidth(column?.width || 0);
  }, [columns]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = e.clientX - resizeStartX;
    const newWidth = Math.max(
      Math.min(resizeStartWidth + deltaX, 600),
      150
    );

    setColumns(prev => prev.map(col => 
      col.key === isResizing ? { ...col, width: newWidth } : col
    ));
  }, [isResizing, resizeStartX, resizeStartWidth]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(null);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Show validation errors if any
  useEffect(() => {
    if (!validation.isValid && validation.errors.length > 0) {
      showError('QA Data Validation', validation.errors.join(', '));
    }
  }, [validation, showError]);

  return (
    <div className={`enhanced-excel-preview qa-excel-preview ${className}`}>
      {/* Header with QA Statistics */}
      <div className="qa-header">
        <div className="qa-stats">
          <div className="stat-item">
            <Brain size={16} className="text-blue-600" />
            <span className="stat-label">Q&A Pairs:</span>
            <span className="stat-value">{displayData.length}</span>
          </div>
          <div className="stat-item">
            <HelpCircle size={16} className="text-green-600" />
            <span className="stat-label">Generation Rate:</span>
            <span className="stat-value">{qaStats.questionGenerationRate.toFixed(1)}%</span>
          </div>
          <div className="stat-item">
            <Filter size={16} className="text-purple-600" />
            <span className="stat-label">With Sections:</span>
            <span className="stat-value">{qaStats.questionsWithSections}</span>
          </div>
          {tableState.showOnlyWithSections && (
            <div className="stat-item">
              <RefreshCw size={16} className="text-orange-600" />
              <span className="stat-label">Filtered:</span>
              <span className="stat-value">{qaData.length - displayData.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Zoom and Control Bar */}
      <div className="excel-controls">
        <div className="zoom-controls">
          <button
            onClick={handleZoomOut}
            disabled={tableState.zoom <= MIN_ZOOM}
            className="zoom-button"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          
          <div className="zoom-display">
            {tableState.zoom}%
          </div>
          
          <button
            onClick={handleZoomIn}
            disabled={tableState.zoom >= MAX_ZOOM}
            className="zoom-button"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          
          <button
            onClick={handleZoomReset}
            className="zoom-reset-button"
            title="Reset Zoom"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        <div className="table-info">
          <span className="row-count">
            {displayData.length} Q&A pairs
            {tableState.showOnlyWithSections && qaData.length !== displayData.length &&
              ` (${qaData.length - displayData.length} filtered out)`
            }
          </span>
          <span className="column-count">2 columns</span>
        </div>

        <div className="view-controls">
          <button
            onClick={handleClearData}
            className={`clear-button ${tableState.showOnlyWithSections ? 'active' : ''}`}
            title={tableState.showOnlyWithSections ? "Show all Q&A pairs" : "Show only Q&A pairs with sections"}
          >
            {tableState.showOnlyWithSections ? <RefreshCw size={16} /> : <Filter size={16} />}
            <span>{tableState.showOnlyWithSections ? 'Show All' : 'Clean'}</span>
          </button>
          <button
            onClick={() => setTableState(prev => ({ ...prev, isFullscreen: !prev.isFullscreen }))}
            className="fullscreen-button"
            title={tableState.isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {tableState.isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div
        ref={tableRef}
        className={`table-container ${tableState.isFullscreen ? 'fullscreen' : ''}`}
        style={{
          height: tableState.isFullscreen ? '100vh' : maxHeight,
          maxHeight: tableState.isFullscreen ? '100vh' : maxHeight,
          fontSize: `${tableState.zoom}%`,
          overflowY: 'auto'
        }}
      >
        <div className="table-wrapper" style={{ height: '100%', overflowY: 'auto' }}>
          <table className="excel-table qa-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th 
                    key={column.key}
                    style={{ width: `${column.width}px` }}
                    className="resizable-header"
                  >
                    <div className="header-content">
                      <span className="header-text">{column.label}</span>
                      {column.resizable && (
                        <div 
                          className="resize-handle"
                          onMouseDown={(e) => handleMouseDown(e, column.key)}
                        />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayData.map((item, rowIndex) => {
                // Get the original index in the full data array for deletion
                const originalIndex = data.findIndex(d =>
                  d.content === item.fullContent &&
                  d.question === item.question
                );

                return (
                  <tr key={rowIndex} className="data-row">
                    {columns.map((column) => {
                      const cellId = `${rowIndex}-${column.key}`;
                      const isSelected = tableState.selectedCells.has(cellId);
                      const cellValue = (item as any)[column.key];

                      // Determine cell class based on column type
                      let cellClass = `excel-cell ${column.key}-cell`;
                      if (isSelected) cellClass += ' selected';

                      return (
                        <td
                          key={cellId}
                          className={cellClass}
                          style={{ width: `${column.width}px` }}
                          onClick={() => column.key !== 'actions' && handleCellClick(rowIndex, column.key)}
                        >
                          <div className="cell-content">
                            {/* Actions column with delete button */}
                            {column.key === 'actions' ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRow(originalIndex);
                                }}
                                className="delete-row-button"
                                title="Delete this Q&A pair"
                              >
                                <Trash2 size={14} />
                              </button>
                            ) : column.key === 'answer' ? (
                              <pre className="answer-text">{cellValue}</pre>
                            ) : column.key === 'fullContent' ? (
                              <pre className="content-text">{cellValue}</pre>
                            ) : (
                              cellValue
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Statistics */}
        <div className="table-footer">
          <div className="footer-stats">
            <span>Zoom: {tableState.zoom}%</span>
            <span>•</span>
            <span>Q&A Pairs: {displayData.length}</span>
            <span>•</span>
            <span>Selected: {tableState.selectedCells.size} cells</span>
          </div>
          <div className="footer-actions">
            <button
              onClick={() => setTableState(prev => ({ ...prev, selectedCells: new Set() }))}
              className="clear-selection-button"
              disabled={tableState.selectedCells.size === 0}
            >
              Clear Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QAExcelPreview;
