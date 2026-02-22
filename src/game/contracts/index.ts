import type { ContractDefinition } from './types';

interface SiteContractScope {
  siteNodes: string[];
  fileTargets: string[];
  recordTargets: string[];
  authEndpoints: string[];
  frameTargets: string[];
}

const scopeBySiteId: Record<string, SiteContractScope> = {
  level1: {
    siteNodes: ['N1_ENTRY', 'N1_DOOR', 'N1_EXIT'],
    fileTargets: ['OPS_ROUTE_PACKET'],
    recordTargets: ['MAINT_SHIFT_A'],
    authEndpoints: ['AUTH_L1'],
    frameTargets: ['RIVAL_OPS', 'MAINT_CREW'],
  },
  level2: {
    siteNodes: ['N2_GATE', 'N2_ALARM', 'N2_LOCK'],
    fileTargets: ['SHIFT_LEDGER_22'],
    recordTargets: ['WITNESS_TRANSPORT'],
    authEndpoints: ['AUTH_L2'],
    frameTargets: ['RIVAL_OPS', 'FACILITY_MAINT'],
  },
  level3: {
    siteNodes: ['N3_WEST', 'N3_TURRET', 'N3_ARCHIVE'],
    fileTargets: ['SURV_PACKAGE_C3'],
    recordTargets: ['ASSET_REGISTRY_11'],
    authEndpoints: ['AUTH_L3'],
    frameTargets: ['RIVAL_OPS', 'SEC_TEAM_DELTA'],
  },
  level4: {
    siteNodes: ['N4_ENTRY', 'N4_DRONE_LOOP', 'N4_CONTROL'],
    fileTargets: ['OPS_DRILL_PLAN'],
    recordTargets: ['MAINT_WINDOW_LOG'],
    authEndpoints: ['AUTH_L4'],
    frameTargets: ['RIVAL_OPS', 'SHIFT_SUPERVISOR'],
  },
  level5: {
    siteNodes: ['N5_CHECKPOINT_A', 'N5_CHECKPOINT_B', 'N5_VAULT_EDGE'],
    fileTargets: ['FIN_AUDIT_BUNDLE', 'VAULT_DOC'],
    recordTargets: ['EMP_042', 'PAYROLL_5'],
    authEndpoints: ['AUTH_L5'],
    frameTargets: ['RIVAL_OPS', 'CONTRACTOR_ZETA'],
  },
};

function withScope(contract: Omit<ContractDefinition, keyof SiteContractScope>): ContractDefinition {
  const scope = scopeBySiteId[contract.siteId];
  return {
    ...contract,
    siteNodes: scope.siteNodes,
    fileTargets: scope.fileTargets,
    recordTargets: scope.recordTargets,
    authEndpoints: scope.authEndpoints,
    frameTargets: scope.frameTargets,
  };
}

