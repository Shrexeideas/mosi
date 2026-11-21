import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { GameHud } from './components/GameHud';
import { GameModal } from './components/GameModal';
import { TitleScreen } from './components/TitleScreen';
import { SoundEngine } from './game/audio';
import { createSimulation, extractHudSnapshot } from './game/rules';
import type { GamePhase, HudSnapshot, UpgradeId } from './game/types';
import {
  UPGRADES,
  createDefaultProgress,
  type PersistentProgress,
} from './game/upgrades';

const LEGACY_BEST_SCORE_KEY = 'ldm_best_score_v1';
const PROGRESS_KEY = 'ldm_progress_v2';

function loadProgress(): PersistentProgress {
  const base = createDefaultProgress();
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistentProgress>;
      return {
        bestScore: Number.isFinite(parsed.bestScore) ? Math.max(0, Number(parsed.bestScore)) : 0,
        evoPoints: Number.isFinite(parsed.evoPoints) ? Math.max(0, Number(parsed.evoPoints)) : 0,
        unlockedUpgrades: Array.isArray(parsed.unlockedUpgrades) ? parsed.unlockedUpgrades : [],
        unlockedAchievements: Array.isArray(parsed.unlockedAchievements)
          ? parsed.unlockedAchievements
          : [],
        roundNumber: Number.isFinite(parsed.roundNumber)
          ? Math.max(1, Number(parsed.roundNumber))
          : 1,
      };
    }
    const legacy = window.localStorage.getItem(LEGACY_BEST_SCORE_KEY);
    if (legacy) {
      const parsedLegacy = Number.parseInt(legacy, 10);
      if (Number.isFinite(parsedLegacy) && parsedLegacy > 0) {
        base.bestScore = parsedLegacy;
      }
    }
  } catch {
    // Ignore storage sandbox errors
  }
  return base;
}

function saveProgress(progress: PersistentProgress): void {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    window.localStorage.setItem(LEGACY_BEST_SCORE_KEY, String(Math.round(progress.bestScore)));
  } catch {
    // Ignore storage quota or sandbox restrictions
  }
}

function isAutostartEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('autostart') === '1';
}

