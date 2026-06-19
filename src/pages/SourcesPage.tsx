import { ArrowUpRight, ChevronRight, Database, ListTodo } from 'lucide-react';
import { dataset } from '../app/data';
import { SourceCoverage } from '../components/SourceCoverage';
import { SectionHeader } from '../components/layout/SectionHeader';
import { formatRomanianDateTime } from '../lib/format';
import type { Source, SourceTodo } from '../lib/types';

interface ProvenanceUrlGroup {
  url: string;
  sources: Source[];
}

interface ProvenanceBundle {
  title: string;
  sources: Source[];
  urlGroups: ProvenanceUrlGroup[];
}

interface ProvenanceGroup {
  key: string;
  title: string;
  sources: Source[];
  bundles: ProvenanceBundle[];
}

const provenanceGroupTitles: Record<string, string> = {
  'onia-official': 'ONIA 2026 official',
  'onia-mlcompete': 'ONIA 2026 mlcompete',
  'roai-2026': 'ROAI 2026',
  'roai-2025': 'ROAI 2025',
  international: 'International results',
  other: 'Other sources'
};

const provenanceGroupOrder = [
  'onia-official',
  'onia-mlcompete',
  'roai-2026',
  'roai-2025',
  'international',
  'other'
];

function sourceTodoStatusLabel(status: SourceTodo['status']) {
  if (status === 'partial') {
    return 'Partial';
  }
  if (status === 'missing') {
    return 'Missing';
  }
  if (status === 'validate') {
    return 'VALIDATE';
  }
  return status;
}

function sourceStatusLabel(status: string) {
  switch (status) {
    case 'ok':
      return 'ok';
    case 'partial':
      return 'partial';
    case 'text-pdf':
      return 'text PDF';
    case 'ocr-transcription':
      return 'OCR';
    case 'archived-html':
      return 'archived HTML';
    default:
      return status;
  }
}

function sourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0];
  }
}

function compactSourceUrl(url: string) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function provenanceGroupKey(source: Source) {
  if (source.id === 'onia-hall-of-fame' || source.id.startsWith('ioai-') || source.id.startsWith('iaio-')) {
    return 'international';
  }
  if (/mlcompete-(23|24)-final/.test(source.id)) {
    return 'onia-official';
  }
  if (source.id.startsWith('mlcompete-') || source.url.includes('platform.olimpiada-ai.ro')) {
    return 'onia-mlcompete';
  }
  if (source.id.startsWith('onia-')) {
    return 'onia-official';
  }
  if (source.id.startsWith('roai-2026-')) {
    return 'roai-2026';
  }
  if (source.id.startsWith('roai-2025-')) {
    return 'roai-2025';
  }
  return 'other';
}

function provenanceBundleTitle(source: Source) {
  const id = source.id;
  if (id.startsWith('mlcompete-')) {
    if (id.includes('profile')) {
      return 'Profile pages';
    }
    if (/mlcompete-(11|12|14|15)-final/.test(id)) {
      return 'Local and county leaderboards';
    }
    if (/mlcompete-(17|18)-final/.test(id)) {
      return 'National final leaderboards';
    }
    if (/mlcompete-(23|24)-final/.test(id)) {
      return 'Lot leaderboards';
    }
    return 'Leaderboards';
  }
  if (id === 'onia-2026-national-participants-sheet') {
    return 'Participant data';
  }
  if (id.startsWith('onia-') && id.endsWith('-2026')) {
    return 'Official JSON feeds';
  }
  if (id === 'roai-2026-page' || id === 'roai-2025-lot-page' || id === 'roai-2026-lot-page') {
    return 'Task/results pages';
  }
  if (id.startsWith('roai-2026-national') || id === 'roai-2025-national-judge' || (id.includes('county') && id.includes('judge'))) {
    return 'Nitro judge leaderboards';
  }
  if (id.includes('lot')) {
    return 'Lot sources';
  }
  if (id.includes('qualified')) {
    return 'Qualified lists';
  }
  if (id.includes('anonymized')) {
    return 'Anonymized national final';
  }
  if (id.includes('final-clasa')) {
    return 'Class final ranking PDFs';
  }
  if (id.includes('final-') || id.includes('-pdf')) {
    return 'Ranking PDFs';
  }
  if (id === 'onia-hall-of-fame') {
    return 'Hall of Fame';
  }
  if (id.startsWith('ioai-') || id.startsWith('iaio-')) {
    return 'Official result pages';
  }
  return 'Source files';
}

function latestAccessedAt(sources: Source[]) {
  const dates = sources.map((source) => source.accessedAt).filter(Boolean).sort();
  return dates.length > 0 ? dates[dates.length - 1] : '';
}

function statusSummary(sources: Source[]) {
  const counts = new Map<string, number>();
  for (const source of sources) {
    const label = sourceStatusLabel(source.status);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([status, count]) => `${count} ${status}`).join(' · ');
}

function domainSummary(sources: Source[]) {
  const domains = Array.from(new Set(sources.map((source) => sourceHost(source.url))));
  if (domains.length <= 2) {
    return domains.join(' · ');
  }
  return `${domains.slice(0, 2).join(' · ')} · +${domains.length - 2}`;
}

