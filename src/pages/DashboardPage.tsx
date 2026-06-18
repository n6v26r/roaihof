import {
  ArrowUpRight,
  Database,
  MapPinned,
  School2,
  Search,
  Trophy,
  Users
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { dataset } from '../app/data';
import type { Indexes } from '../app/indexes';
import { FilterBar } from '../components/FilterBar';
import { RankingTable } from '../components/RankingTable';
import { SummaryCard } from '../components/SummaryCard';
import { SectionHeader } from '../components/layout/SectionHeader';
import { familyCards } from '../features/scoreboards/scoreboards';
import { routeFor } from '../lib/format';
import { AppLink } from '../lib/router';
import {
  aggregateRanking,
  defaultFilters,
  searchItems
} from '../lib/stats';
import type { Filters } from '../lib/types';

export function DashboardPage({ indexes }: { indexes: Indexes }) {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const peopleRanking = useMemo(() => aggregateRanking('people', dataset, filters), [filters]);
  const contestFamilies = useMemo(() => familyCards(indexes.scoreboards), [indexes.scoreboards]);
  const matches = searchItems(dataset, filters.query);

  return (
    <div className="page-stack">
      <section className="terminal-panel hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">ONIA · ROAI · IAIO · IOAI · CEOAI</p>
          <h1>Romanian AI Hall Of Fame</h1>
          <div className="hero-meta">
            <span>{dataset.summary.years.join('-')}</span>
            <span>{dataset.summary.results} entries</span>
            <span>{dataset.summary.namedResults} nominale</span>
          </div>
        </div>
        <FilterBar filters={filters} onChange={setFilters} />
      </section>

      {filters.query ? (
        <section className="terminal-panel">
          <SectionHeader icon={Search} title="Search" meta={`${matches.length} matches`} />
          <div className="search-results">
            {matches.map((item) => (
              <AppLink href={routeFor(item.kind, item.id)} className="search-result" key={`${item.kind}-${item.id}`}>
                <span>
                  <span className="search-result-title">
                    <strong>{item.title}</strong>
                    {item.matchedUsername ? (
                      <span className={`search-username-match ${item.matchedUsername.platform}`}>
                        @{item.matchedUsername.username}
                      </span>
                    ) : null}
                  </span>
                  <small>{item.kind} · {item.subtitle}</small>
                </span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </AppLink>
            ))}
            {matches.length === 0 ? <div className="empty-state">No search matches.</div> : null}
          </div>
        </section>
      ) : null}

      <section className="summary-grid" aria-label="dataset summary">
        <SummaryCard label="People" value={dataset.summary.people} icon={Users} />
        <SummaryCard label="Schools" value={dataset.summary.schools} icon={School2} />
        <SummaryCard label="Counties" value={dataset.summary.counties} icon={MapPinned} />
      </section>

      <section className="grid-two">
        <div className="terminal-panel">
          <SectionHeader icon={Trophy} title="People ranking" meta="top" href="/rankings/people" />
          <RankingTable rows={peopleRanking} kind="people" limit={8} />
        </div>
        <div className="terminal-panel">
          <SectionHeader icon={Database} title="Contests" />
          <div className="family-grid">
            {contestFamilies.map((family) => (
              <AppLink href={`/contests/${family.slug}`} className={family.future ? 'family-card future' : 'family-card'} key={family.name}>
                <span>
                  <strong>{family.future ? `${family.name} (future)` : family.name}</strong>
                  <small>{family.future ? 'planned' : family.yearLabel}</small>
                </span>
              </AppLink>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
