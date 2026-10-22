export type ApplicationStatus =
  | "submitted"
  | "under_review"
  | "correction_required"
  | "approved"
  | "rejected"
  | "completed";

export type PaymentStatus =
  | "not_required"
  | "pending"
  | "submitted"
  | "verified"
  | "rejected";

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  is_published: boolean;
}

export interface Service {
  id: string;
  category_id: string | null;
  title: string;
  slug: string;
  short_description: string;
  description: string;
  price_amount: number | null;
  discounted_price: number | null;
  required_documents: string[];
  eligibility: string;
  instructions: string;
  processing_time: string;
  payment_instructions: string;
  seo_title: string;
  seo_description: string;
  is_published: boolean;
  sort_order: number;
  category?: Pick<ServiceCategory, "id" | "name" | "slug"> | null;
}

export interface FormField {
  name: string;
  label: string;
  type: "text" | "textarea" | "email" | "tel" | "number" | "date" | "select" | "checkbox";
  required?: boolean;
  options?: string[];
  maxLength?: number;
}

export interface ApplicationForm {
  id: string;
  service_id: string;
  title: string;
  fields: FormField[];
  is_active: boolean;
}

export interface CustomerApplication {
  id: string;
  application_reference: string;
  service_id: string;
  service?: {
    title: string;
    price_amount?: number | null;
    discounted_price?: number | null;
  } | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  form_data: Record<string, string | number | boolean | null>;
  status: ApplicationStatus;
  customer_status_message: string;
  payment_state: PaymentStatus;
  created_at: string;
  updated_at: string;
}

export interface ApplicationDocument {
  id: string;
  application_id: string;
  owner_id: string;
  storage_path: string;
  original_file_name: string;
  content_type: string;
  byte_size: number;
  created_at: string;
}

export interface PaymentConfiguration {
  id: string;
  service_id: string | null;
  display_name: string;
  upi_id: string | null;
  upi_link: string | null;
  instructions: string;
  qr_image_path: string | null;
  is_enabled: boolean;
  sort_order: number;
}

export interface PaymentRecord {
  id: string;
  application_id: string;
  amount: number | null;
  payment_reference: string | null;
  payment_state: PaymentStatus;
  created_at: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  is_published: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  starts_at: string | null;
  ends_at: string | null;
  is_published: boolean;
}

export interface WebsiteSettings {
  business?: {
    name?: string;
    region?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    address?: string;
    hours?: string;
  };
  brand?: {
    logo_path?: string;
    logo_alt?: string;
    banner_path?: string;
  };
  theme?: { primary?: string; accent?: string; font?: string };
  homepage?: { announcement?: string; hero_title?: string; hero_description?: string };
}

export interface Profile {
  id: string;
  display_name: string | null;
  role: "customer" | "staff" | "admin";
  is_active: boolean;
}
