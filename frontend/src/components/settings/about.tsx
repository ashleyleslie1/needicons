import { ExternalLink } from "lucide-react";

export function AboutSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">About</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-powered icon pack generator.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white shadow-lg shadow-accent/20">
            N
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">NeedIcons</h2>
            <span className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-mono bg-surface text-muted-foreground px-2 py-0.5 rounded-md">
              v{__APP_VERSION__}
            </span>
          </div>
        </div>

        <div className="mt-5 space-y-3 text-sm">
          <div className="flex items-center justify-between py-2 border-t border-border">
            <span className="text-muted-foreground">License</span>
            <span className="text-foreground font-medium">AGPL-3.0</span>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-border">
            <span className="text-muted-foreground">Source</span>
            <a
              href="https://github.com/ashleyleslie1/needicons"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-accent hover:underline font-medium"
            >
              GitHub
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

declare const __APP_VERSION__: string;
