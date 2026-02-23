import { useEffect, useMemo, useRef, type MouseEvent, type ReactNode } from 'react';
import type { LevelDefinition } from '../../game/models/types';
import type { EventRecord, SimulationSnapshot } from '../../game/engine/eventTypes';

const TILE = 42;

interface MapPanelProps {
  level: LevelDefinition;
  snapshot: SimulationSnapshot | null;
  selectedDeviceId: string | null;
  onSelectDevice: (id: string | null) => void;
  highlighted?: boolean;
  frameEvents?: EventRecord[];
  overlay?: ReactNode;
  playerOverride?: {
    x: number;
    y: number;
    alive?: boolean;
  } | null;
}

function parseCoordTargetId(targetId: string): { x: number; y: number } | null {
  const match = targetId.match(/^coord:(-?\d+),(-?\d+)$/);
  if (!match) {
    return null;
  }
  return { x: Number(match[1]), y: Number(match[2]) };
}

function resolveTurretTarget(
  snapshot: SimulationSnapshot,
  targetId: string | null,
  fallbackX: number,
  fallbackY: number,
): { x: number; y: number } {
  if (!targetId) {
    return { x: fallbackX, y: fallbackY - TILE * 0.4 };
  }

  if (targetId === 'player') {
    return {
      x: snapshot.player.x * TILE + TILE / 2,
      y: snapshot.player.y * TILE + TILE / 2,
    };
  }

  const coordTarget = parseCoordTargetId(targetId);
  if (coordTarget) {
    return {
      x: coordTarget.x * TILE + TILE / 2,
      y: coordTarget.y * TILE + TILE / 2,
    };
  }

  const target = snapshot.devices[targetId];
  if (!target) {
    return { x: fallbackX, y: fallbackY - TILE * 0.4 };
  }

  return {
    x: target.x * TILE + TILE / 2,
    y: target.y * TILE + TILE / 2,
  };
}

function drawDevice(
  ctx: CanvasRenderingContext2D,
  snapshot: SimulationSnapshot,
  device: SimulationSnapshot['devices'][string],
  selected: boolean,
  variant: NonNullable<LevelDefinition['uiVariant']>,
): void {
  const cx = device.x * TILE + TILE / 2;
  const cy = device.y * TILE + TILE / 2;
  const radius = TILE * 0.28;
  const inTurretAimVariant = variant === 'turretAim';

  ctx.save();
  ctx.lineWidth = selected ? 3 : 1;
  ctx.strokeStyle = selected ? '#7dd3fc' : '#0d1117';

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
      const target = resolveTurretTarget(snapshot, device.currentTargetId, cx, cy);
      const dx = target.x - cx;
      const dy = target.y - cy;
      const magnitude = Math.max(1, Math.hypot(dx, dy));
      const ux = dx / magnitude;
      const uy = dy / magnitude;

      if (inTurretAimVariant) {
        ctx.fillStyle = device.enabled ? '#121417' : '#2a2d31';
        ctx.fillRect(cx - radius * 0.45, cy - radius * 0.2, radius * 0.9, radius * 1.35);
        ctx.fillRect(cx - radius * 0.7, cy - radius * 0.95, radius * 1.4, radius * 0.55);
        ctx.strokeRect(cx - radius * 0.7, cy - radius * 0.95, radius * 1.4, radius * 0.55);
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - radius * 0.7);
        ctx.lineTo(cx + ux * TILE * 0.42, cy - radius * 0.7 + uy * TILE * 0.42);
        ctx.stroke();
      } else {
        ctx.fillStyle = device.enabled ? '#ef4444' : '#5f3c3c';
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = device.enabled ? '#fecaca' : '#7f4747';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + ux * TILE * 0.38, cy + uy * TILE * 0.38);
        ctx.stroke();
      }
      break;
    }
    case 'drone': {
      if (inTurretAimVariant) {
        ctx.fillStyle = device.alive ? '#ef4444' : '#6b7280';
        ctx.fillRect(cx - radius * 0.85, cy - radius * 0.85, radius * 1.7, radius * 1.7);
        ctx.strokeRect(cx - radius * 0.85, cy - radius * 0.85, radius * 1.7, radius * 1.7);
      } else {
        const alive = device.alive;
        ctx.fillStyle = alive ? '#f59e0b' : '#666666';
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
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
      ctx.fillStyle = inTurretAimVariant ? '#05070c' : '#6ee7ff';
      ctx.beginPath();
      ctx.rect(cx - radius, cy - radius * 0.5, radius * 2, radius);
      ctx.fill();
      ctx.stroke();
      break;
    }
    default:
      break;
  }

  ctx.fillStyle = inTurretAimVariant ? '#cbd5e1' : '#dbeafe';
  ctx.font = '11px Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(device.id, cx, cy + TILE * 0.44);
  ctx.restore();
}

