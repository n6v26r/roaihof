import { describe, expect, it } from 'vitest';
import dataset from '../generated/app-data.json';
import type { Dataset, Result, Stats } from './types';
import { aggregateRanking, emptyStats, filteredResults, searchItems } from './stats';

const data = dataset as Dataset;

describe('stats helpers', () => {
  it('filters international results separately from merged results', () => {
    const merged = filteredResults(data.results, { circuit: 'merged', stage: 'all' });
    const international = filteredResults(data.results, { circuit: 'international', stage: 'all' });

    expect(merged.length).toBe(data.summary.results);
    expect(international.length).toBeGreaterThan(0);
    expect(international.every((result) => result.stage === 'international')).toBe(true);
  });

  it('does not rank anonymous participant rows as people', () => {
    const ranking = aggregateRanking('people', data, { circuit: 'ONIA', stage: 'national' });

    expect(ranking.length).toBeGreaterThan(0);
    expect(ranking.some((row) => row.name.startsWith('Participant'))).toBe(false);
  });

  it('keeps international medals out of Romanian entity ranking stats', () => {
    const ranking = aggregateRanking('people', data, { circuit: 'merged', stage: 'all' });
    const tache = ranking.find((row) => row.id === 'tache-david-stefan');
    const iaioResult = data.results.find((result) => result.personId === 'tache-david-stefan' && result.contestId === 'iaio-2026');

    expect(iaioResult?.medal).toBe('silver');
    expect(tache?.stats.silver).toBe(2);
    expect(tache?.stats.participations).toBe(3);
    expect(tache?.stats.nationalParticipations).toBe(3);
    expect(tache?.stats.iaioSelections).toBe(2);
    expect(tache?.stats.circuits).not.toContain('IAIO');
  });

  it('uses international results for international contest filters', () => {
    const ranking = aggregateRanking('people', data, { circuit: 'IAIO', stage: 'all' });
    const tache = ranking.find((row) => row.id === 'tache-david-stefan');
    const tacheIAIOResults = data.results.filter((result) =>
      result.personId === 'tache-david-stefan' &&
      result.circuit === 'IAIO' &&
      result.stage === 'international'
    );

    expect(ranking.length).toBeGreaterThan(0);
    expect(tacheIAIOResults.length).toBeGreaterThan(0);
    expect(tache?.stats.silver).toBe(tacheIAIOResults.filter((result) => result.medal === 'silver').length);
    expect(tache?.stats.internationalParticipations).toBe(tacheIAIOResults.length);
    expect(tache?.stats.nationalParticipations).toBe(0);
    expect(tache?.stats.circuits).toEqual(['IAIO']);
  });

  it('uses ROAI 2025 class placement for best national place', () => {
    const ranking = aggregateRanking('people', data, { circuit: 'ROAI', stage: 'national' });
    const ilie = ranking.find((row) => row.id === 'ilie-goga-radu');

    expect(ilie?.stats.bestPlace).toBe(1);
  });

  it('deduplicates split ROAI Lot rankings as one selection event', () => {
    const ranking = aggregateRanking('people', data, { circuit: 'merged', stage: 'all' });
    const ilie = ranking.find((row) => row.id === 'ilie-goga-radu');

    expect(ilie?.stats.selections).toBe(3);
    expect(ilie?.stats.lotParticipations).toBe(3);
    expect(ilie?.stats.ceoaiSelections).toBe(2);
  });

  it('uses international criteria after merged national criteria for every entity kind', () => {
    const tieData = rankingTieDataset();

    expect(aggregateRanking('people', tieData, { circuit: 'merged', stage: 'all' }).map((row) => row.id)).toEqual(['beta', 'alpha']);
    expect(aggregateRanking('schools', tieData, { circuit: 'merged', stage: 'all' }).map((row) => row.id)).toEqual(['school-beta', 'school-alpha']);
    expect(aggregateRanking('counties', tieData, { circuit: 'merged', stage: 'all' }).map((row) => row.id)).toEqual(['county-beta', 'county-alpha']);
  });

  it('keeps the old alphabetical final tiebreaker for the national stage filter', () => {
    const tieData = rankingTieDataset();

    expect(aggregateRanking('people', tieData, { circuit: 'merged', stage: 'national' }).map((row) => row.id)).toEqual(['alpha', 'beta']);
    expect(aggregateRanking('schools', tieData, { circuit: 'merged', stage: 'national' }).map((row) => row.id)).toEqual(['school-alpha', 'school-beta']);
    expect(aggregateRanking('counties', tieData, { circuit: 'merged', stage: 'national' }).map((row) => row.id)).toEqual(['county-alpha', 'county-beta']);
  });

  it('uses national best place before selections in merged rankings', () => {
    const tieData = rankingDataset([
      rankingResult('alpha-national', 'alpha', 'Alpha', 'ONIA', 'national', { medal: 'gold', place: 1 }),
      rankingResult('beta-national', 'beta', 'Beta', 'ONIA', 'national', { medal: 'gold', place: 2 }),
      rankingResult('beta-lot', 'beta', 'Beta', 'ONIA', 'lot', { qualification: 'IOAI' })
    ]);

    expect(aggregateRanking('people', tieData, { circuit: 'merged', stage: 'all' }).map((row) => row.id)).toEqual(['alpha', 'beta']);
  });

  it('uses selections before international criteria in lot rankings', () => {
    const tieData = rankingDataset([
      rankingResult('alpha-lot-1', 'alpha', 'Alpha', 'ONIA', 'lot', { qualification: 'IOAI', year: 2025 }),
      rankingResult('alpha-lot-2', 'alpha', 'Alpha', 'ROAI', 'lot', { qualification: 'IAIO', year: 2026 }),
      rankingResult('beta-lot', 'beta', 'Beta', 'ONIA', 'lot', { qualification: 'IOAI' }),
      rankingResult('beta-ioai', 'beta', 'Beta', 'IOAI', 'international', { medal: 'gold', place: 1 })
    ]);

    expect(aggregateRanking('people', tieData, { circuit: 'merged', stage: 'lot' }).map((row) => row.id)).toEqual(['alpha', 'beta']);
  });

  it('uses international medals, best place, then participations for international rankings', () => {
    const tieData = rankingDataset([
      rankingResult('alpha-iaio', 'alpha', 'Alpha', 'IAIO', 'international', { medal: 'silver', place: 1 }),
      rankingResult('beta-ioai', 'beta', 'Beta', 'IOAI', 'international', { medal: 'gold', place: 50 }),
      rankingResult('delta-ioai', 'delta', 'Delta', 'IOAI', 'international', { medal: 'bronze', place: 2 }),
      rankingResult('gamma-ioai', 'gamma', 'Gamma', 'IOAI', 'international', { medal: 'bronze', place: 3 }),
      rankingResult('zeta-iaio-1', 'zeta', 'Zeta', 'IAIO', 'international', { place: 10 }),
      rankingResult('zeta-iaio-2', 'zeta', 'Zeta', 'IAIO', 'international', { place: 20, year: 2025 }),
      rankingResult('eta-iaio', 'eta', 'Eta', 'IAIO', 'international', { place: 10 })
    ]);

    expect(aggregateRanking('people', tieData, { circuit: 'international', stage: 'all' }).map((row) => row.id)).toEqual([
      'beta',
      'alpha',
      'delta',
      'gamma',
      'zeta',
      'eta'
    ]);
  });

  it('searches aliases and normalized tokens', () => {
    const matches = searchItems(data, 'razvan dedu');

    expect(matches.some((item) => item.id === 'dedu-razvan-matei')).toBe(true);
  });

  it('searches automatically merged shorter name aliases', () => {
    const matches = searchItems(data, 'blidar lucian');

    expect(matches.some((item) => item.id === 'blidar-george-lucian')).toBe(true);
    expect(matches.some((item) => item.id === 'blidar-lucian')).toBe(false);
  });

  it('searches and annotates external usernames', () => {
    const judgeMatch = searchItems(data, 'MihneaStoica').find((item) => item.id === 'stoica-mihnea-teodor');
    const mlcompeteMatch = searchItems(data, 'MihneaTeodorStoica').find((item) => item.id === 'stoica-mihnea-teodor');

    expect(judgeMatch?.matchedUsername).toEqual({ platform: 'judge', username: 'MihneaStoica' });
    expect(mlcompeteMatch?.matchedUsername).toEqual({ platform: 'mlcompete', username: 'MihneaTeodorStoica' });
  });
});

