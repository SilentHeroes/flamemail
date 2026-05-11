import { Inbox, Info, Mail, Plus, Shield } from "lucide-react";
import { Link, NavLink } from "react-router-dom";

interface HeaderProps {
  sessionCount?: number;
}

export function Header({ sessionCount = 0 }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-900">
            <Mail className="h-4 w-4 text-zinc-100" />
          </div>
          <span className="hidden sm:block">
            <strong className="block text-sm font-semibold text-zinc-100">flamemail</strong>
            <small className="block text-[11px] text-zinc-500">disposable inboxes &amp; secure relay</small>
          </span>
        </Link>

        <nav className="flex items-center gap-1" aria-label="Primary">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`
            }
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Create</span>
          </NavLink>
          {sessionCount > 0 ? (
            <span className="flex items-center gap-1 px-2 py-1.5 text-sm text-zinc-500">
              <Inbox className="h-3.5 w-3.5" />
              <span className="text-xs tabular-nums">{sessionCount}</span>
            </span>
          ) : null}
          <NavLink
            to="/about"
            className={({ isActive }) =>
              `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`
            }
          >
            <Info className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">About</span>
          </NavLink>
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`
            }
          >
            <Shield className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Admin</span>
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
