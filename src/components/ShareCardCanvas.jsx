import React, { useEffect, useRef } from 'react';
import { drawStaticMap } from '../utils/staticMap';
import { projectRoute } from '../utils/routeProjection';
import { formatSecondsToPace } from '../utils/paceEngine';

export default function ShareCardCanvas({ waypoints, stats, onRendered }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    async function render() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const width = 1080;
      const height = 1080;
      
      // Clear
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // 1. Draw Map (top 60% = 648px)
      const mapHeight = height * 0.6;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, mapHeight);
      ctx.clip();
      
      await drawStaticMap(ctx, waypoints, width, mapHeight);

      // 2. Draw Route on Map
      const projected = projectRoute(waypoints, width, mapHeight, 60); // 60px padding
      if (projected.length > 1) {
        ctx.beginPath();
        ctx.moveTo(projected[0].x, projected[0].y);
        for (let i = 1; i < projected.length; i++) {
          ctx.lineTo(projected[i].x, projected[i].y);
        }
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 10;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        // Draw start/end dots
        ctx.beginPath();
        ctx.arc(projected[0].x, projected[0].y, 15, 0, Math.PI * 2);
        ctx.fillStyle = '#22C55E';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.stroke();

        const last = projected[projected.length - 1];
        ctx.beginPath();
        ctx.arc(last.x, last.y, 15, 0, Math.PI * 2);
        ctx.fillStyle = '#EF4444';
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();

      // 3. Draw Stats Panel (bottom 40% = 432px)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, mapHeight, width, height - mapHeight);

      // Divider line
      ctx.fillStyle = '#3B82F6';
      ctx.fillRect(0, mapHeight, width, 8);

      // Typography settings
      const fontNum = 'bold 50px "Courier New", monospace';
      const fontLabel = '30px -apple-system, "Segoe UI", sans-serif';
      
      // Run Name & Date
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 50px -apple-system, "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(stats.runName || 'Activity', 80, mapHeight + 100);
      
      ctx.fillStyle = '#94A3B8';
      ctx.font = fontLabel;
      ctx.textAlign = 'right';
      const dateStr = new Date(stats.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      ctx.fillText(dateStr, width - 80, mapHeight + 100);

      // Separator
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(80, mapHeight + 150);
      ctx.lineTo(width - 80, mapHeight + 150);
      ctx.stroke();

      // Row 1: Dist, Time, Elev
      const colWidth = (width - 160) / 3;
      
      // Dist
      ctx.textAlign = 'left';
      ctx.fillStyle = '#F8FAFC';
      ctx.font = fontNum;
      ctx.fillText(stats.distance.toFixed(2) + ' km', 80, mapHeight + 230);
      ctx.fillStyle = '#94A3B8';
      ctx.font = fontLabel;
      ctx.fillText('DISTANCE', 80, mapHeight + 270);

      // Time
      ctx.fillStyle = '#F8FAFC';
      ctx.font = fontNum;
      const h = Math.floor(stats.timeSec / 3600);
      const m = Math.floor((stats.timeSec % 3600) / 60);
      const s = Math.floor(stats.timeSec % 60);
      const timeStr = `${h > 0 ? h+':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      ctx.fillText(timeStr, 80 + colWidth, mapHeight + 230);
      ctx.fillStyle = '#94A3B8';
      ctx.font = fontLabel;
      ctx.fillText('TIME', 80 + colWidth, mapHeight + 270);

      // Elev
      ctx.fillStyle = '#F8FAFC';
      ctx.font = fontNum;
      ctx.fillText('+' + Math.round(stats.elevation) + ' m', 80 + colWidth * 2, mapHeight + 230);
      ctx.fillStyle = '#94A3B8';
      ctx.font = fontLabel;
      ctx.fillText('ELEV GAIN', 80 + colWidth * 2, mapHeight + 270);

      // Separator
      ctx.beginPath();
      ctx.moveTo(80, mapHeight + 310);
      ctx.lineTo(width - 80, mapHeight + 310);
      ctx.stroke();

      // Row 2: Pace, HR, Cadence
      // Pace
      ctx.fillStyle = '#F8FAFC';
      ctx.font = fontNum;
      ctx.fillText(formatSecondsToPace(stats.paceSec) + '/km', 80, mapHeight + 380);
      ctx.fillStyle = '#94A3B8';
      ctx.font = fontLabel;
      ctx.fillText('AVG PACE', 80, mapHeight + 420);

      // HR
      if (stats.includeHr) {
        ctx.fillStyle = '#F8FAFC';
        ctx.font = fontNum;
        ctx.fillText(stats.hr + ' bpm', 80 + colWidth, mapHeight + 380);
        ctx.fillStyle = '#94A3B8';
        ctx.font = fontLabel;
        ctx.fillText('AVG HR', 80 + colWidth, mapHeight + 420);
      }

      // Cadence
      if (stats.includeCadence) {
        ctx.fillStyle = '#F8FAFC';
        ctx.font = fontNum;
        ctx.fillText(stats.cadence + ' spm', 80 + colWidth * 2, mapHeight + 380);
        ctx.fillStyle = '#94A3B8';
        ctx.font = fontLabel;
        ctx.fillText('AVG CADENCE', 80 + colWidth * 2, mapHeight + 420);
      }

      if (onRendered) {
        // Wait a frame to ensure rendering is complete
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
