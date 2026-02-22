import type { ContractDefinition } from './types';

export const tutorialContracts: ContractDefinition[] = [
  {
    id: 'contract_tut_01',
    title: 'Paper Trail',
    clientCodename: 'SABLE',
    factionId: 'faction_independent',
    regionId: 'docklands',
    siteId: 'level1',
    objectiveType: 'EXFIL',
    summary: 'Open the path and exfiltrate cleanly before patrol review.',
    knownIntel: ['Primary corridor has one hard door lock (D1).'],
    unknowns: ['Unknown remote audit cadence.'],
    payout: 250,
    repReward: 1,
    heatPenaltyOnFail: 2,
    missionRules: {
      requireNoTrace: false,
    },
    storyIntro: [
      'Client SABLE wants a quiet extraction route reopened for a courier under active watch.',
      'You are not stealing data here. You are proving you can manipulate facility controls without triggering a full response.',
      'Open D1, move the runner through, and keep the operation clean enough to avoid drawing additional scrutiny.',
    ],
    storyTags: ['tutorial', 'doors'],
  },
  {
    id: 'contract_tut_02',
    title: 'Alarm Window',
    clientCodename: 'EMBER',
    factionId: 'faction_labor_front',
    regionId: 'riverline',
    siteId: 'level2',
    objectiveType: 'EXFIL',
    summary: 'Slip through before automated lockdown seals the route.',
    knownIntel: ['Camera C2 triggers alarm chain.', 'Door D2 hard-locks on alarm RED.'],
    unknowns: ['Escalation timing can be manipulated.'],
    payout: 420,
    repReward: 2,
    heatPenaltyOnFail: 3,
    missionRules: {
      requireNoTrace: false,
    },
    storyIntro: [
      'EMBER needs a maintenance bypass window before a labor witness is relocated off-site.',
      'The site auto-locks movement corridors once alarm state reaches RED.',
      'Your job is to buy just enough time in the alarm chain for the witness route to stay open.',
    ],
    storyTags: ['tutorial', 'alarm'],
  },
  {
    id: 'contract_tut_03',
    title: 'Sightline Cutoff',
    clientCodename: 'MOSS',
    factionId: 'faction_civic_watch',
    regionId: 'old_core',
    siteId: 'level3',
    objectiveType: 'SABOTAGE',
    summary: 'Neutralize surveillance timing long enough to cross the kill zone.',
    knownIntel: ['Turret T3 arms when detection chain activates.'],
    unknowns: ['Secondary alert channel may be dormant.'],
    payout: 650,
    repReward: 2,
    heatPenaltyOnFail: 4,
    missionRules: {
      requireNoTrace: false,
    },
    storyIntro: [
      'MOSS is tracking unauthorized surveillance at this node and needs proof of exploitability.',
      'The client expects resistance escalation if camera coverage is not neutralized quickly.',
      'Cross the zone alive and demonstrate that turret response can be disrupted on demand.',
    ],
    storyTags: ['turret'],
  },
  {
    id: 'contract_tut_04',
    title: 'Sequencer',
    clientCodename: 'VANTA',
    factionId: 'faction_syndicate',
    regionId: 'uptown_grid',
    siteId: 'level4',
    objectiveType: 'EXFIL',
    summary: 'Chain short-lived control windows while turret overwatch spins up.',
    knownIntel: ['Dual cameras overlap route.', 'Red alarm enables turret fire logic.'],
    unknowns: ['Drone DR4 patrol may absorb fire if retargeted.'],
    payout: 900,
    repReward: 3,
    heatPenaltyOnFail: 5,
    missionRules: {
      requireNoTrace: false,
    },
    storyIntro: [
      'VANTA commissioned a timed breach drill against a hardened path with overlapping watch lanes.',
      'Short disable windows are intentional: they want to validate operator sequencing under pressure.',
      'Complete the route by chaining controls precisely before weapons systems stabilize.',
    ],
    storyTags: ['timing', 'drone'],
  },
  {
    id: 'contract_tut_05',
    title: 'Tight Budget',
    clientCodename: 'HELIOS',
    factionId: 'faction_corporate_proxy',
    regionId: 'vault_sector',
    siteId: 'level5',
    objectiveType: 'RETRIEVE',
    summary: 'Navigate a constrained route with two locked checkpoints under hard pressure.',
    knownIntel: ['Dual doors and dual cameras cover the lane.'],
    unknowns: ['Response attribution currently noisy.'],
    payout: 1200,
    repReward: 4,
    heatPenaltyOnFail: 6,
    missionRules: {
      requireNoTrace: true,
    },
    storyIntro: [
      'HELIOS suspects financial tampering and needs a retrieval run through a heavily instrumented corridor.',
      'You are being measured on precision and operational discipline, not brute-force speed.',
      'Deliver a successful traversal while minimizing exposure; this contract determines whether premium clients keep funding your cell.',
    ],
    storyTags: ['budget', 'cleanup-intro'],
  },
];

export const contracts = tutorialContracts;

export const contractById: Record<string, ContractDefinition> = contracts.reduce<Record<string, ContractDefinition>>(
  (acc, contract) => {
    acc[contract.id] = contract;
    return acc;
  },
  {},
);

export const contractIdBySiteId: Record<string, string> = contracts.reduce<Record<string, string>>((acc, contract) => {
  if (!acc[contract.siteId]) {
    acc[contract.siteId] = contract.id;
  }
  return acc;
}, {});
