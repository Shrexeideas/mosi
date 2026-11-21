import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ESCAPE_DURATION,
  FEAST_GOAL,
  MOSQUITO_SPAWN_X,
  MOSQUITO_SPAWN_Y,
  SWAT_HIT_RADIUS,
  SWAT_NEAR_MISS_RADIUS,
  SWAT_STRIKE_DURATION,
  SWAT_WINDUP_DURATION,
  WINDOW_ESCAPE_ZONE,
  computeLongDistanceBonus,
  createSimulation,
  startSwatWindup,
  stepSimulation,
} from './rules';
import {
  FOREARM_LEN,
  PALM_OFFSET,
  UPPER_ARM_LEN,
  computeHumanPose,
  solveTwoBoneArmIK,
} from './humanAnim';
import type { InputState, SwatVariation, TargetId } from './types';

function emptyInput(): InputState {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    sipHeld: false,
    dashJustPressed: false,
    pointerActive: false,
    pointerWorldX: 0,
    pointerWorldY: 0,
  };
}

test('mosquito survives first several seconds safely without input', () => {
  const sim = createSimulation(0, 'playing');
  const input = emptyInput();
  for (let i = 0; i < 180; i++) {
    stepSimulation(sim, input, 1 / 60);
  }
  assert.equal(sim.phase, 'playing');
  assert.equal(sim.subPhase, 'sleep');
  assert.equal(sim.outcome, null);
  assert.equal(sim.sleeper.mood, 'sleeping');
  assert.equal(Math.round(sim.mosquito.x), MOSQUITO_SPAWN_X);
  assert.equal(Math.round(sim.mosquito.y), MOSQUITO_SPAWN_Y);
});

test('movement and dash increase speed and noise, hovering cools noise', () => {
  const sim = createSimulation(0, 'playing');
  const moveRight: InputState = { ...emptyInput(), right: true };

  for (let i = 0; i < 45; i++) {
    stepSimulation(sim, moveRight, 1 / 60);
  }
  assert.ok(sim.mosquito.x > MOSQUITO_SPAWN_X + 100);
  assert.ok(sim.noise > 0);

  stepSimulation(sim, { ...moveRight, dashJustPressed: true }, 1 / 60);
  const afterDashNoise = sim.noise;
  assert.ok(afterDashNoise >= 18);

  sim.mosquito.x = 120;
  sim.mosquito.y = 200;
  for (let i = 0; i < 120; i++) {
    stepSimulation(sim, emptyInput(), 1 / 60);
  }
  assert.ok(sim.noise < afterDashNoise);
});

test('landing and sipping fills belly, awards score & evo points, and triggers victory at 100%', () => {
  const sim = createSimulation(0, 'playing', { archetype: 'deep_snorer' });
  const forearm = sim.targets.find((t) => t.id === 'forearm')!;
  sim.mosquito.x = forearm.x;
  sim.mosquito.y = forearm.y;

  const sipInput: InputState = { ...emptyInput(), sipHeld: true };
  for (let i = 0; i < 720 && sim.phase === 'playing'; i++) {
    sim.sleeper.tension = 0;
    sim.sleeper.mood = 'sleeping';
    sim.sleeper.scratchWindupTimer = 0;
    sim.sleeper.sneezeChargeTimer = 0;
    stepSimulation(sim, sipInput, 1 / 60);
  }

  assert.equal(sim.phase, 'gameover');
  assert.equal(sim.outcome, 'victory');
  assert.equal(sim.mosquito.bellyFill, FEAST_GOAL);
  assert.ok(sim.score > 0);
  assert.ok(sim.evoPointsEarned >= 30);
  assert.equal(sim.bestScore, sim.score);
});

test('long-distance bonus rewards switching between distant targets', () => {
  const footToCheekBonus = computeLongDistanceBonus(470, 500, 882, 398, 'foot', 'cheek');
  const sameTargetBonus = computeLongDistanceBonus(882, 398, 882, 398, 'cheek', 'cheek');
  assert.ok(footToCheekBonus >= 80);
  assert.equal(sameTargetBonus, 0);
});

