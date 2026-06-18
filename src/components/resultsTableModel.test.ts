import { describe, expect, it } from 'vitest';
import { dataset } from '../app/data';
import { mergeDisplayRows, scoreboardHrefForResult } from './resultsTableModel';

const contests = new Map(dataset.contests.map((contest) => [contest.id, contest]));

describe('results table model', () => {
  it('routes result contest links to scoreboards', () => {
    const roaiResult = dataset.results.find((result) => result.contestId === 'roai-2026-national-ix-x' && result.grade === '9');
    const oniaResult = dataset.results.find((result) => result.contestId === 'onia-2026-nationala' && result.grade === '10');
    const oniaGuest = dataset.results.find((result) => result.contestId === 'onia-2026-nationala' && result.status === 'guest');

    expect(scoreboardHrefForResult(roaiResult!, contests.get(roaiResult!.contestId)!)).toBe('/scoreboards/roai-2026-ix-x');
    expect(scoreboardHrefForResult(oniaResult!, contests.get(oniaResult!.contestId)!)).toBe('/scoreboards/onia-2026-clasa-10');
    expect(scoreboardHrefForResult(oniaGuest!, contests.get(oniaGuest!.contestId)!)).toBe('/scoreboards/onia-2026-clasa-8');
  });

  it('shows ONIA grade 8 guests as status rows', () => {
    const guest = dataset.results.find((result) => result.contestId === 'onia-2026-nationala' && result.status === 'guest');
    const displayRows = mergeDisplayRows([guest!], contests);

    expect(displayRows[0].context.label).toBe('ONIA VIII');
    expect(displayRows[0].placeLabel).toBe('-');
    expect(displayRows[0].scoreLabel).not.toBe('-');
    expect(displayRows[0].outcome).toEqual({ label: 'GUEST', kind: 'guest' });
  });

  it('merges split ROAI Lot rows for one person and year', () => {
    const rows = dataset.results.filter((result) =>
      result.personId === 'dedu-razvan-matei' &&
      result.circuit === 'ROAI' &&
      result.year === 2026 &&
      result.stage === 'lot'
    );
    const displayRows = mergeDisplayRows(rows, contests);

    expect(rows).toHaveLength(2);
    expect(displayRows).toHaveLength(1);
    expect(displayRows[0].context.label).toBe('ROAI Lot');
    expect(displayRows[0].placeDetails.map((detail) => detail.target)).toEqual(['IAIO', 'CEOAI']);
  });
});
