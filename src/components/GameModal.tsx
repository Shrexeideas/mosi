import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { EvolutionPanel } from './EvolutionPanel';
import { COMEDY_CONDITIONS } from '../game/upgrades';
import type { AchievementId, HudSnapshot, SleeperArchetype, UpgradeId } from '../game/types';

interface GameModalProps {
  hud: HudSnapshot;
  totalEvoPoints: number;
  unlockedUpgrades: UpgradeId[];
  unlockedAchievements: AchievementId[];
  onUnlockUpgrade: (id: UpgradeId) => void;
  onResume: () => void;
  onRestart: () => void;
  onTitle: () => void;
}

const ARCHETYPE_LABELS: Record<SleeperArchetype, string> = {
  deep_snorer: 'Deep Snorer',
  twitchy: 'Twitchy Sleeper',
  light_sleeper: 'Light Sleeper',
};

export function GameModal({
  hud,
  totalEvoPoints,
  unlockedUpgrades,
  unlockedAchievements,
  onUnlockUpgrade,
  onResume,
  onRestart,
  onTitle,
}: GameModalProps) {
  const [showEvolutions, setShowEvolutions] = useState(false);
  const [evoTab, setEvoTab] = useState<'evolutions' | 'achievements'>('evolutions');

  const isPaused = hud.phase === 'paused';
  const isVictory = hud.phase === 'gameover' && hud.outcome === 'victory';
  const isEscaped = hud.phase === 'gameover' && hud.outcome === 'escaped';
  const isSwatted = hud.phase === 'gameover' && hud.outcome === 'swatted';

  if (hud.phase !== 'paused' && hud.phase !== 'gameover') {
    return null;
  }

  const title = isPaused
    ? 'Paused'
    : isVictory
      ? 'Belly Full!'
      : isEscaped
        ? 'Midnight Escape!'
        : isSwatted
          ? 'Swatted!'
          : 'Caught in Daylight!';

  const subtitle = isPaused
    ? 'Catch your breath while the room stays quiet.'
    : isVictory
      ? 'You slipped out into the moonlight before the alarm could ring.'
      : isEscaped
        ? 'You bolted out the open window right in the human’s face!'
        : isSwatted
          ? 'That sleeper has suspiciously fast reflexes.'
          : 'The alarm rang and you ran out of time to reach the window.';

  const accentColor =
    isVictory || isEscaped
      ? '#88d4b8'
      : isSwatted
        ? '#ff6b6b'
        : '#ffbe5c';

  const canAdvanceNight = isVictory || isEscaped;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-modal-title"
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#090c18]/80 p-4"
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border-2 border-[#e7dccb]/20 bg-[#151a2f] p-5 text-[#f6efe2] shadow-[0_18px_48px_rgba(0,0,0,0.65)] sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#9ea6be]">
              <span>Night {hud.roundNumber}</span>
              <span aria-hidden="true">·</span>
              <span>{ARCHETYPE_LABELS[hud.sleeperArchetype]}</span>
            </div>
            <h2
              id="game-modal-title"
              className="font-display mt-0.5 text-3xl font-extrabold tracking-tight"
              style={{ color: accentColor }}
            >
              {title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[#cfc6b7]">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Inflicted comedy conditions summary if any */}
        {hud.activeConditions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {hud.activeConditions.map((cid) => (
              <span
                key={cid}
                className="rounded-md border border-[#ffbe5c]/30 bg-[#1e243f] px-2 py-0.5 text-[11px] font-semibold text-[#ffdf9e]"
              >
                {COMEDY_CONDITIONS[cid].label}
              </span>
            ))}
          </div>
        )}

        {/* Stat tiles */}
        <div className="mt-4 grid grid-cols-4 gap-2 border-y border-[#e7dccb]/12 py-3.5">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#9ea6be]">
              Score
            </div>
            <div className="font-mono-num mt-0.5 text-lg font-bold text-[#f7efe1]">
              {hud.score}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#9ea6be]">
              Best
            </div>
            <div className="font-mono-num mt-0.5 text-lg font-bold text-[#ffbe5c]">
              {hud.bestScore}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#9ea6be]">
              Blood
            </div>
            <div className="font-mono-num mt-0.5 text-lg font-bold text-[#ff9ca6]">
              {hud.bellyFill}%
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#9ea6be]">
              +Evo
            </div>
            <div className="font-mono-num mt-0.5 text-lg font-bold text-[#88d4b8]">
              +{hud.evoPointsEarned}
            </div>
          </div>
        </div>

        {/* Toggleable Evolution & Trophy Drawer (keeps modal clean!) */}
        {!isPaused && (
          <div className="mt-3.5">
            <button
              type="button"
              data-testid="toggle-evolutions"
              onClick={() => setShowEvolutions((v) => !v)}
              className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-[#ffbe5c]/30 bg-[#1b213a] px-3.5 py-2 text-xs font-bold text-[#ffdf9e] transition-colors hover:border-[#ffbe5c]/60"
            >
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#ffbe5c]" />
                <span>
                  {showEvolutions ? 'Hide Evolutions & Trophies' : 'Evolve Mosquito & Trophies'}
                </span>
              </span>
              <span className="font-mono-num text-[#ffbe5c]">
                {totalEvoPoints} Evo Pts
              </span>
            </button>

            {showEvolutions && (
              <EvolutionPanel
                evoPoints={totalEvoPoints}
                unlockedUpgrades={unlockedUpgrades}
                unlockedAchievements={unlockedAchievements}
                activeTab={evoTab}
                onTabChange={setEvoTab}
                onUnlockUpgrade={onUnlockUpgrade}
              />
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {isPaused ? (
            <button
              type="button"
              onClick={onResume}
              className="flex-1 min-w-[130px] cursor-pointer rounded-xl border-2 border-[#171222] bg-[#ffbe5c] px-5 py-2.5 font-display text-base font-extrabold text-[#171222] shadow-[0_4px_0_#171222] transition-transform hover:-translate-y-0.5 hover:bg-[#ffcb78] active:translate-y-0.5"
            >
              Resume
            </button>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={onRestart}
              className="flex-1 min-w-[130px] cursor-pointer rounded-xl border-2 border-[#171222] bg-[#ffbe5c] px-5 py-2.5 font-display text-base font-extrabold text-[#171222] shadow-[0_4px_0_#171222] transition-transform hover:-translate-y-0.5 hover:bg-[#ffcb78] active:translate-y-0.5"
            >
              {canAdvanceNight ? `Next Night (${hud.roundNumber + 1})` : 'Try Again'}
            </button>
          )}

          {isPaused && (
            <button
              type="button"
              onClick={onRestart}
              className="cursor-pointer rounded-xl border border-[#e7dccb]/25 bg-[#1e2540] px-4 py-2.5 text-sm font-semibold text-[#f4ead9] transition-colors hover:border-[#ffbe5c]/60 hover:text-[#ffcf78]"
            >
              Restart
            </button>
          )}

          <button
            type="button"
            onClick={onTitle}
            className="cursor-pointer rounded-xl border border-[#e7dccb]/20 bg-transparent px-4 py-2.5 text-sm font-semibold text-[#c7beaf] transition-colors hover:border-[#e7dccb]/45 hover:text-[#f4ead9]"
          >
            Title
          </button>
        </div>
      </div>
    </div>
  );
}
