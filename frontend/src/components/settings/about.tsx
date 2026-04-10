export function AboutSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">About</h1>
        <p className="text-sm text-muted-foreground">
          NeedIcons — AI-powered icon pack generator.
        </p>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex gap-4">
          <span className="text-muted-foreground w-20 shrink-0">Version</span>
          <span className="font-mono">{__APP_VERSION__}</span>
        </div>
        <div className="flex gap-4">
          <span className="text-muted-foreground w-20 shrink-0">License</span>
          <span>AGPL-3.0</span>
        </div>
        <div className="flex gap-4">
          <span className="text-muted-foreground w-20 shrink-0">GitHub</span>
          <a
            href="https://github.com/ashleyleslie1/needicons"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            ashleyleslie1/needicons
          </a>
        </div>
      </div>
    </div>
  );
}

declare const __APP_VERSION__: string;