export const contracts: ContractDefinition[] = [
  withScope({
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
    requiredTools: ['tool_core_control'],
    missionRules: {
      requireNoTrace: false,
      cleanupWindowTicks: 18,
    },
    storyIntro: [
      'Client SABLE wants a quiet extraction route reopened for a courier under active watch.',
      'You are not stealing data here. You are proving you can manipulate facility controls without triggering a full response.',
      'Open D1, move the runner through, and keep the operation clean enough to avoid drawing additional scrutiny.',
    ],
    storyTags: ['tutorial', 'doors'],
  }),
  withScope({
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
    requiredTools: ['tool_core_control', 'tool_alarm_link'],
    missionRules: {
      requireNoTrace: false,
      cleanupWindowTicks: 22,
    },
    storyIntro: [
      'EMBER needs a maintenance bypass window before a labor witness is relocated off-site.',
      'The site auto-locks movement corridors once alarm state reaches RED.',
      'Your job is to buy just enough time in the alarm chain for the witness route to stay open.',
    ],
    storyTags: ['tutorial', 'alarm'],
  }),
  withScope({
    id: 'contract_tut_03',
    title: 'Sightline Cutoff',
    clientCodename: 'MOSS',
    factionId: 'faction_civic_watch',
    regionId: 'old_core',
    siteId: 'level3',
    objectiveType: 'SABOTAGE',
    summary: 'Demonstrate surveillance disruption by forcing the node into a controlled fault.',
    knownIntel: ['Turret T3 arms when detection chain activates.'],
    unknowns: ['Secondary alert channel may be dormant.'],
    payout: 650,
    repReward: 2,
    heatPenaltyOnFail: 4,
    requiredTools: ['tool_core_control', 'tool_payload_ops'],
    missionRules: {
      requireNoTrace: false,
      cleanupWindowTicks: 24,
    },
    storyIntro: [
      'MOSS is tracking unauthorized surveillance at this node and needs proof of exploitability.',
      'The client expects resistance escalation if camera coverage is not neutralized quickly.',
      'Cross the zone alive and submit a sabotage marker proving hard controls can be destabilized.',
    ],
    storyTags: ['turret', 'sabotage'],
  }),
  withScope({
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
    requiredTools: ['tool_core_control', 'tool_target_redirector'],
    missionRules: {
      requireNoTrace: false,
      cleanupWindowTicks: 26,
    },
    storyIntro: [
      'VANTA commissioned a timed breach drill against a hardened path with overlapping watch lanes.',
      'Short disable windows are intentional: they want to validate operator sequencing under pressure.',
      'Complete the route by chaining controls precisely before weapons systems stabilize.',
    ],
    storyTags: ['timing', 'drone'],
  }),
  withScope({
    id: 'contract_tut_05',
    title: 'Tight Budget',
    clientCodename: 'HELIOS',
    factionId: 'faction_corporate_proxy',
    regionId: 'vault_sector',
    siteId: 'level5',
    objectiveType: 'RETRIEVE',
    summary: 'Retrieve the audit bundle and leave no operator-attributed residue.',
    knownIntel: ['Dual doors and dual cameras cover the lane.'],
    unknowns: ['Response attribution currently noisy.'],
    payout: 1200,
    repReward: 4,
    heatPenaltyOnFail: 6,
    requiredTools: ['tool_core_control', 'tool_payload_ops', 'tool_scrub_suite'],
    missionRules: {
      requireNoTrace: true,
      cleanupWindowTicks: 30,
    },
    storyIntro: [
      'HELIOS suspects financial tampering and needs a retrieval run through a heavily instrumented corridor.',
      'You are being measured on precision and operational discipline, not brute-force speed.',
      'Deliver the target file, then sanitize the operation before vault analytics pin attribution.',
    ],
    storyTags: ['budget', 'cleanup-intro'],
  }),
  withScope({
    id: 'contract_act1_06',
    title: 'Ledger Burn',
    clientCodename: 'EMBER',
    factionId: 'faction_labor_front',
    regionId: 'riverline',
    siteId: 'level2',
    objectiveType: 'DELETE',
    summary: 'Destroy payroll evidence and avoid creating a clean attribution chain.',
    knownIntel: ['AUTH_L2 snapshots replay-token misuse.'],
    unknowns: ['Alarm handlers may archive process signatures.'],
    payout: 1500,
    repReward: 4,
    heatPenaltyOnFail: 7,
    requiredTools: ['tool_access_spoof', 'tool_payload_ops', 'tool_scrub_suite'],
    missionRules: {
      requireNoTrace: true,
      cleanupWindowTicks: 28,
    },
    storyIntro: [
      'Labor mediators hired you to erase retaliatory payroll flags before arbitration opens.',
      'Delete the incriminating audit file, then scrub log surfaces tied to your access path.',
      'If attribution remains, the client loses leverage and your firm takes the fall.',
    ],
    storyTags: ['delete', 'cleanup'],
  }),
  withScope({
    id: 'contract_act1_07',
    title: 'Maintenance Fiction',
    clientCodename: 'MOSS',
    factionId: 'faction_civic_watch',
    regionId: 'old_core',
    siteId: 'level3',
    objectiveType: 'ALTER',
    summary: 'Alter a personnel record and keep blame pointed at facility maintenance.',
    knownIntel: ['Record EMP_042 is mirrored across audit nodes.'],
    unknowns: ['Competing operators may already be in-system.'],
    payout: 1700,
    repReward: 5,
    heatPenaltyOnFail: 8,
    requiredTools: ['tool_access_spoof', 'tool_payload_ops', 'tool_mask_spoofer'],
    missionRules: {
      requireNoTrace: false,
      allowFrameTarget: true,
      targetFrameIdentity: 'FACILITY_MAINT',
      cleanupWindowTicks: 26,
    },
    storyIntro: [
      'MOSS needs a personnel status changed before a tribunal review packet is generated.',
      'Change the record, then leave evidence that points to a maintenance credential set.',
      'This mission is about control of narrative, not stealth perfection.',
    ],
    storyTags: ['alter', 'frame'],
  }),
  withScope({
    id: 'contract_act1_08',
    title: 'False Flag',
    clientCodename: 'VANTA',
    factionId: 'faction_syndicate',
    regionId: 'uptown_grid',
    siteId: 'level4',
    objectiveType: 'FRAME',
    summary: 'Cause a security incident and forge attribution to rival operators.',
    knownIntel: ['RIVAL_OPS signature is already in district watchlists.'],
    unknowns: ['Cross-surface correlation threshold is unknown.'],
    payout: 1950,
    repReward: 5,
    heatPenaltyOnFail: 9,
    requiredTools: ['tool_mask_spoofer', 'tool_scrub_suite', 'tool_target_redirector'],
    missionRules: {
      allowFrameTarget: true,
      targetFrameIdentity: 'RIVAL_OPS',
      cleanupWindowTicks: 32,
    },
    storyIntro: [
      'VANTA is underwriting a deniable strike against a competing operations firm.',
      'Trigger the incident, then forge cross-surface evidence so investigators converge on RIVAL_OPS.',
      'You succeed only if the blame lands cleanly away from your network signature.',
    ],
    storyTags: ['frame', 'forgery'],
  }),
  withScope({
    id: 'contract_act1_09',
    title: 'Public Message',
    clientCodename: 'CIVIC SIGNAL',
    factionId: 'faction_civic_watch',
    regionId: 'vault_sector',
    siteId: 'level5',
    objectiveType: 'SABOTAGE',
    summary: 'Force an intentional detection event, sabotage target systems, then redirect attribution.',
    knownIntel: ['Mission requires detection visibility to trigger client objective.'],
    unknowns: ['Trace acceleration under forced alert is nonlinear.'],
    payout: 2250,
    repReward: 6,
    heatPenaltyOnFail: 10,
    requiredTools: ['tool_payload_ops', 'tool_mask_spoofer', 'tool_scrub_suite'],
    missionRules: {
      forcedDetection: true,
      allowFrameTarget: true,
      targetFrameIdentity: 'CONTRACTOR_ZETA',
      cleanupWindowTicks: 34,
    },
    storyIntro: [
      'CIVIC SIGNAL wants the incident to be seen, but not traced back to their network.',
      'Get detected, execute sabotage, and redirect post-incident attribution to CONTRACTOR_ZETA.',
      'Failure means both exposure and political blowback landing on your firm.',
    ],
    storyTags: ['forced-detection', 'sabotage'],
  }),
  withScope({
    id: 'contract_act1_10',
    title: 'Clean Exit Protocol',
    clientCodename: 'HELIOS',
    factionId: 'faction_corporate_proxy',
    regionId: 'docklands',
    siteId: 'level1',
    objectiveType: 'RETRIEVE',
    summary: 'Final certification run: retrieve payload and exit under strict zero-attribution policy.',
    knownIntel: ['Audit engines score PROCESS and AUTH residue aggressively.'],
    unknowns: ['Client may withhold payment if any residue remains.'],
    payout: 2600,
    repReward: 7,
    heatPenaltyOnFail: 12,
    requiredTools: ['tool_access_spoof', 'tool_payload_ops', 'tool_mask_spoofer', 'tool_scrub_suite'],
    missionRules: {
      requireNoTrace: true,
      cleanupWindowTicks: 36,
    },
    storyIntro: [
      'HELIOS is validating your cell for premium long-term contracts.',
      'Retrieve the payload and produce a full clean exit across authentication, process, and network traces.',
      'This is less a heist and more a capability audit with real financial stakes.',
    ],
    storyTags: ['certification', 'cleanup'],
  }),
];

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