function groupByUrl(sources: Source[]) {
  const groups = new Map<string, Source[]>();
  for (const source of sources) {
    const key = source.url;
    const urlSources = groups.get(key) ?? [];
    urlSources.push(source);
    groups.set(key, urlSources);
  }
  return Array.from(groups.entries()).map(([url, urlSources]) => ({ url, sources: urlSources }));
}

function provenanceUrlTitle(bundle: ProvenanceBundle, urlGroup: ProvenanceUrlGroup) {
  if (bundle.title === 'Lot leaderboards') {
    if (urlGroup.url.includes('/competitions/23')) {
      return 'Lot final leaderboard 1';
    }
    if (urlGroup.url.includes('/competitions/24')) {
      return 'Lot final leaderboard 2';
    }
  }
  return urlGroup.sources[0].title;
}

function groupProvenance(sources: Source[]): ProvenanceGroup[] {
  const grouped = new Map<string, Source[]>();
  for (const source of sources) {
    const key = provenanceGroupKey(source);
    const groupSources = grouped.get(key) ?? [];
    groupSources.push(source);
    grouped.set(key, groupSources);
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => provenanceGroupOrder.indexOf(left) - provenanceGroupOrder.indexOf(right))
    .map(([key, groupSources]) => {
      const bundlesByTitle = new Map<string, Source[]>();
      for (const source of groupSources) {
        const title = provenanceBundleTitle(source);
        const bundleSources = bundlesByTitle.get(title) ?? [];
        bundleSources.push(source);
        bundlesByTitle.set(title, bundleSources);
      }
      const bundles = Array.from(bundlesByTitle.entries()).map(([title, bundleSources]) => ({
        title,
        sources: bundleSources,
        urlGroups: groupByUrl(bundleSources)
      }));
      return {
        key,
        title: provenanceGroupTitles[key] ?? key,
        sources: groupSources,
        bundles
      };
    });
}

const provenanceGroups = groupProvenance(dataset.provenance);

export function SourcesPage() {
  return (
    <div className="page-stack">
      <section className="terminal-panel route-heading">
        <div>
          <p className="eyebrow">Coverage</p>
          <h1>Sources</h1>
          <p className="muted-line">Generated {formatRomanianDateTime(dataset.generatedAt)}</p>
          <p className="muted-line">
            Most data is fetched using ai. If you find any inaccuracies/completions to be made pls contact me: {' '}
            <a href="https://razv.xyz" target="_blank" rel="noreferrer" className="inline-link">@razv</a>
          </p>
        </div>
      </section>
      <section className="terminal-panel">
        <SourceCoverage statuses={dataset.sourceStatuses} />
      </section>
      {dataset.sourceTodos.length > 0 ? (
        <section className="terminal-panel">
          <SectionHeader icon={ListTodo} title="Source todo" meta={`${dataset.sourceTodos.length} items`} />
          <div className="source-todo-list">
            {dataset.sourceTodos.map((todo) => (
              <article className="source-todo-row" key={todo.id}>
                <span className={`source-todo-status source-todo-${todo.status}`}>
                  {sourceTodoStatusLabel(todo.status)}
                </span>
                <div>
                  <h3>{todo.title}</h3>
                  <p>{todo.detail}</p>
                  {todo.url ? (
                    <a href={todo.url} target="_blank" rel="noreferrer">
                      {todo.url.replace(/^https?:\/\//, '')}
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <section className="terminal-panel">
        <SectionHeader icon={Database} title="Provenance" meta={`${dataset.provenance.length} sources`} />
        <div className="provenance-list">
          {provenanceGroups.map((group) => (
            <details className="provenance-group" key={group.key}>
              <summary className="provenance-group-summary">
                <ChevronRight size={16} className="provenance-group-chevron" aria-hidden="true" />
                <span className="provenance-group-title">
                  <strong>{group.title}</strong>
                  <small>
                    {statusSummary(group.sources)} · latest {latestAccessedAt(group.sources)} · {domainSummary(group.sources)}
                  </small>
                </span>
                <span className="provenance-group-count">{group.sources.length} sources</span>
              </summary>
              <div className="provenance-bundle-list">
                {group.bundles.map((bundle) => (
                  <article className="provenance-bundle" key={bundle.title}>
                    <div className="provenance-bundle-heading">
                      <h3>{bundle.title}</h3>
                      <span>{bundle.sources.length} sources · {bundle.urlGroups.length} links</span>
                    </div>
                    <div className="provenance-url-list">
                      {bundle.urlGroups.map((urlGroup) => {
                        return (
                          <a href={urlGroup.url} target="_blank" rel="noreferrer" className="provenance-row" key={urlGroup.sources.map((source) => source.id).join('|')}>
                            <span>
                              <strong>{provenanceUrlTitle(bundle, urlGroup)}</strong>
                              <small>
                                {compactSourceUrl(urlGroup.url)} · {statusSummary(urlGroup.sources)} · latest {latestAccessedAt(urlGroup.sources)}
                              </small>
                              <span className="provenance-id-list">
                                {urlGroup.sources.map((source) => (
                                  <code key={source.id}>{source.id}</code>
                                ))}
                              </span>
                            </span>
                            <ArrowUpRight size={16} aria-hidden="true" />
                          </a>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
