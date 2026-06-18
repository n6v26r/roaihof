import type {
  CircuitFilter,
  Contest,
  Dataset,
  Filters,
  RankingKind,
  RankingRow,
  Result,
  SearchItem,
  SearchUsername,
  StageFilter,
  Stats
} from './types';
import { buildEffectivePlaceOverrides } from './placements';

export const defaultFilters: Filters = {
  circuit: 'merged',
  stage: 'all',
  query: ''
};

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

export function matchesFilters(result: Result, filters: Pick<Filters, 'circuit' | 'stage'>): boolean {
  return matchesCircuit(result, filters.circuit) && matchesStage(result, filters.stage);
}

export function matchesCircuit(result: Result, circuit: CircuitFilter): boolean {
  if (circuit === 'merged') return true;
  if (circuit === 'international') return result.stage === 'international';
  return result.circuit === circuit;
}

export function matchesStage(result: Result, stage: StageFilter): boolean {
  return stage === 'all' || result.stage === stage;
}

export function filteredResults(results: Result[], filters: Pick<Filters, 'circuit' | 'stage'>): Result[] {
  return results.filter((result) => matchesFilters(result, filters));
}

export function searchItems(dataset: Dataset, query: string) {
  const tokens = normalizeText(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return [];
  return dataset.search
    .filter((item) => tokens.every((token) => item.tokens.some((candidate) => candidate.includes(token))))
    .map((item) => ({ ...item, matchedUsername: matchedSearchUsername(item, tokens) }))
    .slice(0, 12);
}

export type SearchResult = SearchItem & {
  matchedUsername?: SearchUsername;
};

function matchedSearchUsername(item: SearchItem, queryTokens: string[]): SearchUsername | undefined {
  return item.usernames?.find((username) => {
    const usernameTokens = normalizeText(username.username).split(' ').filter(Boolean);
    return queryTokens.some((queryToken) => usernameTokens.some((usernameToken) => usernameToken.includes(queryToken)));
  });
}

export function aggregateRanking(
  kind: RankingKind,
  dataset: Dataset,
  filters: Pick<Filters, 'circuit' | 'stage'>
): RankingRow[] {
  const labels = new Map<string, string>();
  const stats = new Map<string, Stats>();
  const uniqueContestants = new Map<string, Set<string>>();
  const selectionEvents = new Map<string, Set<string>>();
  const rankingScope = internationalRankingScope(filters) ? 'international' : 'romanian';
  const useInternationalTiebreaker = usesInternationalParticipationTiebreaker(filters);
  const internationalParticipations = useInternationalTiebreaker
    ? internationalParticipationCounts(kind, dataset.results)
    : new Map<string, number>();
  const effectivePlaces = buildEffectivePlaceOverrides(dataset.results);

  for (const result of dataset.results) {
    if (!matchesFilters(result, filters)) continue;
    if (!contributesToRankingStats(result, rankingScope)) continue;
    const id = entityId(kind, result);
    if (!id) continue;
    const label = entityLabel(kind, result, dataset);
    labels.set(id, label);
    const rowStats = stats.get(id) ?? emptyStats();
    accumulate(rowStats, result, rankingScope, effectivePlaces);
    stats.set(id, rowStats);
    if (rankingScope === 'romanian' && isSelectionStage(result.stage)) {
      const set = selectionEvents.get(id) ?? new Set<string>();
      set.add(selectionEventKey(result));
      selectionEvents.set(id, set);
    }
    if (result.personId) {
      const set = uniqueContestants.get(id) ?? new Set<string>();
      set.add(result.personId);
      uniqueContestants.set(id, set);
    }
  }

  const rows = Array.from(stats, ([id, rowStats]) => {
    const selectionCount = selectionEvents.get(id)?.size ?? 0;
    rowStats.selections = selectionCount;
    rowStats.lotParticipations = selectionCount;
    rowStats.uniqueContestants = uniqueContestants.get(id)?.size ?? (kind === 'people' ? 1 : 0);
    rowStats.years.sort((a, b) => a - b);
    rowStats.circuits.sort();
    return {
      id,
      name: labels.get(id) ?? id,
      kind: kind.slice(0, -1),
      stats: rowStats
    };
  });

  return rows.sort((a, b) =>
    compareStats(b.stats, a.stats, {
      includeInternationalTiebreaker: useInternationalTiebreaker,
      leftInternationalParticipations: internationalParticipations.get(b.id) ?? 0,
      rightInternationalParticipations: internationalParticipations.get(a.id) ?? 0
    }) || a.name.localeCompare(b.name)
  );
}

function internationalRankingScope(filters: Pick<Filters, 'circuit' | 'stage'>): boolean {
  return filters.stage === 'international' || ['international', 'IAIO', 'IOAI', 'CEOAI'].includes(filters.circuit);
}

function usesInternationalParticipationTiebreaker(filters: Pick<Filters, 'circuit' | 'stage'>): boolean {
  return filters.stage !== 'national' && !internationalRankingScope(filters);
}

function internationalParticipationCounts(kind: RankingKind, results: Result[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const result of results) {
    if (result.stage !== 'international') continue;
    const id = entityId(kind, result);
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export function contestResults(contest: Contest, dataset: Dataset): Result[] {
  return dataset.results
    .filter((result) => result.contestId === contest.id)
    .sort(compareScoreboardResults);
}

export function entityResults(kind: 'person' | 'school' | 'county', id: string, dataset: Dataset): Result[] {
  return dataset.results
    .filter((result) => {
      if (kind === 'person') return result.personId === id;
      if (kind === 'school') return result.schoolId === id;
      return result.countyId === id;
    })
    .sort((a, b) => b.year - a.year || a.contestId.localeCompare(b.contestId) || placeForSort(a.place) - placeForSort(b.place));
}

export function emptyStats(): Stats {
  return {
    participations: 0,
    nationalParticipations: 0,
    internationalParticipations: 0,
    lotParticipations: 0,
    gold: 0,
    silver: 0,
    bronze: 0,
    honorable: 0,
    prizes: 0,
    selections: 0,
    ioaiSelections: 0,
    ceoaiSelections: 0,
    iaioSelections: 0,
    uniqueContestants: 0,
    years: [],
    circuits: []
  };
}

type RankingScope = 'romanian' | 'international';

function accumulate(stats: Stats, result: Result, scope: RankingScope, effectivePlaces: Map<string, number>) {
  if (scope === 'international') {
    accumulateInternational(stats, result);
    return;
  }
  if (!contributesToRomanianEntityStats(result)) return;
  if (!isSelectionStage(result.stage)) {
    stats.participations += 1;
    stats.nationalParticipations += 1;
  }

  if (result.stage === 'national') {
    if (result.medal === 'gold') stats.gold += 1;
    if (result.medal === 'silver') stats.silver += 1;
    if (result.medal === 'bronze') stats.bronze += 1;
    if (result.medal === 'honorable') stats.honorable += 1;
    if (result.prize) stats.prizes += 1;
  }
  if (isSelectionStage(result.stage) && result.qualification?.includes('IOAI')) stats.ioaiSelections += 1;
  if (isSelectionStage(result.stage) && result.qualification?.includes('CEOAI')) stats.ceoaiSelections += 1;
  if (isSelectionStage(result.stage) && result.qualification?.includes('IAIO')) stats.iaioSelections += 1;
  const place = effectivePlaces.get(result.id) ?? result.place;
  if (result.stage === 'national' && place && (!stats.bestPlace || place < stats.bestPlace)) stats.bestPlace = place;
  if (!stats.years.includes(result.year)) stats.years.push(result.year);
  if (!stats.circuits.includes(result.circuit)) stats.circuits.push(result.circuit);
}

function accumulateInternational(stats: Stats, result: Result) {
  if (result.stage !== 'international') return;
  stats.participations += 1;
  stats.internationalParticipations += 1;
  if (result.medal === 'gold') stats.gold += 1;
  if (result.medal === 'silver') stats.silver += 1;
  if (result.medal === 'bronze') stats.bronze += 1;
  if (result.medal === 'honorable') stats.honorable += 1;
  if (result.place && (!stats.bestPlace || result.place < stats.bestPlace)) stats.bestPlace = result.place;
  if (!stats.years.includes(result.year)) stats.years.push(result.year);
  if (!stats.circuits.includes(result.circuit)) stats.circuits.push(result.circuit);
}

function contributesToRankingStats(result: Result, scope: RankingScope): boolean {
  return scope === 'international' ? result.stage === 'international' : contributesToRomanianEntityStats(result);
}

function contributesToRomanianEntityStats(result: Result): boolean {
  return result.stage !== 'international';
}

function isSelectionStage(stage: string): boolean {
  return stage === 'lot';
}

function selectionEventKey(result: Result): string {
  return `${result.personId ?? normalizeText(result.personName)}:${result.year}:${result.circuit}`;
}

function compareStats(
  a: Stats,
  b: Stats,
  options: {
    includeInternationalTiebreaker?: boolean;
    leftInternationalParticipations?: number;
    rightInternationalParticipations?: number;
  } = {}
): number {
  const checks = [
    a.gold - b.gold,
    a.silver - b.silver,
    a.bronze - b.bronze,
    a.honorable - b.honorable,
    a.prizes - b.prizes,
    a.selections - b.selections,
    a.lotParticipations - b.lotParticipations,
    a.nationalParticipations - b.nationalParticipations,
    a.participations - b.participations,
    placeForSort(b.bestPlace) - placeForSort(a.bestPlace),
    options.includeInternationalTiebreaker
      ? (options.leftInternationalParticipations ?? 0) - (options.rightInternationalParticipations ?? 0)
      : 0
  ];
  return checks.find((value) => value !== 0) ?? 0;
}

function placeForSort(place?: number): number {
  return place && place > 0 ? place : 1_000_000;
}

function compareScoreboardResults(a: Result, b: Result): number {
  const leftScore = scoreForSort(a.score);
  const rightScore = scoreForSort(b.score);
  if (leftScore !== rightScore) return rightScore - leftScore;
  return placeForSort(a.place) - placeForSort(b.place) || a.personName.localeCompare(b.personName);
}

function scoreForSort(score?: number): number {
  return score === undefined || score === null ? Number.NEGATIVE_INFINITY : score;
}

function entityId(kind: RankingKind, result: Result): string | undefined {
  if (kind === 'people') return result.personId;
  if (kind === 'schools') return result.schoolId;
  return result.countyId;
}

function entityLabel(kind: RankingKind, result: Result, dataset: Dataset): string {
  if (kind === 'people') return result.personName;
  if (kind === 'schools') return dataset.schools.find((school) => school.id === result.schoolId)?.name ?? result.school ?? '';
  return dataset.counties.find((county) => county.id === result.countyId)?.name ?? result.county ?? '';
}