function rankingResult(
  id: string,
  personId: string,
  personName: string,
  circuit: string,
  stage: string,
  item: Partial<Result> = {}
): Result {
  const year = item.year ?? 2026;
  return {
    id,
    contestId: item.contestId ?? `${circuit.toLowerCase()}-${stage}-${year}`,
    personId,
    personName,
    schoolId: `school-${personId}`,
    school: `${personName} School`,
    countyId: `county-${personId}`,
    county: `${personName} County`,
    year,
    circuit,
    stage,
    sourceId: 'source',
    anonymous: false,
    ...item
  };
}

function rankingDataset(results: Result[]): Dataset {
  const stats = (): Stats => emptyStats();
  const people = Array.from(new Map(results.map((result) => [result.personId!, result.personName])).entries())
    .map(([id, name]) => ({ id, name, schoolIds: [`school-${id}`], countyIds: [`county-${id}`], stats: stats() }));
  const schools = people.map((person) => ({
    id: `school-${person.id}`,
    name: `${person.name} School`,
    countyId: `county-${person.id}`,
    county: `${person.name} County`,
    stats: stats()
  }));
  const counties = people.map((person) => ({
    id: `county-${person.id}`,
    name: `${person.name} County`,
    stats: stats()
  }));

  return {
    generatedAt: '',
    summary: {
      people: people.length,
      schools: schools.length,
      counties: counties.length,
      contests: 0,
      results: results.length,
      namedResults: results.length,
      anonymousResults: 0,
      years: [2026],
      circuits: [],
      latestYear: 2026,
      mergedByDefault: true,
      roaiStatus: '',
      nationalCoverageScope: ''
    },
    provenance: [],
    sourceStatuses: [],
    people,
    schools,
    counties,
    contests: [],
    results,
    rankings: { people: [], schools: [], counties: [] },
    search: []
  };
}

