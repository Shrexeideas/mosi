import type {
  GameSimulation,
  SleepBehaviorId,
  SleeperState,
  SwatVariation,
  WakeStage,
} from './types';

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function normalizeAngle(a: number): number {
  let res = a % (Math.PI * 2);
  if (res > Math.PI) res -= Math.PI * 2;
  if (res < -Math.PI) res += Math.PI * 2;
  return res;
}

/**
 * Keeps upper-arm angle in [0.3, 0.3 + 2*PI) so the branch cut points into
 * the mattress/headboard behind the shoulder and FK interpolation always
 * travels cleanly through the open airspace above/in front of the sleeper.
 */
export function canonUpperAngle(a: number): number {
  const min = 0.3;
  const twoPi = Math.PI * 2;
  let res = ((a - min) % twoPi + twoPi) % twoPi + min;
  if (res >= min + twoPi) res -= twoPi;
  return res;
}

export function lerpAngle(a: number, b: number, t: number): number {
  return a + normalizeAngle(b - a) * clamp(t, 0, 1);
}

export const UPPER_ARM_LEN = 104;
export const FOREARM_LEN = 98;
export const PALM_OFFSET = 18;
export const TORSO_SPINE_LEN = 76;
export const NECK_TO_HEAD_LEN = 66;

export const REST_UPPER_ANGLE = 2.52;
export const REST_ELBOW_ANGLE = 0.68;
export const REST_WRIST_ANGLE = -0.08;

export interface ArmIKResult {
  elbowX: number;
  elbowY: number;
  wristX: number;
  wristY: number;
  handX: number;
  handY: number;
  handRotation: number;
}

export interface ArmAngles {
  upperArmAngle: number;
  elbowAngle: number;
  wristAngle: number;
}

export interface HumanPose {
  pelvisX: number;
  pelvisY: number;
  torsoAngle: number;
  backShoulderX: number;
  backShoulderY: number;
  shoulderX: number;
  shoulderY: number;
  neckX: number;
  neckY: number;
  headX: number;
  headY: number;
  headAngle: number;
  pillowX: number;
  pillowY: number;
  pillowSquash: number;
  blanketLift: number;
  blanketSlideDown: number;
  footX: number;
  footY: number;
  footAngle: number;
  elbowX: number;
  elbowY: number;
  wristX: number;
  wristY: number;
  handX: number;
  handY: number;
  handRotation: number;
  fingerCurl: number;
  eyelidOpen: number;
  gazeX: number;
  gazeY: number;
  browFurrow: number;
  mouthMood: 'calm' | 'snore' | 'irritated' | 'confused' | 'shocked' | 'angry' | 'sneeze';
  breath: number;
}

export const WAKE_STAGE_TIMINGS: Array<{ stage: WakeStage; duration: number }> = [
  { stage: 'startle', duration: 0.18 },
  { stage: 'blink_open', duration: 0.20 },
  { stage: 'confused', duration: 0.24 },
  { stage: 'head_lift', duration: 0.22 },
  { stage: 'sit_up', duration: 0.30 },
  { stage: 'scan_room', duration: 0.24 },
  { stage: 'spot_bug', duration: 0.17 },
];

export function easeInOutSine(t: number): number {
  const c = clamp(t, 0, 1);
  return -(Math.cos(Math.PI * c) - 1) / 2;
}

export function easeOutCubic(t: number): number {
  const c = clamp(t, 0, 1);
  return 1 - Math.pow(1 - c, 3);
}

export function easeInCubic(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c * c;
}

export function easeInQuart(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c * c * c;
}

