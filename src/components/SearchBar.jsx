import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';

export default function SearchBar({ onLocationFound }) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        onLocationFound([parseFloat(lat), parseFloat(lon)]);
        setQuery('');
      } else {
        alert("Location not found.");
      }
    } catch (err) {
      console.error("Search error", err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <form onSubmit={handleSearch} className="flex gap-2">
      <input 
        type="text" 
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search location..."
        className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button 
        type="submit" 
        disabled={isSearching}
        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
      </button>
    </form>
  );
}