export default function App() {
  const initialProgress = useMemo(() => loadProgress(), []);
  const initialPhase: GamePhase = useMemo(
    () => (isAutostartEnabled() ? 'playing' : 'title'),
    []
  );

  const [progress, setProgress] = useState<PersistentProgress>(initialProgress);
  const [phase, setPhase] = useState<GamePhase>(initialPhase);
  const [runId, setRunId] = useState<number>(initialPhase === 'playing' ? 1 : 0);
  const [muted, setMuted] = useState<boolean>(false);
  const [hud, setHud] = useState<HudSnapshot>(() =>
    extractHudSnapshot(
      createSimulation(initialProgress.bestScore, initialPhase, {
        roundNumber: initialProgress.roundNumber,
        unlockedUpgrades: initialProgress.unlockedUpgrades,
        knownAchievements: initialProgress.unlockedAchievements,
      })
    )
  );

  const sound = useMemo(() => new SoundEngine(), []);
  const touchSipRef = useRef<boolean>(false);
  const touchDashRef = useRef<boolean>(false);

  // Sync game state to document.body.dataset.state for accessibility & automated verification
  useEffect(() => {
    document.body.dataset.state = phase;
  }, [phase]);

  const startNewRun = useCallback(() => {
    sound.unlock();
    touchSipRef.current = false;
    touchDashRef.current = false;
    setPhase('playing');
    setRunId((id) => id + 1);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [sound]);

  const handlePause = useCallback(() => {
    setPhase((prev) => (prev === 'playing' ? 'paused' : prev));
  }, []);

  const handleResume = useCallback(() => {
    sound.unlock();
    setPhase((prev) => (prev === 'paused' ? 'playing' : prev));
  }, [sound]);

  const handleReturnToTitle = useCallback(() => {
    touchSipRef.current = false;
    touchDashRef.current = false;
    setPhase('title');
    setRunId((id) => id + 1);
  }, []);

  const handleToggleMute = useCallback(() => {
    sound.unlock();
    setMuted((prev) => {
      const next = !prev;
      sound.setMuted(next);
      return next;
    });
  }, [sound]);

  const handleUnlockUpgrade = useCallback(
    (id: UpgradeId) => {
      sound.unlock();
      setProgress((prev) => {
        if (prev.unlockedUpgrades.includes(id)) return prev;
        const def = UPGRADES.find((u) => u.id === id);
        if (!def || prev.evoPoints < def.cost) return prev;
        const next: PersistentProgress = {
          ...prev,
          evoPoints: prev.evoPoints - def.cost,
          unlockedUpgrades: [...prev.unlockedUpgrades, id],
        };
        saveProgress(next);
        sound.playUpgradeUnlock();
        return next;
      });
    },
    [sound]
  );

  const handleHudUpdate = useCallback((snapshot: HudSnapshot) => {
    setHud((prev) => ({
      ...snapshot,
      bestScore: Math.max(prev.bestScore, snapshot.bestScore),
    }));
  }, []);

  const handleOutcome = useCallback((snapshot: HudSnapshot) => {
    setProgress((prev) => {
      const nextBest = Math.max(prev.bestScore, snapshot.score, snapshot.bestScore);
      const won = snapshot.outcome === 'victory' || snapshot.outcome === 'escaped';
      const mergedAchievements = Array.from(
        new Set([...prev.unlockedAchievements, ...snapshot.unlockedAchievementsThisRun])
      );
      const next: PersistentProgress = {
        ...prev,
        bestScore: nextBest,
        evoPoints: prev.evoPoints + snapshot.evoPointsEarned,
        unlockedAchievements: mergedAchievements,
        roundNumber: won ? prev.roundNumber + 1 : prev.roundNumber,
      };
      saveProgress(next);
      setHud({ ...snapshot, bestScore: nextBest });
      return next;
    });
    setPhase('gameover');
  }, []);

  const handleTouchSipChange = useCallback(
    (held: boolean) => {
      sound.unlock();
      touchSipRef.current = held;
    },
    [sound]
  );

  const handleTouchDash = useCallback(() => {
    sound.unlock();
    touchDashRef.current = true;
  }, [sound]);

  // Global keyboard shortcuts for shell transitions
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (e.code === 'KeyM') {
        handleToggleMute();
        return;
      }

      if (phase === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startNewRun();
        }
        return;
      }

      if (phase === 'playing') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          handlePause();
        }
        return;
      }

      if (phase === 'paused') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          handleResume();
        } else if (e.code === 'KeyR') {
          e.preventDefault();
          startNewRun();
        }
        return;
      }

      if (phase === 'gameover') {
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyR') {
          e.preventDefault();
          startNewRun();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, handlePause, handleResume, handleToggleMute, startNewRun]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0d1120]">
      <GameCanvas
        phase={phase}
        runId={runId}
        roundNumber={progress.roundNumber}
        unlockedUpgrades={progress.unlockedUpgrades}
        knownAchievements={progress.unlockedAchievements}
        sound={sound}
        touchSipRef={touchSipRef}
        touchDashRef={touchDashRef}
        onHudUpdate={handleHudUpdate}
        onOutcome={handleOutcome}
      />

      {phase === 'title' && (
        <TitleScreen
          bestScore={progress.bestScore}
          roundNumber={progress.roundNumber}
          evoPoints={progress.evoPoints}
          unlockedUpgrades={progress.unlockedUpgrades}
          unlockedAchievements={progress.unlockedAchievements}
          muted={muted}
          onUnlockUpgrade={handleUnlockUpgrade}
          onToggleMute={handleToggleMute}
          onStart={startNewRun}
        />
      )}

      {phase === 'playing' && (
        <GameHud
          hud={hud}
          totalEvoPoints={progress.evoPoints}
          muted={muted}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onTouchSipChange={handleTouchSipChange}
          onTouchDash={handleTouchDash}
        />
      )}

      {(phase === 'paused' || phase === 'gameover') && (
        <GameModal
          hud={hud}
          totalEvoPoints={progress.evoPoints}
          unlockedUpgrades={progress.unlockedUpgrades}
          unlockedAchievements={progress.unlockedAchievements}
          onUnlockUpgrade={handleUnlockUpgrade}
          onResume={handleResume}
          onRestart={startNewRun}
          onTitle={handleReturnToTitle}
        />
      )}
    </main>
  );
}
