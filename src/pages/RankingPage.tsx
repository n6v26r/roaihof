import { useMemo, useState } from 'react';
import { dataset } from '../app/data';
import { FilterBar } from '../components/FilterBar';
import { RankingTable } from '../components/RankingTable';
import {
  aggregateRanking,
  defaultFilters
} from '../lib/stats';
import type { Filters, RankingKind } from '../lib/types';

export function RankingPage({ kind }: { kind: RankingKind }) {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const rows = useMemo(() => aggregateRanking(kind, dataset, filters), [kind, filters]);
  const title = kind === 'people' ? 'People ranking' : kind === 'schools' ? 'Schools ranking' : 'County ranking';

  return (
    <div className="page-stack">
      <section className="terminal-panel route-heading">
        <div>
          <p className="eyebrow">Ranking</p>
          <h1>{title}</h1>
          <p className="muted-line">Sorted by medals, prizes, selections, and national best place.</p>
        </div>
        <FilterBar filters={filters} onChange={setFilters} showSearch={false} />
      </section>
      <section className="terminal-panel">
        <RankingTable rows={rows} kind={kind} />
      </section>
    </div>
  );
}
