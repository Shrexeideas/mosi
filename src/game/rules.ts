import type {
  AchievementId,
  ComedyConditionId,
  FoodSource,
  GameOutcome,
  GamePhase,
  GameSimulation,
  HudSnapshot,
  InputState,
  SipTarget,
  SleeperArchetype,
  SwatVariation,
  TargetId,
  UpgradeId,
} from './types';
import { ACHIEVEMENTS, COMEDY_CONDITIONS } from './upgrades';
import {
  REST_ELBOW_ANGLE,
  REST_UPPER_ANGLE,
  REST_WRIST_ANGLE,
  computeArmFromAngles,
  computeHumanPose,
  easeInCubic,
  easeInOutSine,
  easeInQuart,
  easeOutCubic,
  getSwatVariationSpec,
  pickSwatVariation,
  resolveDesiredRestingArmPose,
  solveSwatTargetAngles,
  solveTwoBoneArmIK,
  updateHumanAnimation,
} from './humanAnim';

export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 800;

export const GAME_DURATION = 60;
export const FEAST_GOAL = 100;
export const ESCAPE_DURATION = 15;

export const MOSQUITO_SPAWN_X = 275;
export const MOSQUITO_SPAWN_Y = 270;

export const WINDOW_ESCAPE_ZONE = {
  x: 172,
  y: 268,
  radius: 78,
};

export const FLIGHT_BOUNDS = {
  minX: 48,
  maxX: WORLD_WIDTH - 48,
  minY: 58,
  maxY: WORLD_HEIGHT - 84,
};

export const SLEEPER_EAR_X = 915;
export const SLEEPER_EAR_Y = 395;

export const SWAT_WINDUP_DURATION = 0.72;
export const HUNTER_WINDUP_DURATION = 0.56;
export const SWAT_STRIKE_DURATION = 0.16;
export const SWAT_COOLDOWN_DURATION = 0.58;
export const SWAT_HIT_RADIUS = 44;
export const SWAT_NEAR_MISS_RADIUS = 128;
export const SWAT_THREAT_RADIUS = 155;

export const DASH_DURATION = 0.18;
export const DASH_COOLDOWN = 0.85;
export const DASH_SPEED = 660;
export const MAX_FLIGHT_SPEED = 320;

export interface SimulationOptions {
  roundNumber?: number;
  unlockedUpgrades?: UpgradeId[];
  knownAchievements?: AchievementId[];
  archetype?: SleeperArchetype;
  alarmDuration?: number;
  rng?: () => number;
}

export function createInitialTargets(): SipTarget[] {
  return [
    {
      id: 'foot',
      label: 'Ankle',
      x: 470,
      y: 500,
      radius: 60,
      sipRate: 10.5,
      tensionRate: 17,
      scorePerTick: 12,
      cooldown: 0,
    },
    {
      id: 'forearm',
      label: 'Forearm',
      x: 695,
      y: 458,
      radius: 60,
      sipRate: 13.5,
      tensionRate: 24,
      scorePerTick: 16,
      cooldown: 0,
    },
    {
      id: 'cheek',
      label: 'Cheek',
      x: 882,
      y: 398,
      radius: 56,
      sipRate: 16.5,
      tensionRate: 33,
      scorePerTick: 22,
      cooldown: 0,
    },
  ];
}

export function createBedroomFoods(rng: () => number = Math.random): FoodSource[] {
  const juiceOnSill = rng() < 0.5;
  return [
    {
      id: 'juice',
      kind: 'juice_glass',
      label: 'Juice Glass',
      x: juiceOnSill ? 268 : 1172,
      y: juiceOnSill ? 420 : 458,
      radius: 52,
      amount: 100,
      energyRate: 28,
    },
    {
      id: 'fruit',
      kind: 'fruit_scrap',
      label: 'Apple Scrap',
      x: 215 + Math.round(rng() * 45),
      y: 696,
      radius: 52,
      amount: 100,
      energyRate: 24,
    },
    {
      id: 'spill',
      kind: 'soda_spill',
      label: 'Sweet Spill',
      x: 540 + Math.round(rng() * 140),
      y: 734,
      radius: 54,
      amount: 100,
      energyRate: 26,
    },
  ];
}

function pickArchetype(rng: () => number): SleeperArchetype {
  const roll = rng();
  if (roll < 0.34) return 'deep_snorer';
  if (roll < 0.68) return 'twitchy';
  return 'light_sleeper';
}

function pickAlarmDuration(roundNumber: number, rng: () => number): number {
  const roundDrop = Math.min(8, (roundNumber - 1) * 1.5);
  const minDur = Math.max(36, 46 - roundDrop);
  const maxDur = Math.max(44, 56 - roundDrop);
  return Math.round(minDur + rng() * (maxDur - minDur));
}

export function createSimulation(
  bestScore = 0,
  phase: GamePhase = 'title',
  options: SimulationOptions = {}
): GameSimulation {
  const rng = options.rng ?? Math.random;
  const roundNumber = Math.max(1, options.roundNumber ?? 1);
  const unlockedUpgrades = [...(options.unlockedUpgrades ?? [])];
  const knownAchievements = [...(options.knownAchievements ?? [])];
  const hasBloodTank = unlockedUpgrades.includes('blood_tank');
  const maxEnergy = hasBloodTank ? 125 : 100;
  const alarmDuration = options.alarmDuration ?? pickAlarmDuration(roundNumber, rng);
  const archetype = options.archetype ?? pickArchetype(rng);

  return {
    phase,
    subPhase: 'sleep',
    outcome: null,
    roundNumber,
    score: 0,
    bestScore,
    evoPointsEarned: 0,
    alarmDuration,
    timeRemaining: alarmDuration,
    escapeTimer: ESCAPE_DURATION,
    alarmTickAccumulator: 0,
    alarmRingPulse: 0,
    lightsOn: false,
    elapsedTime: 0,
    noise: 0,
    nearMissCount: 0,
    nearMissStreak: 0,
    longDistanceCount: 0,
    sipsCompleted: 0,
    foodSipsCompleted: 0,
    hitstopTimer: 0,
    slowMoTimer: 0,
    shakeTrauma: 0,
    koFinishTimer: 0,
    sipScoreAccumulator: 0,
    unlockedUpgrades,
    unlockedAchievementsThisRun: [],
    knownAchievements,
    bannerText: '',
    bannerTimer: 0,
    mosquito: {
      x: MOSQUITO_SPAWN_X,
      y: MOSQUITO_SPAWN_Y,
      vx: 0,
      vy: 0,
      facing: 1,
      tilt: 0,
      wingPhase: 0,
      mood: 'hover',
      bellyFill: 0,
      energy: maxEnergy,
      maxEnergy,
      isSipping: false,
      isDrinkingFood: false,
      sipTargetId: null,
      foodTargetId: null,
      lastSipTargetId: null,
      lastSipX: MOSQUITO_SPAWN_X,
      lastSipY: MOSQUITO_SPAWN_Y,
      greedySipStreak: 0,
      bloatLevel: 0,
      dashTimer: 0,
      dashCooldown: 0,
      panicTimer: 0,
      sneezeLaunchTimer: 0,
      squashX: 1,
      squashY: 1,
    },
    sleeper: {
      archetype,
      mood: 'sleeping',
      tension: 0,
      breathPhase: 0,
      breathRate: 1.35,
      breathDepth: 1,
      twitchTimer: 0,
      swatTimer: 0,
      swatDuration: SWAT_WINDUP_DURATION,
      swatX: 700,
      swatY: 450,
      swatStartX: 632,
      swatStartY: 498,
      swatControlX: 740,
      swatControlY: 340,
      swatVariation: 'downward_slap',
      swatStage: 'none',
      swatSecondStrikeDone: false,
      swatFollowThroughTimer: 0,
      swatImpactSquash: 0,
      swatTorsoLean: 0,
      swatWindupUpper: REST_UPPER_ANGLE,
      swatWindupElbow: REST_ELBOW_ANGLE,
      swatWindupWrist: REST_WRIST_ANGLE,
      swatStrikeStartUpper: REST_UPPER_ANGLE,
      swatStrikeStartElbow: REST_ELBOW_ANGLE,
      swatStrikeStartWrist: REST_WRIST_ANGLE,
      swatImpactUpper: REST_UPPER_ANGLE,
      swatImpactElbow: REST_ELBOW_ANGLE,
      swatImpactWrist: REST_WRIST_ANGLE,
      swatThreatenedMosquito: false,
      swatResolved: false,
      upperArmAngle: REST_UPPER_ANGLE,
      elbowAngle: REST_ELBOW_ANGLE,
      wristAngle: REST_WRIST_ANGLE,
      ...(() => {
        const initArm = computeArmFromAngles(
          828,
          440,
          REST_UPPER_ANGLE,
          REST_ELBOW_ANGLE,
          REST_WRIST_ANGLE
        );
        return {
          shoulderX: 828,
          shoulderY: 440,
          elbowX: initArm.elbowX,
          elbowY: initArm.elbowY,
          wristX: initArm.wristX,
          wristY: initArm.wristY,
          handX: initArm.handX,
          handY: initArm.handY,
          handRotation: initArm.handRotation,
        };
      })(),
      fingerCurl: 0.25,
      alertCount: 0,
      mumbleText: '',
      mumbleTimer: 0,
      sleepBehavior: 'idle',
      behaviorTimer: 0,
      behaviorDuration: 0,
      behaviorCooldown: 2.2,
      behaviorBlend: 0,
      bodyRoll: 0,
      headTurn: 0,
      browFurrow: 0,
      eyeOpenAmount: 0,
      gazeX: -0.3,
      gazeY: 0,
      blanketTugAmount: 0,
      pillowSquash: 0,
      footShiftX: 0,
      footShiftY: 0,
      footFlex: 0,
      biteReactionTimer: 0,
      biteReactionTargetId: null,
      biteReactionX: 0,
      biteReactionY: 0,
      wakeStage: 'asleep',
      wakeStageTimer: 0,
      sitUpAmount: 0,
      headLiftAmount: 0,
      activeConditions: [],
      conditionProgress: 0,
      scratchTargetId: null,
      scratchWindupTimer: 0,
      scratchActiveTimer: 0,
      scratchCooldown: 2.5,
      sneezeChargeTimer: 0,
      sneezeBlastTimer: 0,
      sneezeCooldown: 5,
      feverSweatTimer: 0,
      huntX: 894,
      huntCooldown: 0.9,
    },
    targets: createInitialTargets(),
    foods: createBedroomFoods(rng),
    eventsThisStep: [],
  };
}

