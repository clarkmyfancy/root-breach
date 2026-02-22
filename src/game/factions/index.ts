export interface Faction {
  id: string;
  name: string;
  alignment: 'Corporate' | 'Criminal' | 'Civic' | 'Unknown';
  trust: number;
  hostility: number;
  description: string;
}

export const factions: Faction[] = [
  {
    id: 'faction_independent',
    name: 'Independent Brokers',
    alignment: 'Unknown',
    trust: 0,
    hostility: 0,
    description: 'Broker network trading deniable access and time-sensitive contracts.',
  },
  {
    id: 'faction_labor_front',
    name: 'Labor Front',
    alignment: 'Civic',
    trust: 0,
    hostility: 0,
    description: 'Organized labor coalition outsourcing digital leverage operations.',
  },
  {
    id: 'faction_civic_watch',
    name: 'Civic Watch',
    alignment: 'Civic',
    trust: 0,
    hostility: 0,
    description: 'Semi-legal watchdog cell weaponizing leaks and controlled disruptions.',
  },
  {
    id: 'faction_syndicate',
    name: 'Vanta Syndicate',
    alignment: 'Criminal',
    trust: 0,
    hostility: 0,
    description: 'Professional illicit intermediary buying outcomes instead of loyalty.',
  },
  {
    id: 'faction_corporate_proxy',
    name: 'Helios Proxy Division',
    alignment: 'Corporate',
    trust: 0,
    hostility: 0,
    description: 'Corporate front running black-budget influence and sabotage programs.',
  },
];

export const factionById: Record<string, Faction> = factions.reduce<Record<string, Faction>>((acc, faction) => {
  acc[faction.id] = faction;
  return acc;
}, {});
