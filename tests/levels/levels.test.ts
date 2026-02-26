import assert from 'node:assert/strict';
import test from 'node:test';
import { level1 } from '../../src/game/levels/level1';
import { level2 } from '../../src/game/levels/level2';
import { level3 } from '../../src/game/levels/level3';
import { level4 } from '../../src/game/levels/level4';
import { levels } from '../../src/game/levels';

test('levels include Level 1 and generated harder Level 2 in order', () => {
  assert.equal(levels[0]?.id, 'level1');
  assert.equal(levels[1]?.id, 'level2');
});

test('level2 is harder than level1 by map size and guard count', () => {
  const level1Guards = level1.devices.filter((device) => device.type === 'drone');
  const level2Guards = level2.devices.filter((device) => device.type === 'drone');
  const level1Area = level1.map.width * level1.map.height;
  const level2Area = level2.map.width * level2.map.height;

  assert.ok(level2Area > level1Area);
  assert.ok(level2Guards.length > level1Guards.length);
});

test('level2 has a unique top-wall exit door with no blocking wall tile', () => {
  const exitDoor = level2.devices.find((device) => device.type === 'door' && device.id === 'NEXT_DOOR');
  assert.ok(exitDoor);
  if (!exitDoor || exitDoor.type !== 'door') {
    return;
  }

  const wallBlocksDoorTile = level2.map.walls.some((wall) => wall.x === exitDoor.x && wall.y === exitDoor.y);
  assert.equal(wallBlocksDoorTile, false);

  const guardPositions = level2.devices
    .filter((device): device is Extract<typeof level2.devices[number], { type: 'drone' }> => device.type === 'drone')
    .map((guard) => `${guard.x},${guard.y}`);
  assert.equal(new Set(guardPositions).size, guardPositions.length);
});

test('registry includes new levels in order after level2', () => {
  assert.equal(levels[2]?.id, 'level3');
  assert.equal(levels[3]?.id, 'level4');
});

test('level3 alarm trap has guards, side-room alarm/door, and terminal control scope', () => {
  const guards = level3.devices.filter((device) => device.type === 'guard');
  const sideAlarm = level3.devices.find((device) => device.type === 'alarm' && device.id === 'SIDE_ALARM');
  const sideDoor = level3.devices.find((device) => device.type === 'door' && device.id === 'SIDE_ROOM_DOOR');
  const terminal = level3.devices.find((device) => device.type === 'terminal');

  assert.ok(guards.length >= 2);
  assert.ok(sideAlarm);
  assert.ok(sideDoor);
  assert.ok(terminal);
  assert.ok(level3.networkScope.includes('SIDE_ALARM'));
  assert.ok(level3.networkScope.includes('SIDE_ROOM_DOOR'));
});

test('level4 generator shutdown powers down both drones and turrets from one generator', () => {
  const generator = level4.devices.find((device) => device.type === 'generator' && device.id === 'GEN_CORE');
  assert.ok(generator);
  if (!generator || generator.type !== 'generator') {
    return;
  }

  const poweredDevices = generator.poweredDeviceIds.map((id) => level4.devices.find((device) => device.id === id));
  assert.equal(poweredDevices.every(Boolean), true);
  assert.equal(poweredDevices.some((device) => device?.type === 'turret'), true);
  assert.equal(poweredDevices.some((device) => device?.type === 'drone'), true);
  assert.ok(level4.networkScope.includes(generator.id));
});
