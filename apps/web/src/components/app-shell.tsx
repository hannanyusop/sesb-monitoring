import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";

export function AppShell({ children }: PropsWithChildren) {
  return <>
    <header className="topbar">
      <Link className="brand" to="/" aria-label="Current dashboard">
        <span className="brand-mark" aria-hidden="true">↯</span>
        <span><strong>Current</strong><small>Electric usage monitor</small></span>
      </Link>
    </header>
    <main className="page">{children}</main>
  </>;
}
