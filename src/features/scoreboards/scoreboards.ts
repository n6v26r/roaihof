import type { ContestFamily } from '../../app/routes';
import { stageLabel } from '../../lib/format';
import type { Contest, Dataset, Result, Stats } from '../../lib/types';

export interface Scoreboard {
  id: string;
  family: ContestFamily;
  year: number;
  title: string;
  stage: string;
  section?: string;
  city?: string;
  country?: string;
  officialUrls?: string[];
  results: Result[];
}

export function buildScoreboards(data: Dataset): Scoreboard[] {
  const boards: Scoreboard[] = [];
  const contests = new Map(data.contests.map((contest) => [contest.id, contest]));
  const add = (id: string, family: ContestFamily, year: number, title: string, stage: string, section: string | undefined, results: Result[]) => {
    if (results.length === 0) return;
    const info = scoreboardInfo(results, contests);
    boards.push({
      id,
      family,
      year,
      title,
      stage,
      section,
      ...info,
      results: sortScoreboardRows(results)
    });
  };

  const onia2026National = data.results.filter((result) => result.circuit === 'ONIA' && result.year === 2026 && result.stage === 'national');
  add('onia-2026-nationala-full', 'ONIA', 2026, 'Națională', 'national', 'toate clasele', onia2026National);
  add('onia-2026-ix-x', 'ONIA', 2026, 'IX-X', 'national', 'IX-X', onia2026National.filter((result) => result.grade === '9' || result.grade === '10'));
  add('onia-2026-xi-xii', 'ONIA', 2026, 'XI-XII', 'national', 'XI-XII', onia2026National.filter((result) => result.grade === '11' || result.grade === '12'));
  for (const grade of ['9', '10', '11', '12']) {
    add(`onia-2026-clasa-${grade}`, 'ONIA', 2026, `Clasa ${grade}`, 'national', `clasa ${grade}`, onia2026National.filter((result) => result.grade === grade));
  }
  add('onia-2026-lot', 'ONIA', 2026, 'Lot', 'lot', 'Lot', data.results.filter((result) => result.circuit === 'ONIA' && result.year === 2026 && result.stage === 'lot'));

  add('roai-2026-ix-x', 'ROAI', 2026, 'IX-X', 'national', 'IX-X', data.results.filter((result) => result.contestId === 'roai-2026-national-ix-x'));
  add('roai-2026-xi-xii', 'ROAI', 2026, 'XI-XII', 'national', 'XI-XII', data.results.filter((result) => result.contestId === 'roai-2026-national-xi-xii'));
  add('roai-2026-lot', 'ROAI', 2026, 'Lot', 'lot', 'Lot', data.results.filter((result) => result.circuit === 'ROAI' && result.year === 2026 && result.stage === 'lot'));
  const roai2025National = data.results.filter((result) => result.circuit === 'ROAI' && result.year === 2025 && result.stage === 'national');
  add('roai-2025-national-ranking', 'ROAI', 2025, 'National Ranking', 'national', 'toate clasele', roai2025National);
  for (const grade of ['9', '10', '11', '12']) {
    add(
      `roai-2025-clasa-${grade}`,
      'ROAI',
      2025,
      `Clasa ${grade}`,
      'national',
      `clasa ${grade}`,
      data.results.filter((result) => result.contestId === `roai-2025-national-clasa-${grade}`)
    );
  }
  add('roai-2025-lot', 'ROAI', 2025, 'Lot', 'lot', 'Lot', data.results.filter((result) => result.circuit === 'ROAI' && result.year === 2025 && result.stage === 'lot'));

  const iaioYears = Array.from(new Set(data.results.filter((result) => result.circuit === 'IAIO').map((result) => result.year)));
  for (const year of iaioYears) {
    add(`iaio-${year}-global`, 'IAIO', year, 'Global', 'international', 'Global', data.results.filter((result) => result.circuit === 'IAIO' && result.year === year));
  }

  const ioaiYears = Array.from(new Set(data.results.filter((result) => result.circuit === 'IOAI').map((result) => result.year)));
  for (const year of ioaiYears) {
    const yearResults = data.results.filter((result) => result.circuit === 'IOAI' && result.year === year);
    for (const section of ['theory', 'practical', 'individual']) {
      const sectionResults = yearResults.filter((result) => (result.section || 'individual') === section);
      add(`ioai-${year}-${section}`, 'IOAI', year, ioaiSectionTitle(section), 'international', ioaiSectionTitle(section), sectionResults);
    }
  }

  return boards;
}

