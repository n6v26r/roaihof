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

  it('uses international participations as the last non-national ranking tiebreaker for every entity kind', () => {
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
