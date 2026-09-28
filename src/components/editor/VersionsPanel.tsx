import { useState } from "react";
import { History, RotateCcw, Trash2 } from "lucide-react";
import { Section } from "./controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEditor } from "./editorContext";
import {
  purgeTrash,
  restoreTrash,
  restoreVersion,
  saveVersion,
  trashFor,
  useDoc,
} from "@/lib/portfolia/store";

export function VersionsPanel() {
  const { portfolio, notify } = useEditor();
  const doc = useDoc();
  const [name, setName] = useState("");
  const trash = trashFor(doc, portfolio.id);

  return (
    <>
      <Section
        title="Saved versions"
        hint="A snapshot keeps a copy of your whole portfolio as it is now. Restoring one replaces the current draft and can itself be undone."
      >
        <div className="flex gap-2">
          <Input
            value={name}
            placeholder="Version name"
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-sm"
          />
          <Button
            size="xs"
            variant="line"
            onClick={() => {
              saveVersion(portfolio.id, name.trim() || new Date().toLocaleString());
              setName("");
              notify("Version saved.");
            }}
          >
            <History /> Save
          </Button>
        </div>
        {!portfolio.versions.length && (
          <p className="text-xs text-muted-foreground">No versions saved yet.</p>
        )}
        <ul className="divide-y divide-border">
          {portfolio.versions
            .slice()
            .reverse()
            .map((v) => (
              <li key={v.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs">{v.name}</span>
                  <span className="block text-xxs text-muted-foreground">
                    {new Date(v.at).toLocaleString()}
                  </span>
                </span>
                <Button
                  size="xs"
                  variant="quiet"
                  onClick={() => {
                    restoreVersion(portfolio.id, v.id);
                    notify(`Restored “${v.name}”. Undo is still available.`);
                  }}
                >
                  <RotateCcw /> Restore
                </Button>
              </li>
            ))}
        </ul>
      </Section>

      <Section
        title="Trash"
        hint="Deleted items, projects and elements wait here. Nothing is removed permanently until you empty the trash."
      >
        {!trash.length && <p className="text-xs text-muted-foreground">The trash is empty.</p>}
        <ul className="divide-y divide-border">
          {trash.map((t) => (
            <li key={t.id} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs">{t.label}</span>
                <span className="block text-xxs text-muted-foreground">
                  {t.kind} · {new Date(t.at).toLocaleString()}
                </span>
              </span>
              <Button
                size="xs"
                variant="quiet"
                onClick={() => {
                  restoreTrash(t.id);
                  notify("Restored.");
                }}
              >
                <RotateCcw /> Restore
              </Button>
              <Button
                size="icon-sm"
                variant="quiet"
                aria-label="Delete permanently"
                onClick={() => purgeTrash(t.id)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        {trash.length > 0 && (
          <Button size="xs" variant="quiet" onClick={() => purgeTrash()}>
            Empty the trash
          </Button>
        )}
      </Section>
    </>
  );
}
