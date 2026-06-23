import { describe, expect, it } from 'vitest';
import { dataset } from '../../app/data';
import { buildEffectivePlaceOverrides } from '../../lib/placements';
import {
  buildScoreboards,
  placementOverridesForScoreboard,
  scoreboardDetailTag,
  scoreboardOfficialLinks,
  scoreboardOrder
} from './scoreboards';

describe('scoreboards', () => {
  const scoreboards = new Map(buildScoreboards(dataset).map((scoreboard) => [scoreboard.id, scoreboard]));

  it('uses class placement overrides for ROAI 2025 class scoreboards', () => {
    const scoreboard = scoreboards.get('roai-2025-clasa-9');
    const ilieResult = dataset.results.find((result) => result.contestId === 'roai-2025-national-clasa-9' && result.personId === 'ilie-goga-radu');
    const overrides = buildEffectivePlaceOverrides(dataset.results);

    expect(scoreboard).toBeDefined();
    expect(ilieResult?.place).toBe(24);
    expect(ilieResult).toBeDefined();
    expect(overrides.get(ilieResult!.id)).toBe(1);
    expect(placementOverridesForScoreboard(scoreboard!, overrides)?.get(ilieResult!.id)).toBe(1);
  });

  it('does not repeat class titles as scoreboard detail tags', () => {
    expect(scoreboardDetailTag(scoreboards.get('roai-2025-clasa-9')!)).toBeUndefined();
  });

  it('builds an ONIA grade 8 guest scoreboard', () => {
    const scoreboard = scoreboards.get('onia-2026-clasa-8');

    expect(scoreboard).toBeDefined();
    expect(scoreboard?.results).toHaveLength(5);
    expect(scoreboard?.results.every((result) => result.status === 'guest')).toBe(true);
    expect(scoreboard?.results.map((result) => result.score)).toEqual([112.64, 109.3, 88.3, 35.84, 18.18]);
    expect(scoreboardOrder(scoreboard!)).toBeGreaterThan(scoreboardOrder(scoreboards.get('onia-2026-clasa-12')!));
  });

  it('builds ROAI 2026 Baraj as a display-only scoreboard before Lot', () => {
    const scoreboard = scoreboards.get('roai-2026-baraj');

    expect(scoreboard).toBeDefined();
    expect(scoreboard?.stage).toBe('baraj');
    expect(scoreboard?.results).toHaveLength(60);
    expect(scoreboard?.results.filter((result) => result.qualification === 'Lot')).toHaveLength(25);
    expect(scoreboardOrder(scoreboard!)).toBeLessThan(scoreboardOrder(scoreboards.get('roai-2026-lot')!));
  });

  it('keeps ONIA grade 8 guests in score order on IX-X', () => {
    const scoreboard = scoreboards.get('onia-2026-ix-x');
    const guestRows = scoreboard?.results.filter((result) => result.status === 'guest') ?? [];

    expect(guestRows).toHaveLength(5);
    expect(guestRows.map((result) => result.personId)).toEqual([
      'boac-mihai-cosmin',
      'boca-petru',
      'calin-tudor-ioan',
      'chelaru-ioan-cristian',
      'predesel-mathias-alexandru'
    ]);
  });

  it('keeps special official source links', () => {
    expect(scoreboardOfficialLinks(scoreboards.get('onia-2026-lot')!)).toEqual([
      {
        label: 'round 1 final',
        href: 'https://platform.olimpiada-ai.ro/ro/competitions/23?tab=final',
        external: true
      },
      {
        label: 'round 2 final',
        href: 'https://platform.olimpiada-ai.ro/ro/competitions/24?tab=final',
        external: true
      }
    ]);
    expect(scoreboardOfficialLinks(scoreboards.get('roai-2025-national-ranking')!)).toEqual([{
      label: 'official source',
      href: 'https://judge.nitro-ai.org/competitions/roai-2025/onia/leaderboard/complete?page=1&page_size=200',
      external: true
    }]);
    expect(scoreboardOfficialLinks(scoreboards.get('roai-2026-lot')!)).toEqual([{
      label: 'official sources',
      href: 'https://olimpiada.nitro-ai.org/ro/2026/lot?section=tasks',
      external: true
    }]);
    expect(scoreboardOfficialLinks(scoreboards.get('roai-2026-baraj')!)).toEqual([{
      label: 'official source',
      href: 'https://judge.nitro-ai.org/competitions/roai-2025/baraj-nationala-2026/leaderboard/complete?participant_name=razv&page=1&page_size=100',
      external: true
    }]);
  });
});
