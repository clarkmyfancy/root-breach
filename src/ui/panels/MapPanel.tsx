import { useEffect, useMemo, useRef, type MouseEvent } from 'react';
import type { LevelDefinition } from '../../game/models/types';
import type { SimulationSnapshot } from '../../game/engine/eventTypes';

const TILE = 42;

interface MapPanelProps {
  level: LevelDefinition;
  snapshot: SimulationSnapshot | null;
  tick: number;
  selectedDeviceId: string | null;
  onSelectDevice: (id: string | null) => void;
  highlighted?: boolean;
}

function drawDevice(
  ctx: CanvasRenderingContext2D,
  device: SimulationSnapshot['devices'][string],
  selected: boolean,
): void {
  const cx = device.x * TILE + TILE / 2;
  const cy = device.y * TILE + TILE / 2;
  const radius = TILE * 0.28;

  ctx.save();
  ctx.lineWidth = selected ? 3 : 1;
  ctx.strokeStyle = selected ? '#f7d354' : '#0d1117';

  switch (device.type) {
    case 'camera': {
      ctx.fillStyle = device.enabled ? '#47d7ac' : '#3b5a52';
      ctx.beginPath();
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx - radius, cy + radius);
      ctx.lineTo(cx + radius, cy + radius);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'turret': {
      ctx.fillStyle = device.enabled ? '#f87171' : '#5f3c3c';
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      ctx.strokeRect(cx - radius, cy - radius, radius * 2, radius * 2);
      break;
    }
    case 'drone': {
      const alive = device.alive;
      ctx.fillStyle = alive ? '#f59e0b' : '#666666';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'door': {
      ctx.fillStyle = device.isOpen ? '#34d399' : '#9b1c31';
      ctx.fillRect(cx - radius, cy - radius * 0.8, radius * 2, radius * 1.6);
      ctx.strokeRect(cx - radius, cy - radius * 0.8, radius * 2, radius * 1.6);
      break;
    }
    case 'alarm': {
      ctx.fillStyle = device.state === 'GREEN' ? '#16a34a' : device.state === 'YELLOW' ? '#eab308' : '#ef4444';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'terminal': {
      ctx.fillStyle = '#6ee7ff';
      ctx.beginPath();
      ctx.rect(cx - radius, cy - radius * 0.5, radius * 2, radius);
      ctx.fill();
      ctx.stroke();
      break;
    }
    default:
      break;
  }

  ctx.fillStyle = '#dbeafe';
  ctx.font = '11px Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(device.id, cx, cy + TILE * 0.44);
  ctx.restore();
}

export function MapPanel({
  level,
  snapshot,
  tick,
  selectedDeviceId,
  onSelectDevice,
  highlighted = false,
}: MapPanelProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const devices = useMemo(
    () => (snapshot ? Object.values(snapshot.devices) : []),
    [snapshot],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const width = level.map.width * TILE;
    const height = level.map.height * TILE;
    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = '#070b16';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#1f2b45';
    ctx.lineWidth = 1;
    for (let x = 0; x <= level.map.width; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * TILE, 0);
      ctx.lineTo(x * TILE, height);
      ctx.stroke();
    }
    for (let y = 0; y <= level.map.height; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, y * TILE);
      ctx.lineTo(width, y * TILE);
      ctx.stroke();
    }

    ctx.strokeStyle = '#64b5f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    level.playerPath.forEach((point, idx) => {
      const px = point.x * TILE + TILE / 2;
      const py = point.y * TILE + TILE / 2;
      if (idx === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    });
    ctx.stroke();

    for (const wall of level.map.walls) {
      ctx.fillStyle = '#1d2538';
      ctx.fillRect(wall.x * TILE, wall.y * TILE, TILE, TILE);
    }

    ctx.fillStyle = '#16a34a';
    ctx.fillRect(level.entry.x * TILE + TILE * 0.2, level.entry.y * TILE + TILE * 0.2, TILE * 0.6, TILE * 0.6);

    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(level.exit.x * TILE + TILE * 0.2, level.exit.y * TILE + TILE * 0.2, TILE * 0.6, TILE * 0.6);

    for (const device of devices) {
      drawDevice(ctx, device, device.id === selectedDeviceId);
    }

    if (snapshot) {
      const playerX = snapshot.player.x * TILE + TILE / 2;
      const playerY = snapshot.player.y * TILE + TILE / 2;
      ctx.fillStyle = snapshot.player.alive ? '#e2e8f0' : '#f43f5e';
      ctx.beginPath();
      ctx.arc(playerX, playerY, TILE * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.fillStyle = '#f8fafc';
    ctx.font = '12px Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Tick ${tick}`, 8, 16);
  }, [level, snapshot, tick, devices, selectedDeviceId]);

  const onClick = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!snapshot) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const tx = localX / TILE;
    const ty = localY / TILE;

    const hit = Object.values(snapshot.devices).find((device) => {
      const dx = device.x + 0.5 - tx;
      const dy = device.y + 0.5 - ty;
      return Math.sqrt(dx * dx + dy * dy) < 0.45;
    });

    onSelectDevice(hit?.id ?? null);
  };

  return (
    <div className={`panel panel-map ${highlighted ? 'tutorial-focus' : ''}`}>
      <div className="panel__title">Map / Replay</div>
      <canvas ref={canvasRef} className="map-canvas" onClick={onClick} />
    </div>
  );
}
