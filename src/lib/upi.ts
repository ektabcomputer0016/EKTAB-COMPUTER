import type { PaymentConfiguration } from "@/lib/types";

export function buildUpiQrValue(
  payment: PaymentConfiguration,
  amount: number | null,
): string | null {
  if (payment.upi_link) {
    try {
      const url = new URL(payment.upi_link);
      if (url.protocol !== "upi:" || url.hostname !== "pay") return null;
      if (amount !== null && !url.searchParams.has("am")) {
        url.searchParams.set("am", amount.toFixed(2));
      }
      if (!url.searchParams.has("cu")) url.searchParams.set("cu", "INR");
      return url.toString();
    } catch {
      return null;
    }
  }

  if (!payment.upi_id) return null;
  const url = new URL("upi://pay");
  url.searchParams.set("pa", payment.upi_id);
  url.searchParams.set("pn", payment.display_name);
  url.searchParams.set("cu", "INR");
  if (amount !== null) url.searchParams.set("am", amount.toFixed(2));
  return url.toString();
}