export function hasUpgrade(sim: GameSimulation, id: UpgradeId): boolean {
  return sim.unlockedUpgrades.includes(id);
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.hypot(dx, dy);
}

export function findNearestSipTarget(
  x: number,
  y: number,
  targets: SipTarget[]
): SipTarget | null {
  let best: SipTarget | null = null;
  let bestDist = Infinity;
  for (const t of targets) {
    const d = distance(x, y, t.x, t.y);
    if (d <= t.radius && d < bestDist) {
      best = t;
      bestDist = d;
    }
  }
  return best;
}

export function findNearestFoodSource(
  x: number,
  y: number,
  foods: FoodSource[]
): FoodSource | null {
  let best: FoodSource | null = null;
  let bestDist = Infinity;
  for (const f of foods) {
    if (f.amount <= 0) continue;
    const d = distance(x, y, f.x, f.y);
    if (d <= f.radius && d < bestDist) {
      best = f;
      bestDist = d;
    }
  }
  return best;
}

export function computeLongDistanceBonus(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  previousTargetId: TargetId | null,
  newTargetId: TargetId
): number {
  if (previousTargetId === newTargetId) {
    return 0;
  }
  const dist = distance(fromX, fromY, toX, toY);
  if (dist < 170) {
    return 0;
  }
  return Math.round(clamp(dist * 0.22, 45, 160));
}

function pushBanner(sim: GameSimulation, text: string, duration = 2.6): void {
  sim.bannerText = text;
  sim.bannerTimer = duration;
}

function grantAchievement(sim: GameSimulation, id: AchievementId): void {
  if (
    sim.knownAchievements.includes(id) ||
    sim.unlockedAchievementsThisRun.includes(id)
  ) {
    return;
  }
  sim.unlockedAchievementsThisRun.push(id);
  sim.knownAchievements.push(id);
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  const title = def ? def.title : id;
  sim.evoPointsEarned += 10;
  sim.eventsThisStep.push({ type: 'achievement', id, title });
  pushBanner(sim, `Achievement: ${title}! (+10 Evo)`, 3.1);
}

function getArchetypeModifiers(archetype: SleeperArchetype): {
  tensionMult: number;
  scoreMult: number;
  scratchChanceMult: number;
} {
  switch (archetype) {
    case 'deep_snorer':
      return { tensionMult: 0.84, scoreMult: 1, scratchChanceMult: 0.75 };
    case 'twitchy':
      return { tensionMult: 1.04, scoreMult: 1.1, scratchChanceMult: 1.55 };
    case 'light_sleeper':
      return { tensionMult: 1.22, scoreMult: 1.2, scratchChanceMult: 1.05 };
  }
}