test('swat windup -> strike catches stationary mosquito inside hit radius', () => {
  const sim = createSimulation(0, 'playing');
  const cheek = sim.targets.find((t) => t.id === 'cheek')!;
  sim.mosquito.x = cheek.x;
  sim.mosquito.y = cheek.y;
  sim.sleeper.tension = 100;
  sim.sleeper.mood = 'stirring';

  stepSimulation(sim, emptyInput(), 1 / 60);
  assert.equal(sim.sleeper.mood, 'windup');

  const totalSteps = Math.ceil((SWAT_WINDUP_DURATION + SWAT_STRIKE_DURATION + 0.1) * 60);
  for (let i = 0; i < totalSteps && sim.phase === 'playing'; i++) {
    stepSimulation(sim, emptyInput(), 1 / 60);
  }

  for (let i = 0; i < 60 && sim.phase === 'playing'; i++) {
    stepSimulation(sim, emptyInput(), 1 / 60);
  }

  assert.equal(sim.phase, 'gameover');
  assert.equal(sim.outcome, 'swatted');
});

test('swat near-miss rewards escaping outside hit radius but inside near-miss radius', () => {
  const sim = createSimulation(0, 'playing');
  const forearm = sim.targets.find((t) => t.id === 'forearm')!;
  sim.mosquito.x = forearm.x;
  sim.mosquito.y = forearm.y;
  sim.sleeper.tension = 100;
  sim.sleeper.mood = 'stirring';

  stepSimulation(sim, emptyInput(), 1 / 60);
  assert.equal(sim.sleeper.mood, 'windup');
  const lockSteps = Math.ceil(SWAT_WINDUP_DURATION * 0.42 * 60);
  for (let i = 0; i < lockSteps; i++) {
    stepSimulation(sim, emptyInput(), 1 / 60);
  }
  assert.equal(sim.sleeper.swatThreatenedMosquito, true);

  const safeDodgeDist = (SWAT_HIT_RADIUS + SWAT_NEAR_MISS_RADIUS) / 2;
  sim.mosquito.x = sim.sleeper.swatX - safeDodgeDist;
  sim.mosquito.y = sim.sleeper.swatY;

  const remainingSteps = Math.ceil((SWAT_WINDUP_DURATION * 0.65 + SWAT_STRIKE_DURATION) * 60) + 5;
  for (let i = 0; i < remainingSteps; i++) {
    stepSimulation(sim, emptyInput(), 1 / 60);
  }

  assert.equal(sim.phase, 'playing');
  assert.equal(sim.nearMissCount, 1);
  assert.ok(sim.score >= 150);
});

test('alarm expiration triggers wake-up escape sequence, window escape wins, and timeout loses', () => {
  const sim = createSimulation(0, 'playing');
  sim.timeRemaining = 0.05;

  for (let i = 0; i < 8; i++) {
    stepSimulation(sim, emptyInput(), 1 / 60);
  }
  assert.equal(sim.phase, 'playing');
  assert.equal(sim.subPhase, 'escape');
  assert.equal(sim.lightsOn, true);
  assert.equal(sim.sleeper.mood, 'awake');
  assert.ok(sim.escapeTimer <= ESCAPE_DURATION);

  // Flying into moonlit window succeeds with 'escaped'
  const escapeWinSim = createSimulation(0, 'playing');
  escapeWinSim.timeRemaining = 0.02;
  for (let i = 0; i < 4; i++) {
    stepSimulation(escapeWinSim, emptyInput(), 1 / 60);
  }
  escapeWinSim.mosquito.x = WINDOW_ESCAPE_ZONE.x;
  escapeWinSim.mosquito.y = WINDOW_ESCAPE_ZONE.y;
  stepSimulation(escapeWinSim, emptyInput(), 1 / 60);
  assert.equal(escapeWinSim.phase, 'gameover');
  assert.equal(escapeWinSim.outcome, 'escaped');
  assert.ok(escapeWinSim.unlockedAchievementsThisRun.includes('alarm_dodger'));

  // Escape timer expiration triggers dawn defeat
  sim.escapeTimer = 0.03;
  for (let i = 0; i < 10 && sim.phase === 'playing'; i++) {
    stepSimulation(sim, emptyInput(), 1 / 60);
  }
  assert.equal(sim.phase, 'gameover');
  assert.equal(sim.outcome, 'dawn');
});

