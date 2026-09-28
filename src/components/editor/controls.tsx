import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

let n = 0;
const nextId = () => `f${++n}`;

export function Section({
  title,
  children,
  hint,
}: {
  title: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <section className="rule-b px-4 py-4 last:border-b-0">
      <h3 className="label-xs">{title}</h3>
      {hint && <p className="mt-1 text-xxs leading-relaxed text-muted-foreground">{hint}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  mono,
  area,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  area?: boolean;
}) {
  const id = nextId();
  return (
    <div>
      <Label htmlFor={id} className="text-xxs text-muted-foreground">
        {label}
      </Label>
      {area ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="mt-1 text-sm"
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn("mt-1 h-8 text-sm", mono && "font-mono text-xs")}
        />
      )}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <Label className="text-xxs text-muted-foreground">{label}</Label>
        <span className="text-xxs tabular-nums text-muted-foreground">
          {Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
          {suffix}
        </span>
      </div>
      <Slider
        className="mt-2"
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v ?? value)}
        aria-label={label}
      />
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = nextId();
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="text-xxs text-muted-foreground">
        {label}
      </Label>
      <span className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 cursor-pointer border border-border bg-background p-0.5"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-24 font-mono text-xxs"
          aria-label={`${label} value`}
        />
      </span>
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = nextId();
  return (
    <div>
      <Label htmlFor={id} className="text-xxs text-muted-foreground">
        {label}
      </Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-8 w-full border border-input bg-background px-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ToggleRow({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  const id = nextId();
  return (
    <div className="flex items-start justify-between gap-3">
      <span>
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
        {hint && <span className="mt-0.5 block text-xxs text-muted-foreground">{hint}</span>}
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-foreground"
      />
    </div>
  );
}