function drawProjectileEffects(
  ctx: CanvasRenderingContext2D,
  snapshot: SimulationSnapshot,
  frameEvents: EventRecord[],
  variant: NonNullable<LevelDefinition['uiVariant']>,
): void {
  for (const event of frameEvents) {
    if (event.type !== 'TURRET_FIRED') {
      continue;
    }

    const turretId = String(event.payload.turretId ?? '');
    const targetId = String(event.payload.targetId ?? '');
    const turret = snapshot.devices[turretId];
    if (!turret || turret.type !== 'turret') {
      continue;
    }

    const sx = turret.x * TILE + TILE / 2;
    const sy = turret.y * TILE + TILE / 2;

    let ex = sx;
    let ey = sy;
    if (targetId === 'player') {
      ex = snapshot.player.x * TILE + TILE / 2;
      ey = snapshot.player.y * TILE + TILE / 2;
    } else {
      const coord = parseCoordTargetId(targetId);
      if (coord) {
        ex = coord.x * TILE + TILE / 2;
        ey = coord.y * TILE + TILE / 2;
      } else {
        const target = snapshot.devices[targetId];
        if (!target) {
          continue;
        }
        ex = target.x * TILE + TILE / 2;
        ey = target.y * TILE + TILE / 2;
      }
    }

    ctx.save();
    ctx.strokeStyle = variant === 'turretAim' ? '#f87171' : '#fb7185';
    ctx.lineWidth = variant === 'turretAim' ? 2 : 3;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    const px = sx + (ex - sx) * 0.72;
    const py = sy + (ey - sy) * 0.72;
    ctx.fillStyle = variant === 'turretAim' ? '#fee2e2' : '#fde68a';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function MapPanel({
  level,
  snapshot,
  selectedDeviceId,
  onSelectDevice,
  highlighted = false,
  frameEvents = [],
  overlay,
  playerOverride = null,
}: MapPanelProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const variant = level.uiVariant ?? 'default';

  const devices = useMemo(() => (snapshot ? Object.values(snapshot.devices) : []), [snapshot]);

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

    if (variant === 'turretAim') {
      ctx.fillStyle = '#22252d';
    } else {
      ctx.fillStyle = '#070b16';
    }
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = variant === 'turretAim' ? '#2f3644' : '#1f2b45';
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

    if (variant === 'default') {
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
    }

    for (const wall of level.map.walls) {
      ctx.fillStyle = variant === 'turretAim' ? '#f8fafc' : '#1d2538';
      ctx.fillRect(wall.x * TILE, wall.y * TILE, TILE, TILE);
    }

    if (variant === 'default') {
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(level.entry.x * TILE + TILE * 0.2, level.entry.y * TILE + TILE * 0.2, TILE * 0.6, TILE * 0.6);

      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(level.exit.x * TILE + TILE * 0.2, level.exit.y * TILE + TILE * 0.2, TILE * 0.6, TILE * 0.6);
    }

    if (snapshot) {
      for (const device of devices) {
        drawDevice(ctx, snapshot, device, device.id === selectedDeviceId, variant);
      }

      const drawPlayer = playerOverride ?? snapshot.player;
      const playerX = drawPlayer.x * TILE + TILE / 2;
      const playerY = drawPlayer.y * TILE + TILE / 2;
      const playerAlive = drawPlayer.alive ?? snapshot.player.alive;
      if (variant === 'turretAim') {
        ctx.fillStyle = playerAlive ? '#4db7f2' : '#f43f5e';
        ctx.fillRect(playerX - TILE * 0.24, playerY - TILE * 0.24, TILE * 0.48, TILE * 0.48);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        ctx.strokeRect(playerX - TILE * 0.24, playerY - TILE * 0.24, TILE * 0.48, TILE * 0.48);
      } else {
        ctx.fillStyle = playerAlive ? '#e2e8f0' : '#f43f5e';
        ctx.beginPath();
        ctx.arc(playerX, playerY, TILE * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      drawProjectileEffects(ctx, snapshot, frameEvents, variant);
    }

  }, [level, snapshot, devices, selectedDeviceId, frameEvents, variant, playerOverride]);

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
      <div className="panel__title">{variant === 'turretAim' ? 'Map Mode' : 'Map / Replay'}</div>
      <div className="map-canvas-wrap">
        <canvas ref={canvasRef} className="map-canvas" onClick={onClick} />
        {overlay ? <div className="map-canvas-overlay">{overlay}</div> : null}
      </div>
    </div>
  );
}
