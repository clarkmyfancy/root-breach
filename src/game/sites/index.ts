import { levelById } from '../levels';
import type { SiteBlueprint } from './types';

export const sites: SiteBlueprint[] = [
  {
    id: 'site_dock_gate',
    levelId: 'level1',
    regionId: 'docklands',
    factionHintId: 'faction_independent',
    nodes: ['N1_ENTRY', 'N1_DOOR', 'N1_EXIT'],
    routes: ['dock_main_corridor'],
    fileTargets: ['OPS_ROUTE_PACKET'],
    recordTargets: ['MAINT_SHIFT_A'],
    authEndpoints: ['AUTH_L1'],
    level: levelById.level1,
  },
  {
    id: 'site_river_lock',
    levelId: 'level2',
    regionId: 'riverline',
    factionHintId: 'faction_labor_front',
    nodes: ['N2_GATE', 'N2_ALARM', 'N2_LOCK'],
    routes: ['riverline_north_lane'],
    fileTargets: ['SHIFT_LEDGER_22'],
    recordTargets: ['WITNESS_TRANSPORT'],
    authEndpoints: ['AUTH_L2'],
    level: levelById.level2,
  },
  {
    id: 'site_old_core_arc',
    levelId: 'level3',
    regionId: 'old_core',
    factionHintId: 'faction_civic_watch',
    nodes: ['N3_WEST', 'N3_TURRET', 'N3_ARCHIVE'],
    routes: ['old_core_bridge'],
    fileTargets: ['SURV_PACKAGE_C3'],
    recordTargets: ['ASSET_REGISTRY_11'],
    authEndpoints: ['AUTH_L3'],
    level: levelById.level3,
  },
  {
    id: 'site_uptown_sequence',
    levelId: 'level4',
    regionId: 'uptown_grid',
    factionHintId: 'faction_syndicate',
    nodes: ['N4_ENTRY', 'N4_DRONE_LOOP', 'N4_CONTROL'],
    routes: ['uptown_split_a', 'uptown_split_b'],
    fileTargets: ['OPS_DRILL_PLAN'],
    recordTargets: ['MAINT_WINDOW_LOG'],
    authEndpoints: ['AUTH_L4'],
    level: levelById.level4,
  },
  {
    id: 'site_vault_lane',
    levelId: 'level5',
    regionId: 'vault_sector',
    factionHintId: 'faction_corporate_proxy',
    nodes: ['N5_CHECKPOINT_A', 'N5_CHECKPOINT_B', 'N5_VAULT_EDGE'],
    routes: ['vault_primary', 'vault_secondary'],
    fileTargets: ['FIN_AUDIT_BUNDLE', 'VAULT_DOC'],
    recordTargets: ['EMP_042', 'PAYROLL_5'],
    authEndpoints: ['AUTH_L5'],
    level: levelById.level5,
  },
];

export const siteByLevelId: Record<string, SiteBlueprint> = sites.reduce<Record<string, SiteBlueprint>>((acc, site) => {
  acc[site.levelId] = site;
  return acc;
}, {});