export function placementOverridesForScoreboard(scoreboard: Scoreboard, overrides: Map<string, number>): Map<string, number> | undefined {
  if (scoreboard.family === 'ROAI' && scoreboard.year === 2025 && scoreboard.stage === 'national' && scoreboard.title.startsWith('Clasa')) {
    return overrides;
  }
  return undefined;
}

export function familyCards(scoreboards: Map<string, Scoreboard>) {
  const order: ContestFamily[] = ['ONIA', 'ROAI', 'IAIO', 'IOAI', 'CEOAI'];
  const boards = Array.from(scoreboards.values());
  return order.map((name) => {
    const familyScoreboards = boards.filter((scoreboard) => scoreboard.family === name);
    return {
      name,
      slug: name.toLowerCase(),
      future: name === 'CEOAI' && familyScoreboards.length === 0,
      yearLabel: yearLabel(familyScoreboards.map((scoreboard) => scoreboard.year))
    };
  });
}

function scoreboardInfo(results: Result[], contests: Map<string, Contest>) {
  const contestIDs = uniqueValues(results.map((result) => result.contestId));
  const contestItems = contestIDs
    .map((id) => contests.get(id))
    .filter((contest): contest is Contest => Boolean(contest));
  const city = singleValue(uniqueValues(contestItems.map((contest) => contest.city).filter(Boolean) as string[]));
  const country = singleValue(uniqueValues(contestItems.map((contest) => contest.country).filter(Boolean) as string[]));
  const officialUrls = uniqueValues(contestItems.map((contest) => contest.officialUrl).filter(Boolean) as string[]);
  return { city, country, officialUrls };
}

export function scoreboardLocation(scoreboard: Pick<Scoreboard, 'city' | 'country'>): string | undefined {
  if (!scoreboard.city && !scoreboard.country) return undefined;
  if (scoreboard.country && scoreboard.country !== 'România') {
    return [scoreboard.city, scoreboard.country].filter(Boolean).join(', ');
  }
  return scoreboard.city || scoreboard.country;
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values));
}

function singleValue(values: string[]): string | undefined {
  return values.length === 1 ? values[0] : undefined;
}

function sortScoreboardRows(results: Result[]): Result[] {
  return [...results].sort((a, b) => {
    const leftScore = scoreForSort(a.score);
    const rightScore = scoreForSort(b.score);
    if (leftScore !== rightScore) return rightScore - leftScore;
    return placeForSort(a.place) - placeForSort(b.place) || a.personName.localeCompare(b.personName);
  });
}

export function scoreboardOrder(scoreboard: Scoreboard): number {
  const title = scoreboard.title.toLowerCase();
  if (title === 'națională') return 0;
  if (title === 'national ranking') return 0;
  if (title === 'ix-x') return 1;
  if (title === 'xi-xii') return 2;
  if (title.startsWith('clasa')) return 3 + Number(title.replace('clasa ', '')) - 9;
  if (title === 'lot') return 10;
  if (title === 'teoretică') return 0;
  if (title === 'practică') return 1;
  if (title === 'individual') return 0;
  if (title === 'global') return 0;
  return 20;
}

