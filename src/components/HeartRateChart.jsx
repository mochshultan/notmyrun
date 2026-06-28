import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function HeartRateChart({ profileData }) {
  if (!profileData || profileData.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={profileData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
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
          domain={[100, 200]}
          tickFormatter={(val) => Math.round(val) + 'bpm'}
          stroke="hsl(var(--muted-foreground))"
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '4px', fontSize: '12px', color: 'hsl(var(--popover-foreground))' }}
          itemStyle={{ color: '#EF4444' }}
          labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
          formatter={(value) => [`${Math.round(value)} bpm`, 'Heart Rate']}
          labelFormatter={(label) => `Distance: ${Number(label).toFixed(2)} km`}
        />
        <Line
          type="monotone"
          dataKey="hr"
          stroke="#EF4444"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
