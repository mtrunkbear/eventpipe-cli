type FlowEvent = {
  method: string;
  headers: Record<string, string>;
  body: unknown;
};

type FlowContext = {
  env?: Record<string, string>;
};

export async function handler(event: FlowEvent, context: FlowContext) {
  const key = context.env?.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!key) {
    return {
      ok: false,
      error: "Set STRIPE_SECRET_KEY in the flow environment (Event tab). Never use process.env in code boxes.",
    };
  }

  const res = await fetch("https://api.stripe.com/v1/balance", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Stripe-Version": "2024-11-20.acacia",
    },
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      stripeError: data.error ?? data,
    };
  }

  return {
    ok: true,
    available: data.available,
    pending: data.pending,
    livemode: data.livemode,
    note: "Uses REST only so the bundle stays under the 200KB per-node limit; the stripe npm package is too large to bundle here.",
  };
}
