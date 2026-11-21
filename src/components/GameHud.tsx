import { Pause, Volume2, VolumeX } from 'lucide-react';
import type { HudSnapshot } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  totalEvoPoints: number;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onTouchSipChange: (held: boolean) => void;
  onTouchDash: () => void;
}

export function GameHud({
  hud,
  totalEvoPoints,
  muted,
  onToggleMute,
  onPause,
  onTouchSipChange,
  onTouchDash,
}: GameHudProps) {
  const isEscape = hud.subPhase === 'escape';
  const isWindup = hud.sleeperMood === 'windup' || hud.sleeperMood === 'strike';
  const isStirring = hud.sleeperMood === 'stirring';

  const formatTimer = (sec: number) => {
    const clamped = Math.max(0, Math.ceil(sec));
    const m = Math.floor(clamped / 60);
    const s = clamped % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const noiseColor =
    hud.noise >= 75
      ? '#ff5a5f'
      : hud.noise >= 46
        ? '#ffbe5c'
        : '#88d4b8';

  const energyPct = Math.max(
    0,
    Math.min(100, Math.round((hud.energy / Math.max(1, hud.maxEnergy)) * 100))
  );
  const activeTimer = isEscape ? hud.escapeTimer : hud.timeRemaining;
  const isTimerUrgent = isEscape || activeTimer <= 10;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3.5 sm:p-6">
      {/* Top Perimeter Clusters (>= 85% viewport unobstructed) */}
      <div className="relative flex items-start justify-between gap-2">
        {/* Top-Left: Score + Blood + Tiny Evo + Noise/Stamina bars */}
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-baseline gap-1.5 sm:gap-2.5">
            <span
              data-testid="hud-score"
              className="font-mono-num text-xl font-bold leading-none text-[#f7efe1] [text-shadow:0_2px_8px_rgba(8,10,20,0.95)] sm:text-3xl"
            >
              {hud.score}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#d8cfbf]/80 [text-shadow:0_2px_4px_rgba(8,10,20,0.9)] sm:text-xs">
              pts
            </span>
            <span className="text-[#d8cfbf]/40" aria-hidden="true">·</span>
            {/* Blood Goal */}
            <div className="flex items-center gap-1" aria-label={`Blood ${hud.bellyFill}%`}>
              <svg width="11" height="14" viewBox="0 0 13 16" fill="none" aria-hidden="true">
                <path
                  d="M6.5 1C6.5 1 1 7.2 1 10.6C1 13.5 3.4 15.5 6.5 15.5C9.6 15.5 12 13.5 12 10.6C12 7.2 6.5 1 6.5 1Z"
                  fill="#e63946"
                  stroke="#14182a"
                  strokeWidth="1.5"
                />
              </svg>
              <span
                data-testid="hud-belly"
                className="font-mono-num text-xs font-bold text-[#ff9ca6] [text-shadow:0_2px_6px_rgba(8,10,20,0.95)] sm:text-sm"
              >
                {hud.bellyFill}%
              </span>
            </div>
            <span className="text-[#d8cfbf]/40" aria-hidden="true">·</span>
            {/* Tiny Evolution Indicator */}
            <span
              data-testid="hud-evo"
              className="font-mono-num text-[11px] font-bold text-[#ffcf78] [text-shadow:0_2px_6px_rgba(8,10,20,0.95)] sm:text-xs"
              title="Evolution points & unlocked traits"
            >
              EVO {totalEvoPoints + hud.evoPointsEarned}
              {hud.unlockedUpgrades.length > 0 ? ` (${hud.unlockedUpgrades.length}/5)` : ''}
            </span>
          </div>

          {/* Compact Noise & Stamina micro-bars */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#cfc6b7]/85 [text-shadow:0_1px_4px_rgba(8,10,20,0.95)] sm:text-[10px]">
                Noise
              </span>
              <div
                className="h-1.5 w-14 overflow-hidden rounded-full border border-[#e7dccb]/20 bg-[#0d1120]/85 sm:w-20"
                role="progressbar"
                aria-label="Noise level"
                aria-valuenow={hud.noise}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full origin-left transition-transform duration-100"
                  style={{
                    width: '100%',
                    transform: `scaleX(${Math.max(0.03, hud.noise / 100)})`,
                    backgroundColor: noiseColor,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#cfc6b7]/85 [text-shadow:0_1px_4px_rgba(8,10,20,0.95)] sm:text-[10px]">
                <span className="sm:hidden">Stam</span>
                <span className="hidden sm:inline">Stamina</span>
              </span>
              <div
                className="h-1.5 w-12 overflow-hidden rounded-full border border-[#e7dccb]/20 bg-[#0d1120]/85 sm:w-16"
                role="progressbar"
                aria-label="Mosquito stamina"
                aria-valuenow={energyPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full origin-left transition-transform duration-100"
                  style={{
                    width: '100%',
                    transform: `scaleX(${Math.max(0.04, energyPct / 100)})`,
                    backgroundColor: energyPct <= 20 ? '#ff7b78' : '#7ae582',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Top-Right: Alarm / Escape Timer + Sound + Pause */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#cfc6b7]/80 [text-shadow:0_1px_4px_rgba(8,10,20,0.95)] sm:text-[10px]">
              {isEscape ? 'Escape' : `Night ${hud.roundNumber}`}
            </span>
            <div
              data-testid="hud-timer"
              className={`font-mono-num mr-0.5 text-lg font-bold leading-none [text-shadow:0_2px_8px_rgba(8,10,20,0.95)] sm:text-2xl ${
                isTimerUrgent ? 'text-[#ff7b78]' : 'text-[#f7efe1]'
              }`}
            >
              {formatTimer(activeTimer)}
            </div>
          </div>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            className="pointer-events-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-[#e7dccb]/20 bg-[#14192e]/85 text-[#f4ead9] transition-colors hover:border-[#ffbe5c]/60 hover:text-[#ffcf78] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffbe5c] sm:h-10 sm:w-10"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            aria-label="Pause game"
            className="pointer-events-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-[#e7dccb]/20 bg-[#14192e]/85 text-[#f4ead9] transition-colors hover:border-[#ffbe5c]/60 hover:text-[#ffcf78] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffbe5c] sm:h-10 sm:w-10"
          >
            <Pause className="h-4 w-4" />
          </button>
        </div>

        {/* Centered floating Alert / Escape / Comedy Toast (never squeezes top corners on mobile!) */}
        {(isWindup || isStirring || isEscape || hud.bannerText) && (
          <div className="pointer-events-none absolute top-14 left-1/2 flex w-max max-w-[90vw] -translate-x-1/2 flex-col items-center gap-1 sm:top-0">
            {(isWindup || isStirring || isEscape) && (
              <div
                role="status"
                data-testid="hud-alert"
                className={`animate-danger-pulse flex items-center gap-2 rounded-lg border px-3 py-1 text-xs font-bold tracking-wide shadow-[0_3px_10px_rgba(0,0,0,0.5)] sm:text-sm ${
                  isWindup
                    ? 'border-[#ff5a5f]/70 bg-[#2a121b]/90 text-[#ffd2cf]'
                    : isEscape
                      ? 'border-[#88f2c8]/70 bg-[#112a24]/90 text-[#b7ffe2]'
                      : 'border-[#ffbe5c]/50 bg-[#1d1c2e]/85 text-[#ffe1a3]'
                }`}
              >
                <span>
                  {isWindup
                    ? 'SWAT INCOMING!'
                    : isEscape
                      ? 'ALARM! FLY TO WINDOW!'
                      : 'Sleeper stirring...'}
                </span>
              </div>
            )}

            {!isWindup && hud.bannerText && (
              <div
                role="status"
                data-testid="hud-banner"
                className="rounded-lg border border-[#ffbe5c]/35 bg-[#151a2e]/92 px-3 py-1 text-center text-xs font-semibold tracking-wide text-[#ffdf9e] shadow-[0_3px_10px_rgba(0,0,0,0.45)]"
              >
                {hud.bannerText}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Touch Controls for mobile / touch screens (compact, bottom-right only) */}
      <div className="flex items-end justify-between md:hidden">
        <span className="text-[11px] font-medium text-[#d4ccbe]/75 [text-shadow:0_1px_4px_rgba(0,0,0,0.95)]">
          Drag anywhere to fly
        </span>
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onTouchDash();
            }}
            disabled={!hud.dashReady}
            className={`flex h-12 min-w-[66px] items-center justify-center rounded-xl border-2 border-[#171222] px-3 font-display text-xs font-extrabold tracking-wide shadow-[0_3px_0_#171222] ${
              hud.dashReady
                ? 'bg-[#6bb8d9] text-[#121626] active:translate-y-0.5'
                : 'bg-[#2a334d]/80 text-[#9aa4bd]'
            }`}
          >
            DASH
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onTouchSipChange(true);
            }}
            onPointerUp={() => onTouchSipChange(false)}
            onPointerCancel={() => onTouchSipChange(false)}
            onPointerLeave={() => onTouchSipChange(false)}
            className={`flex h-14 min-w-[72px] items-center justify-center rounded-xl border-2 border-[#171222] px-4 font-display text-sm font-extrabold tracking-wide shadow-[0_3px_0_#171222] ${
              hud.canSip || hud.isSipping
                ? 'bg-[#ff6b78] text-[#171222] active:translate-y-0.5'
                : hud.canSipFood || hud.isDrinkingFood
                  ? 'bg-[#a6e22e] text-[#171222] active:translate-y-0.5'
                  : 'bg-[#252c44]/85 text-[#c8c0b4]'
            }`}
          >
            {hud.isSipping
              ? 'SIPPING'
              : hud.isDrinkingFood
                ? 'SNACK'
                : hud.canSipFood && !hud.canSip
                  ? 'SNACK'
                  : 'SIP'}
          </button>
        </div>
      </div>
    </div>
  );
}
