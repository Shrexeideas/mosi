import { Check, Sparkles, Trophy } from 'lucide-react';
import { ACHIEVEMENTS, UPGRADES } from '../game/upgrades';
import type { AchievementId, UpgradeId } from '../game/types';

interface EvolutionPanelProps {
  evoPoints: number;
  unlockedUpgrades: UpgradeId[];
  unlockedAchievements: AchievementId[];
  activeTab: 'evolutions' | 'achievements';
  onTabChange: (tab: 'evolutions' | 'achievements') => void;
  onUnlockUpgrade: (id: UpgradeId) => void;
}

export function EvolutionPanel({
  evoPoints,
  unlockedUpgrades,
  unlockedAchievements,
  activeTab,
  onTabChange,
  onUnlockUpgrade,
}: EvolutionPanelProps) {
  return (
    <div className="mt-4 rounded-xl border border-[#e7dccb]/15 bg-[#101426] p-3">
      <div className="flex items-center justify-between gap-2 border-b border-[#e7dccb]/10 pb-2.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onTabChange('evolutions')}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
              activeTab === 'evolutions'
                ? 'bg-[#ffbe5c] text-[#171222]'
                : 'bg-[#1a203b] text-[#cfc6b7] hover:text-[#f7efe1]'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Evolutions ({unlockedUpgrades.length}/5)</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('achievements')}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
              activeTab === 'achievements'
                ? 'bg-[#88d4b8] text-[#121626]'
                : 'bg-[#1a203b] text-[#cfc6b7] hover:text-[#f7efe1]'
            }`}
          >
            <Trophy className="h-3.5 w-3.5" />
            <span>
              Trophies ({unlockedAchievements.length}/{ACHIEVEMENTS.length})
            </span>
          </button>
        </div>

        <span
          data-testid="evo-points-balance"
          className="font-mono-num text-xs font-bold text-[#ffcf78]"
        >
          {evoPoints} Evo Pts
        </span>
      </div>

      {activeTab === 'evolutions' ? (
        <div className="mt-2.5 grid max-h-[220px] grid-cols-1 gap-2 overflow-y-auto pr-0.5">
          {UPGRADES.map((u) => {
            const owned = unlockedUpgrades.includes(u.id);
            const canAfford = !owned && evoPoints >= u.cost;
            return (
              <div
                key={u.id}
                className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 ${
                  owned
                    ? 'border-[#88d4b8]/40 bg-[#142529]'
                    : 'border-[#e7dccb]/10 bg-[#171c34]'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: u.badgeColor }}
                      aria-hidden="true"
                    />
                    <span className="truncate text-xs font-bold text-[#f7efe1]">
                      {u.name}
                    </span>
                    <span className="text-[10px] font-medium text-[#9ea6be]">
                      · {u.tagline}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-[#c7beaf]">
                    {u.description}
                  </p>
                </div>

                {owned ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#88d4b8]/15 px-2 py-1 text-[11px] font-bold text-[#88d4b8]">
                    <Check className="h-3 w-3" />
                    Evolved
                  </span>
                ) : (
                  <button
                    type="button"
                    data-testid={`unlock-${u.id}`}
                    disabled={!canAfford}
                    onClick={() => onUnlockUpgrade(u.id)}
                    className={`font-mono-num shrink-0 rounded-lg border px-2.5 py-1 text-xs font-extrabold transition-colors ${
                      canAfford
                        ? 'cursor-pointer border-[#171222] bg-[#ffbe5c] text-[#171222] hover:bg-[#ffcf78]'
                        : 'cursor-not-allowed border-[#e7dccb]/10 bg-[#202642] text-[#7c85a0]'
                    }`}
                  >
                    {u.cost} pts
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-2.5 grid max-h-[220px] grid-cols-1 gap-2 overflow-y-auto pr-0.5">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = unlockedAchievements.includes(a.id);
            return (
              <div
                key={a.id}
                className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 ${
                  unlocked
                    ? 'border-[#ffbe5c]/45 bg-[#23202a]'
                    : 'border-[#e7dccb]/10 bg-[#171c34]/60 opacity-75'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#f7efe1]">
                    {a.title}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-[#c7beaf]">
                    {a.description}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                    unlocked
                      ? 'bg-[#ffbe5c]/20 text-[#ffcf78]'
                      : 'bg-[#212742] text-[#838ca6]'
                  }`}
                >
                  {unlocked ? 'Unlocked' : 'Locked'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
