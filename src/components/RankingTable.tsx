import { Medal, Trophy } from 'lucide-react';
import { AppLink } from '../lib/router';
import { routeFor, statLine } from '../lib/format';
import type { RankingKind, RankingRow } from '../lib/types';

interface RankingTableProps {
  rows: RankingRow[];
  kind: RankingKind;
  limit?: number;
}

const kindToEntity = {
  people: 'person',
  schools: 'school',
  counties: 'county'
} as const;

export function RankingTable({ rows, kind, limit }: RankingTableProps) {
  const visible = limit ? rows.slice(0, limit) : rows;
  return (
    <div className="table-shell">
      <table className={limit ? 'data-table ranking-table preview-table' : 'data-table ranking-table'}>
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Medals</th>
            <th>Prizes</th>
            <th>Selections</th>
            <th>Years</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row, index) => {
            const rank = row.rank ?? index + 1;
            const matchedUsername = kind === 'people' ? row.matchedUsername : undefined;
            return (
              <tr key={row.id}>
                <td data-label="#">
                  <span className="rank-cell">
                    {rank <= 3 ? <Trophy size={15} aria-hidden="true" /> : <Medal size={15} aria-hidden="true" />}
                    {rank}
                  </span>
                </td>
                <td data-label="Name">
                  <span className="search-result-title">
                    <AppLink href={routeFor(kindToEntity[kind], row.id)} className="table-link">
                      {row.name}
                    </AppLink>
                    {matchedUsername ? (
                      <span className={`search-username-match ${matchedUsername.platform}`}>
                        @{matchedUsername.username}
                      </span>
                    ) : null}
                  </span>
                  <span className="row-subtitle">{statLine(row.stats)}</span>
                </td>
                <td data-label="Medals">
                  <span className="medal-stack">
                    <b className="m-gold">{row.stats.gold}</b>
                    <b className="m-silver">{row.stats.silver}</b>
                    <b className="m-bronze">{row.stats.bronze}</b>
                  </span>
                </td>
                <td data-label="Prizes">{row.stats.prizes}</td>
                <td data-label="Selections">{row.stats.selections}</td>
                <td data-label="Years">{row.stats.years.join(', ') || '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {visible.length === 0 ? <div className="empty-state">No rows for this filter.</div> : null}
    </div>
  );
}
