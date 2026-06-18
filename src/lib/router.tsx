import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent, type PropsWithChildren } from 'react';

export function usePathname(): string {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  return path;
}

export function navigateTo(href: string) {
  if (href === window.location.pathname) return;
  window.history.pushState({}, '', href);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0 });
}

export function AppLink({
  href,
  children,
  className,
  ...props
}: PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>) {
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    if (href.startsWith('http')) return;
    event.preventDefault();
    navigateTo(href);
  }

  return (
    <a href={href} className={className} onClick={onClick} {...props}>
      {children}
    </a>
  );
}
