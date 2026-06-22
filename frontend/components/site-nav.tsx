"use client";

import Link from "next/link";
import { NAV_LINKS, SITE } from "@/lib/content";
import { useWeb3Wallet } from "@/lib/web3";

export function SiteNav() {
  const { isConnected, address, connect, loading, balance } = useWeb3Wallet();

  const shortAddress = address ? address.slice(0, 6) + "…" + address.slice(-4) : "";

  return (
    <header className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <nav className="glass-panel flex items-center gap-1 rounded-full p-1.5 pl-5 backdrop-blur-xl">
        <Link
          href="/"
          className="font-display text-sm font-bold tracking-[0.28em] text-foreground transition-colors hover:text-accent"
        >
          {SITE.wordmark}
        </Link>

        <span className="mx-3 hidden h-5 w-px bg-white/10 sm:block" />

        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="rounded-full px-3.5 py-2 text-sm text-muted transition-colors hover:bg-white/[0.04] hover:text-foreground"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {isConnected ? (
          <div className="ml-2 flex items-center gap-2 rounded-full border border-accent/20 bg-accent/[0.05] px-4 py-2 font-mono text-xs">
            <span className="text-accent">{balance} USDC</span>
            <span className="h-3 w-px bg-white/10" />
            <span className="text-foreground">{shortAddress}</span>
          </div>
        ) : (
          <button
            onClick={connect}
            disabled={loading}
            className="ml-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-accent-strong disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </nav>
    </header>
  );
}
