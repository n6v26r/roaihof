import type { Indexes } from '../app/indexes';
import { ResultsTable } from '../components/ResultsTable';
import { EntityPage } from '../components/layout/EntityPage';
import {
  placementOverridesForScoreboard,
  scoreboardDetailTag,
  scoreboardLocation,
  scoreboardOfficialLinks,
  statsForResults,
  statsVariantForStage,
  type Scoreboard
} from '../features/scoreboards/scoreboards';
import { stageLabel } from '../lib/format';
import { NotFoundPage } from './NotFoundPage';

export function ScoreboardPage({ scoreboard, indexes }: { scoreboard?: Scoreboard; indexes: Indexes }) {
  if (!scoreboard) return <NotFoundPage />;
  const stats = statsForResults(scoreboard.results);
  const placementOverrides = placementOverridesForScoreboard(scoreboard, indexes.placementOverrides);
  const location = scoreboardLocation(scoreboard);
  const detailTag = scoreboardDetailTag(scoreboard);
  const officialLinks = scoreboardOfficialLinks(scoreboard);

  return (
    <EntityPage
      eyebrow={`${scoreboard.family} · ${stageLabel(scoreboard.stage)}`}
      title={`${scoreboard.family} ${scoreboard.year} · ${scoreboard.title}`}
      stats={stats}
      statsVariant={statsVariantForStage(scoreboard.stage)}
      meta={[
        { label: String(scoreboard.year), href: `/contests/${scoreboard.family.toLowerCase()}` },
        ...(location ? [{ label: location }] : []),
        ...(detailTag ? [{ label: detailTag }] : []),
        ...officialLinks
      ]}
    >
      <ResultsTable
        results={scoreboard.results}
        contests={indexes.contests}
        sources={indexes.sources}
        placementOverrides={placementOverrides}
        hideSource={scoreboard.family === 'ROAI' && scoreboard.stage === 'lot'}
      />
    </EntityPage>
  );
}
