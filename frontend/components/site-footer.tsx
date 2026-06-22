import Link from "next/link";
import { FOOTER_COLUMNS, SITE } from "@/lib/content";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <span className="font-display text-sm font-bold tracking-[0.32em]">
            {SITE.wordmark}
          </span>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            An on-chain agent battle arena on Arc. Open to every wallet, one
            transaction to play, native USDC, runs forever.
          </p>
        </div>

        {FOOTER_COLUMNS.map((column) => (
          <div key={column.heading}>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-faint">
              {column.heading}
            </p>
            <ul className="mt-5 space-y-3">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-faint sm:flex-row">
          <span>
            {SITE.project} · built on {SITE.network}
          </span>
          <span className="font-mono">© 2026 {SITE.wordmark}</span>
        </div>
      </div>
    </footer>
  );
}
