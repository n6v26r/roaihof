import { useEffect, useMemo } from 'react';
import { dataset } from './app/data';
import { buildIndexes } from './app/indexes';
import { parseRoute } from './app/routes';
import { Header } from './components/layout/Header';
import { usePathname } from './lib/router';
import { ContestFamilyPage } from './pages/ContestFamilyPage';
import { DashboardPage } from './pages/DashboardPage';
import { CountyPage, PersonPage, SchoolPage } from './pages/EntityPages';
import { NotFoundPage } from './pages/NotFoundPage';
import { RankingPage } from './pages/RankingPage';
import { ScoreboardPage } from './pages/ScoreboardPage';
import { SourcesPage } from './pages/SourcesPage';
import { applySeoMetadata, seoForRoute } from './lib/seo';

const themeStorageKey = 'roaihof-theme';
type Theme = 'dark' | 'light';

export function App({ initialPath }: { initialPath?: string }) {
  const pathname = usePathname(initialPath);
  const indexes = useMemo(() => buildIndexes(dataset), []);
  const route = useMemo(() => parseRoute(pathname), [pathname]);
  const seo = useMemo(() => seoForRoute(route, indexes, dataset, pathname), [indexes, pathname, route]);

  useEffect(() => {
    applySeoMetadata(seo);
  }, [seo]);

  return (
    <div className="app-shell">
      <Header pathname={pathname} onToggleTheme={toggleTheme} />
      <main className="page-main">
        {route.name === 'home' ? <DashboardPage indexes={indexes} /> : null}
        {route.name === 'rankings' ? <RankingPage kind={route.kind} /> : null}
        {route.name === 'person' ? <PersonPage person={indexes.people.get(route.id)} indexes={indexes} /> : null}
        {route.name === 'school' ? <SchoolPage school={indexes.schools.get(route.id)} indexes={indexes} /> : null}
        {route.name === 'county' ? <CountyPage county={indexes.counties.get(route.id)} indexes={indexes} /> : null}
        {route.name === 'contest-family' ? <ContestFamilyPage family={route.family} indexes={indexes} /> : null}
        {route.name === 'scoreboard' ? <ScoreboardPage scoreboard={indexes.scoreboards.get(route.id)} indexes={indexes} /> : null}
        {route.name === 'sources' ? <SourcesPage /> : null}
        {route.name === 'not-found' ? <NotFoundPage /> : null}
      </main>
    </div>
  );
}

function toggleTheme() {
  if (typeof window === 'undefined') return;

  const current = currentTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;

  try {
    window.localStorage.setItem(themeStorageKey, next);
  } catch {
    // Ignore storage failures; the in-page theme switch still applies.
  }
}

function currentTheme(): Theme {
  const explicitTheme = document.documentElement.dataset.theme;
  if (explicitTheme === 'dark' || explicitTheme === 'light') return explicitTheme;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