export function stepSimulation(
  sim: GameSimulation,
  input: InputState,
  rawDt: number
): void {
  sim.eventsThisStep = [];
  const dt = Math.min(Math.max(rawDt, 0), 0.05);

  if (sim.phase === 'title') {
    sim.sleeper.breathPhase += dt * 1.35;
    sim.mosquito.wingPhase += dt * 42;
    const titlePose = computeHumanPose(sim);
    const titleArm = computeArmFromAngles(
      titlePose.shoulderX,
      titlePose.shoulderY,
      REST_UPPER_ANGLE + Math.sin(sim.sleeper.breathPhase) * 0.015,
      REST_ELBOW_ANGLE,
      REST_WRIST_ANGLE
    );
    sim.sleeper.upperArmAngle = REST_UPPER_ANGLE;
    sim.sleeper.elbowAngle = REST_ELBOW_ANGLE;
    sim.sleeper.wristAngle = REST_WRIST_ANGLE;
    sim.sleeper.shoulderX = titlePose.shoulderX;
    sim.sleeper.shoulderY = titlePose.shoulderY;
    sim.sleeper.elbowX = titleArm.elbowX;
    sim.sleeper.elbowY = titleArm.elbowY;
    sim.sleeper.wristX = titleArm.wristX;
    sim.sleeper.wristY = titleArm.wristY;
    sim.sleeper.handX = titleArm.handX;
    sim.sleeper.handY = titleArm.handY;
    sim.sleeper.handRotation = titleArm.handRotation;
    return;
  }

  if (sim.phase === 'paused') {
    return;
  }

  // Visual timers tick in real dt
  sim.shakeTrauma = Math.max(0, sim.shakeTrauma - dt * 1.85);
  sim.alarmRingPulse = Math.max(0, sim.alarmRingPulse - dt * 0.65);
  if (sim.bannerTimer > 0) {
    sim.bannerTimer = Math.max(0, sim.bannerTimer - dt);
    if (sim.bannerTimer <= 0) {
      sim.bannerText = '';
    }
  }
  if (sim.mosquito.panicTimer > 0) {
    sim.mosquito.panicTimer = Math.max(0, sim.mosquito.panicTimer - dt);
  }
  if (sim.mosquito.sneezeLaunchTimer > 0) {
    sim.mosquito.sneezeLaunchTimer = Math.max(0, sim.mosquito.sneezeLaunchTimer - dt);
  }
  if (sim.sleeper.mumbleTimer > 0) {
    sim.sleeper.mumbleTimer = Math.max(0, sim.sleeper.mumbleTimer - dt);
  }

  // Recover squash & stretch smoothly
  sim.mosquito.squashX += (1 - sim.mosquito.squashX) * Math.min(1, dt * 14);
  sim.mosquito.squashY += (1 - sim.mosquito.squashY) * Math.min(1, dt * 14);

  if (sim.phase === 'gameover') {
    sim.mosquito.wingPhase += dt * 8;
    return;
  }

  // Handle swatted KO beat before transitioning to gameover
  if (sim.koFinishTimer > 0) {
    sim.koFinishTimer = Math.max(0, sim.koFinishTimer - dt);
    sim.mosquito.x += sim.mosquito.vx * dt;
    sim.mosquito.y += sim.mosquito.vy * dt;
    sim.mosquito.vy += 640 * dt;
    sim.mosquito.tilt += dt * 16;
    sim.mosquito.mood = 'swatted';
    if (sim.koFinishTimer <= 0) {
      finishGame(sim, 'swatted');
    }
    return;
  }

  // Hitstop freezes physics briefly while real timers above keep running
  if (sim.hitstopTimer > 0) {
    sim.hitstopTimer = Math.max(0, sim.hitstopTimer - dt);
    return;
  }

  let timeScale = 1;
  if (sim.slowMoTimer > 0) {
    sim.slowMoTimer = Math.max(0, sim.slowMoTimer - dt);
    timeScale = 0.45;
  }
  const simDt = dt * timeScale;
  sim.elapsedTime += simDt;

  // Alarm countdown & wake-up transition
  if (sim.subPhase === 'sleep') {
    sim.timeRemaining = Math.max(0, sim.timeRemaining - simDt);

    if (sim.timeRemaining > 0 && sim.timeRemaining <= 18) {
      const tickInterval =
        sim.timeRemaining <= 3 ? 0.25 : sim.timeRemaining <= 7 ? 0.5 : 1.0;
      sim.alarmTickAccumulator += simDt;
      if (sim.alarmTickAccumulator >= tickInterval) {
        sim.alarmTickAccumulator -= tickInterval;
        const urgency = clamp((18 - sim.timeRemaining) / 18, 0, 1);
        sim.eventsThisStep.push({ type: 'alarm_tick', urgency });
      }
    }

    if (sim.timeRemaining <= 0 && sim.mosquito.bellyFill < FEAST_GOAL) {
      triggerAlarmWakeUp(sim);
    }
  } else {
    // Wake-up & escape countdown
    sim.escapeTimer = Math.max(0, sim.escapeTimer - simDt);
    if (sim.escapeTimer <= 0) {
      sim.eventsThisStep.push({ type: 'dawn' });
      finishGame(sim, 'dawn');
      return;
    }
  }

  for (const t of sim.targets) {
    if (t.cooldown > 0) {
      t.cooldown = Math.max(0, t.cooldown - simDt);
    }
  }

  const m = sim.mosquito;
  const s = sim.sleeper;
  const arch = getArchetypeModifiers(s.archetype);
  const roundSpeedScale = 1 + Math.min(0.24, (sim.roundNumber - 1) * 0.04);

  const wingsUpgrade = hasUpgrade(sim, 'turbo_wings');
  const proboscisUpgrade = hasUpgrade(sim, 'mega_proboscis');
  const ninjaUpgrade = hasUpgrade(sim, 'ninja_mosquito');
  const tankUpgrade = hasUpgrade(sim, 'blood_tank');
  const dashUpgrade = hasUpgrade(sim, 'emergency_dash');

  if (m.dashCooldown > 0) {
    m.dashCooldown = Math.max(0, m.dashCooldown - simDt);
  }

  // Compute movement vector from keyboard + optional pointer steering
  let dirX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dirY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  let throttle = 1;

  if (dirX === 0 && dirY === 0 && input.pointerActive) {
    const dx = input.pointerWorldX - m.x;
    const dy = input.pointerWorldY - m.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 10) {
      dirX = dx / dist;
      dirY = dy / dist;
      throttle = clamp((dist - 10) / 140, 0.25, 1);
    }
  } else if (dirX !== 0 || dirY !== 0) {
    const len = Math.hypot(dirX, dirY);
    dirX /= len;
    dirY /= len;
  }

  // Dash trigger
  if (
    input.dashJustPressed &&
    m.dashCooldown <= 0 &&
    m.dashTimer <= 0 &&
    m.sneezeLaunchTimer <= 0
  ) {
    const dashSpeedMult = dashUpgrade ? 1.18 : 1;
    const lowEnergyFactor = m.energy >= 8 ? 1 : 0.78;
    m.dashTimer = DASH_DURATION;
    m.dashCooldown = DASH_COOLDOWN * (dashUpgrade ? 0.68 : 1);
    m.energy = Math.max(0, m.energy - 11);
    m.bloatLevel = Math.max(0, m.bloatLevel - 0.25);
    m.greedySipStreak = 0;
    m.isSipping = false;
    m.isDrinkingFood = false;
    m.sipTargetId = null;
    m.foodTargetId = null;
    const dashDirX = dirX !== 0 || dirY !== 0 ? dirX : m.facing;
    const dashDirY = dirX !== 0 || dirY !== 0 ? dirY : -0.15;
    const norm = Math.hypot(dashDirX, dashDirY) || 1;
    m.vx = (dashDirX / norm) * DASH_SPEED * dashSpeedMult * lowEnergyFactor;
    m.vy = (dashDirY / norm) * DASH_SPEED * dashSpeedMult * lowEnergyFactor;
    m.squashX = 1.32;
    m.squashY = 0.74;
    const noiseBump = ninjaUpgrade ? 12 : 18;
    sim.noise = clamp(sim.noise + noiseBump, 0, 100);
    sim.eventsThisStep.push({ type: 'dash' });
  }

  const nearbyTarget =
    sim.subPhase === 'sleep' ? findNearestSipTarget(m.x, m.y, sim.targets) : null;
  const nearbyFood = findNearestFoodSource(m.x, m.y, sim.foods);

  const wantsToSipBlood =
    input.sipHeld &&
    nearbyTarget !== null &&
    m.dashTimer <= 0 &&
    m.sneezeLaunchTimer <= 0 &&
    sim.subPhase === 'sleep';

  const wantsToSipFood =
    !wantsToSipBlood &&
    input.sipHeld &&
    nearbyFood !== null &&
    m.dashTimer <= 0 &&
    m.sneezeLaunchTimer <= 0;

  if (wantsToSipBlood && nearbyTarget) {
    const wasSippingSame = m.isSipping && m.sipTargetId === nearbyTarget.id;
    m.isSipping = true;
    m.isDrinkingFood = false;
    m.sipTargetId = nearbyTarget.id;
    m.foodTargetId = null;

    // Gentle magnetic settle onto skin landing spot
    const settleX = nearbyTarget.x;
    const settleY = nearbyTarget.y - 10;
    m.x += (settleX - m.x) * Math.min(1, simDt * 12);
    m.y += (settleY - m.y) * Math.min(1, simDt * 12);
    m.vx *= Math.pow(0.02, simDt);
    m.vy *= Math.pow(0.02, simDt);
    m.facing = nearbyTarget.x >= m.x ? 1 : -1;
    m.tilt += (0.28 * m.facing - m.tilt) * Math.min(1, simDt * 10);

    if (!wasSippingSame) {
      m.squashX = 1.24;
      m.squashY = 0.76;
      sim.eventsThisStep.push({ type: 'land', targetId: nearbyTarget.id });

      const bonus = computeLongDistanceBonus(
        m.lastSipX,
        m.lastSipY,
        nearbyTarget.x,
        nearbyTarget.y,
        m.lastSipTargetId,
        nearbyTarget.id
      );
      if (bonus > 0) {
        sim.score += bonus;
        sim.evoPointsEarned += 3;
        sim.longDistanceCount += 1;
        sim.eventsThisStep.push({
          type: 'long_distance',
          bonus,
          x: nearbyTarget.x,
          y: nearbyTarget.y - 36,
        });
      }
      m.lastSipTargetId = nearbyTarget.id;
      m.lastSipX = nearbyTarget.x;
      m.lastSipY = nearbyTarget.y;
    }

    // Fill belly, energy, evolution points & score
    const sipRateMult = proboscisUpgrade ? 1.3 : 1;
    const scoreMult = (proboscisUpgrade ? 1.25 : 1) * arch.scoreMult;
    const feastGain = nearbyTarget.sipRate * sipRateMult * simDt;
    const prevBelly = m.bellyFill;
    m.bellyFill = clamp(m.bellyFill + feastGain, 0, FEAST_GOAL);
    m.energy = clamp(m.energy + 18 * simDt, 0, m.maxEnergy);

    // Greedy bloated buildup when drinking continuously too long or past 72% belly
    m.greedySipStreak += simDt;
    if (m.greedySipStreak >= 2.8 || m.bellyFill >= 74) {
      const wasHeavy = m.bloatLevel >= 0.55;
      m.bloatLevel = clamp(m.bloatLevel + 0.34 * simDt, 0, 1);
      if (!wasHeavy && m.bloatLevel >= 0.55) {
        sim.eventsThisStep.push({ type: 'bloated', x: m.x, y: m.y - 24 });
        pushBanner(sim, 'SO CHONKY! Flying got heavy — dash to burn it off!', 2.8);
        grantAchievement(sim, 'greedy_balloon');
      }
    }

    // Evolution points from real blood (main source!)
    const gainedBellies = Math.floor(m.bellyFill / 3) - Math.floor(prevBelly / 3);
    if (gainedBellies > 0) {
      sim.evoPointsEarned += gainedBellies * (proboscisUpgrade ? 2 : 1);
    }

    // Build comedy condition progress
    s.conditionProgress += feastGain * 1.18;
    if (s.conditionProgress >= 30 && s.activeConditions.length < 3) {
      s.conditionProgress -= 30;
      triggerNextComedyCondition(sim);
    }

    sim.sipScoreAccumulator += nearbyTarget.scorePerTick * scoreMult * simDt * 6;
    if (sim.sipScoreAccumulator >= 5) {
      const gained = Math.floor(sim.sipScoreAccumulator);
      sim.sipScoreAccumulator -= gained;
      sim.score += gained;
      sim.sipsCompleted += 1;
      sim.eventsThisStep.push({
        type: 'sip_tick',
        x: m.x,
        y: m.y - 16,
      });
    }

    // Sipping builds sleeper tension directly (extra penalty if staying bloated!)
    const ninjaCalm = ninjaUpgrade ? 0.78 : 1;
    const greedTensionMult = m.greedySipStreak > 2.5 ? 1.28 : 1;
    s.tension = clamp(
      s.tension +
        nearbyTarget.tensionRate *
          arch.tensionMult *
          ninjaCalm *
          greedTensionMult *
          roundSpeedScale *
          simDt,
      0,
      100
    );
    sim.noise = clamp(sim.noise + 9 * (ninjaUpgrade ? 0.68 : 1) * simDt, 0, 100);
    m.mood = m.bloatLevel >= 0.55 ? 'bloated' : 'sipping';
    m.wingPhase += simDt * 22;

    if (m.bellyFill >= FEAST_GOAL) {
      sim.score += Math.round(sim.timeRemaining * 15);
      sim.evoPointsEarned += 15;
      sim.eventsThisStep.push({ type: 'victory' });
      finishGame(sim, 'victory');
      return;
    }
  } else if (wantsToSipFood && nearbyFood) {
    // Sipping alternative bedroom food (emergency energy, no noise/tension!)
    const wasSameFood = m.isDrinkingFood && m.foodTargetId === nearbyFood.id;
    m.isSipping = false;
    m.isDrinkingFood = true;
    m.sipTargetId = null;
    m.foodTargetId = nearbyFood.id;
    m.greedySipStreak = Math.max(0, m.greedySipStreak - simDt * 1.5);
    m.bloatLevel = Math.max(0, m.bloatLevel - 0.14 * simDt);

    const settleX = nearbyFood.x;
    const settleY = nearbyFood.y - 12;
    m.x += (settleX - m.x) * Math.min(1, simDt * 12);
    m.y += (settleY - m.y) * Math.min(1, simDt * 12);
    m.vx *= Math.pow(0.02, simDt);
    m.vy *= Math.pow(0.02, simDt);
    m.facing = nearbyFood.x >= m.x ? 1 : -1;

    if (!wasSameFood) {
      m.squashX = 1.18;
      m.squashY = 0.82;
      grantAchievement(sim, 'juice_goblin');
    }

    const drain = Math.min(nearbyFood.amount, 16 * simDt);
    nearbyFood.amount = Math.max(0, nearbyFood.amount - drain);
    m.energy = clamp(m.energy + nearbyFood.energyRate * simDt, 0, m.maxEnergy);

    sim.sipScoreAccumulator += 22 * simDt;
    if (sim.sipScoreAccumulator >= 5) {
      const gained = Math.floor(sim.sipScoreAccumulator);
      sim.sipScoreAccumulator -= gained;
      sim.score += gained;
      sim.foodSipsCompleted += 1;
      sim.eventsThisStep.push({ type: 'food_sip', x: m.x, y: m.y - 14 });
    }

    // Quietly cools noise & tension away from human
    sim.noise = clamp(sim.noise - 24 * simDt, 0, 100);
    if (s.tension < 100 && (s.mood === 'sleeping' || s.mood === 'stirring')) {
      s.tension = clamp(s.tension - 14 * simDt, 0, 100);
    }
    m.mood = 'sipping';
    m.wingPhase += simDt * 20;
  } else {
    m.isSipping = false;
    m.isDrinkingFood = false;
    m.sipTargetId = null;
    m.foodTargetId = null;
    m.greedySipStreak = Math.max(0, m.greedySipStreak - simDt * 1.8);
    m.bloatLevel = Math.max(0, m.bloatLevel - 0.22 * simDt);

    if (m.dashTimer > 0) {
      m.dashTimer = Math.max(0, m.dashTimer - simDt);
      m.x += m.vx * simDt;
      m.y += m.vy * simDt;
      m.vx *= Math.pow(0.42, simDt);
      m.vy *= Math.pow(0.42, simDt);
      m.mood = 'dash';
      m.wingPhase += simDt * 95;
    } else if (m.sneezeLaunchTimer > 0) {
      // Comedy wind launch across bedroom from sneeze
      m.x += m.vx * simDt;
      m.y += m.vy * simDt;
      m.vx *= Math.pow(0.35, simDt);
      m.vy += 120 * simDt;
      m.mood = 'panicked';
      m.wingPhase += simDt * 85;
    } else {
      const speedUpgradeMult = wingsUpgrade ? 1.18 : 1;
      const bloatPenalty = m.bloatLevel * (tankUpgrade ? 0.17 : 0.28);
      const hungryPenalty = m.energy < 18 ? 0.85 : 1;
      const effectiveMaxSpeed =
        MAX_FLIGHT_SPEED * speedUpgradeMult * (1 - bloatPenalty) * hungryPenalty;
      const accel = wingsUpgrade ? 1900 : 1550;
      const targetVx = dirX * effectiveMaxSpeed * throttle;
      const targetVy = dirY * effectiveMaxSpeed * throttle;

      if (dirX !== 0 || dirY !== 0) {
        m.vx +=
          (targetVx - m.vx) *
          Math.min(1, (accel / effectiveMaxSpeed) * simDt * 1.45);
        m.vy +=
          (targetVy - m.vy) *
          Math.min(1, (accel / effectiveMaxSpeed) * simDt * 1.45);
      } else {
        const drag = Math.pow(0.015, simDt);
        m.vx *= drag;
        m.vy *= drag;
        if (m.bloatLevel >= 0.55) {
          // Chubby mosquito sinks slightly while hovering
          m.vy += 42 * m.bloatLevel * simDt;
        }
      }

      m.x += m.vx * simDt;
      m.y += m.vy * simDt;

      const speed = Math.hypot(m.vx, m.vy);
      // Gentle flight energy consumption
      const energyDrain = speed > 190 ? 2.5 : speed > 25 ? 0.6 : 0.25;
      m.energy = Math.max(0, m.energy - energyDrain * simDt);

      if (m.panicTimer > 0) {
        m.mood = 'panicked';
      } else if (m.bloatLevel >= 0.55) {
        m.mood = 'bloated';
      } else if (speed > 210) {
        m.mood = 'fast';
      } else if (speed > 35) {
        m.mood = 'stealth';
      } else {
        m.mood = 'hover';
      }
      m.wingPhase += simDt * (38 + speed * 0.16);
    }

    if (Math.abs(m.vx) > 16) {
      m.facing = m.vx >= 0 ? 1 : -1;
    }
    const desiredTilt = clamp(m.vx / 480, -0.45, 0.45);
    m.tilt += (desiredTilt - m.tilt) * Math.min(1, simDt * 12);

    // Clamp mosquito inside bedroom airspace
    if (m.x < FLIGHT_BOUNDS.minX) {
      m.x = FLIGHT_BOUNDS.minX;
      m.vx = Math.max(0, m.vx);
    } else if (m.x > FLIGHT_BOUNDS.maxX) {
      m.x = FLIGHT_BOUNDS.maxX;
      m.vx = Math.min(0, m.vx);
    }
    if (m.y < FLIGHT_BOUNDS.minY) {
      m.y = FLIGHT_BOUNDS.minY;
      m.vy = Math.max(0, m.vy);
    } else if (m.y > FLIGHT_BOUNDS.maxY) {
      m.y = FLIGHT_BOUNDS.maxY;
      m.vy = Math.min(0, m.vy);
    }

    // Check window escape during wake-up chase
    if (
      sim.subPhase === 'escape' &&
      distance(m.x, m.y, WINDOW_ESCAPE_ZONE.x, WINDOW_ESCAPE_ZONE.y) <=
        WINDOW_ESCAPE_ZONE.radius
    ) {
      const escapeBonus =
        140 + Math.round(m.bellyFill * 4.5) + Math.round(sim.escapeTimer * 16);
      sim.score += escapeBonus;
      sim.evoPointsEarned += 12 + Math.floor(m.bellyFill / 12);
      grantAchievement(sim, 'alarm_dodger');
      sim.eventsThisStep.push({ type: 'escaped' });
      finishGame(sim, 'escaped');
      return;
    }

    // Noise calculation based on flight speed & ear proximity
    const speed = Math.hypot(m.vx, m.vy);
    const earDist = distance(m.x, m.y, SLEEPER_EAR_X, SLEEPER_EAR_Y);
    const proximityFactor = earDist < 240 ? 1 + (1 - earDist / 240) * 1.45 : 0.75;
    const ninjaNoiseMult = ninjaUpgrade ? 0.68 : 1;

    if (speed > 175) {
      const excess = (speed - 175) / 145;
      sim.noise = clamp(
        sim.noise + excess * 28 * proximityFactor * ninjaNoiseMult * simDt,
        0,
        100
      );
    } else if (earDist < 130 && speed > 30) {
      sim.noise = clamp(sim.noise + 14 * ninjaNoiseMult * simDt, 0, 100);
    } else {
      const coolRate = earDist > 360 ? 28 : 19;
      sim.noise = clamp(sim.noise - coolRate * simDt, 0, 100);
    }

    // Noise above threshold pushes sleeper tension up; quiet lets tension calm down
    if (
      sim.subPhase === 'sleep' &&
      sim.noise >= 46 &&
      s.mood !== 'windup' &&
      s.mood !== 'strike' &&
      s.mood !== 'cooldown'
    ) {
      const ninjaCalm = ninjaUpgrade ? 0.78 : 1;
      const noisePush =
        ((sim.noise - 46) / 54) * 28 * proximityFactor * arch.tensionMult * ninjaCalm;
      s.tension = clamp(s.tension + noisePush * simDt, 0, 100);
    } else if (
      sim.subPhase === 'sleep' &&
      (s.mood === 'sleeping' || s.mood === 'stirring') &&
      s.tension < 100
    ) {
      const relaxRate = earDist > 340 ? 18 : 10;
      s.tension = clamp(s.tension - relaxRate * simDt, 0, 100);
    }
  }

  // Update comedy condition behaviors (scratching, fever sweats, sneeze blasts)
  if (sim.subPhase === 'sleep') {
    updateComedyConditions(sim, simDt, arch.scratchChanceMult);
  }

  // Natural breathing, sleep behaviors, mosquito awareness & wake-up sequence
  updateHumanAnimation(sim, simDt);

  // Sleeper state machine & swatting signature mechanic (plus awake hunting!)
  updateSleeperAndSwat(sim, simDt, roundSpeedScale);
}

