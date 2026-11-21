export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type GameOutcome = 'victory' | 'escaped' | 'swatted' | 'dawn' | null;

export type RoundSubPhase = 'sleep' | 'escape';

export type SleeperMood = 'sleeping' | 'stirring' | 'windup' | 'strike' | 'cooldown' | 'awake';

export type SleeperArchetype = 'deep_snorer' | 'twitchy' | 'light_sleeper';

export type MosquitoMood =
  | 'hover'
  | 'stealth'
  | 'fast'
  | 'dash'
  | 'landing'
  | 'sipping'
  | 'panicked'
  | 'swatted'
  | 'bloated';

export type TargetId = 'foot' | 'forearm' | 'cheek';

export type FoodKind = 'juice_glass' | 'fruit_scrap' | 'soda_spill';

export type UpgradeId =
  | 'turbo_wings'
  | 'mega_proboscis'
  | 'ninja_mosquito'
  | 'blood_tank'
  | 'emergency_dash';

export type ComedyConditionId =
  | 'itchy_elbow'
  | 'dramatic_fever'
  | 'sneezing_disorder';

export type AchievementId =
  | 'greedy_balloon'
  | 'sneeze_rocket'
  | 'juice_goblin'
  | 'alarm_dodger'
  | 'swat_bait'
  | 'mad_scientist';

export interface SipTarget {
  id: TargetId;
  label: string;
  x: number;
  y: number;
  radius: number;
  sipRate: number; // feast % per second
  tensionRate: number; // tension per second while sipping
  scorePerTick: number;
  cooldown: number; // seconds before optimal bonus again
}

export interface FoodSource {
  id: string;
  kind: FoodKind;
  label: string;
  x: number;
  y: number;
  radius: number;
  amount: number; // 0..100 remaining
  energyRate: number;
}

export interface MosquitoState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  tilt: number;
  wingPhase: number;
  mood: MosquitoMood;
  bellyFill: number; // 0..100 (Blood Rush goal)
  energy: number; // 0..maxEnergy
  maxEnergy: number;
  isSipping: boolean;
  isDrinkingFood: boolean;
  sipTargetId: TargetId | null;
  foodTargetId: string | null;
  lastSipTargetId: TargetId | null;
  lastSipX: number;
  lastSipY: number;
  greedySipStreak: number; // continuous blood drinking seconds
  bloatLevel: number; // 0..1 heaviness from drinking greedily
  dashTimer: number;
  dashCooldown: number;
  panicTimer: number;
  sneezeLaunchTimer: number;
  squashX: number;
  squashY: number;
}

export type SleepBehaviorId =
  | 'idle'
  | 'nose_scratch'
  | 'arm_shift'
  | 'blanket_tug'
  | 'body_roll'
  | 'leg_shift'
  | 'head_turn'
  | 'peek_eye'
  | 'grumpy_twitch';

export type WakeStage =
  | 'asleep'
  | 'startle'
  | 'blink_open'
  | 'confused'
  | 'head_lift'
  | 'sit_up'
  | 'scan_room'
  | 'spot_bug'
  | 'angry_hunt';

export type SwatVariation =
  | 'downward_slap'
  | 'pillow_side_swat'
  | 'upward_swipe'
  | 'double_slap'
  | 'sleepy_miss_swat';

export type SwatStage =
  | 'none'
  | 'anticipation'
  | 'windup'
  | 'acceleration'
  | 'impact'
  | 'recovery';

export interface SleeperState {
  archetype: SleeperArchetype;
  mood: SleeperMood;
  tension: number; // 0..100
  breathPhase: number;
  breathRate: number;
  breathDepth: number;
  twitchTimer: number;
  swatTimer: number;
  swatDuration: number;
  swatX: number;
  swatY: number;
  swatStartX: number;
  swatStartY: number;
  swatControlX: number;
  swatControlY: number;
  swatVariation: SwatVariation;
  swatStage: SwatStage;
  swatSecondStrikeDone: boolean;
  swatFollowThroughTimer: number;
  swatImpactSquash: number;
  swatTorsoLean: number;
  swatWindupUpper: number;
  swatWindupElbow: number;
  swatWindupWrist: number;
  swatStrikeStartUpper: number;
  swatStrikeStartElbow: number;
  swatStrikeStartWrist: number;
  swatImpactUpper: number;
  swatImpactElbow: number;
  swatImpactWrist: number;
  swatThreatenedMosquito: boolean;
  swatResolved: boolean;
  upperArmAngle: number; // shoulder -> elbow world radians
  elbowAngle: number; // forearm angle relative to upper arm
  wristAngle: number; // hand angle relative to forearm
  shoulderX: number;
  shoulderY: number;
  elbowX: number;
  elbowY: number;
  wristX: number;
  wristY: number;
  handX: number;
  handY: number;
  handRotation: number;
  fingerCurl: number; // 0 = open slap/reach, 1 = curled fist/relaxed curl
  alertCount: number;
  mumbleText: string;
  mumbleTimer: number;
  // Natural sleep behaviors & micro-expressions
  sleepBehavior: SleepBehaviorId;
  behaviorTimer: number;
  behaviorDuration: number;
  behaviorCooldown: number;
  behaviorBlend: number;
  bodyRoll: number; // -1..1 subtle torso/shoulder roll
  headTurn: number; // -1..1 tilt/turn toward buzz or side
  browFurrow: number; // 0..1
  eyeOpenAmount: number; // 0..1
  gazeX: number; // -1..1
  gazeY: number; // -1..1
  blanketTugAmount: number; // 0..1
  pillowSquash: number; // 0..1
  footShiftX: number;
  footShiftY: number;
  footFlex: number;
  // Mosquito location-aware skin reaction
  biteReactionTimer: number;
  biteReactionTargetId: TargetId | null;
  biteReactionX: number;
  biteReactionY: number;
  // Multi-stage alarm wake-up animation
  wakeStage: WakeStage;
  wakeStageTimer: number;
  sitUpAmount: number; // 0 = lying down, 1 = sitting up
  headLiftAmount: number; // 0 = on pillow, 1 = lifted
  // Comedy fictional conditions & antics
  activeConditions: ComedyConditionId[];
  conditionProgress: number; // 0..100 toward next comedy condition
  scratchTargetId: TargetId | null;
  scratchWindupTimer: number;
  scratchActiveTimer: number;
  scratchCooldown: number;
  sneezeChargeTimer: number;
  sneezeBlastTimer: number;
  sneezeCooldown: number;
  feverSweatTimer: number;
  // Awake chase state after alarm rings
  huntX: number;
  huntCooldown: number;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: 'dust' | 'blood' | 'sweat' | 'zzz' | 'spark' | 'wind' | 'juice' | 'note' | 'feather';
}

