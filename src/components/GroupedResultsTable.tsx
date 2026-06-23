import { ResultsTable } from './ResultsTable';
import { Subheading } from './layout/Subheading';
import type { Contest, Result, Source } from '../lib/types';

export function GroupedResultsTable({
  results,
  contests,
  sources,
  compact,
  placementOverrides
}: {
  results: Result[];
  contests: Map<string, Contest>;
  sources: Map<string, Source>;
  compact?: boolean;
  placementOverrides?: Map<string, number>;
}) {
  const forceContestant = distinctContestants(results) > 1;
  const groups = [
    { stage: 'national', title: 'Națională' },
    { stage: 'baraj', title: 'Baraj' },
    { stage: 'lot', title: 'Lot' },
    { stage: 'international', title: 'Internațional' }
  ];
  const rendered = groups
    .map((group) => ({ ...group, results: results.filter((result) => result.stage === group.stage) }))
    .filter((group) => group.results.length > 0);

  if (rendered.length === 0) {
    return <ResultsTable results={[]} contests={contests} sources={sources} compact={compact} placementOverrides={placementOverrides} />;
  }

  return (
    <div className="result-groups">
      {rendered.map((group) => (
        <section key={group.stage}>
          <Subheading title={group.title} />
          <ResultsTable
            results={group.results}
            contests={contests}
            sources={sources}
            compact={compact}
            forceYear
            forceContest
            forceContestant={forceContestant}
            placementOverrides={placementOverrides}
          />
        </section>
      ))}
    </div>
  );
}

function distinctContestants(results: Result[]): number {
  return new Set(results.map((result) => result.personId || result.personName).filter(Boolean)).size;
}