function triggerNextComedyCondition(sim: GameSimulation): void {
  const s = sim.sleeper;
  const order: ComedyConditionId[] =
    s.archetype === 'twitchy'
      ? ['itchy_elbow', 'sneezing_disorder', 'dramatic_fever']
      : s.archetype === 'light_sleeper'
        ? ['dramatic_fever', 'itchy_elbow', 'sneezing_disorder']
        : ['sneezing_disorder', 'itchy_elbow', 'dramatic_fever'];

  const next = order.find((c) => !s.activeConditions.includes(c));
  if (!next) return;

  s.activeConditions.push(next);
  const meta = COMEDY_CONDITIONS[next];
  s.mumbleText = meta.quips[0];
  s.mumbleTimer = 2.0;
  sim.score += 55;
  sim.evoPointsEarned += 4;
  sim.eventsThisStep.push({
    type: 'condition_triggered',
    condition: next,
    x: SLEEPER_EAR_X - 24,
    y: SLEEPER_EAR_Y - 58,
  });
  pushBanner(sim, `Inflicted: ${meta.label}!`, 2.6);

  if (next === 'itchy_elbow') {
    s.scratchCooldown = 0.25;
  } else if (next === 'sneezing_disorder') {
    s.sneezeCooldown = 0.6;
  }

  if (s.activeConditions.length >= 3) {
    grantAchievement(sim, 'mad_scientist');
  }
}