export function easeOutBack(t: number): number {
  const c = clamp(t, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(c - 1, 3) + c1 * Math.pow(c - 1, 2);
}

/**
 * Pure Forward Kinematics: computes elbow, wrist, and palm pivots
 * strictly from shoulder socket and joint angles (fixed bone lengths).
 */
export function computeArmFromAngles(
  shoulderX: number,
  shoulderY: number,
  upperArmAngle: number,
  elbowAngle: number,
  wristAngle: number
): ArmIKResult {
  const elbowX = shoulderX + Math.cos(upperArmAngle) * UPPER_ARM_LEN;
  const elbowY = shoulderY + Math.sin(upperArmAngle) * UPPER_ARM_LEN;
  const forearmWorld = upperArmAngle + elbowAngle;
  const wristX = elbowX + Math.cos(forearmWorld) * FOREARM_LEN;
  const wristY = elbowY + Math.sin(forearmWorld) * FOREARM_LEN;
  const handWorld = forearmWorld + wristAngle;
  const handX = wristX + Math.cos(handWorld) * PALM_OFFSET;
  const handY = wristY + Math.sin(handWorld) * PALM_OFFSET;
  const handRotation = handWorld + Math.PI * 0.5;

  return {
    elbowX,
    elbowY,
    wristX,
    wristY,
    handX,
    handY,
    handRotation,
  };
}

/**
 * Pure two-bone analytic IK solver with anatomical reach clamping.
 * Returns both world coordinates and canonicalized joint angles.
 */
export function solveTwoBoneArmIK(
  shoulderX: number,
  shoulderY: number,
  targetHandX: number,
  targetHandY: number,
  upperLen = UPPER_ARM_LEN,
  lowerLen = FOREARM_LEN,
  bendDir: 1 | -1 = -1,
  handRotOffset = 0
): ArmIKResult & ArmAngles {
  const dxRaw = targetHandX - shoulderX;
  const dyRaw = targetHandY - shoulderY;
  const rawDist = Math.hypot(dxRaw, dyRaw) || 0.001;
  const dirX = dxRaw / rawDist;
  const dirY = dyRaw / rawDist;

  // Wrist sits slightly short of palm center along arm axis
  const wristPullback = Math.min(PALM_OFFSET, rawDist * 0.25);
  const targetWristX = targetHandX - dirX * wristPullback;
  const targetWristY = targetHandY - dirY * wristPullback;

  let wx = targetWristX - shoulderX;
  let wy = targetWristY - shoulderY;
  let dist = Math.hypot(wx, wy) || 0.001;

  const minReach = Math.abs(upperLen - lowerLen) + 8;
  const maxReach = (upperLen + lowerLen) * 0.992;
  if (dist < minReach) {
    wx = (wx / dist) * minReach;
    wy = (wy / dist) * minReach;
    dist = minReach;
  } else if (dist > maxReach) {
    wx = (wx / dist) * maxReach;
    wy = (wy / dist) * maxReach;
    dist = maxReach;
  }

  const baseAngle = Math.atan2(wy, wx);
  const cosShoulder = clamp(
    (upperLen * upperLen + dist * dist - lowerLen * lowerLen) / (2 * upperLen * dist),
    -1,
    1
  );
  const offsetAngle = Math.acos(cosShoulder);
  const upperArmAngle = canonUpperAngle(baseAngle + bendDir * offsetAngle);

  const elbowX = shoulderX + Math.cos(upperArmAngle) * upperLen;
  const elbowY = shoulderY + Math.sin(upperArmAngle) * upperLen;
  const wristX = shoulderX + wx;
  const wristY = shoulderY + wy;

  const forearmWorld = Math.atan2(wristY - elbowY, wristX - elbowX);
  const elbowAngle = normalizeAngle(forearmWorld - upperArmAngle);
  const wristAngle = handRotOffset;
  const handWorld = forearmWorld + wristAngle;
  const handRotation = handWorld + Math.PI * 0.5;
  const handX = wristX + Math.cos(handWorld) * PALM_OFFSET;
  const handY = wristY + Math.sin(handWorld) * PALM_OFFSET;

  return {
    elbowX,
    elbowY,
    wristX,
    wristY,
    handX,
    handY,
    handRotation,
    upperArmAngle,
    elbowAngle,
    wristAngle,
  };
}

/**
 * Picks natural elbow arch side so downward slaps on the bed arch their elbow
 * above the mattress rather than clipping into it, while overhead/cheek/upward
 * swats keep the elbow cleanly in front of the chest.
 */
export function resolveSwatBendDir(
  variation: SwatVariation,
  shoulderX: number,
  shoulderY: number,
  targetHandX: number,
  targetHandY: number
): 1 | -1 {
  if (variation === 'upward_swipe') return -1;
  const dx = targetHandX - shoulderX;
  const dy = targetHandY - shoulderY;
  return dx < -35 && dy > -55 ? 1 : -1;
}

/**
 * Solves target joint angles for a swat impact in safe canonical angle space.
 */
export function solveSwatTargetAngles(
  shoulderX: number,
  shoulderY: number,
  targetHandX: number,
  targetHandY: number,
  variation: SwatVariation = 'downward_slap'
): ArmAngles & { bendDir: 1 | -1 } {
  const bendDir = resolveSwatBendDir(variation, shoulderX, shoulderY, targetHandX, targetHandY);
  const solved = solveTwoBoneArmIK(
    shoulderX,
    shoulderY,
    targetHandX,
    targetHandY,
    UPPER_ARM_LEN,
    FOREARM_LEN,
    bendDir,
    0
  );
  return {
    upperArmAngle: solved.upperArmAngle,
    elbowAngle:
      bendDir === 1 ? Math.min(-0.18, solved.elbowAngle) : Math.max(0.18, solved.elbowAngle),
    wristAngle: 0,
    bendDir,
  };
}

export function pickSwatVariation(
  sim: GameSimulation,
  isHunter: boolean,
  rng: () => number = Math.random
): SwatVariation {
  const s = sim.sleeper;
  const nearPillow = s.swatX >= 740 && s.swatY >= 360;
  const highTarget = s.swatY <= 360;
  const roll = rng();

  const candidates: SwatVariation[] = [];
  if (isHunter) {
    if (roll < 0.26) candidates.push('double_slap');
    else if (roll < 0.50) candidates.push('upward_swipe');
    else if (roll < 0.76) candidates.push('downward_slap');
    else candidates.push('pillow_side_swat');
  } else {
    if (nearPillow && roll < 0.28) candidates.push('pillow_side_swat');
    else if (highTarget && roll < 0.36) candidates.push('upward_swipe');
    else if (s.archetype === 'deep_snorer' && roll < 0.56) candidates.push('sleepy_miss_swat');
    else if (s.alertCount >= 2 && roll < 0.72) candidates.push('double_slap');
    else if (roll < 0.86) candidates.push('upward_swipe');
    else candidates.push('downward_slap');
  }

  const chosen = candidates[0] ?? 'downward_slap';
  if (chosen === s.swatVariation) {
    const order: SwatVariation[] = isHunter
      ? ['downward_slap', 'upward_swipe', 'double_slap', 'pillow_side_swat']
      : ['downward_slap', 'pillow_side_swat', 'upward_swipe', 'double_slap', 'sleepy_miss_swat'];
    return order[(order.indexOf(chosen) + 1) % order.length];
  }
  return chosen;
}

export function getSwatVariationSpec(variation: SwatVariation): {
  windupDuration: number;
  strikeDuration: number;
  recoveryDuration: number;
  anticipationRatio: number;
  windupUpper: number;
  windupElbow: number;
  windupWrist: number;
  wristLagMag: number;
  followThroughUpper: number;
  followThroughElbow: number;
  followThroughWristMag: number;
} {
  switch (variation) {
    case 'pillow_side_swat':
      return {
        windupDuration: 0.72,
        strikeDuration: 0.21,
        recoveryDuration: 0.60,
        anticipationRatio: 0.22,
        windupUpper: 5.18,
        windupElbow: 1.12,
        windupWrist: 0.44,
        wristLagMag: 0.50,
        followThroughUpper: -0.28,
        followThroughElbow: -0.18,
        followThroughWristMag: 0.34,
      };
    case 'upward_swipe':
      return {
        windupDuration: 0.68,
        strikeDuration: 0.21,
        recoveryDuration: 0.58,
        anticipationRatio: 0.20,
        windupUpper: 2.15,
        windupElbow: 1.24,
        windupWrist: -0.42,
        wristLagMag: 0.48,
        followThroughUpper: 0.36,
        followThroughElbow: -0.22,
        followThroughWristMag: 0.36,
      };
    case 'double_slap':
      return {
        windupDuration: 0.66,
        strikeDuration: 0.25,
        recoveryDuration: 0.56,
        anticipationRatio: 0.18,
        windupUpper: 4.38,
        windupElbow: 1.54,
        windupWrist: 0.44,
        wristLagMag: 0.48,
        followThroughUpper: -0.18,
        followThroughElbow: -0.14,
        followThroughWristMag: 0.24,
      };
    case 'sleepy_miss_swat':
      return {
        windupDuration: 0.76,
        strikeDuration: 0.20,
        recoveryDuration: 0.70,
        anticipationRatio: 0.26,
        windupUpper: 3.74,
        windupElbow: 0.78,
        windupWrist: 0.34,
        wristLagMag: 0.36,
        followThroughUpper: -0.14,
        followThroughElbow: -0.12,
        followThroughWristMag: 0.44,
      };
    case 'downward_slap':
    default:
      return {
        windupDuration: 0.70,
        strikeDuration: 0.17,
        recoveryDuration: 0.56,
        anticipationRatio: 0.21,
        windupUpper: 4.38,
        windupElbow: 1.45,
        windupWrist: 0.44,
        wristLagMag: 0.50,
        followThroughUpper: -0.20,
        followThroughElbow: -0.16,
        followThroughWristMag: 0.28,
      };
  }
}

function getBehaviorDuration(behavior: SleepBehaviorId, rng: () => number): number {
  switch (behavior) {
    case 'nose_scratch':
      return 1.65 + rng() * 0.35;
    case 'arm_shift':
      return 1.35 + rng() * 0.35;
    case 'blanket_tug':
      return 1.45 + rng() * 0.35;
    case 'body_roll':
      return 1.9 + rng() * 0.45;
    case 'leg_shift':
      return 1.3 + rng() * 0.4;
    case 'head_turn':
      return 1.6 + rng() * 0.4;
    case 'peek_eye':
      return 1.15 + rng() * 0.25;
    case 'grumpy_twitch':
      return 1.2 + rng() * 0.3;
    case 'idle':
    default:
      return 0;
  }
}

function pickNextSleepBehavior(
  s: SleeperState,
  rng: () => number
): SleepBehaviorId {
  const pool: SleepBehaviorId[] =
    s.archetype === 'twitchy'
      ? ['nose_scratch', 'grumpy_twitch', 'arm_shift', 'leg_shift', 'peek_eye', 'head_turn', 'blanket_tug']
      : s.archetype === 'light_sleeper'
        ? ['peek_eye', 'head_turn', 'nose_scratch', 'blanket_tug', 'grumpy_twitch', 'arm_shift']
        : ['body_roll', 'blanket_tug', 'arm_shift', 'leg_shift', 'nose_scratch', 'head_turn'];

  const picked = pool[Math.floor(rng() * pool.length) % pool.length];
  return picked === s.sleepBehavior ? pool[(pool.indexOf(picked) + 1) % pool.length] : picked;
}

export function advanceWakeStage(s: SleeperState, dt: number): boolean {
  if (s.wakeStage === 'asleep' || s.wakeStage === 'angry_hunt') {
    return s.wakeStage === 'angry_hunt';
  }
  s.wakeStageTimer += dt;
  const idx = WAKE_STAGE_TIMINGS.findIndex((item) => item.stage === s.wakeStage);
  if (idx === -1) {
    s.wakeStage = 'angry_hunt';
    return true;
  }
  const current = WAKE_STAGE_TIMINGS[idx];
  if (s.wakeStageTimer >= current.duration) {
    s.wakeStageTimer -= current.duration;
    if (idx + 1 < WAKE_STAGE_TIMINGS.length) {
      s.wakeStage = WAKE_STAGE_TIMINGS[idx + 1].stage;
    } else {
      s.wakeStage = 'angry_hunt';
      s.wakeStageTimer = 0;
      return true;
    }
  }
  return false;
}

export function computeHumanPose(sim: GameSimulation): HumanPose {
  const s = sim.sleeper;
  const m = sim.mosquito;
  const t = sim.elapsedTime;

  const breathPrimary = Math.sin(s.breathPhase);
  const breathSecondary = Math.sin(s.breathPhase * 0.48 + 0.7) * 0.25;
  const breath = (breathPrimary + breathSecondary) * s.breathDepth;

  let startleJolt = 0;
  let wakeEye = 0;
  let wakeHeadLift = 0;
  let wakeSitUp = 0;
  let wakeScanGaze = 0;

  if (sim.subPhase === 'escape') {
    const stageIdx = WAKE_STAGE_TIMINGS.findIndex((x) => x.stage === s.wakeStage);
    const curDef = WAKE_STAGE_TIMINGS[stageIdx];
    const p = curDef ? clamp(s.wakeStageTimer / curDef.duration, 0, 1) : 1;

    switch (s.wakeStage) {
      case 'startle':
        startleJolt = Math.sin(p * Math.PI) * 1.1;
        wakeEye = p * 0.2;
        break;
      case 'blink_open':
        wakeEye = 0.2 + easeInOutSine(p) * 0.65;
        wakeHeadLift = p * 0.15;
        break;
      case 'confused':
        wakeEye = 0.82;
        wakeHeadLift = 0.15 + easeInOutSine(p) * 0.2;
        wakeScanGaze = 0.45 * Math.sin(p * Math.PI);
        break;
      case 'head_lift':
        wakeEye = 0.88;
        wakeHeadLift = 0.35 + easeOutCubic(p) * 0.65;
        wakeSitUp = p * 0.18;
        break;
      case 'sit_up':
        wakeEye = 0.92;
        wakeHeadLift = 1;
        wakeSitUp = 0.18 + easeOutBack(p) * 0.82;
        break;
      case 'scan_room':
        wakeEye = 0.96;
        wakeHeadLift = 1;
        wakeSitUp = 1;
        wakeScanGaze = Math.sin(p * Math.PI * 2) * 0.95;
        break;
      case 'spot_bug':
      case 'angry_hunt':
      default:
        wakeEye = 1;
        wakeHeadLift = 1;
        wakeSitUp = 1;
        break;
    }
  }

  const sitUp = sim.subPhase === 'escape' ? clamp(wakeSitUp, 0, 1.08) : s.sitUpAmount;
  const headLift = sim.subPhase === 'escape' ? clamp(wakeHeadLift, 0, 1) : s.headLiftAmount;

  // Torso lean/scoot for far swats/scratches keeps shoulder STRICTLY attached to torso!
  const reachLean = clamp(s.swatTorsoLean, 0, 1);
  const huntShift = sim.subPhase === 'escape' ? (s.huntX - 894) * 0.38 : 0;
  const rollShiftY = s.bodyRoll * 5;
  const sneezeRise = s.sneezeChargeTimer > 0 ? -6 - Math.sin(t * 28) * 2.5 : 0;
  const anticipationRecoil = s.swatStage === 'anticipation' ? 5 : 0;

  const pelvisX =
    766 + clamp(huntShift, -165, 42) - reachLean * 124 + anticipationRecoil * 0.6;
  const pelvisY =
    482 - sitUp * 12 - startleJolt * 8 - reachLean * 6 + rollShiftY * 0.4;

  // Spine angle rotates smoothly for sit-up OR forward reach-lean, NEVER detaching shoulder!
  const torsoAngle =
    -0.52 -
    sitUp * 0.98 -
    headLift * 0.12 -
    startleJolt * 0.1 -
    reachLean * 1.24 +
    (s.swatStage === 'anticipation' ? 0.08 : 0);

  const shoulderX = pelvisX + Math.cos(torsoAngle) * TORSO_SPINE_LEN;
  const shoulderY =
    pelvisY + Math.sin(torsoAngle) * TORSO_SPINE_LEN - breath * 2.8 + sneezeRise * 0.4;

  const backShoulderX = shoulderX - 18 * (1 - sitUp) - 24 * sitUp;
  const backShoulderY = shoulderY - 8 + s.bodyRoll * 6;

  // Neck & Head follow torso cleanly
  const headBaseAngle = torsoAngle - 0.06 + s.headTurn * 0.22 - sitUp * 0.12;
  const neckX = shoulderX + Math.cos(headBaseAngle) * 24;
  const neckY = shoulderY + Math.sin(headBaseAngle) * 24;

  const restHeadX = 894 + (s.sneezeChargeTimer > 0 ? Math.sin(t * 34) * 4.5 : 0);
  const restHeadY = 405 - breath * 1.4 + s.bodyRoll * 5 + sneezeRise;
  const sitHeadX = shoulderX + 12 + s.headTurn * 8 - reachLean * 12;
  const sitHeadY = shoulderY - 62 - startleJolt * 4 + reachLean * 12;

  const headBlend = clamp(Math.max(sitUp, headLift * 0.55, reachLean * 0.92), 0, 1);
  const headX = restHeadX + (sitHeadX - restHeadX) * headBlend;
  const headY = restHeadY + (sitHeadY - restHeadY) * headBlend;
  const headAngle =
    0.08 * (1 - headBlend) +
    s.headTurn * 0.24 -
    headLift * 0.14 -
    reachLean * 0.22 +
    (s.sneezeChargeTimer > 0 ? 0.24 : 0) +
    (s.sneezeBlastTimer > 0 ? -0.28 : 0);

  const headWeightOnPillow = clamp(1 - headBlend, 0, 1);
  const totalPillowSquash = clamp(headWeightOnPillow * 0.38 + s.pillowSquash * 0.72, 0, 1);
  const pillowX = 888;
  const pillowY = 446 + totalPillowSquash * 5;

  const footX = 465 + s.footShiftX + (s.mood === 'stirring' ? Math.sin(t * 20) * 1.8 : 0);
  const footY = 514 + s.footShiftY + (s.mood === 'stirring' ? Math.cos(t * 17) * 1.5 : 0);
  const footAngle = -0.18 + Math.sin(t * 1.6) * 0.025 + s.footFlex * 0.24;

  let eyelidOpen = s.eyeOpenAmount;
  if (sim.subPhase === 'escape') {
    eyelidOpen = wakeEye;
  } else if (s.swatVariation === 'sleepy_miss_swat' && (s.mood === 'windup' || s.mood === 'strike')) {
    eyelidOpen = 0.22; // groggy half-squint during sleepy swat!
  } else if (s.mood === 'stirring' || s.mood === 'windup' || s.mood === 'strike') {
    eyelidOpen = Math.max(eyelidOpen, 0.08);
  }

  let gazeX = s.gazeX;
  let gazeY = s.gazeY;
  if (sim.subPhase === 'escape') {
    if (s.wakeStage === 'confused') {
      gazeX = 0.85;
      gazeY = 0.15;
    } else if (s.wakeStage === 'scan_room') {
      gazeX = wakeScanGaze;
      gazeY = -0.15;
    } else {
      const dx = m.x - headX;
      const dy = m.y - headY;
      const d = Math.hypot(dx, dy) || 1;
      gazeX = clamp(dx / d, -1, 1);
      gazeY = clamp(dy / d, -1, 1);
    }
  }

  let mouthMood: HumanPose['mouthMood'] = 'calm';
  if (s.sneezeChargeTimer > 0 || s.sneezeBlastTimer > 0) {
    mouthMood = 'sneeze';
  } else if (sim.subPhase === 'escape') {
    if (s.wakeStage === 'startle' || s.wakeStage === 'spot_bug') {
      mouthMood = 'shocked';
    } else if (s.wakeStage === 'blink_open' || s.wakeStage === 'confused' || s.wakeStage === 'head_lift') {
      mouthMood = 'confused';
    } else {
      mouthMood = 'angry';
    }
  } else if (s.mood === 'stirring' || s.mood === 'windup' || s.mood === 'strike' || s.browFurrow > 0.45) {
    mouthMood = 'irritated';
  } else if (breath > 0.22) {
    mouthMood = 'snore';
  }

  const blanketLift = breath * 5.2 + s.blanketTugAmount * 14 - s.bodyRoll * 4;
  const blanketSlideDown = Math.max(sitUp, reachLean * 0.45) * 62;

  return {
    pelvisX,
    pelvisY,
    torsoAngle,
    backShoulderX,
    backShoulderY,
    shoulderX,
    shoulderY,
    neckX,
    neckY,
    headX,
    headY,
    headAngle,
    pillowX,
    pillowY,
    pillowSquash: totalPillowSquash,
    blanketLift,
    blanketSlideDown,
    footX,
    footY,
    footAngle,
    elbowX: s.elbowX,
    elbowY: s.elbowY,
    wristX: s.wristX,
    wristY: s.wristY,
    handX: s.handX,
    handY: s.handY,
    handRotation: s.handRotation,
    fingerCurl: s.fingerCurl,
    eyelidOpen,
    gazeX,
    gazeY,
    browFurrow: s.browFurrow,
    mouthMood,
    breath,
  };
}

export function updateHumanAnimation(
  sim: GameSimulation,
  dt: number,
  rng: () => number = Math.random
): void {
  const s = sim.sleeper;
  const m = sim.mosquito;
  const t = sim.elapsedTime;

  s.pillowSquash = Math.max(0, s.pillowSquash - dt * 1.9);
  s.swatFollowThroughTimer = Math.max(0, s.swatFollowThroughTimer - dt);
  s.swatImpactSquash = Math.max(0, s.swatImpactSquash - dt * 4.5);
  if (s.biteReactionTimer > 0) {
    s.biteReactionTimer = Math.max(0, s.biteReactionTimer - dt);
  }

  if (m.isSipping && m.sipTargetId) {
    const target = sim.targets.find((item) => item.id === m.sipTargetId);
    if (target) {
      s.biteReactionTargetId = target.id;
      s.biteReactionX = target.x;
      s.biteReactionY = target.y;
      s.biteReactionTimer = 0.65;
    }
  }

  const feverFactor = s.activeConditions.includes('dramatic_fever') ? 1.28 : 1;
  const targetBreathRate =
    sim.subPhase === 'escape'
      ? 3.3
      : s.mood === 'windup' || s.mood === 'strike'
        ? 2.8
        : s.mood === 'stirring'
          ? 2.15 * feverFactor
          : (1.28 + (s.tension / 100) * 0.45) * feverFactor;
  const targetBreathDepth =
    sim.subPhase === 'escape'
      ? 1.25
      : s.mood === 'stirring'
        ? 1.15
        : s.archetype === 'deep_snorer'
          ? 1.22
          : 0.95;

  s.breathRate += (targetBreathRate - s.breathRate) * Math.min(1, dt * 4);
  s.breathDepth += (targetBreathDepth - s.breathDepth) * Math.min(1, dt * 4);
  s.breathPhase += dt * s.breathRate;

  const busyInGameplay =
    sim.subPhase === 'escape' ||
    s.mood === 'windup' ||
    s.mood === 'strike' ||
    s.mood === 'cooldown' ||
    s.scratchWindupTimer > 0 ||
    s.scratchActiveTimer > 0 ||
    s.sneezeChargeTimer > 0;

  if (busyInGameplay) {
    if (s.sleepBehavior !== 'idle') {
      s.sleepBehavior = 'idle';
      s.behaviorTimer = 0;
      s.behaviorBlend = Math.max(0, s.behaviorBlend - dt * 5);
    }
  } else if (s.sleepBehavior !== 'idle') {
    s.behaviorTimer += dt;
    const progress = clamp(s.behaviorTimer / Math.max(0.2, s.behaviorDuration), 0, 1);
    const bell =
      progress < 0.25
        ? easeInOutSine(progress / 0.25)
        : progress > 0.75
          ? easeInOutSine((1 - progress) / 0.25)
          : 1;
    s.behaviorBlend = bell;

    if (progress >= 1) {
      s.sleepBehavior = 'idle';
      s.behaviorTimer = 0;
      s.behaviorBlend = 0;
      s.behaviorCooldown =
        s.archetype === 'twitchy' ? 3.2 + rng() * 2.5 : 4.8 + rng() * 3.8;
    }
  } else {
    s.behaviorCooldown -= dt * (s.mood === 'stirring' ? 1.4 : 1);
    if (s.behaviorCooldown <= 0 && s.mood === 'sleeping') {
      s.sleepBehavior = pickNextSleepBehavior(s, rng);
      s.behaviorTimer = 0;
      s.behaviorDuration = getBehaviorDuration(s.sleepBehavior, rng);
      s.behaviorBlend = 0;
    }
  }

  const distToHead = distance(m.x, m.y, 894, 405);
  const distToBody = distance(m.x, m.y, 690, 460);
  const proximityAlert =
    sim.subPhase === 'sleep' && sim.phase === 'playing'
      ? clamp(1 - Math.min(distToHead, distToBody) / 230, 0, 1) *
        clamp(0.3 + sim.noise / 85 + s.tension / 100, 0.2, 1)
      : 0;

  let goalBodyRoll = 0;
  let goalHeadTurn = 0;
  let goalBrow = clamp(s.tension / 115 + proximityAlert * 0.45, 0, 1);
  let goalEyeOpen = 0;
  let goalGazeX = -0.3;
  let goalGazeY = 0;
  let goalBlanketTug = 0;
  let goalFootShiftX = 0;
  let goalFootShiftY = 0;
  let goalFootFlex = 0;

  if (m.isSipping && m.sipTargetId === 'foot') {
    goalFootFlex = Math.sin(t * 9) * 0.28;
    goalFootShiftY = -2 + Math.sin(t * 7) * 2;
  }

  if (sim.subPhase === 'sleep') {
    if (proximityAlert > 0.25) {
      goalHeadTurn += clamp((m.x - 894) / 260, -0.55, 0.35) * proximityAlert;
    }

    const b = s.behaviorBlend;
    const p =
      s.behaviorDuration > 0 ? clamp(s.behaviorTimer / s.behaviorDuration, 0, 1) : 0;

    switch (s.sleepBehavior) {
      case 'body_roll':
        goalBodyRoll = Math.sin(p * Math.PI) * 0.85;
        goalHeadTurn += 0.3 * b;
        break;
      case 'head_turn':
        goalHeadTurn += Math.sin(p * Math.PI * 1.5) * 0.72 * b;
        break;
      case 'blanket_tug':
        goalBlanketTug = b;
        break;
      case 'leg_shift':
        goalFootShiftX = -10 * b;
        goalFootShiftY = -7 * b;
        goalFootFlex = Math.sin(p * Math.PI * 2) * 0.85 * b;
        break;
      case 'peek_eye':
        goalEyeOpen = 0.48 * b;
        goalGazeX = Math.sin(p * Math.PI * 2) * 0.65;
        goalGazeY = -0.25;
        break;
      case 'grumpy_twitch':
        goalBrow = Math.max(goalBrow, 0.85 * b);
        goalHeadTurn += Math.sin(t * 14) * 0.12 * b;
        break;
      default:
        break;
    }

    if (s.mood === 'stirring') {
      goalBrow = Math.max(goalBrow, 0.78);
      goalHeadTurn += Math.sin(t * 8) * 0.16;
    }
    if (s.mood === 'windup' || s.mood === 'strike') {
      if (s.swatVariation === 'pillow_side_swat') {
        goalBodyRoll = -0.35;
      }
      goalBrow = s.swatVariation === 'sleepy_miss_swat' ? 0.55 : 0.95;
    }
  } else {
    advanceWakeStage(s, dt);
    goalBrow = s.wakeStage === 'angry_hunt' || s.wakeStage === 'spot_bug' ? 1 : 0.45;
    goalEyeOpen = 1;
    if (s.wakeStage === 'angry_hunt') {
      s.sitUpAmount += (1 - s.sitUpAmount) * Math.min(1, dt * 8);
      s.headLiftAmount += (1 - s.headLiftAmount) * Math.min(1, dt * 8);
    } else if (s.wakeStage === 'sit_up' || s.wakeStage === 'scan_room' || s.wakeStage === 'spot_bug') {
      s.sitUpAmount += (1 - s.sitUpAmount) * Math.min(1, dt * 7);
      s.headLiftAmount += (1 - s.headLiftAmount) * Math.min(1, dt * 9);
    } else if (s.wakeStage === 'head_lift') {
      s.headLiftAmount += (0.85 - s.headLiftAmount) * Math.min(1, dt * 7);
    }
  }

  // Smooth torso reach-lean for far targets during swat or scratch
  let goalTorsoLean = 0;
  if (sim.subPhase === 'sleep') {
    if (s.mood === 'windup' || s.mood === 'strike') {
      goalTorsoLean = clamp((675 - s.swatX) / 230, 0, 1);
    } else if (
      s.scratchTargetId === 'foot' &&
      (s.scratchWindupTimer > 0 || s.scratchActiveTimer > 0)
    ) {
      goalTorsoLean = 0.85;
    }
  } else if (s.mood === 'windup' || s.mood === 'strike') {
    // Awake sitting swat leaning toward target
    goalTorsoLean = clamp((610 - s.swatX) / 340, 0, 0.72);
  }

  const smoothRate = Math.min(1, dt * 7.5);
  s.bodyRoll += (goalBodyRoll - s.bodyRoll) * smoothRate;
  s.headTurn += (goalHeadTurn - s.headTurn) * smoothRate;
  s.browFurrow += (goalBrow - s.browFurrow) * smoothRate;
  s.eyeOpenAmount += (goalEyeOpen - s.eyeOpenAmount) * Math.min(1, dt * 11);
  s.gazeX += (goalGazeX - s.gazeX) * smoothRate;
  s.gazeY += (goalGazeY - s.gazeY) * smoothRate;
  s.blanketTugAmount += (goalBlanketTug - s.blanketTugAmount) * smoothRate;
  s.footShiftX += (goalFootShiftX - s.footShiftX) * smoothRate;
  s.footShiftY += (goalFootShiftY - s.footShiftY) * smoothRate;
  s.footFlex += (goalFootFlex - s.footFlex) * smoothRate;
  s.swatTorsoLean += (goalTorsoLean - s.swatTorsoLean) * Math.min(1, dt * 8.5);

  updateDynamicTargetPositions(sim);
}

function updateDynamicTargetPositions(sim: GameSimulation): void {
  const s = sim.sleeper;
  const foot = sim.targets.find((t) => t.id === 'foot');
  if (foot) {
    foot.x = 470 + s.footShiftX * 0.7;
    foot.y = 500 + s.footShiftY * 0.7;
  }
  const cheek = sim.targets.find((t) => t.id === 'cheek');
  if (cheek) {
    cheek.x = 882 + s.headTurn * 4;
    cheek.y = 398 + s.bodyRoll * 4;
  }
}

export function resolveDesiredRestingArmPose(
  sim: GameSimulation,
  pose: Pick<HumanPose, 'shoulderX' | 'shoulderY' | 'breath' | 'headX' | 'headY'>
): {
  targetHandX: number;
  targetHandY: number;
  fingerCurl: number;
  rotOffset: number;
  bendDir: 1 | -1;
} {
  const s = sim.sleeper;
  const m = sim.mosquito;
  const t = sim.elapsedTime;

  const baseHandX = 635;
  const baseHandY = 492 - pose.breath * 1.8;

  if (
    sim.subPhase === 'sleep' &&
    s.scratchTargetId &&
    (s.scratchWindupTimer > 0 || s.scratchActiveTimer > 0)
  ) {
    const target = sim.targets.find((item) => item.id === s.scratchTargetId);
    if (target) {
      if (s.scratchWindupTimer > 0) {
        const w = 1 - clamp(s.scratchWindupTimer / 0.65, 0, 1);
        const reach = easeInOutSine(w);
        return {
          targetHandX: baseHandX + (target.x + 10 - baseHandX) * reach,
          targetHandY: baseHandY + (target.y - 24 - baseHandY) * reach,
          fingerCurl: 0.65 * reach,
          rotOffset: -0.35 * reach,
          bendDir: -1,
        };
      } else {
        const swipe = Math.sin(t * 28) * 16;
        return {
          targetHandX: target.x + swipe,
          targetHandY: target.y - 6 + Math.cos(t * 24) * 6,
          fingerCurl: 0.75,
          rotOffset: -0.22 + Math.sin(t * 26) * 0.22,
          bendDir: -1,
        };
      }
    }
  }

  if (sim.subPhase === 'sleep' && s.sleepBehavior !== 'idle') {
    const b = s.behaviorBlend;
    if (s.sleepBehavior === 'nose_scratch') {
      const wiggle = Math.sin(t * 16) * 5 * b;
      return {
        targetHandX: baseHandX + (pose.headX - 24 - baseHandX) * b + wiggle,
        targetHandY: baseHandY + (pose.headY + 6 - baseHandY) * b,
        fingerCurl: 0.72 * b,
        rotOffset: -0.4 * b,
        bendDir: -1,
      };
    }
    if (s.sleepBehavior === 'blanket_tug') {
      return {
        targetHandX: baseHandX + (818 - baseHandX) * b,
        targetHandY: baseHandY + (438 - s.blanketTugAmount * 14 - baseHandY) * b,
        fingerCurl: 0.85 * b,
        rotOffset: 0.25 * b,
        bendDir: -1,
      };
    }
    if (s.sleepBehavior === 'arm_shift') {
      return {
        targetHandX: baseHandX + 28 * b,
        targetHandY: baseHandY - 20 * b,
        fingerCurl: 0.35 + 0.2 * b,
        rotOffset: -0.15 * b,
        bendDir: -1,
      };
    }
  }

  const nearMosquito = distance(m.x, m.y, 760, 440) < 220;
  const microTwitchX =
    s.mood === 'stirring'
      ? Math.sin(t * 15) * 6
      : nearMosquito
        ? Math.sin(t * 9) * 2.5
        : Math.sin(t * 1.4) * 2;
  const microTwitchY =
    s.mood === 'stirring'
      ? -12 + Math.cos(t * 12) * 4
      : nearMosquito
        ? -3 + Math.cos(t * 8) * 2
        : 0;
  const fingerTwitch =
    s.mood === 'stirring'
      ? 0.55 + Math.sin(t * 14) * 0.25
      : nearMosquito
        ? 0.35 + Math.sin(t * 8) * 0.2
        : 0.25 + Math.sin(t * 1.2) * 0.08;

  return {
    targetHandX: baseHandX + microTwitchX,
    targetHandY: baseHandY + microTwitchY,
    fingerCurl: fingerTwitch,
    rotOffset: REST_WRIST_ANGLE + (s.mood === 'stirring' ? Math.sin(t * 13) * 0.14 : 0),
    bendDir: -1,
  };
}
