import { resultOutcome, scoreboardRouteForContest, scoreWithMax } from '../lib/format';
import type { Contest, Result } from '../lib/types';

export interface ContestContext {
  label: string;
  note?: string;
  key: string;
}

export interface DisplayRow {
  id: string;
  primary: Result;
  context: ContestContext;
  placeLabel: string;
  scoreLabel: string;
  placeDetails: LotDetail[];
  scoreDetails: LotDetail[];
  outcome: ReturnType<typeof resultOutcome>;
  sourceIds: string[];
}

export interface LotDetail {
  target: string;
  value: string;
}

export function mergeDisplayRows(results: Result[], contests: Map<string, Contest>, placementOverrides?: Map<string, number>): DisplayRow[] {
  const groups: Result[][] = [];
  const roaiLotGroups = new Map<string, Result[]>();

  for (const result of results) {
    if (isMergedROAILotResult(result)) {
      const key = `${result.year}:${result.personId || result.personName}`;
      const existing = roaiLotGroups.get(key);
      if (existing) {
        existing.push(result);
      } else {
        const group = [result];
        roaiLotGroups.set(key, group);
        groups.push(group);
      }
      continue;
    }
    groups.push([result]);
  }

  return groups.map((group) => displayRow(group, contests, placementOverrides));
}

export function displaySchoolName(school?: string, county?: string): string {
  if (!school) return '-';
  if (!county) return school;
  for (const suffix of [`, ${county}`, ` ${county}`]) {
    if (school.endsWith(suffix)) return school.slice(0, -suffix.length);
  }
  return school;
}

export function scoreboardHrefForResult(result: Result, contest: Contest): string {
  const fallback = scoreboardRouteForContest(contest.id);
  if (result.stage === 'lot') {
    if (result.circuit === 'ONIA' && result.year === 2026) return '/scoreboards/onia-2026-lot';
    if (result.circuit === 'ROAI' && (result.year === 2025 || result.year === 2026)) return `/scoreboards/roai-${result.year}-lot`;
    return fallback;
  }
  if (result.stage === 'national') {
    if (result.circuit === 'ONIA' && result.year === 2026 && result.grade) {
      return `/scoreboards/onia-2026-clasa-${result.grade}`;
    }
    if (result.circuit === 'ROAI' && result.year === 2026) {
      const section = result.section || contest.section || '';
      if (section === 'IX-X') return '/scoreboards/roai-2026-ix-x';
      if (section === 'XI-XII') return '/scoreboards/roai-2026-xi-xii';
    }
    if (result.circuit === 'ROAI' && result.year === 2025 && result.grade) {
      return `/scoreboards/roai-2025-clasa-${result.grade}`;
    }
  }
  return fallback;
}

function displayRow(group: Result[], contests: Map<string, Contest>, placementOverrides?: Map<string, number>): DisplayRow {
  const sorted = [...group].sort((a, b) => lotTargetOrder(lotTarget(a, contests.get(a.contestId))).localeCompare(lotTargetOrder(lotTarget(b, contests.get(b.contestId)))));
  const qualified = sorted.find((result) => result.qualification);
  const primary = qualified ?? sorted[0];
  const context = group.length > 1 ? { label: `${primary.circuit} Lot`, key: `${primary.circuit}-lot` } : contestContext(primary, contests.get(primary.contestId));
  const outcome = resultOutcome({ ...primary, qualification: qualified?.qualification || primary.qualification });
  return {
    id: sorted.map((result) => result.id).join('-'),
    primary,
    context,
    placeLabel: group.length > 1 ? lotDetails(sorted, contests, (result) => placeLabel(result, placementOverrides)) : placeLabel(primary, placementOverrides),
    scoreLabel: group.length > 1 ? lotDetails(sorted, contests, scoreWithMax) : scoreWithMax(primary),
    placeDetails: group.length > 1 ? lotDetailItems(sorted, contests, (result) => placeLabel(result, placementOverrides)) : [],
    scoreDetails: group.length > 1 ? lotDetailItems(sorted, contests, scoreWithMax) : [],
    outcome,
    sourceIds: unique(sorted.map((result) => result.sourceId).filter(Boolean))
  };
}

function placeLabel(result: Result, placementOverrides?: Map<string, number>): string {
  const place = placementOverrides?.get(result.id) ?? result.place;
  return place ? `#${place}` : '-';
}

function isMergedROAILotResult(result: Result): boolean {
  return result.circuit === 'ROAI' && result.stage === 'lot';
}

function lotDetails(results: Result[], contests: Map<string, Contest>, value: (result: Result) => string): string {
  return results
    .map((result) => `${lotTarget(result, contests.get(result.contestId))} ${value(result)}`)
    .join(' · ');
}

function lotDetailItems(results: Result[], contests: Map<string, Contest>, value: (result: Result) => string): LotDetail[] {
  return results.map((result) => ({
    target: lotTarget(result, contests.get(result.contestId)),
    value: value(result)
  }));
}

function lotTarget(result: Result, contest?: Contest): string {
  const section = contest?.section || result.section || result.qualification || '';
  const match = section.toUpperCase().match(/IOAI|IAIO|CEOAI/);
  if (match) return match[0];
  const contestMatch = result.contestId.toUpperCase().match(/IOAI|IAIO|CEOAI/);
  return contestMatch?.[0] ?? result.circuit;
}

function lotTargetOrder(target: string): string {
  const order: Record<string, string> = { IOAI: '0', IAIO: '1', CEOAI: '2' };
  return order[target] ?? `9-${target}`;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function contestContext(result: Result, contest?: Contest): ContestContext {
  const circuit = result.circuit || contest?.circuit || result.contestId.toUpperCase();
  if (result.stage === 'lot') {
    return { label: `${circuit} Lot`, key: `${circuit}-lot` };
  }
  if (result.stage === 'international') {
    const section = internationalSectionLabel(result.section);
    return { label: section ? `${circuit} ${section}` : circuit, key: `${circuit}-${section || 'main'}` };
  }

  const section = contest?.section || result.section || '';
  const sectionKey = section.toLowerCase();
  if (section === 'IX-X' || section === 'XI-XII') {
    const note = result.grade ? `${ordinal(result.grade)} grade` : undefined;
    return { label: `${circuit} ${section}`, note, key: `${circuit}-${section}-${note || ''}` };
  }
  if (sectionKey.startsWith('clasa') || result.grade) {
    return { label: `${circuit} ${romanGrade(result.grade) || section.replace(/^clasa\s+/i, '')}`, key: `${circuit}-${result.grade || section}` };
  }
  return { label: circuit, key: circuit };
}

function romanGrade(grade?: string): string {
  switch (grade) {
    case '9':
      return 'IX';
    case '10':
      return 'X';
    case '11':
      return 'XI';
    case '12':
      return 'XII';
    default:
      return '';
  }
}

function ordinal(value: string): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  const lastTwo = number % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13
    ? 'th'
    : number % 10 === 1
      ? 'st'
      : number % 10 === 2
        ? 'nd'
        : number % 10 === 3
          ? 'rd'
          : 'th';
  return `${number}${suffix}`;
}

function internationalSectionLabel(section?: string): string | undefined {
  if (section === 'theory') return 'Teoretică';
  if (section === 'practical') return 'Practică';
  return undefined;
}