function updateComedyConditions(
  sim: GameSimulation,
  simDt: number,
  scratchChanceMult: number
): void {
  const s = sim.sleeper;
  const m = sim.mosquito;

  // Dramatic Fever periodic sweats
  if (s.activeConditions.includes('dramatic_fever')) {
    s.feverSweatTimer -= simDt;
    if (s.feverSweatTimer <= 0) {
      s.feverSweatTimer = 1.6;
      if (s.mood === 'sleeping' && s.mumbleTimer <= 0) {
        const quips = COMEDY_CONDITIONS.dramatic_fever.quips;
        s.mumbleText = quips[Math.floor(sim.elapsedTime) % quips.length];
        s.mumbleTimer = 1.4;
      }
    }
  }

  // Itchy Elbow / Twitchy scratch interrupt
  if (s.scratchWindupTimer > 0) {
    s.scratchWindupTimer -= simDt;
    if (s.scratchWindupTimer <= 0) {
      s.scratchActiveTimer = 0.52;
      const target = sim.targets.find((t) => t.id === s.scratchTargetId);
      if (target && distance(m.x, m.y, target.x, target.y) <= 72) {
        // Flick the mosquito away comically!
        m.isSipping = false;
        m.sipTargetId = null;
        m.vx = -290;
        m.vy = -190;
        m.panicTimer = 0.5;
        sim.noise = clamp(sim.noise + 14, 0, 100);
        sim.shakeTrauma = Math.max(sim.shakeTrauma, 0.28);
        s.mumbleText = '*scratch scratch*';
        s.mumbleTimer = 1.1;
        sim.eventsThisStep.push({
          type: 'scratch_flick',
          x: target.x,
          y: target.y - 20,
        });
        pushBanner(sim, 'Human scratched that exact spot!', 2.0);
      }
    }
  } else if (s.scratchActiveTimer > 0) {
    s.scratchActiveTimer = Math.max(0, s.scratchActiveTimer - simDt);
  } else {
    const hasItchy = s.activeConditions.includes('itchy_elbow');
    s.scratchCooldown -= simDt * (hasItchy ? 1.55 : 0.7) * scratchChanceMult;
    if (s.scratchCooldown <= 0 && m.isSipping && m.sipTargetId && s.mood !== 'windup' && s.mood !== 'strike') {
      s.scratchTargetId = m.sipTargetId;
      s.scratchWindupTimer = 0.65;
      s.scratchCooldown = hasItchy ? 4.8 : 7.5;
      s.mumbleText = 'Itchy...';
      s.mumbleTimer = 0.85;
    }
  }

  // Suspicious Sneezing Disorder -> telegraphed ACHOO blast!
  if (s.activeConditions.includes('sneezing_disorder')) {
    if (s.sneezeChargeTimer > 0) {
      s.sneezeChargeTimer -= simDt;
      if (s.sneezeChargeTimer <= 0) {
        s.sneezeBlastTimer = 0.36;
        s.mumbleText = 'ACHOO!!';
        s.mumbleTimer = 1.4;
        sim.shakeTrauma = Math.max(sim.shakeTrauma, 0.58);
        sim.eventsThisStep.push({
          type: 'sneeze_blast',
          x: SLEEPER_EAR_X - 55,
          y: SLEEPER_EAR_Y + 5,
        });

        // Blast mosquito if in front of sleeper
        if (m.x >= 340 && m.x <= 915 && m.y >= 260 && m.y <= 575) {
          m.isSipping = false;
          m.sipTargetId = null;
          m.vx = -640;
          m.vy = -220;
          m.sneezeLaunchTimer = 0.48;
          m.panicTimer = 0.8;
          m.squashX = 1.38;
          m.squashY = 0.68;
          sim.score += 65;
          grantAchievement(sim, 'sneeze_rocket');
          pushBanner(sim, 'SNEEZE ROCKET! Blasted across the room!', 2.4);
        }
      }
    } else if (s.sneezeBlastTimer > 0) {
      s.sneezeBlastTimer = Math.max(0, s.sneezeBlastTimer - simDt);
    } else {
      s.sneezeCooldown -= simDt;
      if (s.sneezeCooldown <= 0 && s.mood !== 'windup' && s.mood !== 'strike') {
        s.sneezeChargeTimer = 1.15;
        s.sneezeCooldown = 8.5;
        s.mumbleText = 'Ah... AH...';
        s.mumbleTimer = 1.15;
      }
    }
  }
}

export function triggerAlarmWakeUp(sim: GameSimulation): void {
  if (sim.subPhase === 'escape') return;
  sim.subPhase = 'escape';
  sim.lightsOn = true;
  sim.escapeTimer = ESCAPE_DURATION;
  sim.alarmRingPulse = 1;
  sim.shakeTrauma = 0.75;
  sim.mosquito.isSipping = false;
  sim.mosquito.sipTargetId = null;
  sim.sleeper.mood = 'awake';
  sim.sleeper.tension = 100;
  sim.sleeper.wakeStage = 'startle';
  sim.sleeper.wakeStageTimer = 0;
  sim.sleeper.sitUpAmount = 0;
  sim.sleeper.headLiftAmount = 0;
  sim.sleeper.sleepBehavior = 'idle';
  sim.sleeper.swatStage = 'none';
  sim.sleeper.swatTorsoLean = 0;
  sim.sleeper.swatImpactSquash = 0;
  sim.sleeper.scratchWindupTimer = 0;
  sim.sleeper.scratchActiveTimer = 0;
  sim.sleeper.huntX = 894;
  sim.sleeper.huntCooldown = 0.45;
  sim.sleeper.mumbleText = 'WHA—?!';
  sim.sleeper.mumbleTimer = 1.6;
  sim.eventsThisStep.push({ type: 'alarm_ring' });
  pushBanner(sim, 'ALARM RANG! Fly to the OPEN WINDOW to escape!', 3.6);
}

