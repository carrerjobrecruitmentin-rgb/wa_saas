/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          STEALTH MODULE — Public API Index                           ║
 * ║                                                                      ║
 * ║  Import from this file to use any stealth component:                 ║
 * ║                                                                      ║
 * ║  import { HumanEmulationEngine } from '../common/stealth';           ║
 * ║  import { resolveSpintax } from '../common/stealth';                 ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

// 🧠 Master Engine (use this in most cases)
export { HumanEmulationEngine, DEFAULT_HUMAN_EMULATION_CONFIG } from './human-emulation.engine';
export type { HumanEmulationConfig } from './human-emulation.engine';

// 📝 Spintax Engine
export { resolveSpintax, hasSpintax, countSpintaxVariations, generateVariants } from './spintax.engine';

// 🖱️ Bezier Mouse Engine
export { generateBezierPath, humanMouseMove, humanClick, addJitter, humanClickOffset } from './bezier-mouse.engine';
export type { Point, MouseMoveOptions } from './bezier-mouse.engine';

// ⌨️ Keystroke Dynamics Engine
export {
  humanType,
  randomTypingProfile,
  DEFAULT_TYPING_PROFILE,
  FAST_TYPING_PROFILE,
  SLOW_TYPING_PROFILE,
} from './keystroke-dynamics.engine';
export type { TypingProfile } from './keystroke-dynamics.engine';

// 🌙 Circadian Rhythm Engine
export {
  waitForWorkingHours,
  isWithinWorkingHours,
  calculateHumanDelay,
  msUntilNextWorkingWindow,
  getCurrentActivityWeight,
  getTimeBasedDelayMultiplier,
  HUMAN_ACTIVITY_PATTERN,
  DEFAULT_CIRCADIAN_CONFIG,
} from './circadian-rhythm.engine';
export type { CircadianConfig, ActivityWindow } from './circadian-rhythm.engine';

// 🎭 Background Noise Engine
export {
  performBackgroundNoise,
  pickNoiseActivity,
  smoothScroll,
  idleMouseMovement,
  DEFAULT_NOISE_CONFIG,
} from './background-noise.engine';
export type { NoiseConfig, NoiseActivity } from './background-noise.engine';

// 🕵️ Stealth Mode Engine
export {
  applyStealthToPage,
  randomStealthProfile,
  getStealthLaunchArgs,
  getStealthPageScript,
  STEALTH_PROFILES,
} from './stealth-mode.engine';
export type { StealthProfile } from './stealth-mode.engine';

// 🏗️ NestJS Module
export { StealthModule } from './stealth.module';
