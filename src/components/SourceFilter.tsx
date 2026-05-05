import React from 'react';
import './SourceFilter.css';

export interface FilterOption {
  id: string;
  label: string;
  count: number;
  type: 'domain' | 'media';
}

interface SourceFilterProps {
  options: FilterOption[];
  selectedFilter: string | null;
  onFilterChange: (filter: string | null) => void;
}

const SourceFilter: React.FC<SourceFilterProps> = ({
  options,
  selectedFilter,
  onFilterChange
}) => {
  // Separate domain and media filters
  const domainFilters = options.filter(opt => opt.type === 'domain');
  const mediaFilters = options.filter(opt => opt.type === 'media');
  const totalCount = options.reduce((sum, opt) => sum + opt.count, 0);

  return (
    <div className="source-filter">
      {/* Media Type Filter */}
      {mediaFilters.length > 0 && (
        <>
          <div className="filter-label">By Media Type:</div>
          <div className="filter-buttons">
            {mediaFilters.map((option) => (
              <button
                key={option.id}
                className={`filter-btn ${selectedFilter === option.id ? 'active' : ''}`}
                onClick={() => onFilterChange(option.id)}
                title={`Filter by ${option.label}`}
                disabled={option.count === 0}
              >
                <span className="filter-text">{option.label}</span>
                <span className="filter-count">{option.count}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Domain Filter */}
      {domainFilters.length > 0 && (
        <>
          <div className="filter-label">By Domain:</div>
          <div className="filter-buttons">
            <button
              className={`filter-btn filter-btn-all ${selectedFilter === null || !selectedFilter?.startsWith('domain-') ? 'active' : ''}`}
              onClick={() => onFilterChange(null)}
              title="Show all items"
            >
              <span className="filter-text">All</span>
              <span className="filter-count">{totalCount}</span>
            </button>
            
            {domainFilters.map((option) => (
              <button
                key={option.id}
                className={`filter-btn ${selectedFilter === option.id ? 'active' : ''}`}
                onClick={() => onFilterChange(option.id)}
                title={`Filter by ${option.label}`}
                disabled={option.count === 0}
              >
                <span className="filter-text">{option.label}</span>
                <span className="filter-count">{option.count}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default SourceFilter;
