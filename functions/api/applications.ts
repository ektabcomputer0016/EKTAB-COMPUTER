interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

interface AuthenticatedUser {
  id: string;
  email?: string;
  phone?: string;
  email_confirmed_at?: string | null;
  phone_confirmed_at?: string | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NAME_MAX = 120;
const DATA_MAX_BYTES = 24_000;
const ALLOWED_FIELD_TYPES = new Set([
  "text",
  "textarea",
  "email",
  "tel",
  "number",
  "date",
  "select",
  "checkbox",
]);

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (!isPlainObject(value) || typeof value.id !== "string") return false;
  const optionalTextFields = [
    value.email,
    value.phone,
    value.email_confirmed_at,
    value.phone_confirmed_at,
  ];
  return optionalTextFields.every(
    (field) => field === undefined || field === null || typeof field === "string",
  );
}

function validString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

async function validateFields(
  env: Env,
  accessToken: string,
  serviceId: string,
  formData: Record<string, unknown>,
): Promise<string | null> {
  const base = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/application_forms`;
  const url = new URL(base);
  url.searchParams.set("service_id", `eq.${serviceId}`);
  url.searchParams.set("is_active", "eq.true");
  url.searchParams.set("select", "fields");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    return "The service form could not be checked. Please try again later.";
  }

  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return "This service is not accepting applications right now.";
  }

  const form = rows[0];
  const fields = isPlainObject(form) ? form.fields : undefined;
  if (!Array.isArray(fields)) {
    return "The service form is not configured correctly. Please contact the centre.";
  }

  const allowedNames = new Set<string>();
  for (const field of fields) {
    if (
      !isPlainObject(field) ||
      typeof field.name !== "string" ||
      !/^[a-z][a-z0-9_]{0,39}$/i.test(field.name) ||
      (field.type !== undefined &&
        (typeof field.type !== "string" ||
          !ALLOWED_FIELD_TYPES.has(field.type)))
    ) {
      return "The service form is not configured correctly. Please contact the centre.";
    }
    allowedNames.add(field.name);
    const value = formData[field.name];
    if (
      field.required === true &&
      (value === undefined ||
        value === "" ||
        (typeof value === "string" && !value.trim()) ||
        (field.type === "checkbox" && value === false))
    ) {
      return `Please complete: ${validString(field.label, 100) ? field.label : field.name}.`;
    }
    if (value === undefined || value === null || value === "") continue;

    if (typeof value === "string") {
      const maximum =
        typeof field.maxLength === "number" &&
        Number.isInteger(field.maxLength) &&
        field.maxLength > 0 &&
        field.maxLength <= 4000
          ? field.maxLength
          : 4000;
      if (value.length > maximum) {
        return `The answer for ${field.name} is too long.`;
      }
      if (
        field.type === "select" &&
        Array.isArray(field.options) &&
        !field.options.includes(value)
      ) {
        return `Choose a valid option for ${field.name}.`;
      }
    } else if (
      typeof value !== "boolean" &&
      typeof value !== "number" &&
      !Array.isArray(value)
    ) {
      return `The answer for ${field.name} has an unsupported format.`;
    }
  }

  if (Object.keys(formData).some((key) => !allowedNames.has(key))) {
    return "The application contains fields that are not part of this service form.";
  }

  return null;
}

export const onRequestPost = async ({ request, env }: PagesContext) => {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return json({ error: "Application services are not configured." }, 503);
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "Expected a JSON request." }, 415);
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const tokenMatch = /^Bearer ([\w.-]+)$/.exec(authorization);
  if (!tokenMatch) {
    return json({ error: "Verify your phone or email before applying." }, 401);
  }
  const accessToken = tokenMatch[1];

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > DATA_MAX_BYTES) {
    return json({ error: "The application is too large." }, 413);
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > DATA_MAX_BYTES) {
      return json({ error: "The application is too large." }, 413);
    }
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return json({ error: "The request is not valid JSON." }, 400);
  }
  if (!isPlainObject(body)) {
    return json({ error: "The application has an invalid format." }, 400);
  }

  const { serviceId, customerName, formData } = body;
  if (
    typeof serviceId !== "string" ||
    !UUID_PATTERN.test(serviceId) ||
    !validString(customerName, NAME_MAX) ||
    !isPlainObject(formData) ||
    new TextEncoder().encode(JSON.stringify(formData)).length > DATA_MAX_BYTES
  ) {
    return json({ error: "Check the application details and try again." }, 400);
  }

  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const userResponse = await fetch(`${base}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!userResponse.ok) {
    return json({ error: "Your verification expired. Please sign in again." }, 401);
  }
  const user: unknown = await userResponse.json();
  if (!isAuthenticatedUser(user)) {
    return json({ error: "Your verification could not be confirmed." }, 401);
  }

  const hasVerifiedEmail = Boolean(user.email_confirmed_at);
  const hasVerifiedPhone = Boolean(user.phone_confirmed_at);
  if (!hasVerifiedEmail && !hasVerifiedPhone) {
    return json(
      { error: "Verify your email address or phone number before applying." },
      403,
    );
  }
  if (!user.phone && !user.email) {
    return json(
      { error: "Add a verified contact method to your account before applying." },
      403,
    );
  }

  const validationError = await validateFields(
    env,
    accessToken,
    serviceId,
    formData,
  );
  if (validationError) {
    return json({ error: validationError }, 400);
  }

  const applicationResponse = await fetch(`${base}/rest/v1/rpc/submit_application`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      p_service_id: serviceId,
      p_customer_name: customerName.trim(),
      p_form_data: formData,
    }),
  });

  if (!applicationResponse.ok) {
    const safeMessage =
      applicationResponse.status === 401 || applicationResponse.status === 403
        ? "Your account is not permitted to submit this application."
        : "We could not submit your application. Please try again.";
    return json({ error: safeMessage }, applicationResponse.status >= 500 ? 503 : 400);
  }

  const created: unknown = await applicationResponse.json();
  if (!Array.isArray(created) || !isPlainObject(created[0])) {
    return json(
      { error: "The application was saved, but its reference could not be read." },
      502,
    );
  }
  const record = created[0];
  if (
    typeof record.application_id !== "string" ||
    !UUID_PATTERN.test(record.application_id) ||
    typeof record.application_reference !== "string" ||
    typeof record.status !== "string"
  ) {
    return json(
      { error: "The application was saved, but its reference could not be read." },
      502,
    );
  }

  return json(
    {
      id: record.application_id,
      reference: record.application_reference,
      status: record.status,
    },
    201,
  );
};
