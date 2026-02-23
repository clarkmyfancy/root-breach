import { useMemo, useState } from 'react';
import { gameplayMode, isDevGameplayMode } from '../../config/gameMode';
import { contracts } from '../../game/contracts';
import { factionById } from '../../game/factions';
import { siteByLevelId } from '../../game/sites';
import { toolById, toolCatalog } from '../../game/tools';
import { EventLogPanel } from '../panels/EventLogPanel';
import { FailureSummaryPanel } from '../panels/FailureSummaryPanel';
import { ForensicsPanel } from '../panels/ForensicsPanel';
import { useGameStore, type DesktopApp } from '../../store/useGameStore';
import { LevelScreen } from './LevelScreen';

const appNav: Array<{ id: DesktopApp; label: string }> = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'worldMap', label: 'World Map' },
  { id: 'siteMonitor', label: 'Site Monitor' },
  { id: 'forensics', label: 'Forensics' },
  { id: 'blackMarket', label: 'Black Market' },
  { id: 'profile', label: 'Profile' },
];

function InboxApp(): JSX.Element {
  return (
    <div className="panel desktop-app">
      <div className="panel__title">Inbox</div>
      <div className="inbox-list">
        <article className="inbox-item">
          <h4>Ops Desk: Two-Phase Protocol Active</h4>
          <p>Complete objective first, then sanitize or redirect evidence before closure windows expire.</p>
        </article>
        <article className="inbox-item">
          <h4>Forensics Team: Attribution Rules Tightened</h4>
          <p>Failure debrief now considers trace escalation, unsanitized evidence, and frame-target consistency.</p>
        </article>
        <article className="inbox-item">
          <h4>Procurement: Tooling Expansion</h4>
          <p>Probe, Access, Payload, Mask, and Scrub suites are now available as rep grows.</p>
        </article>
      </div>
    </div>
  );
}

