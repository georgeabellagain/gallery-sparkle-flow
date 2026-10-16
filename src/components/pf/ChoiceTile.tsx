import type { LucideIcon } from "lucide-react";
export function ChoiceTile({
  label,
  icon: Icon,
  selected,
  onClick,
  disabled = false,
}: {
  label: string;
  icon: LucideIcon;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border p-2 text-center text-xs transition-colors disabled:cursor-not-allowed ${selected ? "border-blue-600 bg-blue-600 text-white" : "border-border bg-background hover:bg-muted"}`}
    >
      <Icon className="size-6" aria-hidden />
      <span>{label}</span>
    </button>
  );
}
