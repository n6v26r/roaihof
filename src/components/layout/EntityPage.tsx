import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { StatGrid } from '../StatGrid';
import { AppLink } from '../../lib/router';
import type { Stats } from '../../lib/types';

export type UsernameMetaItem = {
  label: string;
  platform: 'judge' | 'mlcompete';
  usernames: string[];
  hrefs?: string[];
};

export function EntityPage({
  eyebrow,
  title,
  stats,
  statsVariant,
  usernameMeta,
  meta,
  extras,
  children
}: {
  eyebrow: string;
  title: string;
  stats: Stats;
  statsVariant?: 'entity' | 'national' | 'lot' | 'international';
  usernameMeta?: UsernameMetaItem[];
  meta?: Array<{ label: string; href?: string; external?: boolean }>;
  extras?: Array<{ label: string; value: string | number }>;
  children: ReactNode;
}) {
  return (
    <div className="page-stack">
      <section className="terminal-panel entity-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {usernameMeta?.length ? (
            <div className="username-pill-row">
              {usernameMeta.map((item) => (
                <span className={`username-pill ${item.platform}`} key={`${item.platform}-${item.usernames.join('|')}`}>
                  <span className="username-pill-label">{item.label}:</span>
                  {item.usernames.map((username, index) => {
                    const href = item.hrefs?.[index];
                    return (
                      <span className="username-pill-value" key={username}>
                        {index > 0 ? ', ' : null}
                        {href ? (
                          <a href={href} target="_blank" rel="noreferrer">
                            @{username}
                          </a>
                        ) : (
                          `@${username}`
                        )}
                      </span>
                    );
                  })}
                </span>
              ))}
            </div>
          ) : null}
          {meta?.length ? (
            <div className="pill-row">
              {meta.map((item) =>
                item.href ? (
                  item.external ? (
                    <a href={item.href} target="_blank" rel="noreferrer" className="meta-pill" key={`${item.label}-${item.href}`}>
                      {item.label}
                      <ArrowUpRight size={13} />
                    </a>
                  ) : (
                    <AppLink href={item.href} className="meta-pill" key={`${item.label}-${item.href}`}>
                      {item.label}
                    </AppLink>
                  )
                ) : (
                  <span className="meta-pill" key={item.label}>{item.label}</span>
                )
              )}
            </div>
          ) : null}
        </div>
        <StatGrid stats={stats} variant={statsVariant} extras={extras} />
      </section>
      <section className="terminal-panel">{children}</section>
    </div>
  );
}