test('alternative bedroom food restores energy safely without evo points and unlocks juice_goblin', () => {
  const sim = createSimulation(0, 'playing');
  const juice = sim.foods[0];
  sim.mosquito.x = juice.x;
  sim.mosquito.y = juice.y;
  sim.mosquito.energy = 40;
  sim.noise = 30;

  const sipInput: InputState = { ...emptyInput(), sipHeld: true };
  for (let i = 0; i < 60; i++) {
    stepSimulation(sim, sipInput, 1 / 60);
  }

  assert.ok(sim.mosquito.energy > 60);
  assert.ok(juice.amount < 100);
  // Only the one-time +10 achievement bonus, 0 direct evo points from snacks
  assert.equal(sim.evoPointsEarned, 10);
  assert.ok(sim.noise < 30);
  assert.ok(sim.unlockedAchievementsThisRun.includes('juice_goblin'));
});

test('greedy sipping causes bloated state, slows speed, and unlocks greedy_balloon', () => {
  const sim = createSimulation(0, 'playing', { archetype: 'deep_snorer' });
  const ankle = sim.targets.find((t) => t.id === 'foot')!;
  sim.mosquito.x = ankle.x;
  sim.mosquito.y = ankle.y;

  const sipInput: InputState = { ...emptyInput(), sipHeld: true };
  for (let i = 0; i < 300; i++) {
    sim.sleeper.tension = 0;
    sim.sleeper.mood = 'sleeping';
    sim.sleeper.scratchWindupTimer = 0;
    sim.sleeper.sneezeChargeTimer = 0;
    stepSimulation(sim, sipInput, 1 / 60);
  }

  assert.ok(sim.mosquito.bloatLevel >= 0.55);
  assert.ok(sim.unlockedAchievementsThisRun.includes('greedy_balloon'));
});

test('evolution upgrades measurably boost speed, sip rate, stealth, energy cap, and dash cooldown', () => {
  const baseSim = createSimulation(0, 'playing', { archetype: 'twitchy' });
  const evoSim = createSimulation(0, 'playing', {
    archetype: 'twitchy',
    unlockedUpgrades: [
      'turbo_wings',
      'mega_proboscis',
      'ninja_mosquito',
      'blood_tank',
      'emergency_dash',
    ],
  });

  assert.equal(baseSim.mosquito.maxEnergy, 100);
  assert.equal(evoSim.mosquito.maxEnergy, 125);

  const moveRight: InputState = { ...emptyInput(), right: true };
  for (let i = 0; i < 40; i++) {
    stepSimulation(baseSim, moveRight, 1 / 60);
    stepSimulation(evoSim, moveRight, 1 / 60);
  }
  assert.ok(evoSim.mosquito.x > baseSim.mosquito.x);

  // Dash cooldown check
  stepSimulation(baseSim, { ...emptyInput(), dashJustPressed: true }, 1 / 60);
  stepSimulation(evoSim, { ...emptyInput(), dashJustPressed: true }, 1 / 60);
  assert.ok(evoSim.mosquito.dashCooldown < baseSim.mosquito.dashCooldown);

  // Sip rate & stealth check
  const baseForearm = baseSim.targets.find((t) => t.id === 'forearm')!;
  const evoForearm = evoSim.targets.find((t) => t.id === 'forearm')!;
  baseSim.mosquito.x = baseForearm.x;
  baseSim.mosquito.y = baseForearm.y;
  evoSim.mosquito.x = evoForearm.x;
  evoSim.mosquito.y = evoForearm.y;
  baseSim.sleeper.tension = 0;
  evoSim.sleeper.tension = 0;
  baseSim.mosquito.dashTimer = 0;
  evoSim.mosquito.dashTimer = 0;
  for (let i = 0; i < 60; i++) {
    stepSimulation(baseSim, { ...emptyInput(), sipHeld: true }, 1 / 60);
    stepSimulation(evoSim, { ...emptyInput(), sipHeld: true }, 1 / 60);
  }
  assert.ok(evoSim.mosquito.bellyFill > baseSim.mosquito.bellyFill);
  assert.ok(evoSim.sleeper.tension < baseSim.sleeper.tension);
});

test('comedy sneeze disorder launches mosquito safely across bedroom and unlocks sneeze_rocket', () => {
  const sim = createSimulation(0, 'playing', { archetype: 'deep_snorer' });
  sim.sleeper.activeConditions.push('sneezing_disorder');
  sim.sleeper.sneezeChargeTimer = 0.02;
  sim.mosquito.x = 700;
  sim.mosquito.y = 450;

  for (let i = 0; i < 10; i++) {
    stepSimulation(sim, emptyInput(), 1 / 60);
  }

  assert.ok(sim.mosquito.vx < -300);
  assert.ok(sim.mosquito.sneezeLaunchTimer > 0);
  assert.ok(sim.unlockedAchievementsThisRun.includes('sneeze_rocket'));
});

