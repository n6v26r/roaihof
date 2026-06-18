import { Database } from 'lucide-react';
import type { Indexes } from '../app/indexes';
import type { ContestFamily } from '../app/routes';
import { SectionHeader } from '../components/layout/SectionHeader';
import {
  scoreboardOrder,
  scoreboardSubtitle,
  yearLabel
} from '../features/scoreboards/scoreboards';
import { AppLink } from '../lib/router';

export function ContestFamilyPage({ family, indexes }: { family: ContestFamily; indexes: Indexes }) {
  const scoreboards = Array.from(indexes.scoreboards.values())
    .filter((scoreboard) => scoreboard.family === family)
    .sort((a, b) => b.year - a.year || scoreboardOrder(a) - scoreboardOrder(b) || a.title.localeCompare(b.title));
  const years = Array.from(new Set(scoreboards.map((scoreboard) => scoreboard.year))).sort((a, b) => b - a);
  const future = family === 'CEOAI' && scoreboards.length === 0;

  return (
    <div className="page-stack">
      <section className="terminal-panel route-heading">
        <div>
          <p className="eyebrow">Contest</p>
          <h1>{family}</h1>
          <p className="muted-line">{future ? 'Future editions will be added here.' : yearLabel(years)}</p>
        </div>
      </section>
      {future ? (
        <section className="terminal-panel">
          <div className="empty-state">No CEOAI scoreboard has been imported yet.</div>
        </section>
      ) : (
        years.map((year) => {
          const editionScoreboards = scoreboards.filter((scoreboard) => scoreboard.year === year);
          return (
            <section className="terminal-panel" key={year}>
              <SectionHeader icon={Database} title={`${family} ${year}`} />
              <div className="scoreboard-grid">
                {editionScoreboards.map((scoreboard) => {
                  const subtitle = scoreboardSubtitle(scoreboard);
                  return (
                    <AppLink href={`/scoreboards/${scoreboard.id}`} className="scoreboard-card" key={scoreboard.id}>
                      <span>
                        <strong>{scoreboard.title}</strong>
                        {subtitle ? <small>{subtitle}</small> : null}
                      </span>
                      <code>{scoreboard.results.length}</code>
                    </AppLink>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