function lerpScalar(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

function applyArmFK(
  s: GameSimulation['sleeper'],
  shoulderX: number,
  shoulderY: number,
  upperArmAngle: number,
  elbowAngle: number,
  wristAngle: number,
  fingerCurl: number,
  fingerSmoothAlpha = 1
): void {
  const fk = computeArmFromAngles(
    shoulderX,
    shoulderY,
    upperArmAngle,
    elbowAngle,
    wristAngle
  );
  s.shoulderX = shoulderX;
  s.shoulderY = shoulderY;
  s.upperArmAngle = upperArmAngle;
  s.elbowAngle = elbowAngle;
  s.wristAngle = wristAngle;
  s.elbowX = fk.elbowX;
  s.elbowY = fk.elbowY;
  s.wristX = fk.wristX;
  s.wristY = fk.wristY;
  s.handX = fk.handX;
  s.handY = fk.handY;
  s.handRotation = fk.handRotation;
  s.fingerCurl += (fingerCurl - s.fingerCurl) * clamp(fingerSmoothAlpha, 0, 1);
}

function applyRestingIKViaFK(
  s: GameSimulation['sleeper'],
  shoulderX: number,
  shoulderY: number,
  targetHandX: number,
  targetHandY: number,
  bendDir: 1 | -1,
  rotOffset: number,
  fingerCurl: number,
  smoothAlpha: number
): void {
  const ik = solveTwoBoneArmIK(
    shoulderX,
    shoulderY,
    targetHandX,
    targetHandY,
    undefined,
    undefined,
    bendDir,
    rotOffset
  );
  const alpha = clamp(smoothAlpha, 0, 1);
  const nextUpper = lerpScalar(s.upperArmAngle, ik.upperArmAngle, alpha);
  const nextElbow = lerpScalar(s.elbowAngle, ik.elbowAngle, alpha);
  const nextWrist = lerpScalar(s.wristAngle, ik.wristAngle, alpha);
  applyArmFK(
    s,
    shoulderX,
    shoulderY,
    nextUpper,
    nextElbow,
    nextWrist,
    fingerCurl,
    Math.min(1, alpha * 1.4)
  );
}

function resolveSwatHit(sim: GameSimulation, strictPalmOnly: boolean): boolean {
  const s = sim.sleeper;
  const m = sim.mosquito;
  const handDist = distance(m.x, m.y, s.handX, s.handY);
  const targetDist = distance(m.x, m.y, s.swatX, s.swatY);
  const hitDist = strictPalmOnly ? handDist : Math.min(handDist, targetDist);

  if (hitDist <= SWAT_HIT_RADIUS) {
    sim.hitstopTimer = 0.085;
    sim.shakeTrauma = 0.95;
    sim.koFinishTimer = 0.72;
    m.isSipping = false;
    m.isDrinkingFood = false;
    m.vx = (m.x >= s.handX ? 1 : -1) * 140;
    m.vy = -220;
    m.mood = 'swatted';
    s.mood = 'awake';
    s.mumbleText = 'GOTCHA!';
    s.mumbleTimer = 1.5;
    sim.eventsThisStep.push({ type: 'swatted', x: s.handX, y: s.handY });
    return true;
  }
  return false;
}

function updateSleeperAndSwat(
  sim: GameSimulation,
  simDt: number,
  roundSpeedScale: number
): void {
  const s = sim.sleeper;
  const m = sim.mosquito;
  const pose = computeHumanPose(sim);
  const distToBedCenter = distance(m.x, m.y, 700, 455);

  // Awake hunting mode after alarm rings!
  if (sim.subPhase === 'escape') {
    if (s.wakeStage === 'angry_hunt' || s.wakeStage === 'spot_bug') {
      s.huntX += (clamp(m.x, 380, 960) - s.huntX) * Math.min(1, simDt * 3.0);
    }

    if (s.mood === 'awake') {
      s.swatStage = 'none';
      let guardHandX = pose.shoulderX - 68;
      let guardHandY = pose.shoulderY + 8;
      let curl = 0.55;
      let rotOff = -0.2;

      if (s.wakeStage === 'startle') {
        guardHandX = pose.shoulderX - 58;
        guardHandY = pose.shoulderY - 18;
        curl = 0.1;
      } else if (s.wakeStage === 'blink_open' || s.wakeStage === 'confused') {
        guardHandX = pose.headX - 38;
        guardHandY = pose.headY + 14;
        curl = 0.65;
        if (s.wakeStage === 'confused' && s.mumbleTimer <= 0.2) {
          s.mumbleText = 'Huh...?!';
          s.mumbleTimer = 0.6;
        }
      } else if (s.wakeStage === 'spot_bug') {
        guardHandX = pose.shoulderX - 88;
        guardHandY = pose.shoulderY - 26;
        curl = 0.15;
        s.mumbleText = 'A MOSQUITO?!';
        s.mumbleTimer = 0.85;
      } else if (s.wakeStage === 'angry_hunt') {
        guardHandX = pose.shoulderX - 78 + Math.sin(sim.elapsedTime * 9) * 16;
        guardHandY = pose.shoulderY - 34 + Math.cos(sim.elapsedTime * 7) * 12;
        curl = 0.42;
        rotOff = Math.sin(sim.elapsedTime * 10) * 0.22;

        s.huntCooldown -= simDt * roundSpeedScale;
        if (s.huntCooldown <= 0) {
          startSwatWindup(sim, true);
          return;
        }
      }

      applyRestingIKViaFK(
        s,
        pose.shoulderX,
        pose.shoulderY,
        guardHandX,
        guardHandY,
        -1,
        rotOff,
        curl,
        Math.min(1, simDt * 9)
      );
      return;
    }
    // Fall through to windup/strike/cooldown below during hunt swats!
  }

  if (s.mood === 'sleeping') {
    s.swatStage = 'none';
    const restPose = resolveDesiredRestingArmPose(sim, pose);
    applyRestingIKViaFK(
      s,
      pose.shoulderX,
      pose.shoulderY,
      restPose.targetHandX,
      restPose.targetHandY,
      restPose.bendDir,
      restPose.rotOffset,
      restPose.fingerCurl,
      Math.min(1, simDt * 11)
    );

    if (s.tension >= 38) {
      s.mood = 'stirring';
      s.twitchTimer = 0.45;
      s.mumbleText = 'Hmm...';
      s.mumbleTimer = 1.0;
      sim.eventsThisStep.push({ type: 'stirring' });
    }
  } else if (s.mood === 'stirring') {
    s.swatStage = 'none';
    s.twitchTimer = Math.max(0, s.twitchTimer - simDt);
    const restPose = resolveDesiredRestingArmPose(sim, pose);
    applyRestingIKViaFK(
      s,
      pose.shoulderX,
      pose.shoulderY,
      restPose.targetHandX,
      restPose.targetHandY,
      restPose.bendDir,
      restPose.rotOffset,
      restPose.fingerCurl,
      Math.min(1, simDt * 13)
    );

    if (s.tension >= 100 || (sim.noise >= 92 && distToBedCenter < 310)) {
      startSwatWindup(sim, false);
    } else if (s.tension < 26) {
      s.mood = 'sleeping';
    }
  } else if (s.mood === 'windup') {
    const isHunter = sim.subPhase === 'escape';
    const totalWindup = Math.max(0.05, s.swatDuration);
    s.swatTimer -= simDt;
    const progress = 1 - clamp(s.swatTimer / totalWindup, 0, 1);

    const minX = isHunter ? 280 : 410;
    const maxX = isHunter ? 1050 : 960;
    const minY = isHunter ? 170 : 320;
    const maxY = isHunter ? 620 : 560;

    // Sleepy miss swat tracks sluggishly and commits early so player easily dodges!
    const trackLimit = s.swatVariation === 'sleepy_miss_swat' ? 0.22 : 0.35;
    const trackSpeed = s.swatVariation === 'sleepy_miss_swat' ? 2.6 : 6.5;
    if (progress < trackLimit) {
      s.swatX += (m.x - s.swatX) * Math.min(1, simDt * trackSpeed);
      s.swatY += (m.y - s.swatY) * Math.min(1, simDt * trackSpeed);
      s.swatX = clamp(s.swatX, minX, maxX);
      s.swatY = clamp(s.swatY, minY, maxY);
    }

    if (distance(m.x, m.y, s.swatX, s.swatY) <= SWAT_THREAT_RADIUS) {
      s.swatThreatenedMosquito = true;
      m.panicTimer = 0.25;
    }

    // Continuously align impact joint angles with current torso-lean shoulder position
    const impactAngles = solveSwatTargetAngles(
      pose.shoulderX,
      pose.shoulderY,
      s.swatX,
      s.swatY,
      s.swatVariation
    );
    s.swatImpactUpper = impactAngles.upperArmAngle;
    s.swatImpactElbow = impactAngles.elbowAngle;
    s.swatImpactWrist = impactAngles.wristAngle;

    const spec = getSwatVariationSpec(s.swatVariation);
    const antRatio = spec.anticipationRatio;

    if (progress < antRatio) {
      // STAGE 1: ANTICIPATION — subtle recoil & finger tension before drawing arm back
      s.swatStage = 'anticipation';
      const ap = progress / antRatio;
      const tensionBell = Math.sin(ap * Math.PI);
      const goalUpper = s.swatWindupUpper - 0.14 * tensionBell;
      const goalElbow = s.swatWindupElbow + (impactAngles.bendDir === 1 ? 0.18 : 0.22) * tensionBell;
      const goalWrist = lerpScalar(s.swatWindupWrist, -spec.windupWrist * 0.28, ap);
      applyArmFK(
        s,
        pose.shoulderX,
        pose.shoulderY,
        goalUpper,
        goalElbow,
        goalWrist,
        0.58,
        Math.min(1, simDt * 18)
      );
    } else {
      // STAGE 2: WIND-UP — arm lifts/draws back with elbow bending naturally & wrist cocking
      s.swatStage = 'windup';
      const wp = easeInOutSine((progress - antRatio) / Math.max(0.01, 1 - antRatio));
      const goalUpper = lerpScalar(s.swatWindupUpper, spec.windupUpper, wp);
      const goalElbow = lerpScalar(s.swatWindupElbow, spec.windupElbow, wp);
      const goalWrist = lerpScalar(s.swatWindupWrist, spec.windupWrist, wp);
      applyArmFK(
        s,
        pose.shoulderX,
        pose.shoulderY,
        goalUpper,
        goalElbow,
        goalWrist,
        lerpScalar(0.58, 0.08, wp),
        Math.min(1, simDt * 18)
      );
    }

    if (s.swatTimer <= 0) {
      s.mood = 'strike';
      s.swatStage = 'acceleration';
      s.swatDuration = spec.strikeDuration * (isHunter ? 0.88 : 1);
      s.swatTimer = s.swatDuration;
      s.swatStrikeStartUpper = s.upperArmAngle;
      s.swatStrikeStartElbow = s.elbowAngle;
      s.swatStrikeStartWrist = s.wristAngle;
      s.swatStartX = s.handX;
      s.swatStartY = s.handY;
      s.swatControlX = (s.handX + s.swatX) * 0.5;
      s.swatControlY = Math.min(s.handY, s.swatY) - 42;
      s.swatSecondStrikeDone = false;
      s.swatResolved = false;
      sim.eventsThisStep.push({ type: 'swat_strike', x: s.swatX, y: s.swatY });
    }
  } else if (s.mood === 'strike') {
    const strikeDur = Math.max(0.05, s.swatDuration);
    s.swatTimer -= simDt;
    const progress = 1 - clamp(s.swatTimer / strikeDur, 0, 1);

    const impact1 = solveSwatTargetAngles(
      pose.shoulderX,
      pose.shoulderY,
      s.swatX,
      s.swatY,
      s.swatVariation
    );
    s.swatImpactUpper = impact1.upperArmAngle;
    s.swatImpactElbow = impact1.elbowAngle;
    s.swatImpactWrist = impact1.wristAngle;
    const spec = getSwatVariationSpec(s.swatVariation);
    const deltaForearm =
      impact1.upperArmAngle +
      impact1.elbowAngle -
      (s.swatStrikeStartUpper + s.swatStrikeStartElbow);
    const wristLagDir = deltaForearm >= 0 ? -1 : 1;
    const wristLagAmt = spec.wristLagMag * wristLagDir;

    let upperGoal = impact1.upperArmAngle;
    let elbowGoal = impact1.elbowAngle;
    let wristGoal = 0;
    let fingerGoal = 0.04;
    let inHitWindow = false;
    let strictPalmOnly = false;

    if (s.swatVariation === 'double_slap') {
      const secX = clamp(s.swatX + 46, 420, 1040);
      const secY = clamp(s.swatY - 38, 170, 560);
      const impact2 = solveSwatTargetAngles(
        pose.shoulderX,
        pose.shoulderY,
        secX,
        secY,
        'double_slap'
      );
      const reCockUpper = lerpScalar(impact1.upperArmAngle, spec.windupUpper, 0.42);
      const reCockElbow = lerpScalar(impact1.elbowAngle, spec.windupElbow, 0.48);
      const reCockWrist = spec.windupWrist * 0.72;

      if (progress < 0.40) {
        // Slap #1 Acceleration (upper arm/elbow accelerates smoothly ahead, forearm whips with wrist lag)
        s.swatStage = 'acceleration';
        const t = progress / 0.40;
        const upperT = easeInOutSine(Math.min(1, t * 1.14));
        const elbowT = easeInCubic(t);
        upperGoal = lerpScalar(s.swatStrikeStartUpper, impact1.upperArmAngle, upperT);
        elbowGoal = lerpScalar(s.swatStrikeStartElbow, impact1.elbowAngle, elbowT);
        wristGoal =
          s.swatStrikeStartWrist * (1 - easeInQuart(t)) +
          wristLagAmt * Math.sin(t * Math.PI);
        inHitWindow = t >= 0.85;
      } else if (progress < 0.50) {
        // Slap #1 Impact
        if (s.swatStage !== 'impact') {
          s.swatImpactSquash = Math.max(s.swatImpactSquash, 0.92);
        }
        s.swatStage = 'impact';
        upperGoal = impact1.upperArmAngle;
        elbowGoal = impact1.elbowAngle;
        wristGoal = 0;
        fingerGoal = 0.02;
        inHitWindow = true;
      } else if (progress < 0.66) {
        // Rapid elbow re-cock before slap #2
        s.swatStage = 'windup';
        if (!s.swatSecondStrikeDone) {
          s.swatSecondStrikeDone = true;
          s.mumbleText = 'TAKE THAT—AND THAT!';
          s.mumbleTimer = 0.9;
        }
        const rt = easeInOutSine((progress - 0.50) / 0.16);
        upperGoal = lerpScalar(impact1.upperArmAngle, reCockUpper, rt);
        elbowGoal = lerpScalar(impact1.elbowAngle, reCockElbow, rt);
        wristGoal = lerpScalar(0, reCockWrist, rt);
        fingerGoal = 0.16;
      } else if (progress < 0.88) {
        // Slap #2 Acceleration
        s.swatStage = 'acceleration';
        const t2 = (progress - 0.66) / 0.22;
        const upperT = easeInOutSine(Math.min(1, t2 * 1.14));
        const elbowT = easeInCubic(t2);
        const deltaForearm2 =
          impact2.upperArmAngle + impact2.elbowAngle - (reCockUpper + reCockElbow);
        const lagDir2 = deltaForearm2 >= 0 ? -1 : 1;
        upperGoal = lerpScalar(reCockUpper, impact2.upperArmAngle, upperT);
        elbowGoal = lerpScalar(reCockElbow, impact2.elbowAngle, elbowT);
        wristGoal =
          reCockWrist * (1 - easeInQuart(t2)) +
          spec.wristLagMag * 0.85 * lagDir2 * Math.sin(t2 * Math.PI);
        inHitWindow = t2 >= 0.85;
        strictPalmOnly = true;
      } else {
        // Slap #2 Impact
        if (s.swatStage !== 'impact') {
          s.swatImpactSquash = 1;
        }
        s.swatStage = 'impact';
        upperGoal = impact2.upperArmAngle;
        elbowGoal = impact2.elbowAngle;
        wristGoal = 0;
        fingerGoal = 0.02;
        inHitWindow = true;
        strictPalmOnly = true;
      }
    } else {
      if (progress < 0.78) {
        // STAGE 3: ACCELERATION — shoulder/elbow drives ahead, forearm whips open, wrist lags!
        s.swatStage = 'acceleration';
        const t = progress / 0.78;
        const upperT = easeInOutSine(Math.min(1, t * 1.06));
        const elbowT = easeInCubic(t);
        upperGoal = lerpScalar(s.swatStrikeStartUpper, impact1.upperArmAngle, upperT);
        elbowGoal = lerpScalar(s.swatStrikeStartElbow, impact1.elbowAngle, elbowT);
        wristGoal =
          s.swatStrikeStartWrist * (1 - easeInQuart(t)) +
          wristLagAmt * Math.sin(t * Math.PI);
        fingerGoal = 0.05;
        inHitWindow = t >= 0.88;
      } else {
        // STAGE 4: IMPACT — palm snaps decisively onto target with brief compression
        if (s.swatStage !== 'impact') {
          s.swatStage = 'impact';
          s.swatImpactSquash = 1;
          if (
            s.swatVariation === 'pillow_side_swat' &&
            s.swatX >= 720 &&
            s.pillowSquash < 0.75
          ) {
            s.pillowSquash = 1;
            sim.eventsThisStep.push({ type: 'pillow_slap', x: s.swatX, y: s.swatY });
          }
        }
        const impP = (progress - 0.78) / 0.22;
        upperGoal = impact1.upperArmAngle + spec.followThroughUpper * 0.08 * impP;
        elbowGoal = impact1.elbowAngle;
        wristGoal = 0;
        fingerGoal = 0.02;
        inHitWindow = true;
      }
    }

    applyArmFK(s, pose.shoulderX, pose.shoulderY, upperGoal, elbowGoal, wristGoal, fingerGoal, 1);

    if (s.swatStage === 'acceleration' && progress >= 0.30 && progress <= 0.50) {
      s.swatControlX = s.handX;
      s.swatControlY = s.handY;
    }

    if (inHitWindow) {
      if (resolveSwatHit(sim, strictPalmOnly)) {
        return;
      }
    }

    if (!s.swatResolved && s.swatStage === 'impact') {
      s.swatResolved = true;
      const dist = distance(m.x, m.y, s.swatX, s.swatY);
      sim.shakeTrauma = Math.max(
        sim.shakeTrauma,
        s.swatVariation === 'pillow_side_swat' ? 0.55 : 0.42
      );
      if (s.swatThreatenedMosquito || dist <= SWAT_NEAR_MISS_RADIUS) {
        sim.nearMissCount += 1;
        sim.nearMissStreak += 1;
        const bonus = 150 + Math.min(3, sim.nearMissStreak - 1) * 50;
        sim.score += bonus;
        sim.evoPointsEarned += 5;
        sim.hitstopTimer = 0.05;
        sim.slowMoTimer = 0.42;
        sim.shakeTrauma = 0.62;
        m.panicTimer = 0.75;
        m.squashX = 1.28;
        m.squashY = 0.76;
        s.swatFollowThroughTimer = 0.45;
        s.mumbleText =
          sim.subPhase === 'escape'
            ? 'COME BACK HERE!'
            : s.swatVariation === 'pillow_side_swat'
              ? 'WHACK! ...Wait?'
              : s.swatVariation === 'sleepy_miss_swat'
                ? 'Mmph... missed...'
                : 'Grr... missed!';
        s.mumbleTimer = 1.1;
        sim.eventsThisStep.push({
          type: 'near_miss',
          bonus,
          streak: sim.nearMissStreak,
          x: m.x,
          y: m.y - 26,
        });
        if (sim.nearMissCount >= 3) {
          grantAchievement(sim, 'swat_bait');
        }
      }
    }

    if (s.swatTimer <= 0) {
      // STAGE 5: RECOVERY — snapshot end-of-impact pose, follow through, then relax back to rest
      const isEscape = sim.subPhase === 'escape';
      s.mood = 'cooldown';
      s.swatStage = 'recovery';
      s.swatDuration = spec.recoveryDuration * (isEscape ? 0.58 : 1);
      s.swatTimer = s.swatDuration;
      s.swatStrikeStartUpper = s.upperArmAngle;
      s.swatStrikeStartElbow = s.elbowAngle;
      s.swatStrikeStartWrist = s.wristAngle;
      s.swatImpactUpper = s.upperArmAngle + spec.followThroughUpper;
      s.swatImpactElbow = s.elbowAngle + (impact1.bendDir === 1 ? -spec.followThroughElbow : spec.followThroughElbow);
      s.swatImpactWrist = -wristLagDir * spec.followThroughWristMag;
      s.tension = 20;
      sim.noise = Math.min(sim.noise, 40);
    }
  } else if (s.mood === 'cooldown') {
    s.swatStage = 'recovery';
    const recDur = Math.max(0.05, s.swatDuration);
    s.swatTimer -= simDt;
    const progress = 1 - clamp(s.swatTimer / recDur, 0, 1);
    const isEscape = sim.subPhase === 'escape';

    let restUpper = REST_UPPER_ANGLE;
    let restElbow = REST_ELBOW_ANGLE;
    let restWrist = REST_WRIST_ANGLE;
    if (isEscape) {
      const guard = solveTwoBoneArmIK(
        pose.shoulderX,
        pose.shoulderY,
        pose.shoulderX - 74,
        pose.shoulderY - 26,
        undefined,
        undefined,
        -1,
        -0.2
      );
      restUpper = guard.upperArmAngle;
      restElbow = guard.elbowAngle;
      restWrist = guard.wristAngle;
    }

    if (progress < 0.34) {
      // Follow-through momentum arc + natural wrist/finger relaxation
      const ft = easeOutCubic(progress / 0.34);
      const u = lerpScalar(s.swatStrikeStartUpper, s.swatImpactUpper, ft);
      const e = lerpScalar(s.swatStrikeStartElbow, s.swatImpactElbow, ft);
      const w = lerpScalar(s.swatStrikeStartWrist, s.swatImpactWrist, ft);
      applyArmFK(s, pose.shoulderX, pose.shoulderY, u, e, w, lerpScalar(0.04, 0.24, ft), 1);
    } else {
      // Smooth ease back to comfortable resting/guard pose
      const rt = easeInOutSine((progress - 0.34) / 0.66);
      const u = lerpScalar(s.swatImpactUpper, restUpper, rt);
      const e = lerpScalar(s.swatImpactElbow, restElbow, rt);
      const w = lerpScalar(s.swatImpactWrist, restWrist, rt);
      applyArmFK(
        s,
        pose.shoulderX,
        pose.shoulderY,
        u,
        e,
        w,
        lerpScalar(0.24, isEscape ? 0.42 : 0.28, rt),
        1
      );
    }

    if (s.swatTimer <= 0) {
      s.swatStage = 'none';
      if (isEscape) {
        s.mood = 'awake';
        s.huntCooldown = 0.95;
      } else {
        s.mood = 'sleeping';
      }
    }
  }
}

export function startSwatWindup(
  sim: GameSimulation,
  isHunter = false,
  forcedVariation?: SwatVariation
): void {
  const s = sim.sleeper;
  const m = sim.mosquito;
  const pose = computeHumanPose(sim);
  s.mood = 'windup';
  const minX = isHunter ? 280 : 410;
  const maxX = isHunter ? 1050 : 960;
  const minY = isHunter ? 170 : 320;
  const maxY = isHunter ? 620 : 560;
  s.swatX = clamp(m.x, minX, maxX);
  s.swatY = clamp(m.y, minY, maxY);
  s.swatVariation = forcedVariation ?? pickSwatVariation(sim, isHunter);

  const impact = solveSwatTargetAngles(
    pose.shoulderX,
    pose.shoulderY,
    s.swatX,
    s.swatY,
    s.swatVariation
  );
  const spec = getSwatVariationSpec(s.swatVariation);
  s.swatDuration = spec.windupDuration * (isHunter ? 0.80 : 1);
  s.swatTimer = s.swatDuration;
  s.swatStage = 'anticipation';

  s.swatWindupUpper = s.upperArmAngle;
  s.swatWindupElbow = s.elbowAngle;
  s.swatWindupWrist = s.wristAngle;
  s.swatImpactUpper = impact.upperArmAngle;
  s.swatImpactElbow = impact.elbowAngle;
  s.swatImpactWrist = impact.wristAngle;
  s.swatStartX = s.handX;
  s.swatStartY = s.handY;
  s.swatControlX = (s.handX + s.swatX) * 0.5;
  s.swatControlY = Math.min(s.handY, s.swatY) - 42;
  s.swatSecondStrikeDone = false;
  s.swatFollowThroughTimer = 0;
  s.swatThreatenedMosquito = distance(m.x, m.y, s.swatX, s.swatY) <= SWAT_THREAT_RADIUS;
  s.swatResolved = false;
  s.alertCount += 1;
  s.mumbleText = isHunter
    ? s.swatVariation === 'double_slap'
      ? 'HOLD STILL!!'
      : 'HEY BUG!'
    : s.swatVariation === 'pillow_side_swat'
      ? 'SMACK!'
      : s.swatVariation === 'sleepy_miss_swat'
        ? 'Mmph...?'
        : 'BZZ?!';
  s.mumbleTimer = 0.75;
  m.isSipping = false;
  m.isDrinkingFood = false;
  sim.eventsThisStep.push({ type: 'swat_windup', x: s.swatX, y: s.swatY });
}

export function finishGame(sim: GameSimulation, outcome: Exclude<GameOutcome, null>): void {
  sim.phase = 'gameover';
  sim.outcome = outcome;
  // Award consolation evo points proportional to blood collected so players always progress!
  if (outcome === 'swatted' || outcome === 'dawn') {
    sim.evoPointsEarned += Math.floor(sim.mosquito.bellyFill / 12);
  }
  if (sim.score > sim.bestScore) {
    sim.bestScore = sim.score;
  }
}

export function extractHudSnapshot(
  sim: GameSimulation,
  inputX?: number,
  inputY?: number
): HudSnapshot {
  const m = sim.mosquito;
  const x = inputX ?? m.x;
  const y = inputY ?? m.y;
  const nearbyTarget =
    sim.subPhase === 'sleep' ? findNearestSipTarget(x, y, sim.targets) : null;
  const nearbyFood = findNearestFoodSource(x, y, sim.foods);

  return {
    phase: sim.phase,
    subPhase: sim.subPhase,
    outcome: sim.outcome,
    roundNumber: sim.roundNumber,
    score: Math.round(sim.score),
    bestScore: Math.round(sim.bestScore),
    evoPointsEarned: sim.evoPointsEarned,
    noise: Math.round(sim.noise),
    tension: Math.round(sim.sleeper.tension),
    bellyFill: Math.round(m.bellyFill),
    energy: Math.round(m.energy),
    maxEnergy: m.maxEnergy,
    bloatLevel: Number(m.bloatLevel.toFixed(2)),
    timeRemaining: Math.ceil(sim.timeRemaining),
    escapeTimer: Math.ceil(sim.escapeTimer),
    alarmDuration: sim.alarmDuration,
    elapsedTime: sim.elapsedTime,
    sleeperMood: sim.sleeper.mood,
    sleeperArchetype: sim.sleeper.archetype,
    activeConditions: [...sim.sleeper.activeConditions],
    nearMissCount: sim.nearMissCount,
    longDistanceCount: sim.longDistanceCount,
    canSip: nearbyTarget !== null,
    canSipFood: nearbyFood !== null,
    isSipping: m.isSipping,
    isDrinkingFood: m.isDrinkingFood,
    dashReady: m.dashCooldown <= 0,
    lightsOn: sim.lightsOn,
    bannerText: sim.bannerText,
    unlockedUpgrades: [...sim.unlockedUpgrades],
    unlockedAchievementsThisRun: [...sim.unlockedAchievementsThisRun],
  };
}
