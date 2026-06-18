import { ExternalLink } from 'lucide-react';
import { AppLink } from '../lib/router';
import { medalLabel, routeFor } from '../lib/format';
import type { Contest, Result, Source } from '../lib/types';
import {
  displaySchoolName,
  mergeDisplayRows,
  scoreboardHrefForResult,
  type LotDetail
} from './resultsTableModel';

interface ResultsTableProps {
  results: Result[];
  contests: Map<string, Contest>;
  sources: Map<string, Source>;
  compact?: boolean;
  forceYear?: boolean;
  forceContest?: boolean;
  forceContestant?: boolean;
  hideSource?: boolean;
  placementOverrides?: Map<string, number>;
}

export function ResultsTable({
  results,
  contests,
  sources,
  compact = false,
  forceYear = false,
  forceContest = false,
  forceContestant = false,
  hideSource = false,
  placementOverrides
}: ResultsTableProps) {
  const displayRows = mergeDisplayRows(results, contests, placementOverrides);
  const uniqueYears = new Set(displayRows.map((row) => row.primary.year));
  const uniqueContestContexts = new Set(displayRows.map((row) => row.context.key));
  const uniqueContestants = new Set(displayRows.map((row) => row.primary.personId || row.primary.personName).filter(Boolean));
  const uniqueSchools = new Set(displayRows.map((row) => row.primary.schoolId || row.primary.school).filter(Boolean));
  const uniqueCounties = new Set(displayRows.map((row) => row.primary.countyId || row.primary.county).filter(Boolean));
  const uniqueSources = new Set(displayRows.flatMap((row) => row.sourceIds));
  const showYear = forceYear || displayRows.length === 0 || uniqueYears.size > 1;
  const showContest = forceContest || displayRows.length === 0 || uniqueContestContexts.size > 1;
  const showContestant = forceContestant || displayRows.length === 0 || uniqueContestants.size > 1;
  const showSchool = displayRows.length === 0 || uniqueSchools.size > 1;
  const showCounty = displayRows.length === 0 || uniqueCounties.size > 1;
  const showPlace = displayRows.length === 0 || displayRows.some((row) => row.placeLabel !== '-');
  const showScore = displayRows.length === 0 || displayRows.some((row) => row.scoreLabel !== '-');
  const showResult = displayRows.length === 0 || displayRows.some((row) => row.outcome.kind !== 'empty');
  const showMedal = displayRows.length === 0 || displayRows.some((row) => row.primary.medal);
  const showSource = !hideSource && (displayRows.length === 0 || uniqueSources.size > 1);

  return (
    <div className="table-shell">
      <table className={compact ? 'data-table results-table compact-table' : 'data-table results-table'}>
        <thead>
          <tr>
            {showYear ? <th>Year</th> : null}
            {showContest ? <th>Contest</th> : null}
            {showContestant ? <th>Contestant</th> : null}
            {showSchool ? <th>School</th> : null}
            {showCounty ? <th>County</th> : null}
            {showPlace ? <th>Place</th> : null}
            {showScore ? <th>Score</th> : null}
            {showResult ? <th>Result</th> : null}
            {showMedal ? <th>Medal</th> : null}
            {showSource ? <th>Source</th> : null}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row) => {
            const result = row.primary;
            const contest = contests.get(result.contestId);
            const sourceLinks = row.sourceIds
              .map((sourceID) => sources.get(sourceID))
              .filter((source): source is Source => Boolean(source?.url));
            return (
              <tr key={row.id}>
                {showYear ? <td data-label="Year" className="result-year-cell mono nowrap">{result.year}</td> : null}
                {showContest ? (
                  <td data-label="Contest" className="result-contest-cell">
                    <span className="table-cell-stack">
                      {contest ? (
                        <AppLink href={scoreboardHrefForResult(result, contest)} className="table-link">
                          {row.context.label}
                        </AppLink>
                      ) : (
                        row.context.label
                      )}
                      {row.context.note ? <span className="row-subtitle">{row.context.note}</span> : null}
                    </span>
                  </td>
                ) : null}
                {showContestant ? (
                  <td data-label="Contestant" className="result-person-cell">
                    {result.personId ? (
                      <AppLink href={routeFor('person', result.personId)} className="table-link">
                        {result.personName}
                      </AppLink>
                    ) : (
                      <span className="muted">{result.personName}</span>
                    )}
                  </td>
                ) : null}
                {showSchool ? (
                  <td data-label="School" className="result-school-cell">
                    {result.schoolId ? (
                      <AppLink href={routeFor('school', result.schoolId)}>{displaySchoolName(result.school, result.county)}</AppLink>
                    ) : (
                      displaySchoolName(result.school, result.county)
                    )}
                  </td>
                ) : null}
                {showCounty ? (
                  <td data-label="County" className="result-county-cell nowrap">
                    {result.countyId ? <AppLink href={routeFor('county', result.countyId)}>{result.county}</AppLink> : result.county || '-'}
                  </td>
                ) : null}
                {showPlace ? (
                  <td data-label="Place" className="result-place-cell mono nowrap">
                    <LotDetailStack details={row.placeDetails} fallback={row.placeLabel} />
                  </td>
                ) : null}
                {showScore ? (
                  <td data-label="Score" className="result-score-cell mono nowrap">
                    <LotDetailStack details={row.scoreDetails} fallback={row.scoreLabel} />
                  </td>
                ) : null}
                {showResult ? (
                  <td data-label="Result" className="result-outcome-cell">
                    {row.outcome.kind === 'empty' ? '-' : <span className={`result-pill result-${row.outcome.kind}`}>{row.outcome.label}</span>}
                  </td>
                ) : null}
                {showMedal ? (
                  <td data-label="Medal" className="result-medal-cell">
                    {result.medal ? <span className={`medal-pill medal-${result.medal}`}>{medalLabel(result.medal)}</span> : '-'}
                  </td>
                ) : null}
                {showSource ? (
                  <td data-label="Source" className="result-source-cell">
                    {sourceLinks.length > 0 ? (
                      <span className="source-link-stack">
                        {sourceLinks.map((source) => (
                          <a href={source.url} target="_blank" rel="noreferrer" className="icon-link" title={source.title} key={source.id}>
                            <ExternalLink size={15} />
                          </a>
                        ))}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      {results.length === 0 ? <div className="empty-state">No participations for this view.</div> : null}
    </div>
  );
}

function LotDetailStack({ details, fallback }: { details: LotDetail[]; fallback: string }) {
  if (details.length <= 1) return fallback;
  return (
    <span className="lot-detail-stack">
      {details.map((detail) => (
        <span className={detail.value === '-' ? 'lot-detail-chip is-empty' : 'lot-detail-chip'} key={detail.target}>
          <span className="lot-detail-target">{detail.target}</span>
          <span className="lot-detail-value">{detail.value}</span>
        </span>
      ))}
    </span>
  );
}
