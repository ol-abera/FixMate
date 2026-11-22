import { Search, X } from 'lucide-react';

export default function SearchBar({ value, onChange, placeholder = 'Search...', style = {} }) {
  return (
    <div className="search" style={style}>
      <Search size={18} className="search__icon" aria-hidden="true" />
      <input type="search" aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="search__clear"><X size={16} /></button>
      )}
    </div>
  );
}
