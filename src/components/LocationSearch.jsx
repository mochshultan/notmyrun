import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';

const cache = new Map();
const WAIT_MS = 120;

export default function LocationSearch({ onLocationSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const doSearch = useCallback(async (q) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) { setResults([]); setOpen(false); return; }

    const lower = trimmed.toLowerCase();
    const cached = cache.get(lower);
    if (cached) { setResults(cached); setOpen(true); return; }

    setLoading(true);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(trimmed)}`);
      const d = await r.json();
      if (d?.length) {
        cache.set(lower, d);
        if (d.length < 3 && d.length > 0) {
          // also cache with first 3 chars so partial = instant
          for (let i = 2; i < trimmed.length; i++) cache.set(trimmed.slice(0, i), d);
        }
        setResults(d);
        setOpen(true);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), WAIT_MS);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  const select = (item) => { onLocationSelect(parseFloat(item.lat), parseFloat(item.lon)); setQuery(item.display_name); setOpen(false); };

  return (
    <div ref={ref} className="relative max-w-sm">
      <div className="relative">
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} onFocus={() => results.length > 0 && setOpen(true)}
          className="w-full h-9 rounded-lg border border-border/60 bg-card/95 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 pl-9 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 shadow-sm transition-all"
          placeholder="Search location..." />
        {loading ? <Loader2 className="absolute left-3 top-2.5 h-4 w-4 animate-spin text-primary" /> : <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-border/60 bg-card shadow-lg z-[1001] max-h-60 overflow-y-auto animate-fade-in">
          {results.map((item) => (
            <div key={item.place_id} onClick={() => select(item)}
              className="flex items-start gap-2 p-2.5 border-b border-border/40 last:border-0 hover:bg-muted/50 cursor-pointer text-sm transition-colors">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span className="line-clamp-2 text-left text-foreground/80">{item.display_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