export interface FloatingText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  scale: number;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  sipHeld: boolean;
  dashJustPressed: boolean;
  pointerActive: boolean;
  pointerWorldX: number;
  pointerWorldY: number;
}

export interface GameSimulation {
  phase: GamePhase;
  subPhase: RoundSubPhase;
  outcome: GameOutcome;
  roundNumber: number;
  score: number;
  bestScore: number;
  evoPointsEarned: number;
  alarmDuration: number;
  timeRemaining: number;
  escapeTimer: number;
  alarmTickAccumulator: number;
  alarmRingPulse: number;
  lightsOn: boolean;
  elapsedTime: number;
  noise: number; // 0..100
  nearMissCount: number;
  nearMissStreak: number;
  longDistanceCount: number;
  sipsCompleted: number;
  foodSipsCompleted: number;
  hitstopTimer: number;
  slowMoTimer: number;
  shakeTrauma: number;
  koFinishTimer: number;
  sipScoreAccumulator: number;
  unlockedUpgrades: UpgradeId[];
  unlockedAchievementsThisRun: AchievementId[];
  knownAchievements: AchievementId[];
  bannerText: string;
  bannerTimer: number;
  mosquito: MosquitoState;
  sleeper: SleeperState;
  targets: SipTarget[];
  foods: FoodSource[];
  eventsThisStep: SimEvent[];
}

export type SimEvent =
  | { type: 'dash' }
  | { type: 'land'; targetId: TargetId }
  | { type: 'sip_tick'; x: number; y: number }
  | { type: 'food_sip'; x: number; y: number }
  | { type: 'long_distance'; bonus: number; x: number; y: number }
  | { type: 'stirring' }
  | { type: 'swat_windup'; x: number; y: number }
  | { type: 'swat_strike'; x: number; y: number }
  | { type: 'near_miss'; bonus: number; streak: number; x: number; y: number }
  | { type: 'swatted'; x: number; y: number }
  | { type: 'pillow_slap'; x: number; y: number }
  | { type: 'alarm_tick'; urgency: number }
  | { type: 'alarm_ring' }
  | { type: 'scratch_flick'; x: number; y: number }
  | { type: 'bloated'; x: number; y: number }
  | { type: 'condition_triggered'; condition: ComedyConditionId; x: number; y: number }
  | { type: 'sneeze_blast'; x: number; y: number }
  | { type: 'achievement'; id: AchievementId; title: string }
  | { type: 'victory' }
  | { type: 'escaped' }
  | { type: 'dawn' };

export interface HudSnapshot {
  phase: GamePhase;
  subPhase: RoundSubPhase;
  outcome: GameOutcome;
  roundNumber: number;
  score: number;
  bestScore: number;
  evoPointsEarned: number;
  noise: number;
  tension: number;
  bellyFill: number;
  energy: number;
  maxEnergy: number;
  bloatLevel: number;
  timeRemaining: number;
  escapeTimer: number;
  alarmDuration: number;
  elapsedTime: number;
  sleeperMood: SleeperMood;
  sleeperArchetype: SleeperArchetype;
  activeConditions: ComedyConditionId[];
  nearMissCount: number;
  longDistanceCount: number;
  canSip: boolean;
  canSipFood: boolean;
  isSipping: boolean;
  isDrinkingFood: boolean;
  dashReady: boolean;
  lightsOn: boolean;
  bannerText: string;
  unlockedUpgrades: UpgradeId[];
  unlockedAchievementsThisRun: AchievementId[];
}
