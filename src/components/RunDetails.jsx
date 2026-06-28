import React from 'react';

export default function RunDetails({
  runName, setRunName, runDescription, setRunDescription,
  startTime, setStartTime, pace, setPace,
  inconsistency, setInconsistency,
  includeHr, setIncludeHr, hrInconsistency, setHrInconsistency, hrTarget, setHrTarget,
  includeCadence, setIncludeCadence, cadenceInconsistency, setCadenceInconsistency, cadenceTarget, setCadenceTarget,
}) {
  const sv = (() => { const [m, s] = pace.split(':').map(Number); return m*60 + s; })();
  const onPace = (v) => { const t = Number(v); setPace(`${Math.floor(t/60)}:${(t%60).toString().padStart(2,'0')}`); };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Name</label>
        <input type="text" value={runName} onChange={e => setRunName(e.target.value)}
          className="w-full h-9 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 transition-all" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Date</label>
          <input type="date" value={startTime.split('T')[0]} onChange={e => setStartTime(e.target.value + 'T' + startTime.split('T')[1])}
            className="w-full h-9 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 transition-all [color-scheme:dark]" />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Time</label>
          <input type="time" value={startTime.split('T')[1]} onChange={e => setStartTime(startTime.split('T')[0] + 'T' + e.target.value)}
            className="w-full h-9 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 transition-all [color-scheme:dark]" />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Description</label>
        <input type="text" value={runDescription} onChange={e => setRunDescription(e.target.value)}
          className="w-full h-9 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 transition-all" />
      </div>

      <div className="border-t border-border/40 my-2" />

      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-muted-foreground">Pace</span>
          <span className="text-sm font-bold text-primary tabular-nums">{pace} /km</span>
        </div>
        <input type="range" min={240} max={480} step={5} value={sv} onChange={e => onPace(e.target.value)} className="w-full" />
        <div className="flex justify-between text-[10px] text-muted-foreground/40"><span>4:00</span><span>5:30</span><span>8:00</span></div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-muted-foreground">Pace Variation</span>
          <span className="text-sm font-bold text-muted-foreground tabular-nums">{inconsistency}%</span>
        </div>
        <input type="range" min={0} max={100} value={inconsistency} onChange={e => setInconsistency(Number(e.target.value))} className="w-full" />
      </div>

      <div className="border-t border-border/40 my-2" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5 text-destructive" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span className="text-xs font-medium text-muted-foreground">Heart Rate</span>
        </div>
        <label className="toggle-switch"><input type="checkbox" checked={includeHr} onChange={e => setIncludeHr(e.target.checked)} /><span className="toggle-slider" /></label>
      </div>
      {includeHr && (
        <div className="space-y-2 pl-3 border-l-2 border-destructive/15">
          <Slider label="Target HR" val={`${hrTarget} bpm`} min={100} max={200} step={5} value={hrTarget} onChange={setHrTarget} />
          <Slider label="HR Variation" val={`${hrInconsistency}%`} min={0} max={50} step={1} value={hrInconsistency} onChange={setHrInconsistency} />
        </div>
      )}

      <div className="border-t border-border/40 my-2" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          <span className="text-xs font-medium text-muted-foreground">Cadence</span>
        </div>
        <label className="toggle-switch"><input type="checkbox" checked={includeCadence} onChange={e => setIncludeCadence(e.target.checked)} /><span className="toggle-slider" /></label>
      </div>
      {includeCadence && (
        <div className="space-y-2 pl-3 border-l-2 border-primary/15">
          <Slider label="Target Cadence" val={`${cadenceTarget} spm`} min={150} max={200} step={5} value={cadenceTarget} onChange={setCadenceTarget} />
          <Slider label="Cadence Variation" val={`${cadenceInconsistency}%`} min={0} max={30} step={1} value={cadenceInconsistency} onChange={setCadenceInconsistency} />
        </div>
      )}
    </div>
  );
}

function Slider({ label, val, min, max, step, value, onChange }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-muted-foreground/60">{label}</span>
        <span className="text-xs font-bold text-muted-foreground tabular-nums">{val}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full" />
    </div>
  );
}
