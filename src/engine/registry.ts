// Mode key → frame painter. Kept separate from the presets so tree
// shaking can in principle drop unused modes in custom builds.

import type { ModeKey } from '../presets';
import type { ModeDraw } from './types';
import { drawBranch } from './branch';
import { drawDelegate } from './delegate';
import { drawGlobe, drawRubik, drawWave } from './lattice';
import { drawMorph } from './morph';
import { drawOrbits } from './orbits';
import { drawRibbon } from './ribbon';
import { drawTorus } from './torus';

export const MODE_DRAWS: Record<ModeKey, ModeDraw> = {
  orbits: drawOrbits,
  globe: drawGlobe,
  rubik: drawRubik,
  wave: drawWave,
  ribbon: drawRibbon,
  morph: drawMorph,
  torus: drawTorus,
  branch: drawBranch,
  delegate: drawDelegate
};
