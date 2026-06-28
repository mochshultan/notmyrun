import React, { useEffect, useRef } from 'react';
import { drawStaticMap } from '../utils/staticMap';
import { projectRoute } from '../utils/routeProjection';
import { formatSecondsToPace } from '../utils/paceEngine';

export default function StoryCardCanvas({ waypoints, stats, onRendered }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    async function render() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const width = 1080;
      const height = 1920;
      
      // Clear
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // 1. Draw Map (top 55%)
      const mapHeight = height * 0.55;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, mapHeight);
      ctx.clip();
      
      await drawStaticMap(ctx, waypoints, width, mapHeight);

      // 2. Draw Route on Map
      const projected = projectRoute(waypoints, width, mapHeight, 60); 
      if (projected.length > 1) {
        ctx.beginPath();
        ctx.moveTo(projected[0].x, projected[0].y);
        for (let i = 1; i < projected.length; i++) {
          ctx.lineTo(projected[i].x, projected[i].y);
        }
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 12;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(projected[0].x, projected[0].y, 20, 0, Math.PI * 2);
        ctx.fillStyle = '#22C55E';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 5;
        ctx.stroke();
      }
      ctx.restore();

      // Fade map bottom into dark panel
      const grad = ctx.createLinearGradient(0, mapHeight - 200, 0, mapHeight);
      grad.addColorStop(0, 'rgba(15, 23, 42, 0)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 1)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, mapHeight - 200, width, 200);

      // 3. Draw Stats Panel
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, mapHeight, width, height - mapHeight);

      // Typography settings
      const fontMain = 'bold 100px "Courier New", monospace';
      const fontLabel = '40px -apple-system, "Segoe UI", sans-serif';
      
      // Run Name & Date
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 70px -apple-system, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(stats.runName || 'Activity', width / 2, mapHeight + 100);
      
      ctx.fillStyle = '#3B82F6';
      ctx.font = fontLabel;
      const dateStr = new Date(stats.startTime).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
      ctx.fillText(dateStr, width / 2, mapHeight + 170);

      const drawRow = (y, val1, lbl1, val2, lbl2) => {
        const mid = width / 2;
        // Left
        ctx.textAlign = 'right';
        ctx.fillStyle = '#F8FAFC';
        ctx.font = fontMain;
        ctx.fillText(val1, mid - 40, y);
        ctx.fillStyle = '#94A3B8';
        ctx.font = fontLabel;
        ctx.fillText(lbl1, mid - 40, y + 50);

        // Right
        ctx.textAlign = 'left';
        ctx.fillStyle = '#F8FAFC';
        ctx.font = fontMain;
        ctx.fillText(val2, mid + 40, y);
        ctx.fillStyle = '#94A3B8';
        ctx.font = fontLabel;
        ctx.fillText(lbl2, mid + 40, y + 50);
      };

      const h = Math.floor(stats.timeSec / 3600);
      const m = Math.floor((stats.timeSec % 3600) / 60);
      const s = Math.floor(stats.timeSec % 60);
      const timeStr = `${h > 0 ? h+':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

      drawRow(mapHeight + 400, stats.distance.toFixed(2), 'km', timeStr, 'time');
      drawRow(mapHeight + 650, '+' + Math.round(stats.elevation) + 'm', 'elev gain', formatSecondsToPace(stats.paceSec), 'avg pace');

      if (stats.includeHr || stats.includeCadence) {
        drawRow(
          mapHeight + 900, 
          stats.includeHr ? stats.hr : '-', 'avg hr', 
          stats.includeCadence ? stats.cadence : '-', 'avg cadence'
        );
      }

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
      height={1920} 
      style={{ display: 'none' }}
    />
  );
}
