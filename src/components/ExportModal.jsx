import React, { useState, useEffect } from 'react';
import { X, Download, ClipboardCopy } from 'lucide-react';
import { stitchMapCanvas } from '../utils/staticMap';
import { renderShareCard, renderStoryCard, renderRouteArt } from '../utils/canvasExport';

export default function ExportModal({ isOpen, onClose, snappedPoints, stats }) {
  const [tab, setTab] = useState('share');
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!isOpen || !snappedPoints?.length) return;
    let active = true;
    setLoading(true); setErr(null); setCopied(false);
    (async () => {
      try {
        const md = await stitchMapCanvas(snappedPoints);
        if (!active) return;
        const fn = tab === 'share' ? renderShareCard : tab === 'story' ? renderStoryCard : renderRouteArt;
        if (!active) return;
        setUrl(fn({ ...md, stats }).toDataURL('image/png'));
      } catch (e) { setErr(e.message || 'Failed'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [isOpen, tab, snappedPoints, stats]);

  if (!isOpen) return null;

  const dl = () => { if (!url) return; const a = document.createElement('a'); a.href = url; a.download = `${(stats.runName||'activity').replace(/[^a-z0-9]/gi,'_')}-${tab}.png`; a.click(); };
  const cp = async () => { try { const b = await fetch(url).then(r => r.blob()); await navigator.clipboard.write([new ClipboardItem({'image/png': b})]); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { alert('Could not copy.'); } };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-card border border-border/60 rounded-xl shadow-xl w-full max-w-4xl flex flex-col md:flex-row overflow-hidden max-h-[90vh] animate-scale-in">
        <div className="flex-1 bg-background p-5 flex items-center justify-center border-b md:border-b-0 md:border-r border-border/40 relative min-h-[280px]">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center flex-col gap-3 text-muted-foreground z-10 bg-background/80">
              <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary border-t-transparent" />
              <span className="text-sm">Generating...</span>
            </div>
          )}
          {err && <div className="absolute inset-0 flex items-center justify-center text-destructive z-10 bg-background/80 p-6 text-sm text-center">{err}</div>}
          {url && <img src={url} alt="" className="max-w-full max-h-[55vh] object-contain rounded-lg" />}
        </div>
        <div className="w-full md:w-72 p-5 flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-base font-bold text-foreground">Export</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-col gap-1.5 mb-6">
            {[
              { id: 'share', label: 'Share Card', desc: '1080×1080' },
              { id: 'story', label: 'Story Card', desc: '1080×1920' },
              { id: 'art', label: 'Route Art', desc: '1080×1080' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`text-left px-3.5 py-2.5 rounded-lg border transition-all ${tab === t.id ? 'bg-primary/5 border-primary/30 text-foreground' : 'bg-card border-border/60 text-muted-foreground hover:bg-muted/50'}`}>
                <div className="font-medium text-sm">{t.label}</div>
                <div className="text-[11px] mt-0.5 opacity-60">{t.desc}</div>
              </button>
            ))}
          </div>
          <div className="mt-auto flex flex-col gap-2">
            <button onClick={dl} disabled={loading || !url}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-30 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm">
              <Download className="w-4 h-4" /> Download PNG
            </button>
            <button onClick={cp} disabled={loading || !url}
              className="w-full bg-card hover:bg-muted/50 disabled:opacity-30 text-foreground font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 border border-border transition-colors">
              <ClipboardCopy className="w-4 h-4" /> {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
