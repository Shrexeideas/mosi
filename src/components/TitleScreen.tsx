import { useState } from 'react';
import { Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { EvolutionPanel } from './EvolutionPanel';
import type { AchievementId, UpgradeId } from '../game/types';

interface TitleScreenProps {
  bestScore: number;
  roundNumber: number;
  evoPoints: number;
  unlockedUpgrades: UpgradeId[];
  unlockedAchievements: AchievementId[];
  muted: boolean;
  onUnlockUpgrade: (id: UpgradeId) => void;
  onToggleMute: () => void;
  onStart: () => void;
}

export function TitleScreen({
  bestScore,
  roundNumber,
  evoPoints,
  unlockedUpgrades,
  unlockedAchievements,
  muted,
  onUnlockUpgrade,
  onToggleMute,
  onStart,
}: TitleScreenProps) {
  const [showLab, setShowLab] = useState(false);
  const [labTab, setLabTab] = useState<'evolutions' | 'achievements'>('evolutions');

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-5 sm:p-8">
      {/* Top Bar: Sound toggle only */}
      <div className="flex items-start justify-end">
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={muted ? 'Unmute sound' : 'Mute sound'}
          className="pointer-events-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-[#e2d6c3]/20 bg-[#14192e]/85 text-[#f4ead9] transition-colors hover:border-[#ffbe5c]/60 hover:text-[#ffcf78] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffbe5c]"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>

      {/* Upper-Center Lockup anchored in calm wall negative space above bed */}
      <div className="mx-auto mt-2 mb-auto flex w-full max-w-4xl flex-col items-center justify-start pt-2 text-center sm:mt-4 sm:pt-4 md:pr-20">
        <div className="relative flex flex-col items-center">
          {/* Small animated hovering mosquito orbiting the title */}
          <div
            aria-hidden="true"
            className="animate-title-mosquito pointer-events-none absolute -top-7 right-0 sm:-right-14 sm:-top-5"
          >
            <svg width="74" height="58" viewBox="0 0 74 58" fill="none">
              <ellipse
                cx="31"
                cy="18"
                rx="16"
                ry="6"
                transform="rotate(-24 31 18)"
                fill="#dff4ff"
                fillOpacity="0.65"
                stroke="#8bb8db"
                strokeWidth="1.5"
              />
              <ellipse
                cx="26"
                cy="22"
                rx="13"
                ry="5"
                transform="rotate(-42 26 22)"
                fill="#cceaff"
                fillOpacity="0.45"
                stroke="#8bb8db"
                strokeWidth="1.2"
              />
              <path
                d="M32 34 L25 45 L19 49 M36 35 L33 46 L29 51 M40 34 L42 45 L38 49"
                stroke="#181424"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <ellipse
                cx="23"
                cy="33"
                rx="12"
                ry="6.5"
                transform="rotate(-12 23 33)"
                fill="#d63a4e"
                stroke="#181424"
                strokeWidth="2.2"
              />
              <path
                d="M17 29 L19 38 M23 27 L25 38 M29 28 L30 37"
                stroke="#181424"
                strokeOpacity="0.7"
                strokeWidth="2"
              />
              <ellipse cx="36" cy="30" rx="7" ry="6" fill="#3c4054" stroke="#181424" strokeWidth="2.2" />
              <circle cx="45" cy="28" r="6" fill="#4a4f66" stroke="#181424" strokeWidth="2.2" />
              <path d="M51 28 L64 31" stroke="#181424" strokeWidth="2.2" strokeLinecap="round" />
              <circle cx="47" cy="26" r="4.5" fill="#ffffff" stroke="#181424" strokeWidth="1.8" />
              <circle cx="48.2" cy="26" r="2" fill="#181424" />
            </svg>
          </div>

          <h1 className="sr-only">Long-Distance Mosquito</h1>
          <svg
            viewBox="0 0 540 148"
            className="h-auto w-full max-w-[460px]"
            aria-hidden="true"
          >
            <text
              x="270"
              y="52"
              textAnchor="middle"
              fill="#f7efe1"
              stroke="#121526"
              strokeWidth="8"
              paintOrder="stroke fill"
              fontFamily="Bricolage Grotesque, sans-serif"
              fontWeight="800"
              fontSize="42"
              letterSpacing="-1"
            >
              LONG-DISTANCE
            </text>
            <text
              x="270"
              y="122"
              textAnchor="middle"
              fill="#ffbe5c"
              stroke="#121526"
              strokeWidth="10"
              paintOrder="stroke fill"
              fontFamily="Bricolage Grotesque, sans-serif"
              fontWeight="800"
              fontSize="72"
              letterSpacing="-1.5"
            >
              MOSQUITO
            </text>
          </svg>

          <p className="mt-1.5 text-base font-medium tracking-wide text-[#dfd7ca] [text-shadow:0_2px_6px_rgba(0,0,0,0.9)] sm:text-lg">
            One tiny mosquito. One very light sleeper.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3.5">
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onStart();
              }}
              className="pointer-events-auto inline-flex min-h-[50px] min-w-[164px] cursor-pointer items-center justify-center rounded-xl border-2 border-[#171222] bg-[#ffbe5c] px-8 py-3 font-display text-lg font-extrabold tracking-wide text-[#171222] shadow-[0_5px_0_#171222] transition-transform duration-150 hover:-translate-y-0.5 hover:bg-[#ffcb78] active:translate-y-0.5 active:shadow-[0_2px_0_#171222] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffbe5c]"
            >
              {roundNumber > 1 ? `PLAY NIGHT ${roundNumber}` : 'PLAY'}
            </button>

            {(evoPoints > 0 || unlockedUpgrades.length > 0 || unlockedAchievements.length > 0) && (
              <button
                type="button"
                data-testid="open-title-evolutions"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setShowLab(true);
                }}
                className="pointer-events-auto inline-flex min-h-[46px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#ffbe5c]/45 bg-[#151a2f]/90 px-4 py-2 text-sm font-bold text-[#ffdf9e] transition-colors hover:border-[#ffbe5c] hover:text-[#fff3d6]"
              >
                <Sparkles className="h-4 w-4 text-[#ffbe5c]" />
                <span>Evolutions</span>
                <span className="font-mono-num text-xs text-[#ffbe5c]">
                  ({evoPoints})
                </span>
              </button>
            )}

            {bestScore > 0 && (
              <span className="font-mono-num text-sm font-semibold text-[#e6dccb]/90 [text-shadow:0_2px_6px_rgba(0,0,0,0.85)]">
                Best {bestScore}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom single-line flat control hint */}
      <div className="flex justify-center">
        <p className="hidden text-center text-sm font-medium tracking-wide text-[#eae2d6]/90 [text-shadow:0_2px_4px_rgba(0,0,0,0.95)] sm:block">
          WASD / Arrows Move · Hold Space Sip · Shift Dash · Esc Pause
        </p>
        <p className="text-center text-xs font-medium tracking-wide text-[#eae2d6]/90 [text-shadow:0_2px_4px_rgba(0,0,0,0.95)] sm:hidden">
          Drag to fly · Hold Sip · Tap Dash
        </p>
      </div>

      {/* Optional compact Evolutions & Trophies dialog when opened from Title */}
      {showLab && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mosquito Evolutions and Trophies"
          className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-[#090c18]/80 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border-2 border-[#e7dccb]/20 bg-[#151a2f] p-5 text-[#f6efe2] shadow-[0_18px_48px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold text-[#ffbe5c]">
                Mosquito Lab
              </h2>
              <button
                type="button"
                aria-label="Close evolutions"
                onClick={() => setShowLab(false)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#e7dccb]/20 text-[#cfc6b7] hover:text-[#f7efe1]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <EvolutionPanel
              evoPoints={evoPoints}
              unlockedUpgrades={unlockedUpgrades}
              unlockedAchievements={unlockedAchievements}
              activeTab={labTab}
              onTabChange={setLabTab}
              onUnlockUpgrade={onUnlockUpgrade}
            />
          </div>
        </div>
      )}
    </div>
  );
}
