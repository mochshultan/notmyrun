import React, { useState, useEffect, useMemo, useRef } from 'react';
import Map from './components/Map';
import RouteStats from './components/RouteStats';
import RunDetails from './components/RunDetails';
import PaceChart from './components/PaceChart';
import ElevationChart from './components/ElevationChart';
import HeartRateChart from './components/HeartRateChart';
import LocationSearch from './components/LocationSearch';
import ExportModal from './components/ExportModal';

import { calculateTotalDistance } from './utils/haversine';
import { fetchElevations, calculateElevationGain } from './utils/elevationApi';
import { generatePaceProfile } from './utils/paceEngine';
import { generateGPXString } from './utils/gpxExport';
import { snapToRoads } from './utils/osrmRouter';
import { Download, Share2, MapPin, Loader2, Footprints, Undo2, RotateCcw, TrendingUp, Heart, Zap, Route, Timer } from 'lucide-react';

function App() {
  const [waypoints, setWaypoints] = useState([]);
  const [snappedPoints, setSnappedPoints] = useState([]);
  const [elevations, setElevations] = useState([]);
  const [mapCenter, setMapCenter] = useState(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const [isFetchingElevation, setIsFetchingElevation] = useState(false);
  const [snapError, setSnapError] = useState(null);
  const [runName, setRunName] = useState('Morning Run');
  const [runDescription, setRunDescription] = useState('');
  const [startTime, setStartTime] = useState(() => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); });
  const [isBike, setIsBike] = useState(false);
  const [pace, setPace] = useState('5:30');
  const [inconsistency, setInconsistency] = useState(10);
  const [includeHr, setIncludeHr] = useState(true);
  const [hrInconsistency, setHrInconsistency] = useState(10);
  const [hrTarget, setHrTarget] = useState(145);
  const [includeCadence, setIncludeCadence] = useState(true);
  const [cadenceInconsistency, setCadenceInconsistency] = useState(10);
  const [cadenceTarget, setCadenceTarget] = useState(170);
  const [showWaypoints, setShowWaypoints] = useState(true);
  const [shapeMode, setShapeMode] = useState('draw');
  const snapTimeout = useRef(null);

  useEffect(() => {
    if (!waypoints.length) { setSnappedPoints([]); setElevations([]); setSnapError(null); setIsSnapping(false); return; }
    clearTimeout(snapTimeout.current); setIsSnapping(true); setSnapError(null);
    snapTimeout.current = setTimeout(async () => {
      try { const s = await snapToRoads(waypoints, isBike); if (s.length < 2) { setSnapError("Route too short — add more points."); setSnappedPoints([]); } else setSnappedPoints(s); }
      catch { setSnapError("Road snapping unavailable — using straight-line route."); } finally { setIsSnapping(false); }
    }, 600);
    return () => clearTimeout(snapTimeout.current);
  }, [waypoints, isBike]);

  useEffect(() => {
    let a = true; if (!snappedPoints.length) return; setIsFetchingElevation(true);
    fetchElevations(snappedPoints).then(e => { if (a) { setElevations(e); setIsFetchingElevation(false); } });
    return () => { a = false; };
  }, [snappedPoints]);

  const dist = useMemo(() => calculateTotalDistance(snappedPoints), [snappedPoints]);
  const elevGain = useMemo(() => calculateElevationGain(elevations), [elevations]);
  const profile = useMemo(() => {
    if (!snappedPoints.length || elevations.length !== snappedPoints.length) return [];
    const cumDists = [0]; let t = 0;
    for (let i = 1; i < snappedPoints.length; i++) { const x = calculateTotalDistance([snappedPoints[i-1], snappedPoints[i]]); t += x; cumDists.push(t); }
    return generatePaceProfile({ points: snappedPoints, distances: cumDists, elevations, basePaceStr: pace, inconsistency, isBike, startTime });
  }, [snappedPoints, elevations, pace, inconsistency, isBike, startTime]);
  const timeSec = profile.length ? profile.reduce((t, p, i) => i ? t + p.paceSec * (p.distance - profile[i-1].distance) : 0, 0) : 0;
  const avgP = dist > 0 ? timeSec / dist : 330;
  const avgHr = profile.length ? Math.round(profile.reduce((a, p) => a + (p.hr || 0), 0) / profile.length) : 0;
  const avgCad = profile.length ? Math.round(profile.reduce((a, p) => a + (p.cadence || 0), 0) / profile.length) : 0;
  const fmt = (s) => { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), s2 = Math.floor(s%60); return h ? `${h}:${String(m).padStart(2,'0')}:${String(s2).padStart(2,'0')}` : `${m}:${String(s2).padStart(2,'0')}`; };

  const addPt = (p) => setWaypoints(v => [...v, p]);
  const undo = () => setWaypoints(v => v.slice(0, -1));
  const clear = () => { if (window.confirm("Clear the entire route?")) setWaypoints([]); };

  const shape = (t) => {
    setShapeMode(t); if (t === 'draw') return;
    const clat = mapCenter ? mapCenter[0] : 40.7128, clng = mapCenter ? mapCenter[1] : -74.0060, pts = [];
    if (t === 'circle') { const r = 0.01; for (let i = 0; i <= 36; i++) { const th = (i / 36) * Math.PI * 2; pts.push({ lat: clat + r * Math.sin(th), lng: clng + r * Math.cos(th) }); } }
    else if (t === 'heart') { const sc = 0.0003; for (let a = 0; a <= Math.PI * 2; a += 0.1) { const x = 16 * Math.pow(Math.sin(a), 3), y = 13 * Math.cos(a) - 5 * Math.cos(2*a) - 2 * Math.cos(3*a) - Math.cos(4*a); pts.push({ lat: clat + y * sc, lng: clng + x * sc }); } }
    setWaypoints(pts);
  };

  const buildPts = () => profile.map((p, i) => ({ lat: snappedPoints[i].lat, lon: snappedPoints[i].lon || snappedPoints[i].lng, elevation: p.elevation, timeStr: p.timeStr, hr: p.hr, cadence: p.cadence }));

  const dlGPX = () => {
    if (snappedPoints.length < 2) return alert("Add at least 2 points.");
    if (elevations.length !== snappedPoints.length) return alert("Waiting for elevation data...");
    const g = generateGPXString({ trackPoints: buildPts(), runName, description: runDescription, startTime, isBike, includeHr, includeCadence });
    const blob = new Blob([g], { type: "application/gpx+xml" }), url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${runName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.gpx`; a.click(); URL.revokeObjectURL(url);
  };

  const strava = () => {
    if (snappedPoints.length < 2) return alert("Add at least 2 points.");
    if (elevations.length !== snappedPoints.length) return alert("Waiting for elevation data...");
    const g = generateGPXString({ trackPoints: buildPts(), runName, description: runDescription, startTime, isBike, includeHr, includeCadence });
    const blob = new Blob([g], { type: "application/gpx+xml" }), url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${runName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.gpx`; a.click(); URL.revokeObjectURL(url);
    window.open('https://www.strava.com/upload/select', '_blank');
  };

  const statsProps = { runName, startTime, totalDistanceKm: dist, totalElevationGain: elevGain, totalTimeSec: Math.round(timeSec), avgPaceSec: avgP, avgHr, avgCadence: avgCad, includeHr, includeCadence, paceSec: avgP, hr: avgHr, cadence: avgCad, distance: dist, elevation: elevGain };
  const hasR = waypoints.length > 0, hasV = snappedPoints.length >= 2;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between">
            <a href="/" className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 flex items-center justify-center relative">
                <Footprints className="h-[18px] w-[18px] text-white" />
                <svg className="absolute inset-0 w-full h-full text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="11" />
                  <line x1="4" y1="20" x2="20" y2="4" />
                </svg>
              </div>
              <div className="leading-tight"><div className="font-bold text-base tracking-tight">NotMyRun</div></div>
            </a>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsExportModalOpen(true)} disabled={!hasV} className="inline-flex items-center gap-1.5 px-3 h-8 text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary border border-border rounded-md hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"><Share2 className="h-3.5 w-3.5" /> Export</button>
              <button onClick={strava} disabled={!hasV} className="inline-flex items-center gap-1.5 px-3 h-8 text-xs font-semibold bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-30 disabled:pointer-events-none transition-colors shadow-sm"><Zap className="h-3.5 w-3.5" /> Strava</button>
              <button onClick={dlGPX} disabled={!hasV} className="inline-flex items-center gap-1.5 px-3 h-8 text-xs font-medium border border-primary/30 text-primary rounded-md hover:bg-primary/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"><Download className="h-3.5 w-3.5" /> GPX</button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-5 animate-fade-in">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Create your route</h1>
          <p className="text-muted-foreground text-sm mt-1">Drop points on the map to design your run or ride.</p>
        </div>

        {snapError && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />{snapError}</div>}

        {hasV && (
          <div className="mb-5 rounded-md border border-border bg-card p-4 animate-slide-up">
            <div className="grid grid-cols-6 gap-4">
              {[
                { l: 'Distance', v: dist.toFixed(2), u: 'km', i: Route },
                { l: 'Duration', v: fmt(timeSec), u: '', i: Timer },
                { l: 'Elev Gain', v: Math.round(elevGain), u: 'm', i: TrendingUp },
                { l: 'Avg Pace', v: `${Math.floor(avgP/60)}:${String(Math.floor(avgP%60)).padStart(2,'0')}`, u: '/km', s: <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
                { l: 'Avg HR', v: includeHr ? avgHr : '--', u: includeHr ? 'bpm' : '', i: Heart },
                { l: 'Cadence', v: includeCadence ? avgCad : '--', u: includeCadence ? 'spm' : '', s: <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> },
              ].map((x, i) => (
                <div key={x.l} className={`flex flex-col items-center text-center animate-fade-in stagger-${i+1}`}>
                  {x.s || <x.i className="h-4 w-4 text-primary mb-2" />}
                  <div className="text-sm font-bold text-foreground">{x.v}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{x.u || x.l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-7 gap-5">
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-md border border-border bg-card shadow-sm overflow-hidden animate-slide-up">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">Route Map</span>
                  {isSnapping && <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded"><Loader2 className="h-3 w-3 animate-spin" />Snapping</span>}
                  {isFetchingElevation && <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded"><Loader2 className="h-3 w-3 animate-spin" />Elevation</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={undo} disabled={!waypoints.length} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-20" title="Undo"><Undo2 className="h-4 w-4" /></button>
                  <button onClick={clear} disabled={!waypoints.length} className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-20" title="Clear"><RotateCcw className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="relative h-[420px] sm:h-[480px] w-full">
                <Map waypoints={waypoints} snappedPoints={snappedPoints} onAddPoint={shapeMode === 'draw' ? addPt : () => {}} showWaypoints={showWaypoints} mapCenter={mapCenter} />
                {hasR && <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-2 bg-black/80 border border-border rounded-md px-3 py-1.5 text-xs font-medium text-foreground"><MapPin className="h-3 w-3 text-primary" />{waypoints.length} pts{dist > 0 && ` · ${dist.toFixed(2)} km`}</div>}
                <div className="absolute top-3 left-3 right-3 z-[1000]"><LocationSearch onLocationSelect={(lat, lng) => setMapCenter([lat, lng])} onUndo={undo} /></div>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Shape</span>
                  <div className="flex gap-1">
                    {[
                      { id: 'draw', label: 'Draw', icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg> },
                      { id: 'heart', label: 'Heart', icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg> },
                      { id: 'circle', label: 'Circle', icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg> },
                    ].map(x => (
                      <button key={x.id} onClick={() => shape(x.id)} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${shapeMode === x.id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>{x.icon}{x.label}</button>
                    ))}
                  </div>
                </div>
                {hasR && <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none"><span>Waypoints</span><label className="toggle-switch"><input type="checkbox" checked={showWaypoints} onChange={e => setShowWaypoints(e.target.checked)} /><span className="toggle-slider" /></label></label>}
              </div>
            </div>

            {(
              <div className="space-y-3 animate-slide-up stagger-2">
                <span className="text-sm font-semibold block">Data</span>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { t: 'Pace', c: <PaceChart profileData={profile} /> },
                    { t: 'Elevation', c: <ElevationChart profileData={profile} /> },
                    includeHr && { t: 'Heart Rate', c: <HeartRateChart profileData={profile} /> },
                  ].filter(Boolean).map(x => (
                    <div key={x.t} className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
                      <div className="px-3 py-2 border-b border-border"><span className="text-xs font-semibold uppercase tracking-wider text-primary/80">{x.t}</span></div>
                      <div className={`p-2 ${!profile.length ? 'h-[120px] flex items-center justify-center' : 'h-[120px]'}`}>
                        {profile.length ? x.c : <span className="text-xs text-muted-foreground/50">Add route first</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-5">
            <div className="animate-slide-up stagger-1"><RouteStats totalDistanceKm={dist} totalTimeSec={Math.round(timeSec)} totalElevationGain={elevGain} paceSec={avgP} /></div>

            <div className="rounded-md border border-border bg-card shadow-sm overflow-hidden animate-slide-up stagger-2">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <span className="text-sm font-semibold">Activity Details</span>
                <div className="flex items-center gap-3"><span className={`text-xs font-medium ${!isBike ? 'text-primary' : 'text-muted-foreground'}`}>Run</span><label className="toggle-switch"><input type="checkbox" checked={isBike} onChange={e => setIsBike(e.target.checked)} /><span className="toggle-slider" /></label><span className={`text-xs font-medium ${isBike ? 'text-primary' : 'text-muted-foreground'}`}>Bike</span></div>
              </div>
              <div className="p-4">
                <RunDetails runName={runName} setRunName={setRunName} runDescription={runDescription} setRunDescription={setRunDescription} startTime={startTime} setStartTime={setStartTime} isBike={isBike} setIsBike={setIsBike} pace={pace} setPace={setPace} inconsistency={inconsistency} setInconsistency={setInconsistency} includeHr={includeHr} setIncludeHr={setIncludeHr} hrInconsistency={hrInconsistency} setHrInconsistency={setHrInconsistency} hrTarget={hrTarget} setHrTarget={setHrTarget} includeCadence={includeCadence} setIncludeCadence={setIncludeCadence} cadenceInconsistency={cadenceInconsistency} setCadenceInconsistency={setCadenceInconsistency} cadenceTarget={cadenceTarget} setCadenceTarget={setCadenceTarget} />
              </div>
              <div className="px-4 py-3 border-t border-border space-y-2">
                <button onClick={strava} disabled={!hasV} className="w-full flex items-center justify-center gap-2 h-10 text-sm font-semibold bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-30 disabled:pointer-events-none transition-colors shadow-sm"><Zap className="h-4 w-4" /> Upload to Strava</button>
                <button onClick={dlGPX} disabled={!hasV} className="w-full flex items-center justify-center gap-2 h-10 text-sm font-medium border border-primary/30 text-primary rounded-md hover:bg-primary/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"><Download className="h-4 w-4" /> Download GPX</button>
                <button onClick={() => setIsExportModalOpen(true)} disabled={!hasV} className="w-full flex items-center justify-center gap-2 h-10 text-sm font-medium bg-secondary text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"><Share2 className="h-4 w-4" /> Export Image</button>
              </div>
            </div>
            <button onClick={clear} disabled={!hasR} className="w-full text-center text-xs text-destructive/50 hover:text-destructive disabled:opacity-20 transition-colors">Clear all waypoints</button>
          </div>
        </div>
      </main>

      <footer className="border-t border-border mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2"><Footprints className="h-3 w-3 text-primary" /><span className="font-medium">NotMyRun</span></div>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
      </footer>

      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} snappedPoints={snappedPoints} stats={statsProps} />
    </div>
  );
}

export default App;