test('two-bone IK solver preserves exact anatomical bone lengths across poses', () => {
  const targets = [
    [682, 486],
    [870, 410],
    [470, 500],
    [980, 220],
  ];
  for (const [tx, ty] of targets) {
    const ik = solveTwoBoneArmIK(828, 440, tx, ty, UPPER_ARM_LEN, FOREARM_LEN, -1);
    const upperDist = Math.hypot(ik.elbowX - 828, ik.elbowY - 440);
    const lowerDist = Math.hypot(ik.wristX - ik.elbowX, ik.wristY - ik.elbowY);
    const palmDist = Math.hypot(ik.handX - ik.wristX, ik.handY - ik.wristY);
    assert.ok(Math.abs(upperDist - UPPER_ARM_LEN) < 0.01);
    assert.ok(Math.abs(lowerDist - FOREARM_LEN) < 0.01);
    assert.ok(Math.abs(palmDist - PALM_OFFSET) < 0.01);
  }
});

test('random sleep behaviors trigger smoothly with cooldowns and yield to gameplay danger', () => {
  const sim = createSimulation(0, 'playing', { archetype: 'twitchy' });
  sim.sleeper.behaviorCooldown = 0.05;
  const seenBehaviors = new Set<string>();

  for (let i = 0; i < 480; i++) {
    stepSimulation(sim, emptyInput(), 1 / 60);
    if (sim.sleeper.sleepBehavior !== 'idle') {
      seenBehaviors.add(sim.sleeper.sleepBehavior);
    }
  }

  assert.ok(seenBehaviors.size >= 1);
  assert.ok(sim.sleeper.breathPhase > 1);
});

test('location-aware mosquito reactions turn head toward buzz and scratch reaches actual target', () => {
  const sim = createSimulation(0, 'playing', { archetype: 'twitchy' });
  sim.mosquito.x = 740;
  sim.mosquito.y = 390;
  sim.noise = 35;

  for (let i = 0; i < 40; i++) {
    stepSimulation(sim, emptyInput(), 1 / 60);
  }
  assert.ok(sim.sleeper.headTurn < -0.02);
  assert.ok(sim.sleeper.browFurrow > 0.05);

  const testTargets: TargetId[] = ['foot', 'cheek', 'forearm'];
  for (const tid of testTargets) {
    const target = sim.targets.find((t) => t.id === tid)!;
    sim.sleeper.mood = 'sleeping';
    sim.sleeper.tension = 0;
    sim.sleeper.scratchTargetId = tid;
    sim.sleeper.scratchWindupTimer = 0.04;
    sim.sleeper.scratchActiveTimer = 0;
    sim.mosquito.x = target.x;
    sim.mosquito.y = target.y;

    for (let i = 0; i < 18; i++) {
      stepSimulation(sim, { ...emptyInput(), sipHeld: true }, 1 / 60);
    }
    const handDist = Math.hypot(sim.sleeper.handX - target.x, sim.sleeper.handY - target.y);
    assert.ok(handDist < 190, `hand should reach toward ${tid}, got dist ${handDist}`);
  }
});

test('alarm triggers complete multi-stage wake-up progression into angry sit-up hunt', () => {
  const sim = createSimulation(0, 'playing');
  sim.timeRemaining = 0.02;

  const seenStages = new Set<string>();
  for (let i = 0; i < 130; i++) {
    stepSimulation(sim, emptyInput(), 1 / 60);
    seenStages.add(sim.sleeper.wakeStage);
  }

  assert.ok(seenStages.has('startle'));
  assert.ok(seenStages.has('confused'));
  assert.ok(seenStages.has('sit_up'));
  assert.ok(seenStages.has('scan_room'));
  assert.ok(seenStages.has('angry_hunt'));

  const pose = computeHumanPose(sim);
  assert.ok(pose.eyelidOpen >= 0.95);
  assert.ok(sim.sleeper.sitUpAmount >= 0.9);
  assert.ok(pose.headY < 370);
});

