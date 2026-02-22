import { useMemo, useState } from 'react';
import type { EvidenceRecord } from '../../game/models/types';

interface ForensicsPanelProps {
  evidence: EvidenceRecord[];
}

type EvidenceFilter = 'ALL' | 'NETFLOW' | 'AUTH' | 'DEVICE' | 'FILE_AUDIT' | 'ALARM' | 'PROCESS';
type AttributionFilter = 'ALL' | 'OPERATOR' | 'NON_OPERATOR';

export function ForensicsPanel({ evidence }: ForensicsPanelProps): JSX.Element {
  const [surfaceFilter, setSurfaceFilter] = useState<EvidenceFilter>('ALL');
  const [scrubbedOnly, setScrubbedOnly] = useState(false);
  const [attributionFilter, setAttributionFilter] = useState<AttributionFilter>('ALL');

  const filtered = useMemo(() => {
    return evidence.filter((record) => {
      if (surfaceFilter !== 'ALL' && record.surface !== surfaceFilter) {
        return false;
      }
      if (scrubbedOnly && !record.scrubbed) {
        return false;
      }
      const attributedTo = record.attributedTo ?? 'OPERATOR';
      if (attributionFilter === 'OPERATOR' && attributedTo !== 'OPERATOR') {
        return false;
      }
      if (attributionFilter === 'NON_OPERATOR' && attributedTo === 'OPERATOR') {
        return false;
      }
      return true;
    });
  }, [evidence, surfaceFilter, scrubbedOnly, attributionFilter]);

  return (
    <div className="panel panel-forensics">
      <div className="panel__title">Forensics</div>
      <div className="forensics-filters">
        <select value={surfaceFilter} onChange={(event) => setSurfaceFilter(event.target.value as EvidenceFilter)}>
          <option value="ALL">All Surfaces</option>
          <option value="NETFLOW">NETFLOW</option>
          <option value="AUTH">AUTH</option>
          <option value="DEVICE">DEVICE</option>
          <option value="FILE_AUDIT">FILE_AUDIT</option>
          <option value="ALARM">ALARM</option>
          <option value="PROCESS">PROCESS</option>
        </select>
        <select value={attributionFilter} onChange={(event) => setAttributionFilter(event.target.value as AttributionFilter)}>
          <option value="ALL">All Attribution</option>
          <option value="OPERATOR">Operator</option>
          <option value="NON_OPERATOR">Non-Operator</option>
        </select>
        <label className="forensics-check">
          <input type="checkbox" checked={scrubbedOnly} onChange={(event) => setScrubbedOnly(event.target.checked)} />
          scrubbed only
        </label>
      </div>
      <div className="forensics-table">
        {filtered.slice().reverse().map((record) => (
          <div className="forensics-row" key={record.id}>
            <span>[{record.tick}]</span>
            <span>{record.surface}</span>
            <span>{record.siteNodeId}</span>
            <span>sev {record.severity}</span>
            <span>{record.signature}</span>
            <span>{record.attributedTo ?? 'OPERATOR'}</span>
            <span>{record.scrubbed ? 'scrubbed' : record.forged ? 'forged' : 'live'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