function ContractBoardApp(): JSX.Element {
  const save = useGameStore((state) => state.save);
  const startContract = useGameStore((state) => state.startContract);

  return (
    <div className="panel desktop-app">
      <div className="panel__title">Contract Board</div>
      <div className="contract-grid">
        {contracts.map((contract) => {
          const unlocked = save.campaign.unlockedContracts.includes(contract.id);
          const completed = save.campaign.completedContracts.includes(contract.id);
          const missingTools = (contract.requiredTools ?? []).filter((toolId) => !save.campaign.ownedTools[toolId]?.owned);
          const blockedByTools = !isDevGameplayMode && missingTools.length > 0;

          return (
            <article key={contract.id} className={`contract-card ${unlocked ? '' : 'contract-card--locked'}`}>
              <h4>{contract.title}</h4>
              <div className="muted">
                {contract.clientCodename} · {contract.regionId}
              </div>
              <p>{contract.summary}</p>
              <div className="contract-card__meta">
                <span>Pay: {contract.payout}cr</span>
                <span>Rep: +{contract.repReward}</span>
              </div>
              {missingTools.length > 0 && !isDevGameplayMode ? (
                <div className="contract-requirements">Missing tools: {missingTools.map((id) => toolById[id]?.name ?? id).join(', ')}</div>
              ) : null}
              {missingTools.length > 0 && isDevGameplayMode ? (
                <div className="contract-requirements">Dev mode override: tool requirements bypassed.</div>
              ) : null}
              <button
                className="btn btn-primary"
                disabled={!unlocked || blockedByTools}
                onClick={() => startContract(contract.id)}
              >
                {completed ? 'Replay Contract' : unlocked ? 'Accept Contract' : 'Locked'}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function WorldMapApp(): JSX.Element {
  const save = useGameStore((state) => state.save);
  const startContract = useGameStore((state) => state.startContract);

  const siteLayout: Array<{
    id: string;
    regionId: string;
    x: number;
    y: number;
    label: string;
    levelId: string;
  }> = [
    { id: 'site_dock_gate', regionId: 'docklands', x: 120, y: 220, label: 'Dock Gate', levelId: 'level1' },
    { id: 'site_river_lock', regionId: 'riverline', x: 280, y: 150, label: 'River Lock', levelId: 'level2' },
    { id: 'site_old_core_arc', regionId: 'old_core', x: 430, y: 210, label: 'Old Core Arc', levelId: 'level3' },
    { id: 'site_uptown_sequence', regionId: 'uptown_grid', x: 610, y: 140, label: 'Uptown Sequence', levelId: 'level4' },
    { id: 'site_vault_lane', regionId: 'vault_sector', x: 760, y: 250, label: 'Vault Lane', levelId: 'level5' },
  ];

  const regionOverlays = [
    { id: 'docklands', x: 40, y: 140, width: 180, height: 180 },
    { id: 'riverline', x: 200, y: 80, width: 190, height: 160 },
    { id: 'old_core', x: 360, y: 120, width: 180, height: 170 },
    { id: 'uptown_grid', x: 530, y: 70, width: 190, height: 170 },
    { id: 'vault_sector', x: 680, y: 160, width: 180, height: 180 },
  ];

  const [selectedSiteId, setSelectedSiteId] = useState(siteLayout[0].id);
  const selectedSite = siteLayout.find((site) => site.id === selectedSiteId) ?? siteLayout[0];
  const selectedContracts = contracts.filter((contract) => contract.siteId === selectedSite.levelId);

  const firstContractBySite = useMemo(() => {
    return contracts.reduce<Record<string, string>>((acc, contract) => {
      if (!acc[contract.siteId]) {
        acc[contract.siteId] = contract.id;
      }
      return acc;
    }, {});
  }, []);

  const links: Array<[string, string]> = [
    ['site_dock_gate', 'site_river_lock'],
    ['site_river_lock', 'site_old_core_arc'],
    ['site_old_core_arc', 'site_uptown_sequence'],
    ['site_uptown_sequence', 'site_vault_lane'],
    ['site_river_lock', 'site_uptown_sequence'],
  ];

  const nodeById = siteLayout.reduce<Record<string, (typeof siteLayout)[number]>>((acc, node) => {
    acc[node.id] = node;
    return acc;
  }, {});

  return (
    <div className="panel desktop-app world-map-app">
      <div className="panel__title">Network Map</div>
      <div className="world-map-layout">
        <div className="world-map-canvas">
          <svg viewBox="0 0 900 360" role="img" aria-label="World map network">
            <defs>
              <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#173257" strokeWidth="1" opacity="0.4" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="900" height="360" fill="url(#grid)" />

            {regionOverlays.map((region) => (
              <g key={region.id}>
                <rect
                  x={region.x}
                  y={region.y}
                  width={region.width}
                  height={region.height}
                  rx="22"
                  ry="22"
                  fill="#0d1d3b"
                  stroke="#2c4f80"
                  opacity="0.65"
                />
                <text x={region.x + 10} y={region.y + 20} fill="#9cc3f0" fontSize="12">
                  {region.id}
                </text>
              </g>
            ))}

            {links.map(([fromId, toId]) => {
              const from = nodeById[fromId];
              const to = nodeById[toId];
              return (
                <line
                  key={`${fromId}-${toId}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="#4a6d9f"
                  strokeWidth="2.5"
                  opacity="0.8"
                />
              );
            })}

            {siteLayout.map((node) => {
              const firstContractId = firstContractBySite[node.levelId];
              const unlocked = firstContractId ? save.campaign.unlockedContracts.includes(firstContractId) : false;
              const completed = firstContractId ? save.campaign.completedContracts.includes(firstContractId) : false;
              const isSelected = node.id === selectedSiteId;
              const fill = completed ? '#34d399' : unlocked ? '#38bdf8' : '#475569';
              const stroke = isSelected ? '#f8fafc' : '#0f172a';

              return (
                <g key={node.id} onClick={() => setSelectedSiteId(node.id)} className="world-map-node">
                  <circle cx={node.x} cy={node.y} r={isSelected ? 20 : 16} fill={fill} stroke={stroke} strokeWidth="3" />
                  <text x={node.x + 24} y={node.y + 4} fill="#dbeafe" fontSize="12">
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="world-map-legend">
            <span><i className="legend-dot legend-dot--locked" /> Locked</span>
            <span><i className="legend-dot legend-dot--unlocked" /> Unlocked</span>
            <span><i className="legend-dot legend-dot--complete" /> Completed</span>
          </div>
        </div>

        <aside className="world-map-details">
          <h4>{selectedSite.label}</h4>
          <div className="muted">Region: {selectedSite.regionId}</div>
          {selectedContracts.map((contract) => {
            const unlocked = save.campaign.unlockedContracts.includes(contract.id);
            const completed = save.campaign.completedContracts.includes(contract.id);
            return (
              <article key={contract.id} className="world-map-contract">
                <div className="world-map-contract__title">{contract.title}</div>
                <div className="muted">{factionById[contract.factionId]?.name ?? contract.factionId}</div>
                <p>{contract.summary}</p>
                <button className="btn btn-primary" disabled={!unlocked} onClick={() => startContract(contract.id)}>
                  {completed ? 'Replay' : unlocked ? 'Open Briefing' : 'Locked'}
                </button>
              </article>
            );
          })}
        </aside>
      </div>
    </div>
  );
}

function ForensicsApp(): JSX.Element {
  const replayResult = useGameStore((state) => state.replayResult);
  const frameIndex = useGameStore((state) => state.frameIndex);
  const failureSummary = useGameStore((state) => state.failureSummary);
  const currentFrame = replayResult
    ? replayResult.frames[Math.min(frameIndex, Math.max(0, replayResult.frames.length - 1))]
    : undefined;
  const events = useMemo(() => {
    if (!replayResult || !currentFrame) {
      return [];
    }
    return replayResult.events.filter((event) => event.tick <= currentFrame.tick);
  }, [replayResult, currentFrame]);

  return (
    <div className="desktop-forensics">
      <ForensicsPanel
        evidence={currentFrame?.snapshot.evidence ?? []}
        attribution={currentFrame?.snapshot.attribution}
        ruleChecks={currentFrame?.snapshot.missionOutcome.ruleChecks ?? []}
      />
      <EventLogPanel events={events} />
      <FailureSummaryPanel summary={failureSummary} />
    </div>
  );
}

function BlackMarketApp(): JSX.Element {
  const save = useGameStore((state) => state.save);
  const purchaseTool = useGameStore((state) => state.purchaseTool);
  const [message, setMessage] = useState<string>('');

  return (
    <div className="panel desktop-app">
      <div className="panel__title">Black Market</div>
      {message ? <div className="market-message">{message}</div> : null}
      <div className="market-grid">
        {toolCatalog
          .filter((tool) => tool.cost > 0)
          .map((tool) => {
            const owned = Boolean(save.campaign.ownedTools[tool.id]?.owned);
            const repLocked = save.campaign.reputation < tool.repRequired;
            const fundsLocked = save.campaign.credits < tool.cost;
            const disabled = owned || repLocked || fundsLocked;
            return (
              <article className="market-card" key={tool.id}>
                <h4>{tool.name}</h4>
                <div className="muted">
                  {tool.category} · Tier {tool.tier}
                </div>
                <p>{tool.description}</p>
                <div className="contract-card__meta">
                  <span>{tool.cost}cr</span>
                  <span>Rep {tool.repRequired}</span>
                </div>
                <div className="market-unlocks">Unlocks: {tool.unlocksCommands.join(', ')}</div>
                <button
                  className="btn btn-primary"
                  disabled={disabled}
                  onClick={() => {
                    const result = purchaseTool(tool.id);
                    setMessage(result.message);
                  }}
                >
                  {owned ? 'Owned' : 'Buy Tool'}
                </button>
              </article>
            );
          })}
      </div>
    </div>
  );
}

function ProfileApp(): JSX.Element {
  const save = useGameStore((state) => state.save);
  const ownedTools = Object.entries(save.campaign.ownedTools)
    .filter(([, value]) => value.owned)
    .map(([id]) => id);

  return (
    <div className="panel desktop-app">
      <div className="panel__title">Operator Profile</div>
      <div className="profile-grid">
        <div>Credits: {save.campaign.credits}</div>
        <div>Reputation: {save.campaign.reputation}</div>
        <div>Global Heat: {save.campaign.globalHeat}</div>
        <div>Completed Contracts: {save.campaign.completedContracts.length}</div>
      </div>
      <div className="panel__subtitle">Owned Tools</div>
      {ownedTools.length ? (
        <ul className="owned-tool-list">
          {ownedTools.map((id) => (
            <li key={id}>{toolById[id]?.name ?? id}</li>
          ))}
        </ul>
      ) : (
        <div className="muted">No tools owned.</div>
      )}
    </div>
  );
}

export function DesktopShell(): JSX.Element {
  const phase = useGameStore((state) => state.phase);
  const debrief = useGameStore((state) => state.debrief);
  const activeDesktopApp = useGameStore((state) => state.activeDesktopApp);
  const currentContractId = useGameStore((state) => state.currentContractId);
  const setActiveDesktopApp = useGameStore((state) => state.setActiveDesktopApp);
  const acknowledgeDebrief = useGameStore((state) => state.acknowledgeDebrief);
  const launchContractOperation = useGameStore((state) => state.launchContractOperation);
  const openLevelSelect = useGameStore((state) => state.openLevelSelect);

  const activeContract = currentContractId ? contracts.find((contract) => contract.id === currentContractId) : null;
  const activeSite = activeContract ? siteByLevelId[activeContract.siteId] : null;

  return (
    <div className="desktop-shell">
      <aside className="desktop-rail">
        <h2>Root Breach / Ops</h2>
        <div className="desktop-rail__apps">
          {appNav.map((app) => (
            <button
              key={app.id}
              className={`btn ${activeDesktopApp === app.id ? 'btn-primary' : ''}`}
              onClick={() => setActiveDesktopApp(app.id)}
            >
              {app.label}
            </button>
          ))}
        </div>
      </aside>

      <main className="desktop-main">
        <header className="desktop-status">
          <div>
            <strong>Phase:</strong> {phase}
          </div>
          <div>
            <strong>Active Contract:</strong> {activeContract?.title ?? 'None'}
          </div>
          <div>
            <strong>Site:</strong> {activeSite?.id ?? '-'}
          </div>
          <div>
            <strong>Mode:</strong> {gameplayMode}
          </div>
        </header>

        {phase === 'debrief' && debrief ? (
          <section className="panel debrief-banner">
            <div className="panel__title">Debrief</div>
            <div>
              {debrief.contractTitle} / client {debrief.clientCodename}
            </div>
            <div className="debrief-metrics">
              <span>Outcome: {debrief.outcome}</span>
              <span>Objective: {debrief.objectivePassed ? 'pass' : 'fail'}</span>
              <span>Cleanup: {debrief.cleanupPassed ? 'pass' : 'fail'}</span>
              <span>Trace: {debrief.traceFinal.toFixed(1)} ({debrief.tracePassed ? 'pass' : 'fail'})</span>
              <span>
                Attribution: {debrief.attributionActor} ({(debrief.attributionConfidence * 100).toFixed(0)}%)
              </span>
              <span>Payout: {debrief.payoutDelta}</span>
              <span>Rep: {debrief.repDelta >= 0 ? `+${debrief.repDelta}` : debrief.repDelta}</span>
              <span>Heat: {debrief.heatDelta >= 0 ? `+${debrief.heatDelta}` : debrief.heatDelta}</span>
            </div>
            {debrief.failedRules.length ? (
              <div className="muted">Failed rules: {debrief.failedRules.join(', ')}</div>
            ) : null}
            {debrief.failureReasons.length ? (
              <div className="muted">Exposure causes: {debrief.failureReasons.join(', ')}</div>
            ) : null}
            <button className="btn" onClick={acknowledgeDebrief}>
              Return to Contracts
            </button>
          </section>
        ) : null}

        <section className="desktop-content">
          {activeDesktopApp === 'inbox' ? <InboxApp /> : null}
          {activeDesktopApp === 'contracts' ? <ContractBoardApp /> : null}
          {activeDesktopApp === 'worldMap' ? <WorldMapApp /> : null}
          {activeDesktopApp === 'siteMonitor' ? <LevelScreen /> : null}
          {activeDesktopApp === 'forensics' ? <ForensicsApp /> : null}
          {activeDesktopApp === 'blackMarket' ? <BlackMarketApp /> : null}
          {activeDesktopApp === 'profile' ? <ProfileApp /> : null}
        </section>
      </main>

      {phase === 'contractIntro' && activeContract ? (
        <div className="contract-intro-modal-backdrop" role="dialog" aria-modal="true" aria-label="Contract briefing">
          <section className="panel contract-intro-modal">
            <div className="panel__title">Contract Briefing</div>
            <div>
              <strong>{activeContract.title}</strong> / client {activeContract.clientCodename}
            </div>
            <div className="debrief-metrics">
              <span>Objective: {activeContract.objectiveType}</span>
              <span>Payout: {activeContract.payout}</span>
              <span>Rep: +{activeContract.repReward}</span>
              <span>Heat Risk: +{activeContract.heatPenaltyOnFail}</span>
            </div>
            <div className="contract-intro-story">
              {activeContract.storyIntro.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <div className="contract-intro-actions">
              <button className="btn" onClick={openLevelSelect}>
                Back to Board
              </button>
              <button className="btn btn-primary" onClick={launchContractOperation}>
                Launch Contract
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