function rankingTieDataset(): Dataset {
  const stats = (): Stats => emptyStats();
  const result = (item: Partial<Result> & Pick<Result, 'id' | 'contestId' | 'personId' | 'personName' | 'schoolId' | 'school' | 'countyId' | 'county' | 'year' | 'circuit' | 'stage' | 'sourceId'>): Result => ({
    originalCounty: '',
    locality: '',
    section: '',
    grade: '',
    place: undefined,
    score: undefined,
    scoreMax: undefined,
    medal: '',
    prize: '',
    qualification: '',
    anonymous: false,
    ...item
  });

  return {
    generatedAt: '',
    summary: {
      people: 2,
      schools: 2,
      counties: 2,
      contests: 2,
      results: 3,
      namedResults: 3,
      anonymousResults: 0,
      years: [2026],
      circuits: ['IAIO', 'ONIA'],
      latestYear: 2026,
      mergedByDefault: true,
      roaiStatus: '',
      nationalCoverageScope: ''
    },
    provenance: [],
    sourceStatuses: [],
    people: [
      { id: 'alpha', name: 'Alpha', schoolIds: ['school-alpha'], countyIds: ['county-alpha'], stats: stats() },
      { id: 'beta', name: 'Beta', schoolIds: ['school-beta'], countyIds: ['county-beta'], stats: stats() }
    ],
    schools: [
      { id: 'school-alpha', name: 'Alpha School', countyId: 'county-alpha', county: 'Alpha County', stats: stats() },
      { id: 'school-beta', name: 'Beta School', countyId: 'county-beta', county: 'Beta County', stats: stats() }
    ],
    counties: [
      { id: 'county-alpha', name: 'Alpha County', stats: stats() },
      { id: 'county-beta', name: 'Beta County', stats: stats() }
    ],
    contests: [],
    results: [
      result({
        id: 'r-alpha-national',
        contestId: 'onia-national',
        personId: 'alpha',
        personName: 'Alpha',
        schoolId: 'school-alpha',
        school: 'Alpha School',
        countyId: 'county-alpha',
        county: 'Alpha County',
        year: 2026,
        circuit: 'ONIA',
        stage: 'national',
        sourceId: 'source',
        place: 1,
        medal: 'gold'
      }),
      result({
        id: 'r-beta-national',
        contestId: 'onia-national',
        personId: 'beta',
        personName: 'Beta',
        schoolId: 'school-beta',
        school: 'Beta School',
        countyId: 'county-beta',
        county: 'Beta County',
        year: 2026,
        circuit: 'ONIA',
        stage: 'national',
        sourceId: 'source',
        place: 1,
        medal: 'gold'
      }),
      result({
        id: 'r-beta-international',
        contestId: 'iaio-2026',
        personId: 'beta',
        personName: 'Beta',
        schoolId: 'school-beta',
        school: 'Beta School',
        countyId: 'county-beta',
        county: 'Beta County',
        year: 2026,
        circuit: 'IAIO',
        stage: 'international',
        sourceId: 'source'
      })
    ],
    rankings: { people: [], schools: [], counties: [] },
    search: []
  };
}
