import { useEffect, useRef } from 'react';
import type { SoundEngine } from '../game/audio';
import {
  EffectsPool,
  renderBedroomGame,
  screenToWorldPoint,
  type CameraTransform,
} from '../game/renderer';
import { createSimulation, extractHudSnapshot, hasUpgrade, stepSimulation } from '../game/rules';
import type {
  AchievementId,
  GamePhase,
  GameSimulation,
  HudSnapshot,
  InputState,
  UpgradeId,
} from '../game/types';

interface GameCanvasProps {
  phase: GamePhase;
  runId: number;
  roundNumber: number;
  unlockedUpgrades: UpgradeId[];
  knownAchievements: AchievementId[];
  sound: SoundEngine;
  touchSipRef: React.MutableRefObject<boolean>;
  touchDashRef: React.MutableRefObject<boolean>;
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onOutcome: (snapshot: HudSnapshot) => void;
}

export function GameCanvas({
  phase,
  runId,
  roundNumber,
  unlockedUpgrades,
  knownAchievements,
  sound,
  touchSipRef,
  touchDashRef,
  onHudUpdate,
  onOutcome,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const phaseRef = useRef<GamePhase>(phase);
  const roundNumberRef = useRef<number>(roundNumber);
  const upgradesRef = useRef<UpgradeId[]>(unlockedUpgrades);
  const achievementsRef = useRef<AchievementId[]>(knownAchievements);

  roundNumberRef.current = roundNumber;
  upgradesRef.current = unlockedUpgrades;
  achievementsRef.current = knownAchievements;

  const initialAlarmDuration = (() => {
    if (typeof window === 'undefined') return undefined;
    const raw = new URLSearchParams(window.location.search).get('alarmSec');
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed >= 2 ? parsed : undefined;
  })();

  const debugTimeScale = (() => {
    if (typeof window === 'undefined') return 1;
    const raw = new URLSearchParams(window.location.search).get('timeScale');
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed >= 0.1 && parsed <= 1 ? parsed : 1;
  })();

  const simRef = useRef<GameSimulation>(
    createSimulation(0, phase, {
      roundNumber,
      unlockedUpgrades,
      knownAchievements,
      alarmDuration: initialAlarmDuration,
    })
  );
  const effectsRef = useRef<EffectsPool>(new EffectsPool());
  const onHudUpdateRef = useRef(onHudUpdate);
  const onOutcomeRef = useRef(onOutcome);

  onHudUpdateRef.current = onHudUpdate;
  onOutcomeRef.current = onOutcome;

  // Sync phase transitions without tearing down canvas
  useEffect(() => {
    phaseRef.current = phase;
    simRef.current.phase = phase;
    if (phase !== 'playing') {
      sound.silenceLoops();
    }
    onHudUpdateRef.current(extractHudSnapshot(simRef.current));
  }, [phase, sound]);

  // Reset simulation cleanly whenever runId increments
  useEffect(() => {
    if (runId === 0) return;
    const prevBest = simRef.current.bestScore;
    simRef.current = createSimulation(prevBest, phaseRef.current, {
      roundNumber: roundNumberRef.current,
      unlockedUpgrades: upgradesRef.current,
      knownAchievements: achievementsRef.current,
      alarmDuration: initialAlarmDuration,
    });
    effectsRef.current = new EffectsPool();
    onHudUpdateRef.current(extractHudSnapshot(simRef.current));
  }, [runId]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let viewportW = container.clientWidth || window.innerWidth;
    let viewportH = container.clientHeight || window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      viewportW = container.clientWidth || window.innerWidth;
      viewportH = container.clientHeight || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(viewportW * dpr));
      canvas.height = Math.max(1, Math.floor(viewportH * dpr));
      canvas.style.width = `${viewportW}px`;
      canvas.style.height = `${viewportH}px`;
    };
    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const heldKeys = new Set<string>();
    let dashQueued = false;
    let pointerActive = false;
    let pointerClientX = 0;
    let pointerClientY = 0;
    let lastCamera: CameraTransform = { scale: 1, offsetX: 0, offsetY: 0 };

    const clearInputs = () => {
      heldKeys.clear();
      pointerActive = false;
      dashQueued = false;
      touchSipRef.current = false;
      touchDashRef.current = false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'ArrowLeft' ||
        code === 'ArrowRight' ||
        code === 'Space'
      ) {
        if (phaseRef.current === 'playing') {
          e.preventDefault();
        }
      }
      if (phaseRef.current !== 'playing') return;

      sound.unlock();
      if (!e.repeat && (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyJ')) {
        dashQueued = true;
      }
      heldKeys.add(code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      heldKeys.delete(e.code);
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (phaseRef.current !== 'playing') return;
      if (e.button === 2) {
        dashQueued = true;
        return;
      }
      sound.unlock();
      pointerActive = true;
      pointerClientX = e.clientX;
      pointerClientY = e.clientY;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!pointerActive) return;
      pointerClientX = e.clientX;
      pointerClientY = e.clientY;
    };

    const handlePointerUp = () => {
      pointerActive = false;
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (phaseRef.current === 'playing') {
        e.preventDefault();
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        clearInputs();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', handleVisibility);
    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    canvas.addEventListener('contextmenu', handleContextMenu);

    let rafId = 0;
    let lastTime = performance.now();
    let hudThrottle = 0;
    let lastSerializedKey = '';

    const frame = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      const sim = simRef.current;
      const effects = effectsRef.current;

      const worldPt = pointerActive
        ? screenToWorldPoint(
            pointerClientX,
            pointerClientY,
            canvas.getBoundingClientRect(),
            lastCamera
          )
        : { x: sim.mosquito.x, y: sim.mosquito.y };

      const input: InputState = {
        up: heldKeys.has('KeyW') || heldKeys.has('ArrowUp'),
        down: heldKeys.has('KeyS') || heldKeys.has('ArrowDown'),
        left: heldKeys.has('KeyA') || heldKeys.has('ArrowLeft'),
        right: heldKeys.has('KeyD') || heldKeys.has('ArrowRight'),
        sipHeld: heldKeys.has('Space') || heldKeys.has('KeyE') || touchSipRef.current,
        dashJustPressed: dashQueued || touchDashRef.current,
        pointerActive,
        pointerWorldX: worldPt.x,
        pointerWorldY: worldPt.y,
      };
      dashQueued = false;
      touchDashRef.current = false;

      const prevPhase = sim.phase;
      stepSimulation(sim, input, dt * debugTimeScale);
      effects.update(sim, dt * debugTimeScale);

      const speed = Math.hypot(sim.mosquito.vx, sim.mosquito.vy);
      sound.updateContinuous(
        sim.phase,
        speed,
        sim.mosquito.isSipping || sim.mosquito.isDrinkingFood,
        sim.mosquito.mood === 'dash',
        sim.sleeper.breathPhase,
        hasUpgrade(sim, 'ninja_mosquito'),
        sim.mosquito.bloatLevel
      );
      sound.handleEvents(sim.eventsThisStep, sim.mosquito.bellyFill);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lastCamera = renderBedroomGame(ctx, sim, effects, viewportW, viewportH, now / 1000);

      hudThrottle += dt;
      if (prevPhase === 'playing' && sim.phase === 'gameover') {
        const snap = extractHudSnapshot(sim);
        onOutcomeRef.current(snap);
      } else if (hudThrottle >= 0.075) {
        hudThrottle = 0;
        const snap = extractHudSnapshot(sim);
        const key = `${snap.score}|${snap.noise}|${snap.tension}|${snap.bellyFill}|${snap.energy}|${snap.bloatLevel}|${snap.timeRemaining}|${snap.escapeTimer}|${snap.subPhase}|${snap.sleeperMood}|${snap.canSip}|${snap.canSipFood}|${snap.isSipping}|${snap.isDrinkingFood}|${snap.dashReady}|${snap.evoPointsEarned}|${snap.bannerText}|${snap.activeConditions.length}`;
        if (key !== lastSerializedKey) {
          lastSerializedKey = key;
          onHudUpdateRef.current(snap);
        }
      }

      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clearInputs);
      document.removeEventListener('visibilitychange', handleVisibility);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      sound.silenceLoops();
    };
  }, [sound, touchDashRef, touchSipRef]);

  return (
    <div ref={containerRef} className="fixed inset-0 z-0 overflow-hidden bg-[#0d1120]">
      <canvas
        ref={canvasRef}
        data-testid="game-canvas"
        className="block h-full w-full cursor-crosshair touch-none"
      />
    </div>
  );
}
