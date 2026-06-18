import { CheckCircle2, CircleAlert } from 'lucide-react';
import type { SourceStatus } from '../lib/types';

interface SourceCoverageProps {
  statuses: SourceStatus[];
  compact?: boolean;
}

export function SourceCoverage({ statuses, compact = false }: SourceCoverageProps) {
  const visible = compact ? statuses.slice(0, 4) : statuses;
  return (
    <div className="source-grid">
      {visible.map((source) => (
        <article className={`source-item source-${source.status}`} key={source.id}>
          <div className="source-status-icon">
            {source.status === 'ok' ? <CheckCircle2 size={17} aria-hidden="true" /> : <CircleAlert size={17} aria-hidden="true" />}
          </div>
          <div>
            <h3>{source.title}</h3>
            <p>{source.detail}</p>
            {source.url ? (
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.url.replace(/^https?:\/\//, '')}
              </a>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
