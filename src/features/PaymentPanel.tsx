import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowUpRight, CircleAlert, LoaderCircle, Upload } from "lucide-react";
import {
  getPublicAssetUrl,
  listCustomerPaymentRecords,
  listPublicPaymentConfiguration,
  submitPaymentReference,
  toSafeUiError,
  uploadApplicationDocuments,
} from "@/lib/portal";
import { buildUpiQrValue } from "@/lib/upi";
import type { PaymentConfiguration, PaymentRecord } from "@/lib/types";

function formatMoney(amount: number | null) {
  if (amount === null) return "The centre has not published a fee.";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ApplicationPaymentPanel({
  applicationId,
  serviceId,
  amount,
}: {
  applicationId: string;
  serviceId: string;
  amount: number | null;
}) {
  const [methods, setMethods] = useState<PaymentConfiguration[] | null>(null);
  const [records, setRecords] = useState<PaymentRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [version, setVersion] = useState(0);
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [qrErrors, setQrErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadError("");
    Promise.all([
      listPublicPaymentConfiguration(serviceId),
      listCustomerPaymentRecords(applicationId),
    ])
      .then(([options, submitted]) => {
        if (!live) return;
        setMethods(options);
        setRecords(submitted);
      })
      .catch((err) => {
        if (live) setLoadError(toSafeUiError(err));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [applicationId, serviceId, version]);

  const activeRecord = records?.find((record) => record.payment_state !== "rejected");

  async function sendReference(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await submitPaymentReference(applicationId, reference);
      setReference("");
      setMessage(
        "Reference submitted. It remains pending until an authorized staff member checks the received payment.",
      );
      setVersion((current) => current + 1);
    } catch (err) {
      setError(toSafeUiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function uploadReceipt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!receipt) return;
    setUploadBusy(true);
    setError("");
    setMessage("");
    try {
      await uploadApplicationDocuments(applicationId, [receipt]);
      setReceipt(null);
      setMessage(
        "Private receipt file uploaded for staff review. Uploading a screenshot does not confirm payment.",
      );
      setVersion((current) => current + 1);
    } catch (err) {
      setError(toSafeUiError(err));
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-border bg-card p-6">
      <p className="eyebrow">Payment options</p>
      <h2 className="serif mt-2 text-2xl">Pay only through a method published by the centre.</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Published service fee: {formatMoney(amount)}. Confirm the amount with the centre before paying.
      </p>

      {loading ? (
        <div role="status" className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle size={17} className="animate-spin" /> Loading secure payment options
        </div>
      ) : loadError ? (
        <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-900">
          <CircleAlert size={18} /> {loadError}
          <button type="button" onClick={() => setVersion((current) => current + 1)} className="ml-auto underline">
            Retry
          </button>
        </div>
      ) : !methods?.length ? (
        <p className="mt-4 rounded-xl bg-secondary/60 p-4 text-sm leading-6">
          The centre has not published a payment method for this service. Contact the centre before sending money.
        </p>
      ) : (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {methods.map((method) => {
              const qrValue = buildUpiQrValue(method, amount);
              return (
                <article key={method.id} className="rounded-xl border border-border p-4">
                  <h3 className="font-semibold">{method.display_name}</h3>
                  {method.instructions && (
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                      {method.instructions}
                    </p>
                  )}
                  {method.upi_id && (
                    <p className="mt-3 break-all font-mono text-sm">UPI ID: {method.upi_id}</p>
                  )}
                  {method.upi_link && (
                    <a
                      href={buildUpiQrValue(method, amount) ?? method.upi_link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-sm font-semibold underline"
                    >
                      Open UPI app <ArrowUpRight size={15} />
                    </a>
                  )}
                  {method.qr_image_path && !qrErrors[method.id] ? (
                    <img
                      src={getPublicAssetUrl(method.qr_image_path)}
                      alt={`${method.display_name} payment QR`}
                      onError={() => setQrErrors((current) => ({ ...current, [method.id]: true }))}
                      className="mt-4 h-40 w-40 rounded-lg border border-border bg-white object-contain p-2"
                    />
                  ) : qrValue ? (
                    <div className="mt-4 inline-block rounded-lg border border-border bg-white p-2">
                      <QRCodeSVG
                        value={qrValue}
                        size={144}
                        level="M"
                        title={`${method.display_name} UPI QR`}
                      />
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          {records?.map((record) => (
            <div
              key={record.id}
              className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4 text-sm"
            >
              <span>
                Reference: <strong className="font-mono">{record.payment_reference}</strong>
              </span>
              <span className="status-pill">
                {record.payment_state === "verified"
                  ? "Verified by staff"
                  : record.payment_state === "rejected"
                    ? "Needs a new reference"
                    : "Pending staff review"}
              </span>
            </div>
          ))}

          {!activeRecord && (
            <form onSubmit={sendReference} className="mt-5 flex flex-col gap-3 sm:flex-row">
              <label className="sr-only" htmlFor={`payment-reference-${applicationId}`}>
                Payment reference
              </label>
              <input
                id={`payment-reference-${applicationId}`}
                required
                minLength={3}
                maxLength={150}
                pattern="[A-Za-z0-9 ./_-]{3,150}"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="UPI transaction / payment reference"
                className="h-12 min-w-0 flex-1 rounded-xl border border-input bg-background px-4 text-sm"
              />
              <button
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {busy && <LoaderCircle size={16} className="animate-spin" />}
                Submit reference
              </button>
            </form>
          )}

          <form onSubmit={uploadReceipt} className="mt-4 space-y-3 border-t border-border pt-4">
            <label className="block text-sm font-semibold">
              Optional private receipt or supporting document
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(event) => setReceipt(event.target.files?.[0] ?? null)}
                className="mt-2 block w-full rounded-xl border border-input bg-background p-3 text-sm"
              />
            </label>
            <p className="text-xs leading-5 text-muted-foreground">
              PDF, JPEG or PNG; up to 10 MB. Files are private. A receipt or screenshot is not proof that funds were received.
            </p>
            <button
              disabled={!receipt || uploadBusy}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-bold disabled:opacity-50"
            >
              {uploadBusy ? <LoaderCircle className="animate-spin" size={16} /> : <Upload size={16} />}
              Upload private file
            </button>
          </form>
        </>
      )}

      {message && <p role="status" className="mt-4 rounded-lg bg-secondary p-3 text-sm leading-5">{message}</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm leading-5 text-red-900">{error}</p>}
    </section>
  );
}
