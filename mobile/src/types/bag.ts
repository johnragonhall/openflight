export type ClubCategory = 'driver' | 'wood' | 'hybrid' | 'iron' | 'wedge' | 'putter';

export interface ClubTypeOption {
  key: string;
  label: string;
  shotClub?: string; // maps to shots.club value from server
}

export interface ClubCategoryDef {
  category: ClubCategory;
  label: string;
  abbreviation: string;
  types: ClubTypeOption[];
}

export const CLUB_CATEGORIES: ClubCategoryDef[] = [
  {
    category: 'driver',
    label: 'Driver',
    abbreviation: 'Dr',
    types: [{ key: 'driver', label: 'Dr', shotClub: 'driver' }],
  },
  {
    category: 'wood',
    label: 'Wood',
    abbreviation: 'W',
    types: [
      { key: '2w', label: '2w' },
      { key: '3w', label: '3w', shotClub: '3-wood' },
      { key: '4w', label: '4w' },
      { key: '5w', label: '5w', shotClub: '5-wood' },
      { key: '7w', label: '7w', shotClub: '7-wood' },
      { key: '9w', label: '9w' },
    ],
  },
  {
    category: 'hybrid',
    label: 'Hybrid',
    abbreviation: 'H',
    types: [
      { key: '1h', label: '1h' },
      { key: '2h', label: '2h', shotClub: '2-hybrid' },
      { key: '3h', label: '3h', shotClub: '3-hybrid' },
      { key: '4h', label: '4h', shotClub: '4-hybrid' },
      { key: '5h', label: '5h', shotClub: '5-hybrid' },
      { key: '6h', label: '6h' },
      { key: '7h', label: '7h' },
    ],
  },
  {
    category: 'iron',
    label: 'Iron',
    abbreviation: 'I',
    types: [
      { key: '2i', label: '2i', shotClub: '2-iron' },
      { key: '3i', label: '3i', shotClub: '3-iron' },
      { key: '4i', label: '4i', shotClub: '4-iron' },
      { key: '5i', label: '5i', shotClub: '5-iron' },
      { key: '6i', label: '6i', shotClub: '6-iron' },
      { key: '7i', label: '7i', shotClub: '7-iron' },
      { key: '8i', label: '8i', shotClub: '8-iron' },
      { key: '9i', label: '9i', shotClub: '9-iron' },
    ],
  },
  {
    category: 'wedge',
    label: 'Wedge',
    abbreviation: 'Wdg',
    types: [
      { key: 'pw', label: 'PW', shotClub: 'pitching-wedge' },
      { key: 'gw', label: 'GW', shotClub: 'gap-wedge' },
      { key: 'sw', label: 'SW', shotClub: 'sand-wedge' },
      { key: 'lw', label: 'LW', shotClub: 'lob-wedge' },
      { key: 'w50', label: '50°' },
      { key: 'w52', label: '52°' },
      { key: 'w54', label: '54°' },
      { key: 'w56', label: '56°' },
      { key: 'w58', label: '58°' },
      { key: 'w60', label: '60°' },
    ],
  },
  {
    category: 'putter',
    label: 'Putter',
    abbreviation: 'Pt',
    types: [{ key: 'putter', label: 'Pt' }],
  },
];

export interface Club {
  id: string;
  category: ClubCategory;
  type_key: string;
  abbreviation: string;
  brand: string;
  name: string;
  in_bag: boolean;
  bag_position: number;
}

export interface ClubWithStats extends Club {
  avg_carry: number | null;
  avg_total: number | null;
  shot_count: number;
  last_shot_at: string | null;
}

// Maps shots.club (server string) → our type_key
export const SHOT_CLUB_TO_TYPE_KEY: Record<string, string> = {
  driver: 'driver',
  '3-wood': '3w', '5-wood': '5w', '7-wood': '7w',
  '2-hybrid': '2h', '3-hybrid': '3h', '4-hybrid': '4h', '5-hybrid': '5h',
  hybrid: '3h',
  '2-iron': '2i', '3-iron': '3i', '4-iron': '4i', '5-iron': '5i',
  '6-iron': '6i', '7-iron': '7i', '8-iron': '8i', '9-iron': '9i',
  'pitching-wedge': 'pw', 'gap-wedge': 'gw', 'sand-wedge': 'sw', 'lob-wedge': 'lw',
};

export function getTypeLabel(category: ClubCategory, typeKey: string): string {
  const cat = CLUB_CATEGORIES.find(c => c.category === category);
  return cat?.types.find(t => t.key === typeKey)?.label ?? typeKey;
}

export function getClubDisplayName(club: Pick<Club, 'category' | 'type_key' | 'brand' | 'name'>): string {
  if (club.name) return club.name;
  const label = getTypeLabel(club.category, club.type_key);
  return club.brand ? `${club.brand} ${label}` : label;
}

export function getShotClubForTypeKey(typeKey: string): string | undefined {
  return Object.entries(SHOT_CLUB_TO_TYPE_KEY).find(([, v]) => v === typeKey)?.[0];
}
