import React, { useEffect, useRef } from 'react';
import { projectRoute } from '../utils/routeProjection';
import { formatSecondsToPace } from '../utils/paceEngine';

export default function RouteArtCanvas({ waypoints, stats, onRendered }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    async function render() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const width = 1080;
      const height = 1080;
      
      // Pure black background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // Draw Route
      const projected = projectRoute(waypoints, width, height, 150); // huge padding
      if (projected.length > 1) {
        ctx.beginPath();
        ctx.moveTo(projected[0].x, projected[0].y);
        for (let i = 1; i < projected.length; i++) {
          ctx.lineTo(projected[i].x, projected[i].y);
        }
        
        // Neon glow effect
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 15;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        ctx.shadowColor = '#3B82F6';
        ctx.shadowBlur = 30;
        ctx.stroke();
        
        // Draw again without blur for core intensity
        ctx.shadowBlur = 0;
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#E0F2FE';
        ctx.stroke();
      }

      // Small stats text in bottom-right corner
      const h = Math.floor(stats.timeSec / 3600);
      const m = Math.floor((stats.timeSec % 3600) / 60);
      const s = Math.floor(stats.timeSec % 60);
      const timeStr = `${h > 0 ? h+':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

      const text = `${stats.distance.toFixed(2)} km · ${timeStr} · +${Math.round(stats.elevation)}m`;

      ctx.fillStyle = '#94A3B8';
      ctx.font = '24px "Courier New", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(text, width - 60, height - 60);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 36px -apple-system, "Segoe UI", sans-serif';
      ctx.fillText(stats.runName || 'Activity', width - 60, height - 100);

      if (onRendered) {
        setTimeout(() => {
          canvas.toBlob((blob) => {
            onRendered(URL.createObjectURL(blob));
          }, 'image/png');
        }, 100);
      }
    }

    render();
  }, [waypoints, stats]);

  return (
    <canvas 
      ref={canvasRef} 
      width={1080} 
      height={1080} 
      style={{ display: 'none' }}
    />
  );
}
