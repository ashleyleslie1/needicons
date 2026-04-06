export function AboutSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">About</h1>
        <p className="text-sm text-muted-foreground">
          Information about this application.
        </p>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex gap-4">
          <span className="text-muted-foreground w-20 shrink-0">Version</span>
          <span className="font-mono">0.1.0</span>
        </div>
        <div className="flex gap-4">
          <span className="text-muted-foreground w-20 shrink-0">License</span>
          <span>AGPL-3.0</span>
        </div>
        <div className="flex gap-4">
          <span className="text-muted-foreground w-20 shrink-0">GitHub</span>
          <a
            href="https://github.com/needicons/needicons"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            needicons/needicons
          </a>
        </div>
      </div>
    </div>
  );
}
