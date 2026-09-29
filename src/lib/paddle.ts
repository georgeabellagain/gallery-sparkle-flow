import { resolvePaddlePrice } from "@/lib/payments.functions";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

declare global {
  interface Window {
    Paddle: any;
  }
}

export function getPaddleEnvironment(): "sandbox" | "live" {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

let ready: Promise<void> | null = null;
export function initializePaddle(): Promise<void> {
  if (ready) return ready;
  if (!clientToken) return Promise.reject(new Error("Payments are not configured"));
  ready = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    s.onload = () => {
      window.Paddle.Environment.set(getPaddleEnvironment() === "sandbox" ? "sandbox" : "production");
      window.Paddle.Initialize({ token: clientToken });
      resolve();
    };
    s.onerror = () => {
      ready = null;
      reject(new Error("Couldn’t load checkout"));
    };
    document.head.appendChild(s);
  });
  return ready;
}

export type PlanPrice = "personal_monthly" | "personal_yearly";

export async function openCheckout(o: { priceId: PlanPrice; email?: string; userId: string; successUrl: string }) {
  await initializePaddle();
  const priceId = await resolvePaddlePrice({ data: { priceId: o.priceId, environment: getPaddleEnvironment() } });
  window.Paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customer: o.email ? { email: o.email } : undefined,
    customData: { userId: o.userId },
    settings: { displayMode: "overlay", successUrl: o.successUrl, allowLogout: false, variant: "one-page" },
  });
}
