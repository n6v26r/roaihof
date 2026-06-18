import { useState } from 'react';
import { RankingTable } from './RankingTable';
import { Subheading } from './layout/Subheading';
import type { RankingKind, RankingRow } from '../lib/types';

export function ExpandableRankingBlock({
  title,
  rows,
  kind,
  collapsedLimit = 3
}: {
  title: string;
  rows: RankingRow[];
  kind: RankingKind;
  collapsedLimit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = rows.length > collapsedLimit;
  const visibleRows = expanded || !canExpand ? rows : rows.slice(0, collapsedLimit);

  return (
    <section className="entity-detail-block">
      <div className="entity-list-header">
        <Subheading title={title} />
        {canExpand ? (
          <button type="button" className="section-link entity-expand-button" onClick={() => setExpanded((value) => !value)}>
            {expanded ? `Show ${collapsedLimit}` : `Show all ${rows.length}`}
          </button>
        ) : null}
      </div>
      <RankingTable rows={visibleRows} kind={kind} />
    </section>
  );
}
