import { useState } from "react";
import { useAddRequirements } from "@/hooks/api/use-requirements";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AddRequirementProps {
  packId: string;
}

export function AddRequirement({ packId }: AddRequirementProps) {
  const [open, setOpen] = useState(false);
  const [namesInput, setNamesInput] = useState("");
  const addRequirements = useAddRequirements();

  const parsedNames = namesInput
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  async function handleAdd() {
    if (parsedNames.length === 0) return;
    await addRequirements.mutateAsync({
      packId,
      requirements: parsedNames.map((name) => ({ name })),
    });
    setOpen(false);
    setNamesInput("");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setNamesInput("");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          + Add Icons
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Icons</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="icon-names">
              Icon names
            </label>
            <p className="text-xs text-muted-foreground">
              Separate names with commas or newlines
            </p>
            <textarea
              id="icon-names"
              value={namesInput}
              onChange={(e) => setNamesInput(e.target.value)}
              placeholder="tent, backpack, compass&#10;campfire&#10;sleeping bag"
              rows={5}
              className="flex w-full rounded-md border border-border bg-input px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent resize-none"
            />
          </div>
          {parsedNames.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Adding{" "}
              <span className="font-semibold text-accent">
                {parsedNames.length}
              </span>{" "}
              icon{parsedNames.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleAdd}
            disabled={parsedNames.length === 0 || addRequirements.isPending}
          >
            {addRequirements.isPending ? "Adding…" : `Add ${parsedNames.length > 0 ? parsedNames.length : ""} Icon${parsedNames.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
