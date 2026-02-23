import assert from 'node:assert/strict';
import test from 'node:test';
import { level1 } from '../../src/game/levels/level1';
import { level2 } from '../../src/game/levels/level2';
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
