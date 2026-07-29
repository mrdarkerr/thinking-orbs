// Branch: a geodesic decision tree grows across an implied sphere, tests
// its leaves, then commits to one route — the "planning" state. Curved
// dotted edges preserve the orb family without drawing a globe underneath.

import type { Dot, ModeDraw } from './types';
import { makeProj, paint, radiusScale } from './core';

type Vec3 = [number, number, number];

interface BranchNode {
  dir: Vec3;
  parent: number;
  level: number;
  code: number[];
}

const treeCache = new Map<number, BranchNode[]>();

function smoothstep(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

function spherePoint(latDeg: number, lonDeg: number): Vec3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const cl = Math.cos(lat);
  return [cl * Math.sin(lon), Math.sin(lat), cl * Math.cos(lon)];
}

function slerp(a: Vec3, b: Vec3, f: number): Vec3 {
  const d = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(d);
  if (omega < 1e-5) return a;
  const so = Math.sin(omega);
  const wa = Math.sin((1 - f) * omega) / so;
  const wb = Math.sin(f * omega) / so;
  return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb];
}

function buildTree(depth: number): BranchNode[] {
  const hit = treeCache.get(depth);
  if (hit) return hit;

  const nodes: BranchNode[] = [{ dir: spherePoint(-58, 0), parent: -1, level: 0, code: [] }];
  let parents = [0];
  let parentLons = [0];

  for (let level = 1; level <= depth; level++) {
    const next: number[] = [];
    const nextLons: number[] = [];
    const childCount = level === 1 ? 3 : 2;
    const latitude = level === 1 ? -14 : level === 2 ? 27 : 60;
    const spread = level === 1 ? 52 : level === 2 ? 18 : 8;

    for (let pi = 0; pi < parents.length; pi++) {
      for (let child = 0; child < childCount; child++) {
        const offset = childCount === 3 ? (child - 1) * spread : (child === 0 ? -1 : 1) * spread;
        const lon = parentLons[pi] + offset;
        const parent = parents[pi];
        const index = nodes.length;
        nodes.push({
          dir: spherePoint(latitude, lon),
          parent,
          level,
          code: [...nodes[parent].code, child],
        });
        next.push(index);
        nextLons.push(lon);
      }
    }

    parents = next;
    parentLons = nextLons;
  }

  treeCache.set(depth, nodes);
  return nodes;
}

function winnerCode(cycle: number, depth: number): number[] {
  const leafCount = 3 * 2 ** Math.max(0, depth - 1);
  let leaf = ((cycle % leafCount) + leafCount) % leafCount;
  const code = new Array<number>(depth).fill(0);
  const tailCount = 2 ** Math.max(0, depth - 1);
  code[0] = Math.floor(leaf / tailCount);
  leaf %= tailCount;
  for (let level = 1; level < depth; level++) {
    const div = 2 ** (depth - level - 1);
    code[level] = Math.floor(leaf / div);
    leaf %= div;
  }
  return code;
}

function isWinnerPrefix(code: number[], winner: number[]): boolean {
  return code.every((value, index) => winner[index] === value);
}

export const drawBranch: ModeDraw = (ctx, size, t, dark, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * (o.spread ?? 0.82);
  const depth = Math.max(2, Math.round(o.treeDepth ?? 3));
  const edgeDots = Math.max(2, Math.round(o.edgeDots ?? 4));
  const nodes = buildTree(depth);
  const pt = makeProj(0.07 * Math.sin(t * 0.32), 0.08, cx, cy, R);
  const rs = radiusScale(size, o.rsPow ?? 0.6);

  const period = 5.2;
  const shifted = t + 2.6;
  const phase = ((shifted % period) + period) % period;
  const cycle = Math.floor(shifted / period);
  const winner = winnerCode(cycle, depth);

  const growth = phase < 1.5 ? smoothstep(phase / 1.5) : 1;
  const evaluating = phase >= 1.5 && phase < 2.6;
  const selection = phase < 2.6 ? 0 : phase < 3.2 ? smoothstep((phase - 2.6) / 0.6) : 1;
  const reset = phase < 4.2 ? 0 : smoothstep((phase - 4.2) / 1);
  // Neutralise the old winner before the cycle wraps. The next cycle picks a
  // different route, so carrying selection size/ink across the boundary pops.
  const committed = selection * (1 - reset);
  const frontier = evaluating ? (phase - 1.5) / 1.1 : -1;
  const dimFloor = o.dimFloor ?? 0.28;
  const idleFloor = o.idleFloor ?? 0.12;
  const dots: Dot[] = [];

  for (let ni = 1; ni < nodes.length; ni++) {
    const node = nodes[ni];
    const parent = nodes[node.parent];
    const selected = isWinnerPrefix(node.code, winner);

    for (let di = 1; di <= edgeDots; di++) {
      const f = di / (edgeDots + 1);
      const pathProgress = (node.level - 1 + f) / depth;
      const visible = smoothstep((growth - pathProgress + 0.07) / 0.14);

      const dir = slerp(parent.dir, node.dir, f);
      const [x, y, z] = pt(dir[0], dir[1], dir[2]);
      const zDepth = (z + 1) / 2;
      const pulse = frontier < 0 ? 0 : Math.exp(-((pathProgress - frontier) ** 2) / 0.018);
      const choiceAlpha = selected ? 1 : 1 - committed * (1 - dimFloor);
      // Keep the complete tree at idleFloor through both sides of the wrap;
      // growth and selection rise above that stable ghost without a hard reset.
      const alpha = Math.max(idleFloor, visible * choiceAlpha * (1 - reset));

      dots.push({
        x,
        y,
        z,
        r:
          ((o.rBase ?? 0.52) +
            (o.rDepth ?? 1.2) * zDepth +
            (o.rActive ?? 0.65) * (pulse + (selected ? committed * 0.55 : 0))) *
          rs,
        white: 0.68 - 0.52 * zDepth - 0.14 * pulse - (selected ? 0.1 * committed : 0),
        a: alpha * (0.52 + 0.48 * zDepth),
      });
    }
  }

  for (let ni = 0; ni < nodes.length; ni++) {
    const node = nodes[ni];
    const pathProgress = node.level / depth;
    const visible = ni === 0 ? 1 : smoothstep((growth - pathProgress + 0.1) / 0.2);
    const selected = ni === 0 || isWinnerPrefix(node.code, winner);
    const [x, y, z] = pt(node.dir[0], node.dir[1], node.dir[2]);
    const zDepth = (z + 1) / 2;
    const choiceAlpha = selected ? 1 : 1 - committed * (1 - dimFloor);
    const alpha = ni === 0 ? 1 : Math.max(idleFloor, visible * choiceAlpha * (1 - reset));

    dots.push({
      x,
      y,
      z: z + 0.001,
      r:
        ((o.rBase ?? 0.52) +
          (o.rDepth ?? 1.2) * zDepth +
          (o.rActive ?? 0.65) * (0.55 + (selected ? committed * 0.45 : 0))) *
        rs,
      white: 0.58 - 0.48 * zDepth - (selected ? 0.13 * committed : 0),
      a: alpha,
    });
  }

  paint(ctx, dots, dark, o.rMin);
};
