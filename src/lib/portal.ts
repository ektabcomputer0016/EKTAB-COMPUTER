import type { User } from "@supabase/supabase-js";
import { getSafeErrorMessage, requireSupabase } from "@/lib/supabase";
import type {
  Announcement,
  ApplicationDocument,
  ApplicationForm,
  ApplicationStatus,
  CustomerApplication,
  FAQ,
  FormField,
  PaymentRecord,
  PaymentConfiguration,
  Profile,
  Service,
  ServiceCategory,
  WebsiteSettings,
} from "@/lib/types";

type PublicSettingRow = { setting_key: string; setting_value: unknown };

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  correction_required: "Correction required",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
};

export async function sendVerificationCode(contact: string) {
  const client = requireSupabase();
  const value = contact.trim();
  if (!value) throw new Error("Enter an email address or phone number.");

  if (value.includes("@")) {
    const { error } = await client.auth.signInWithOtp({
      email: value,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: new URL(
          "track",
          new URL(import.meta.env.BASE_URL, window.location.origin),
        ).toString(),
      },
    });
    if (error) throw error;
    return "Check your email for a secure sign-in link. Your details have not been saved as an application.";
  }

  const normalizedPhone = value.replace(/[\s()-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
    throw new Error("Enter a phone number with its country code, for example +91…");
  }
  const { error } = await client.auth.signInWithOtp({
    phone: normalizedPhone,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
  return "Check your phone for the one-time verification code.";
}

export async function verifyPhoneCode(phone: string, token: string) {
  const { data, error } = await requireSupabase().auth.verifyOtp({
    phone: phone.replace(/[\s()-]/g, ""),
    token: token.trim(),
    type: "sms",
  });
  if (error) throw error;
  return data;
}

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await requireSupabase()
    .from("profiles")
    .select("id, display_name, role, is_active")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function listPublicServices(): Promise<Service[]> {
  const { data, error } = await requireSupabase()
    .from("services")
    .select("*, category:service_categories(id, name, slug)")
    .eq("is_published", true)
    .order("sort_order")
    .order("title");
  if (error) throw error;
  return (data ?? []) as unknown as Service[];
}

export async function listAdminServices(): Promise<Service[]> {
  const { data, error } = await requireSupabase()
    .from("services")
    .select("*, category:service_categories(id, name, slug)")
    .order("sort_order")
    .order("title");
  if (error) throw error;
  return (data ?? []) as unknown as Service[];
}

export async function listCategories(): Promise<ServiceCategory[]> {
  const { data, error } = await requireSupabase()
    .from("service_categories")
    .select("id, name, slug, description, sort_order, is_published")
    .eq("is_published", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as ServiceCategory[];
}

export async function getServiceBySlug(slug: string): Promise<Service | null> {
  const { data, error } = await requireSupabase()
    .from("services")
    .select("*, category:service_categories(id, name, slug)")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as Service | null;
}

export async function getApplicationForm(serviceId: string): Promise<ApplicationForm> {
  const { data, error } = await requireSupabase()
    .from("application_forms")
    .select("id, service_id, title, fields, is_active")
    .eq("service_id", serviceId)
    .eq("is_active", true)
    .single();
  if (error) throw error;
  const form = data as unknown as ApplicationForm;
  if (!Array.isArray(form.fields)) {
    throw new Error("This service form is not configured correctly.");
  }
  return form;
}

export async function getPublicSettings(): Promise<WebsiteSettings> {
  const { data, error } = await requireSupabase()
    .from("website_settings")
    .select("setting_key, setting_value")
    .eq("is_public", true);
  if (error) throw error;
  const settings: WebsiteSettings = {};
  for (const row of (data ?? []) as PublicSettingRow[]) {
    if (
      row.setting_key === "business" ||
      row.setting_key === "brand" ||
      row.setting_key === "theme" ||
      row.setting_key === "homepage"
    ) {
      settings[row.setting_key] = row.setting_value as WebsiteSettings[typeof row.setting_key];
    }
  }
  return settings;
}

export async function getAdminSettings() {
  const { data, error } = await requireSupabase()
    .from("website_settings")
    .select("setting_key, setting_value, is_public")
    .order("setting_key");
  if (error) throw error;
  return (data ?? []) as Array<PublicSettingRow & { is_public: boolean }>;
}

export async function listPublicFaqs(): Promise<FAQ[]> {
  const { data, error } = await requireSupabase()
    .from("faqs")
    .select("id, question, answer, sort_order, is_published")
    .eq("is_published", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as FAQ[];
}

export async function listAdminFaqs(): Promise<FAQ[]> {
  const { data, error } = await requireSupabase()
    .from("faqs")
    .select("id, question, answer, sort_order, is_published")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as FAQ[];
}

export async function listPublicAnnouncements(): Promise<Announcement[]> {
  const now = new Date().toISOString();
  const { data, error } = await requireSupabase()
    .from("announcements")
    .select("id, title, message, starts_at, ends_at, is_published")
    .eq("is_published", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Announcement[];
}

export async function listAdminAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await requireSupabase()
    .from("announcements")
    .select("id, title, message, starts_at, ends_at, is_published")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Announcement[];
}

export async function listPublicPaymentConfiguration(serviceId: string): Promise<PaymentConfiguration[]> {
  const client = requireSupabase();
  const [serviceResult, generalResult] = await Promise.all([
    client
      .from("payment_configuration")
      .select("id, service_id, display_name, upi_id, upi_link, instructions, qr_image_path, is_enabled, sort_order")
      .eq("service_id", serviceId)
      .eq("is_enabled", true)
      .order("sort_order"),
    client
      .from("payment_configuration")
      .select("id, service_id, display_name, upi_id, upi_link, instructions, qr_image_path, is_enabled, sort_order")
      .is("service_id", null)
      .eq("is_enabled", true)
      .order("sort_order"),
  ]);
  if (serviceResult.error) throw serviceResult.error;
  if (generalResult.error) throw generalResult.error;
  return [
    ...((serviceResult.data ?? []) as PaymentConfiguration[]),
    ...((generalResult.data ?? []) as PaymentConfiguration[]),
  ];
}

export function getPublicAssetUrl(path: string): string {
  return requireSupabase().storage.from("site-assets").getPublicUrl(path).data.publicUrl;
}

export async function createApplication(
  serviceId: string,
  customerName: string,
  formData: Record<string, string | number | boolean | null>,
  turnstileToken?: string,
): Promise<{ id: string; reference: string; status: string }> {
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) throw new Error("Verify your email or phone before applying.");

  const apiUrl = new URL("api/applications", new URL(import.meta.env.BASE_URL, window.location.origin));
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
    body: JSON.stringify({ serviceId, customerName, formData, turnstileToken }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "The application could not be submitted. Please try again.";
    throw new Error(message);
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("id" in payload) ||
    typeof payload.id !== "string" ||
    !("reference" in payload) ||
    typeof payload.reference !== "string" ||
    !("status" in payload) ||
    typeof payload.status !== "string"
  ) {
    throw new Error("The application was submitted, but the confirmation could not be read.");
  }
  return {
    id: payload.id,
    reference: payload.reference,
    status: payload.status,
  };
}

export async function submitPaymentReference(
  applicationId: string,
  paymentReference: string,
): Promise<PaymentRecord> {
  const reference = paymentReference.trim();
  if (!/^[A-Za-z0-9 ./_-]{3,150}$/.test(reference)) {
    throw new Error("Enter a valid payment reference (3–150 letters, numbers or . / _ -).");
  }
  const { data, error } = await requireSupabase().rpc("submit_payment_reference", {
    p_application_id: applicationId,
    p_payment_reference: reference,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  if (
    !row ||
    typeof row.payment_record_id !== "string" ||
    typeof row.application_id !== "string" ||
    typeof row.payment_state !== "string" ||
    typeof row.created_at !== "string"
  ) {
    throw new Error("The payment reference was not returned. Please check the application status.");
  }
  return {
    id: row.payment_record_id,
    application_id: row.application_id,
    amount:
      typeof row.amount === "number"
        ? row.amount
        : row.amount == null
          ? null
          : Number(row.amount),
    payment_reference:
      typeof row.payment_reference === "string" ? row.payment_reference : reference,
    payment_state: row.payment_state,
    created_at: row.created_at,
  };
}

export async function listCustomerPaymentRecords(
  applicationId: string,
): Promise<PaymentRecord[]> {
  const { data, error } = await requireSupabase()
    .from("payment_records")
    .select("id, application_id, amount, payment_reference, payment_state, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PaymentRecord[];
}

export async function uploadApplicationDocuments(
  applicationId: string,
  files: File[],
): Promise<{ uploaded: number }> {
  const client = requireSupabase();
  if (files.length > 10) throw new Error("Choose no more than 10 files.");

  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("Your secure session ended. Sign in again to upload documents.");

  let uploaded = 0;
  for (const file of files) {
    const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
    if (!allowedTypes.has(file.type)) {
      throw new Error(`${file.name}: use a PDF, JPEG or PNG file.`);
    }
    if (file.size === 0 || file.size > 10 * 1024 * 1024) {
      throw new Error(`${file.name}: each file must be smaller than 10 MB.`);
    }
    const safeName = file.name
      .normalize("NFKC")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/^\.+/, "")
      .slice(-150);
    if (!safeName) throw new Error("A file has an invalid name.");
    const path = `${userId}/${applicationId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await client.storage
      .from("application-documents")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;

    const { error: metadataError } = await client.from("application_documents").insert({
      application_id: applicationId,
      owner_id: userId,
      storage_path: path,
      original_file_name: file.name.slice(0, 255),
      content_type: file.type,
      byte_size: file.size,
    });
    if (metadataError) {
      await client.storage.from("application-documents").remove([path]);
      throw metadataError;
    }
    uploaded += 1;
  }
  return { uploaded };
}

export async function getCustomerApplication(reference: string): Promise<CustomerApplication | null> {
  const { data, error } = await requireSupabase()
    .from("applications")
    .select("id, application_reference, service_id, customer_name, status, customer_status_message, payment_state, created_at, updated_at, service:services(title, price_amount, discounted_price)")
    .eq("application_reference", reference.trim().toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as CustomerApplication | null;
}

export async function listAdminApplications(): Promise<CustomerApplication[]> {
  const { data, error } = await requireSupabase()
    .from("applications")
    .select("id, application_reference, service_id, customer_name, customer_phone, customer_email, form_data, status, customer_status_message, payment_state, created_at, updated_at, service:services(title)")
    .order("created_at", { ascending: false })
    .limit(250);
  if (error) throw error;
  return (data ?? []) as unknown as CustomerApplication[];
}

export async function listApplicationDocuments(applicationId: string): Promise<ApplicationDocument[]> {
  const { data, error } = await requireSupabase()
    .from("application_documents")
    .select("id, application_id, owner_id, storage_path, original_file_name, content_type, byte_size, created_at")
    .eq("application_id", applicationId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as ApplicationDocument[];
}

export async function createPrivateDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await requireSupabase()
    .storage.from("application-documents")
    .createSignedUrl(storagePath, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function createService(
  service: Partial<Service> & Pick<Service, "title" | "slug">,
  fields: FormField[],
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("services")
    .insert(service)
    .select("id")
    .single();
  if (error) throw error;
  const { error: formError } = await client
    .from("application_forms")
    .insert({
      service_id: data.id,
      title: `${service.title} application form`,
      fields,
      is_active: true,
    });
  if (formError) {
    throw new Error(
      `The service was created as a draft, but its application form was not saved. ${getSafeErrorMessage(formError)}`,
    );
  }
  return data.id as string;
}

export async function updateService(
  id: string,
  service: Partial<Service>,
  fields?: FormField[],
) {
  const client = requireSupabase();
  const { error } = await client.from("services").update(service).eq("id", id);
  if (error) throw error;
  if (fields !== undefined) {
    const { error: formError } = await client
      .from("application_forms")
      .upsert(
        {
          service_id: id,
          title: "Application form",
          fields,
          is_active: true,
        },
        { onConflict: "service_id" },
      );
    if (formError) {
      throw new Error(
        `The service details were saved, but its application form was not. ${getSafeErrorMessage(formError)}`,
      );
    }
  }
}

export async function getServiceFormForAdmin(serviceId: string): Promise<ApplicationForm | null> {
  const { data, error } = await requireSupabase()
    .from("application_forms")
    .select("id, service_id, title, fields, is_active")
    .eq("service_id", serviceId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as ApplicationForm | null;
}

export async function deleteService(id: string) {
  const { error } = await requireSupabase().from("services").delete().eq("id", id);
  if (error) throw error;
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
  customerMessage: string,
) {
  const { error } = await requireSupabase()
    .from("applications")
    .update({ status, customer_status_message: customerMessage })
    .eq("id", id);
  if (error) throw error;
}

export async function addStaffNote(applicationId: string, note: string, authorId: string) {
  const { error } = await requireSupabase().from("application_staff_notes").insert({
    application_id: applicationId,
    author_id: authorId,
    note,
  });
  if (error) throw error;
}

export async function listStaffNotes(applicationId: string) {
  const { data, error } = await requireSupabase()
    .from("application_staff_notes")
    .select("id, author_id, note, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; author_id: string; note: string; created_at: string }>;
}

export async function updateSetting(
  key: string,
  value: Record<string, unknown>,
  isPublic: boolean,
  user: User,
) {
  const { error } = await requireSupabase()
    .from("website_settings")
    .upsert(
      { setting_key: key, setting_value: value, is_public: isPublic, updated_by: user.id },
      { onConflict: "setting_key" },
    );
  if (error) throw error;
}

export async function upsertFaq(faq: Partial<FAQ> & Pick<FAQ, "question" | "answer">) {
  const { error } = await requireSupabase().from("faqs").upsert(faq);
  if (error) throw error;
}

export async function deleteFaq(id: string) {
  const { error } = await requireSupabase().from("faqs").delete().eq("id", id);
  if (error) throw error;
}

export async function listAdminPayments(): Promise<PaymentConfiguration[]> {
  const { data, error } = await requireSupabase()
    .from("payment_configuration")
    .select("id, service_id, display_name, upi_id, upi_link, instructions, qr_image_path, is_enabled, sort_order")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as PaymentConfiguration[];
}

export async function savePaymentConfiguration(
  config: Partial<PaymentConfiguration> & Pick<PaymentConfiguration, "display_name">,
  user: User,
) {
  const { error } = await requireSupabase()
    .from("payment_configuration")
    .upsert({ ...config, updated_by: user.id });
  if (error) throw error;
}

export async function uploadSiteAsset(file: File, path: string): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPEG, PNG or WebP image.");
  }
  if (file.size === 0 || file.size > 5 * 1024 * 1024) {
    throw new Error("The image must be smaller than 5 MB.");
  }
  const { data, error } = await requireSupabase()
    .storage.from("site-assets")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return data.path;
}

export async function updatePaymentRecord(
  paymentRecordId: string,
  state: "verified" | "rejected",
) {
  const { error } = await requireSupabase().rpc("verify_payment_record", {
    p_payment_record_id: paymentRecordId,
    p_payment_state: state,
  });
  if (error) throw error;
}

export async function listPaymentRecords(applicationId: string) {
  const { data, error } = await requireSupabase()
    .from("payment_records")
    .select("id, application_id, customer_id, amount, payment_reference, payment_state, verified_by, verified_at, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    application_id: string;
    customer_id: string;
    amount: number | null;
    payment_reference: string | null;
    payment_state: string;
    verified_by: string | null;
    verified_at: string | null;
    created_at: string;
  }>;
}

export async function listAdminAnnouncementsForEdit() {
  const { data, error } = await requireSupabase()
    .from("announcements")
    .select("id, title, message, starts_at, ends_at, is_published")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Announcement[];
}

export async function saveAnnouncement(announcement: Partial<Announcement> & Pick<Announcement, "title" | "message">) {
  const { error } = await requireSupabase().from("announcements").upsert(announcement);
  if (error) throw error;
}

export async function deleteAnnouncement(id: string) {
  const { error } = await requireSupabase().from("announcements").delete().eq("id", id);
  if (error) throw error;
}

export async function getAdminSummary() {
  const client = requireSupabase();
  const [services, recentApplications, totalResult] = await Promise.all([
    client.from("services").select("id, is_published"),
    client
      .from("applications")
      .select("id, application_reference, customer_name, status, created_at, service:services(title)")
      .order("created_at", { ascending: false })
      .limit(12),
    client.from("applications").select("id", { count: "exact", head: true }),
  ]);
  if (services.error) throw services.error;
  if (recentApplications.error) throw recentApplications.error;
  if (totalResult.error) throw totalResult.error;
  type RecentApplication = {
    id: string;
    application_reference: string;
    customer_name: string;
    status: ApplicationStatus;
    created_at: string;
    service?: { title: string } | null;
  };
  const recent: RecentApplication[] = (recentApplications.data ?? []).map((item) => {
    const relatedService = Array.isArray(item.service)
      ? item.service[0]
      : item.service;
    return {
      id: item.id,
      application_reference: item.application_reference,
      customer_name: item.customer_name,
      status: item.status as ApplicationStatus,
      created_at: item.created_at,
      service:
        relatedService && typeof relatedService.title === "string"
          ? { title: relatedService.title }
          : null,
    };
  });
  const counts = recent.reduce<Record<string, number>>((out, item) => {
    out[item.status] = (out[item.status] ?? 0) + 1;
    return out;
  }, {});
  return {
    totalApplications: totalResult.count ?? 0,
    publishedServices: (services.data ?? []).filter((service) => service.is_published).length,
    draftServices: (services.data ?? []).filter((service) => !service.is_published).length,
    recentApplications: recent,
    recentStatusCounts: counts,
  };
}

export function toSafeUiError(error: unknown) {
  const message = getSafeErrorMessage(error);
  if (/JWT|token expired|invalid claim/i.test(message)) {
    return "Your secure session has expired. Sign in again to continue.";
  }
  if (/network|fetch failed|failed to fetch|load failed/i.test(message)) {
    return "The secure service is not reachable right now. Check the connection and try again.";
  }
  return message;
}
