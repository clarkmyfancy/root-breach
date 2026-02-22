import { useMemo, useState } from 'react';
import { contracts } from '../../game/contracts';
import { toolCatalog } from '../../game/tools';
import { EventLogPanel } from '../panels/EventLogPanel';
import { FailureSummaryPanel } from '../panels/FailureSummaryPanel';
import { useGameStore, type DesktopApp } from '../../store/useGameStore';
import { LevelScreen } from './LevelScreen';

const appNav: Array<{ id: DesktopApp; label: string }> = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'contracts', label: 'Contracts' },
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
          <h4>Ops Desk: New Contract Feed Online</h4>
          <p>Contracts now include payout, heat exposure, and mission rules. Review briefing data before deployment.</p>
        </article>
        <article className="inbox-item">
          <h4>Procurement: Market Access Enabled</h4>
          <p>Reputation now gates tooling. Buy upgrades from Black Market to unlock additional command capabilities.</p>
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
              <button className="btn btn-primary" disabled={!unlocked} onClick={() => startContract(contract.id)}>
                {completed ? 'Replay Contract' : unlocked ? 'Accept Contract' : 'Locked'}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ForensicsApp(): JSX.Element {
  const replayResult = useGameStore((state) => state.replayResult);
  const frameIndex = useGameStore((state) => state.frameIndex);
  const failureSummary = useGameStore((state) => state.failureSummary);
  const events = useMemo(() => {
    if (!replayResult) {
      return [];
    }
    const maxTick = replayResult.frames[Math.min(frameIndex, replayResult.frames.length - 1)]?.tick ?? 0;
    return replayResult.events.filter((event) => event.tick <= maxTick);
  }, [replayResult, frameIndex]);

  return (
    <div className="desktop-split">
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
            <li key={id}>{id}</li>
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
        </header>

        {phase === 'debrief' && debrief ? (
          <section className="panel debrief-banner">
            <div className="panel__title">Debrief</div>
            <div>
              {debrief.contractTitle} / client {debrief.clientCodename}
            </div>
            <div className="debrief-metrics">
              <span>Outcome: {debrief.outcome}</span>
              <span>Payout: {debrief.payoutDelta}</span>
              <span>Rep: {debrief.repDelta >= 0 ? `+${debrief.repDelta}` : debrief.repDelta}</span>
              <span>Heat: {debrief.heatDelta >= 0 ? `+${debrief.heatDelta}` : debrief.heatDelta}</span>
            </div>
            <button className="btn" onClick={acknowledgeDebrief}>
              Return to Contracts
            </button>
          </section>
        ) : null}

        {phase === 'contractIntro' && activeContract ? (
          <section className="panel contract-intro-banner">
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
        ) : null}

        <section className="desktop-content">
          {activeDesktopApp === 'inbox' ? <InboxApp /> : null}
          {activeDesktopApp === 'contracts' ? <ContractBoardApp /> : null}
          {activeDesktopApp === 'siteMonitor' ? <LevelScreen /> : null}
          {activeDesktopApp === 'forensics' ? <ForensicsApp /> : null}
          {activeDesktopApp === 'blackMarket' ? <BlackMarketApp /> : null}
          {activeDesktopApp === 'profile' ? <ProfileApp /> : null}
        </section>
      </main>
    </div>
  );
}
