import { ArrowUpRight, Database, ListTodo } from 'lucide-react';
import { dataset } from '../app/data';
import { SourceCoverage } from '../components/SourceCoverage';
import { SectionHeader } from '../components/layout/SectionHeader';
import { formatRomanianDateTime } from '../lib/format';
import type { SourceTodo } from '../lib/types';

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
          {dataset.provenance.map((source) => (
            <a href={source.url} target="_blank" rel="noreferrer" className="provenance-row" key={source.id}>
              <span>
                <strong>{source.title}</strong>
                <small>{source.accessedAt} · {source.status}</small>
              </span>
              <ArrowUpRight size={16} />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
