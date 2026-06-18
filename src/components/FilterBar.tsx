import { Filter, Search } from 'lucide-react';
import type { CircuitFilter, Filters, StageFilter } from '../lib/types';

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  showSearch?: boolean;
}

const circuits: Array<{ value: CircuitFilter; label: string }> = [
  { value: 'merged', label: 'Merged' },
  { value: 'ONIA', label: 'ONIA' },
  { value: 'ROAI', label: 'ROAI' },
  { value: 'international', label: 'International' },
  { value: 'IOAI', label: 'IOAI' },
  { value: 'IAIO', label: 'IAIO' },
  { value: 'CEOAI', label: 'CEOAI' }
];

const stages: Array<{ value: StageFilter; label: string }> = [
  { value: 'all', label: 'All stages' },
  { value: 'national', label: 'National' },
  { value: 'lot', label: 'Lot' }
];

export function FilterBar({ filters, onChange, showSearch = true }: FilterBarProps) {
  return (
    <div className="filter-bar" aria-label="filters">
      <label className="field">
        <Filter size={16} aria-hidden="true" />
        <select
          value={filters.circuit}
          onChange={(event) => onChange({ ...filters, circuit: event.target.value as CircuitFilter })}
        >
          {circuits.map((circuit) => (
            <option key={circuit.value} value={circuit.value}>
              {circuit.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-mark">ST</span>
        <select value={filters.stage} onChange={(event) => onChange({ ...filters, stage: event.target.value as StageFilter })}>
          {stages.map((stage) => (
            <option key={stage.value} value={stage.value}>
              {stage.label}
            </option>
          ))}
        </select>
      </label>
      {showSearch ? (
        <label className="field field-search">
          <Search size={16} aria-hidden="true" />
          <input
            value={filters.query}
            onChange={(event) => onChange({ ...filters, query: event.target.value })}
            placeholder="Search"
            type="search"
          />
        </label>
      ) : null}
    </div>
  );
}
