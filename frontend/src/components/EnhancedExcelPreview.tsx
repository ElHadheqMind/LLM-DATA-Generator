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
  Trash2
} from 'lucide-react';
import { HierarchyData } from '../types/api';
import { useToast } from './ToastContainer';

interface EnhancedExcelPreviewProps {
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
  selectedCells: Set<string>;
  columnWidths: Record<string, number>;
  rowHeight: number;
  isFullscreen: boolean;
  showCleanedData: boolean;
}

const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 25;
const DEFAULT_ROW_HEIGHT = 40;
const MIN_ROW_HEIGHT = 30;
const MAX_ROW_HEIGHT = 100;

const EnhancedExcelPreview: React.FC<EnhancedExcelPreviewProps> = ({
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
  const { showSuccess, showInfo } = useToast();

  // Define column configuration
  const defaultColumns: ColumnConfig[] = useMemo(() => {
    const baseColumns = [
      { key: 'document_name', label: 'Document Name', width: 150, minWidth: 100, maxWidth: 300, resizable: true },
      { key: 'section', label: 'Section', width: 150, minWidth: 100, maxWidth: 300, resizable: true },
      { key: 'subsection', label: 'Subsection', width: 150, minWidth: 100, maxWidth: 300, resizable: true },
      { key: 'subsubsection', label: 'Sub-subsection', width: 150, minWidth: 100, maxWidth: 300, resizable: true },
      { key: 'subsubsubsection', label: 'Sub-sub-subsection', width: 150, minWidth: 100, maxWidth: 300, resizable: true },
      { key: 'content', label: 'Content', width: 400, minWidth: 200, maxWidth: 800, resizable: true }
    ];

    // Add actions column if onDataChange is available (allows deletion)
    if (onDataChange) {
      baseColumns.push({ key: 'actions', label: 'Actions', width: 60, minWidth: 60, maxWidth: 60, resizable: false });
    }

    if (showSourceColumn) {
      return [
        { key: 'source_document', label: 'Source Document', width: 200, minWidth: 150, maxWidth: 400, resizable: true },
        ...baseColumns
      ];
    }

    return baseColumns;
  }, [showSourceColumn, onDataChange]);

  // Initialize table state
  const [tableState, setTableState] = useState<TableState>(() => {
    const initialColumnWidths: Record<string, number> = {};
    defaultColumns.forEach(col => {
      initialColumnWidths[col.key] = col.width;
    });

    return {
      zoom: DEFAULT_ZOOM,
      selectedCells: new Set(),
      columnWidths: initialColumnWidths,
      rowHeight: DEFAULT_ROW_HEIGHT,
      isFullscreen: false,
      showCleanedData: false
    };
  });

  // Function to check if a row has meaningful section information
  const hasValidSectionInfo = useCallback((item: HierarchyData) => {
    const sectionFields = [item.section, item.subsection, item.subsubsection, item.subsubsubsection];
    return sectionFields.some(field => field && field.trim().length > 0);
  }, []);

  // Filter data based on clean mode
  const displayData = useMemo(() => {
    if (!tableState.showCleanedData) {
      return data;
    }
    return data.filter(hasValidSectionInfo);
  }, [data, tableState.showCleanedData, hasValidSectionInfo]);

  // Clean data function
  const handleCleanData = useCallback(() => {
    const cleanedData = data.filter(hasValidSectionInfo);
    const removedCount = data.length - cleanedData.length;

    if (removedCount === 0) {
      showInfo('Clean Data', 'No rows without section information found.');
      return;
    }

    if (onDataChange) {
      onDataChange(cleanedData);
      showSuccess('Data Cleaned', `Removed ${removedCount} rows without section information. ${cleanedData.length} rows remaining.`);
    } else {
      // If no onDataChange callback, just toggle the view
      setTableState(prev => ({ ...prev, showCleanedData: !prev.showCleanedData }));
      const action = tableState.showCleanedData ? 'Showing all data' : `Hiding ${removedCount} rows without sections`;
      showInfo('View Updated', action);
    }
  }, [data, hasValidSectionInfo, onDataChange, showSuccess, showInfo, tableState.showCleanedData]);

  // Toggle clean view function
  const handleToggleCleanView = useCallback(() => {
    const newShowCleaned = !tableState.showCleanedData;
    setTableState(prev => ({ ...prev, showCleanedData: newShowCleaned }));

    const cleanedData = data.filter(hasValidSectionInfo);
    const hiddenCount = data.length - cleanedData.length;

    if (newShowCleaned && hiddenCount > 0) {
      showInfo('Clean View', `Hiding ${hiddenCount} rows without section information.`);
    } else if (!newShowCleaned) {
      showInfo('Full View', 'Showing all data including rows without sections.');
    }
  }, [data, hasValidSectionInfo, showInfo, tableState.showCleanedData]);

  // Delete individual row function
  const handleDeleteRow = useCallback((index: number) => {
    if (!onDataChange) return;

    const newData = data.filter((_, i) => i !== index);
    onDataChange(newData);
    showSuccess('Row Deleted', 'The selected row has been removed.');
  }, [data, onDataChange, showSuccess]);

  // Zoom functions
  const handleZoomIn = useCallback(() => {
    setTableState(prev => ({
      ...prev,
      zoom: Math.min(prev.zoom + ZOOM_STEP, MAX_ZOOM)
    }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setTableState(prev => ({
      ...prev,
      zoom: Math.max(prev.zoom - ZOOM_STEP, MIN_ZOOM)
    }));
  }, []);

  const handleZoomReset = useCallback(() => {
    setTableState(prev => ({
      ...prev,
      zoom: DEFAULT_ZOOM
    }));
  }, []);

  // Row height adjustment functions
  const handleRowHeightIncrease = useCallback(() => {
    setTableState(prev => ({
      ...prev,
      rowHeight: Math.min(prev.rowHeight + 5, MAX_ROW_HEIGHT)
    }));
  }, []);

  const handleRowHeightDecrease = useCallback(() => {
    setTableState(prev => ({
      ...prev,
      rowHeight: Math.max(prev.rowHeight - 5, MIN_ROW_HEIGHT)
    }));
  }, []);

  const handleRowHeightReset = useCallback(() => {
    setTableState(prev => ({
      ...prev,
      rowHeight: DEFAULT_ROW_HEIGHT
    }));
  }, []);

  // Column resizing functions
  const handleMouseDown = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    setIsResizing(columnKey);
    setResizeStartX(e.clientX);
    setResizeStartWidth(tableState.columnWidths[columnKey]);
  }, [tableState.columnWidths]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = e.clientX - resizeStartX;
    const column = defaultColumns.find(col => col.key === isResizing);
    if (!column) return;

    const newWidth = Math.max(
      column.minWidth,
      Math.min(column.maxWidth, resizeStartWidth + deltaX)
    );

    setTableState(prev => ({
      ...prev,
      columnWidths: {
        ...prev.columnWidths,
        [isResizing]: newWidth
      }
    }));
  }, [isResizing, resizeStartX, resizeStartWidth, defaultColumns]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(null);
  }, []);

  // Auto-fit column width on double-click
  const handleDoubleClick = useCallback((columnKey: string) => {
    const column = defaultColumns.find(col => col.key === columnKey);
    if (!column) return;

    // Calculate optimal width based on content
    let maxContentWidth = column.label.length * 8 + 40; // Header width
    
    data.forEach(item => {
      const cellContent = String((item as any)[columnKey] || '');
      const contentWidth = cellContent.length * 7 + 20; // Approximate character width
      maxContentWidth = Math.max(maxContentWidth, contentWidth);
    });

    const optimalWidth = Math.max(
      column.minWidth,
      Math.min(column.maxWidth, maxContentWidth)
    );

    setTableState(prev => ({
      ...prev,
      columnWidths: {
        ...prev.columnWidths,
        [columnKey]: optimalWidth
      }
    }));
  }, [defaultColumns, data]);

  // Event listeners for mouse events
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Keyboard event listeners for full-screen mode
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // ESC key to exit full-screen
      if (event.key === 'Escape' && tableState.isFullscreen) {
        event.preventDefault();
        setTableState(prev => ({ ...prev, isFullscreen: false }));
      }
      // F11 key to toggle full-screen
      else if (event.key === 'F11') {
        event.preventDefault();
        setTableState(prev => ({ ...prev, isFullscreen: !prev.isFullscreen }));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [tableState.isFullscreen]);

  return (
    <div className={`enhanced-excel-preview ${className}`}>
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

        <div className="row-height-controls">
          <span className="control-label">Row Height:</span>
          <button
            onClick={handleRowHeightDecrease}
            disabled={tableState.rowHeight <= MIN_ROW_HEIGHT}
            className="row-height-button"
            title="Decrease Row Height"
          >
            <ChevronDown size={14} />
          </button>
          <span className="row-height-display">{tableState.rowHeight}px</span>
          <button
            onClick={handleRowHeightIncrease}
            disabled={tableState.rowHeight >= MAX_ROW_HEIGHT}
            className="row-height-button"
            title="Increase Row Height"
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={handleRowHeightReset}
            className="row-height-reset"
            title="Reset Row Height"
          >
            <Settings size={14} />
          </button>
        </div>

        <div className="clean-controls">
          <button
            onClick={handleToggleCleanView}
            className={`clean-toggle-button ${tableState.showCleanedData ? 'active' : ''}`}
            title={tableState.showCleanedData ? "Show all rows" : "Hide rows without sections"}
          >
            {tableState.showCleanedData ? <FilterX size={16} /> : <Filter size={16} />}
            <span className="button-text">
              {tableState.showCleanedData ? 'Show All' : 'Clean View'}
            </span>
          </button>

          {onDataChange && (
            <button
              onClick={handleCleanData}
              className="clean-data-button"
              title="Permanently remove rows without section information"
            >
              <X size={16} />
              <span className="button-text">Remove Empty</span>
            </button>
          )}
        </div>

        <div className="table-info">
          <span className="row-count">
            {tableState.showCleanedData
              ? `${displayData.length} of ${data.length} rows`
              : `${data.length} rows`
            }
          </span>
          <span className="column-count">{defaultColumns.length} columns</span>
          {tableState.showCleanedData && (
            <span className="clean-info">
              ({data.length - displayData.length} hidden)
            </span>
          )}
        </div>

        <div className="view-controls">
          <button
            onClick={() => setTableState(prev => ({ ...prev, isFullscreen: !prev.isFullscreen }))}
            className="fullscreen-button"
            title={tableState.isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {tableState.isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Enhanced Table Container */}
      <div
        ref={tableRef}
        className={`enhanced-table-container ${tableState.isFullscreen ? 'fullscreen' : ''}`}
        style={{
          maxHeight: tableState.isFullscreen ? '100vh' : maxHeight,
          transform: `scale(${tableState.zoom / 100})`,
          transformOrigin: 'top left'
        }}
      >
        <div className="table-wrapper">
          <table className="enhanced-data-table">
            <thead>
              <tr>
                {defaultColumns.map((column) => (
                  <th
                    key={column.key}
                    style={{
                      width: tableState.columnWidths[column.key],
                      minWidth: column.minWidth,
                      maxWidth: column.maxWidth
                    }}
                    className="resizable-header"
                  >
                    <div className="header-content">
                      <span className="header-text">{column.label}</span>
                      {column.resizable && (
                        <div
                          className="resize-handle"
                          onMouseDown={(e) => handleMouseDown(e, column.key)}
                          onDoubleClick={() => handleDoubleClick(column.key)}
                          title="Drag to resize, double-click to auto-fit"
                        >
                          <MoreHorizontal size={12} />
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayData.map((item, index) => {
                // Get the original index in the full data array for deletion
                const originalIndex = data.indexOf(item);

                return (
                  <tr
                    key={index}
                    style={{ height: tableState.rowHeight }}
                    className="data-row"
                  >
                    {defaultColumns.map((column) => (
                      <td
                        key={`${index}-${column.key}`}
                        style={{
                          width: tableState.columnWidths[column.key],
                          height: tableState.rowHeight
                        }}
                        className={`cell ${column.key}-cell ${
                          tableState.selectedCells.has(`${index}-${column.key}`) ? 'selected' : ''
                        }`}
                        onClick={(e) => {
                          // Don't trigger cell selection for actions column
                          if (column.key === 'actions') return;

                          const cellId = `${index}-${column.key}`;
                          setTableState(prev => {
                            const newSelected = new Set(prev.selectedCells);

                            // Handle multi-select with Ctrl/Cmd key
                            if (e.ctrlKey || e.metaKey) {
                              if (newSelected.has(cellId)) {
                                newSelected.delete(cellId);
                              } else {
                                newSelected.add(cellId);
                              }
                            } else {
                              // Single select - clear others and select this one
                              newSelected.clear();
                              newSelected.add(cellId);
                            }

                            return { ...prev, selectedCells: newSelected };
                          });
                        }}
                      >
                        <div className="cell-content">
                          {column.key === 'actions' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRow(originalIndex);
                              }}
                              className="delete-row-button"
                              title="Delete this row"
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : column.key === 'source_document' ? (
                            (item as any).source_document
                          ) : (
                            (item as any)[column.key] || ''
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Full-screen Exit Controls */}
        {tableState.isFullscreen && (
          <div className="fullscreen-exit-controls">
            <div className="fullscreen-instructions">
              <span>Press ESC or F11 to exit full-screen</span>
            </div>
            <button
              onClick={() => setTableState(prev => ({ ...prev, isFullscreen: false }))}
              className="fullscreen-exit-button"
              title="Exit Full-screen (ESC)"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Table Footer with Statistics */}
        <div className="table-footer">
          <div className="footer-stats">
            <span>Zoom: {tableState.zoom}%</span>
            <span>•</span>
            <span>
              Rows: {tableState.showCleanedData
                ? `${displayData.length} of ${data.length}`
                : data.length
              }
            </span>
            <span>•</span>
            <span>Selected: {tableState.selectedCells.size} cells</span>
            {tableState.showCleanedData && (
              <>
                <span>•</span>
                <span className="clean-status">Clean view active</span>
              </>
            )}
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

export default EnhancedExcelPreview;
