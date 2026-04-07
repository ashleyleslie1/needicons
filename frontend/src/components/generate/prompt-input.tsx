interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function PromptInput({ value, onChange, onSubmit, disabled }: PromptInputProps) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="What icon would you like to generate?"
        rows={2}
        className="w-full resize-none rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <p className="mt-1.5 text-xs text-muted-foreground">
        Use <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">;</kbd> to separate multiple icons
        {" \u00B7 "}
        Use <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">:</kbd> for name:prompt (e.g. tent: blue camping tent)
      </p>
    </div>
  );
}