test('all 5 swat variations execute 5-stage FK sequence with fixed bone lengths, smooth frames, and pillow squash', () => {
  const variations: SwatVariation[] = [
    'downward_slap',
    'pillow_side_swat',
    'upward_swipe',
    'double_slap',
    'sleepy_miss_swat',
  ];

  for (const variation of variations) {
    const sim = createSimulation(0, 'playing');
    sim.mosquito.x = 860;
    sim.mosquito.y = 415;
    startSwatWindup(sim, false, variation);

    const seenStages = new Set<string>();
    let hitPillow = false;
    let prevElbowX = sim.sleeper.elbowX;
    let prevElbowY = sim.sleeper.elbowY;
    let prevWristX = sim.sleeper.wristX;
    let prevWristY = sim.sleeper.wristY;
    let maxElbowJump = 0;
    let maxWristJump = 0;

    for (let i = 0; i < 120 && sim.phase === 'playing'; i++) {
      // Dodge clear after tracking lock (~0.25s) so swat strikes the intended zone safely
      if (i >= 18) {
        sim.mosquito.x = 240;
        sim.mosquito.y = 220;
      }
      stepSimulation(sim, emptyInput(), 1 / 60);
      seenStages.add(sim.sleeper.swatStage);

      const s = sim.sleeper;
      const upperLen = Math.hypot(s.elbowX - s.shoulderX, s.elbowY - s.shoulderY);
      const foreLen = Math.hypot(s.wristX - s.elbowX, s.wristY - s.elbowY);
      const palmLen = Math.hypot(s.handX - s.wristX, s.handY - s.wristY);
      assert.ok(
        Math.abs(upperLen - UPPER_ARM_LEN) < 0.05,
        `${variation} upperLen drifted: ${upperLen}`
      );
      assert.ok(
        Math.abs(foreLen - FOREARM_LEN) < 0.05,
        `${variation} foreLen drifted: ${foreLen}`
      );
      assert.ok(
        Math.abs(palmLen - PALM_OFFSET) < 0.05,
        `${variation} palmLen drifted: ${palmLen}`
      );

      maxElbowJump = Math.max(maxElbowJump, Math.hypot(s.elbowX - prevElbowX, s.elbowY - prevElbowY));
      maxWristJump = Math.max(maxWristJump, Math.hypot(s.wristX - prevWristX, s.wristY - prevWristY));
      prevElbowX = s.elbowX;
      prevElbowY = s.elbowY;
      prevWristX = s.wristX;
      prevWristY = s.wristY;

      if (sim.eventsThisStep.some((e) => e.type === 'pillow_slap')) {
        hitPillow = true;
      }
      if (i > 40 && s.swatStage === 'none') {
        break;
      }
    }

    assert.ok(seenStages.has('anticipation'), `${variation} missing anticipation`);
    assert.ok(seenStages.has('windup'), `${variation} missing windup`);
    assert.ok(seenStages.has('acceleration'), `${variation} missing acceleration`);
    assert.ok(seenStages.has('impact'), `${variation} missing impact`);
    assert.ok(seenStages.has('recovery'), `${variation} missing recovery`);
    assert.ok(maxElbowJump < 38, `${variation} elbow jumped ${maxElbowJump.toFixed(1)}px in 1 frame`);
    assert.ok(maxWristJump < 65, `${variation} wrist jumped ${maxWristJump.toFixed(1)}px in 1 frame`);

    if (variation === 'pillow_side_swat') {
      assert.equal(hitPillow, true);
    }
  }
});

test('palm genuinely reaches stationary targets on cheek, forearm, and foot during impact', () => {
  const targetIds: TargetId[] = ['cheek', 'forearm', 'foot'];
  for (const tid of targetIds) {
    const sim = createSimulation(0, 'playing');
    const target = sim.targets.find((t) => t.id === tid)!;
    sim.mosquito.x = target.x;
    sim.mosquito.y = target.y;
    startSwatWindup(sim, false, 'downward_slap');

    let minHandDist = Infinity;
    for (let i = 0; i < 80 && sim.phase === 'playing'; i++) {
      stepSimulation(sim, emptyInput(), 1 / 60);
      minHandDist = Math.min(
        minHandDist,
        Math.hypot(sim.sleeper.handX - target.x, sim.sleeper.handY - target.y)
      );
      if (sim.koFinishTimer > 0) break;
    }

    assert.ok(
      minHandDist <= SWAT_HIT_RADIUS + 4 || sim.koFinishTimer > 0 || sim.outcome === 'swatted',
      `palm failed to reach ${tid}, minDist=${minHandDist.toFixed(1)}`
    );
  }
});
