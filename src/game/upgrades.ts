import type { AchievementId, ComedyConditionId, UpgradeId } from './types';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  tagline: string;
  description: string;
  cost: number;
  badgeColor: string;
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'turbo_wings',
    name: 'Turbo Wings',
    tagline: 'Carbon-fiber flutter',
    description: '+18% max flight speed & snappier air steering.',
    cost: 30,
    badgeColor: '#66d9ef',
  },
  {
    id: 'mega_proboscis',
    name: 'Mega Proboscis',
    tagline: 'Artisanal brass straw',
    description: '+30% faster blood collection & +25% sip points.',
    cost: 40,
    badgeColor: '#ffbe5c',
  },
  {
    id: 'ninja_mosquito',
    name: 'Ninja Mosquito',
    tagline: 'Stealth headband',
    description: '-32% buzzing noise & 22% calmer sleeper tension.',
    cost: 35,
    badgeColor: '#ff6b78',
  },
  {
    id: 'blood_tank',
    name: 'Blood Tank',
    tagline: 'Reinforced belly pack',
    description: '+25 max energy capacity & 40% lighter bloat penalty.',
    cost: 35,
    badgeColor: '#d94862',
  },
  {
    id: 'emergency_dash',
    name: 'Emergency Dash',
    tagline: 'Nitrous tail puff',
    description: '-32% dash cooldown & +18% escape burst speed.',
    cost: 45,
    badgeColor: '#a6e22e',
  },
];

export interface AchievementDef {
  id: AchievementId;
  title: string;
  description: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'greedy_balloon',
    title: 'Greedy Chonk',
    description: 'Drink so much at once you get bloated and heavy.',
  },
  {
    id: 'sneeze_rocket',
    title: 'Sneeze Astronaut',
    description: 'Get launched across the room by a suspicious sneeze.',
  },
  {
    id: 'juice_goblin',
    title: 'Juice Goblin',
    description: 'Refuel from forgotten bedroom snacks.',
  },
  {
    id: 'alarm_dodger',
    title: 'Midnight Houdini',
    description: 'Escape through the window after the alarm rings.',
  },
  {
    id: 'swat_bait',
    title: 'Ankle Biter Deluxe',
    description: 'Pull off 3+ near-misses in a single round.',
  },
  {
    id: 'mad_scientist',
    title: 'Symptom Collector',
    description: 'Trigger all 3 comedy conditions on one sleeper.',
  },
];

export interface ConditionMeta {
  id: ComedyConditionId;
  label: string;
  quips: string[];
}

export const COMEDY_CONDITIONS: Record<ComedyConditionId, ConditionMeta> = {
  itchy_elbow: {
    id: 'itchy_elbow',
    label: 'Itchy Elbow Syndrome',
    quips: [
      'Why is my elbow SO itchy?!',
      'Phantom mosquito itch!!',
      'Stop scratching in your sleep!',
    ],
  },
  dramatic_fever: {
    id: 'dramatic_fever',
    label: 'Mild Dramatic Fever',
    quips: [
      '98.7°F... tell my cat I tried.',
      'So warm... must be tropical.',
      'Dramatic forehead sweat!',
    ],
  },
  sneezing_disorder: {
    id: 'sneezing_disorder',
    label: 'Suspicious Sneezing Disorder',
    quips: [
      'Ah... AH... ACHOO!!',
      'Allergic to tiny freeloaders!',
      'Bless this room!!',
    ],
  },
};

export interface PersistentProgress {
  bestScore: number;
  evoPoints: number;
  unlockedUpgrades: UpgradeId[];
  unlockedAchievements: AchievementId[];
  roundNumber: number;
}

export function createDefaultProgress(): PersistentProgress {
  return {
    bestScore: 0,
    evoPoints: 0,
    unlockedUpgrades: [],
    unlockedAchievements: [],
    roundNumber: 1,
  };
}
