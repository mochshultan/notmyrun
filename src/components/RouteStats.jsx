import React from 'react';
import { formatSecondsToPace } from '../utils/paceEngine';
import { Ruler, Timer, TrendingUp } from 'lucide-react';

export default function RouteStats({ totalDistanceKm, totalTimeSec, totalElevationGain, paceSec }) {
  const fmt = (s) => { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = Math.floor(s%60); return h > 0 ? `${h}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}` : `${m}:${sec.toString().padStart(2,'0')}`; };

  const items = [
    { icon: Ruler, label: 'Distance', val: totalDistanceKm > 0 ? totalDistanceKm.toFixed(2) : '--', unit: 'km' },
    { icon: Timer, label: 'Duration', val: totalTimeSec > 0 ? fmt(totalTimeSec) : '--', unit: '' },
    { icon: TrendingUp, label: 'Elevation', val: totalElevationGain > 0 ? `${Math.round(totalElevationGain)}` : '--', unit: 'm' },
    { icon: null, label: 'Pace', val: paceSec > 0 ? formatSecondsToPace(paceSec) : '--', unit: '/km', svg: <svg className="h-4 w-4 text-primary mb-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((x, i) => (
        <div key={x.label} className="flex flex-col items-center text-center p-3 bg-card border border-border/60 rounded-lg">
          {x.svg || <x.icon className="h-4 w-4 text-primary mb-1.5" />}
          <div className="text-lg font-bold text-foreground leading-tight">{x.val}</div>
          <div className="text-xs text-muted-foreground mt-2">{x.unit || x.label}</div>
        </div>
      ))}
    </div>
  );
}
