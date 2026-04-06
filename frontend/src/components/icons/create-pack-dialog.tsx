import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreatePack } from "@/hooks/api/use-packs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CreatePackDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [stylePrompt, setStylePrompt] = useState("");
  const navigate = useNavigate();
  const createPack = useCreatePack();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setName("");
      setStylePrompt("");
    }
  }

  async function handleCreate() {
    const pack = await createPack.mutateAsync({ name, style_prompt: stylePrompt });
    setOpen(false);
    setName("");
    setStylePrompt("");
    navigate(`/packs/${pack.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="w-full">
          + New Pack
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Icon Pack</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="pack-name">
              Pack Name
            </label>
            <Input
              id="pack-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Camping App Icons"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="style-prompt">
              Style Prompt
            </label>
            <Input
              id="style-prompt"
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              placeholder="e.g. flat minimalist, thin outlines, pastel colors"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleCreate}
            disabled={!name.trim() || createPack.isPending}
          >
            Create Pack
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