export function scoreboardSubtitle(scoreboard: Scoreboard): string | undefined {
  const stage = stageLabel(scoreboard.stage);
  const titleKey = subtitleKey(scoreboard.title);
  const parts = [stage, scoreboard.section, scoreboardLocation(scoreboard)]
    .filter((part): part is string => Boolean(part))
    .filter((part, index, values) => {
      const key = subtitleKey(part);
      return key !== titleKey && values.findIndex((value) => subtitleKey(value) === key) === index;
    });
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export function scoreboardDetailTag(scoreboard: Scoreboard): string | undefined {
  const tag = scoreboard.section || stageLabel(scoreboard.stage);
  return subtitleKey(tag) === subtitleKey(scoreboard.title) ? undefined : tag;
}

export function scoreboardOfficialLinks(scoreboard: Scoreboard): Array<{ label: string; href: string; external: boolean }> {
  if (scoreboard.family === 'ROAI' && scoreboard.year === 2025 && scoreboard.stage === 'national') {
    return [{
      label: 'official source',
      href: 'https://judge.nitro-ai.org/competitions/roai-2025/onia/leaderboard/complete?page=1&page_size=200',
      external: true
    }];
  }

  const officialUrls = scoreboard.officialUrls ?? [];
  if (scoreboard.family === 'ROAI' && scoreboard.stage === 'lot' && officialUrls.length > 1) {
    return [{
      label: 'official sources',
      href: `https://olimpiada.nitro-ai.org/ro/${scoreboard.year}/lot?section=tasks`,
      external: true
    }];
  }

  return officialUrls.map((url, index, urls) => ({
    label: urls.length === 1 ? 'official source' : `official source ${index + 1}`,
    href: url,
    external: true
  }));
}

function subtitleKey(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function ioaiSectionTitle(section: string): string {
  if (section === 'theory') return 'Teoretică';
  if (section === 'practical') return 'Practică';
  return 'Individual';
}

function placeForSort(place?: number): number {
  return place && place > 0 ? place : 1_000_000;
}

function scoreForSort(score?: number): number {
  return score === undefined || score === null ? Number.NEGATIVE_INFINITY : score;
}

export function statsVariantForStage(stage: string): 'entity' | 'national' | 'lot' | 'international' {
  if (stage === 'national') return 'national';
  if (stage === 'lot') return 'lot';
  if (stage === 'international') return 'international';
  return 'entity';
}

export function statsForResults(results: Result[]): Stats {
  const stats = defaultEntityStats();
  const lotParticipants = new Set<string>();
  const lotSelections = new Set<string>();
  const lotTargets = {
    ioai: new Set<string>(),
    ceoai: new Set<string>(),
    iaio: new Set<string>()
  };
  const onlyLot = results.length > 0 && results.every((result) => result.stage === 'lot');

  for (const result of results) {
    if (result.stage === 'international') {
      stats.participations += 1;
      stats.internationalParticipations += 1;
    } else if (result.stage === 'lot') {
      lotParticipants.add(lotParticipantKey(result));
      if (result.qualification) {
        const selectionKey = lotSelectionKey(result);
        lotSelections.add(selectionKey);
        if (result.qualification.includes('IOAI')) lotTargets.ioai.add(selectionKey);
        if (result.qualification.includes('CEOAI')) lotTargets.ceoai.add(selectionKey);
        if (result.qualification.includes('IAIO')) lotTargets.iaio.add(selectionKey);
      }
    } else {
      stats.participations += 1;
      stats.nationalParticipations += 1;
    }
    if (result.stage === 'national' || result.stage === 'international') {
      if (result.medal === 'gold') stats.gold += 1;
      if (result.medal === 'silver') stats.silver += 1;
      if (result.medal === 'bronze') stats.bronze += 1;
      if (result.medal === 'honorable') stats.honorable += 1;
    }
    if (result.stage === 'national') {
      if (result.prize) stats.prizes += 1;
    }
    if ((result.stage === 'national' || result.stage === 'international') && result.place && (!stats.bestPlace || result.place < stats.bestPlace)) {
      stats.bestPlace = result.place;
    }
    if (!stats.years.includes(result.year)) stats.years.push(result.year);
    if (!stats.circuits.includes(result.circuit)) stats.circuits.push(result.circuit);
  }
  if (onlyLot) {
    stats.participations = lotParticipants.size;
    stats.selections = lotSelections.size;
    stats.lotParticipations = lotParticipants.size;
    stats.ioaiSelections = lotTargets.ioai.size;
    stats.ceoaiSelections = lotTargets.ceoai.size;
    stats.iaioSelections = lotTargets.iaio.size;
  }
  stats.years.sort((a, b) => a - b);
  stats.circuits.sort();
  return stats;
}

function lotParticipantKey(result: Result): string {
  return `${result.personId ?? result.personName}:${result.year}:${result.circuit}`;
}

function lotSelectionKey(result: Result): string {
  return `${lotParticipantKey(result)}:${result.qualification ?? ''}`;
}

export function yearLabel(years: number[]): string {
  const unique = Array.from(new Set(years)).sort((a, b) => a - b);
  if (unique.length === 0) return '';
  if (unique.length === 1) return String(unique[0]);
  return `${unique[0]}-${unique[unique.length - 1]}`;
}

function defaultEntityStats(): Stats {
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
