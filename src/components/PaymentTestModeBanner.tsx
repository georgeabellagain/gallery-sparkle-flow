import { getPaddleEnvironment } from "@/lib/paddle";

export function PaymentTestModeBanner() {
  if (getPaddleEnvironment() !== "sandbox") return null;
  return (
    <div className="w-full border-b border-border bg-muted px-4 py-2 text-center text-xs text-muted-foreground">
      Payments in the preview are in test mode — use card 4242 4242 4242 4242.{" "}
      <a href="https://docs.lovable.dev/features/payments#test-and-live-environments" target="_blank" rel="noopener noreferrer" className="underline">
        Read more
      </a>
    </div>
  );
}
