import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Download, FileSpreadsheet, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { useToast } from './ToastContainer';
import { HierarchyData } from '../types/api';
import EnhancedExcelPreview from './EnhancedExcelPreview';

interface DataVisualizationProps {
  data: HierarchyData[];
  filename: string;
  onDownload: () => void;
  isDownloading: boolean;
}

const DataVisualization: React.FC<DataVisualizationProps> = ({
  data: initialData,
  filename,
  onDownload,
  isDownloading,
}) => {
  const { showInfo, showSuccess } = useToast();
  const [data, setData] = useState(initialData);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'hierarchy'>('table');

  // Update data when initialData changes
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // Handle data changes from clean operations
  const handleDataChange = useCallback((newData: HierarchyData[]) => {
    setData(newData);
  }, []);

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    
    return data.filter(item =>
      Object.values(item).some(value =>
        value.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data, searchTerm]);

  // Group data by sections for hierarchy view
  const groupedData = useMemo(() => {
    const groups: { [key: string]: HierarchyData[] } = {};
    
    filteredData.forEach(item => {
      const key = item.section || 'No Section';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    });
    
    return groups;
  }, [filteredData]);

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

  const handleViewModeChange = (mode: 'table' | 'hierarchy') => {
    setViewMode(mode);
    showInfo('View Changed', `Switched to ${mode} view`);
  };

  const expandAllSections = () => {
    const allSections = new Set(Object.keys(groupedData));
    setExpandedSections(allSections);
    showSuccess('Sections Expanded', 'All sections are now expanded');
  };

  const collapseAllSections = () => {
    setExpandedSections(new Set());
    showSuccess('Sections Collapsed', 'All sections are now collapsed');
  };

  const renderTableView = () => (
    <EnhancedExcelPreview
      data={filteredData}
      showSourceColumn={false}
      className="data-visualization-table"
      onDataChange={handleDataChange}
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

  return (
    <div className="data-visualization">
      <div className="visualization-header">
        <div className="header-left">
          <FileSpreadsheet size={24} />
          <div>
            <h2>Extracted Data</h2>
            <p>{filteredData.length} of {data.length} entries</p>
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
          
          <div className="view-toggle">
            <button
              className={`toggle-button ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('table')}
            >
              Table
            </button>
            <button
              className={`toggle-button ${viewMode === 'hierarchy' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('hierarchy')}
            >
              Hierarchy
            </button>
          </div>

          {viewMode === 'hierarchy' && (
            <div className="hierarchy-controls">
              <button onClick={expandAllSections} className="control-button">
                Expand All
              </button>
              <button onClick={collapseAllSections} className="control-button">
                Collapse All
              </button>
            </div>
          )}
          
          <button
            onClick={onDownload}
            disabled={isDownloading}
            className="download-button"
          >
            <Download size={20} />
            {isDownloading ? 'Generating...' : 'Download Excel'}
          </button>
        </div>
      </div>

      <div className="visualization-content">
        {viewMode === 'table' ? renderTableView() : renderHierarchyView()}
      </div>
    </div>
  );
};

export default DataVisualization;
