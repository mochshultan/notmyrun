import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { formatSecondsToPace } from '../utils/paceEngine';

export default function PaceChart({ profileData }) {
  if (!profileData || profileData.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={profileData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorPace" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#FC5200" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#FC5200" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <XAxis 
          dataKey="distance" 
          tickFormatter={(val) => val.toFixed(1) + 'k'} 
          stroke="hsl(var(--muted-foreground))" 
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          minTickGap={30}
        />
        <YAxis 
          dataKey="paceSec"
          reversed={true}
          tickFormatter={(val) => formatSecondsToPace(val)}
          stroke="hsl(var(--muted-foreground))"
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '4px', fontSize: '12px', color: 'hsl(var(--popover-foreground))' }}
          itemStyle={{ color: '#FC5200' }}
          labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
          formatter={(value) => [formatSecondsToPace(value), 'Pace']}
          labelFormatter={(label) => `Distance: ${Number(label).toFixed(2)} km`}
        />
        <Area 
          type="monotone" 
          dataKey="paceSec" 
          stroke="#FC5200" 
          strokeWidth={2}
          fillOpacity={1} 
          fill="url(#colorPace)" 
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
