-- EKTAB COMPUTER initial Supabase schema.
-- Run this only in the intended Supabase project after reviewing the policies.
create extension if not exists pgcrypto;

create type public.profile_role as enum ('customer', 'staff', 'admin');
create type public.application_status as enum (
  'submitted',
  'under_review',
  'correction_required',
  'approved',
  'rejected',
  'completed'
);
create type public.payment_status as enum (
  'not_required',
  'pending',
  'submitted',
  'verified',
  'rejected'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role public.profile_role not null default 'customer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.service_categories (id) on delete set null,
  title text not null check (length(trim(title)) between 2 and 140),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  short_description text not null default '',
  description text not null default '',
  price_amount numeric(10, 2) check (price_amount is null or price_amount >= 0),
  discounted_price numeric(10, 2) check (discounted_price is null or discounted_price >= 0),
  required_documents jsonb not null default '[]'::jsonb check (jsonb_typeof(required_documents) = 'array'),
  eligibility text not null default '',
  instructions text not null default '',
  processing_time text not null default '',
  payment_instructions text not null default '',
  seo_title text not null default '',
  seo_description text not null default '',
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discounted_price is null or price_amount is null or discounted_price <= price_amount)
);
create index services_public_order_idx on public.services (is_published, sort_order);
create index services_category_idx on public.services (category_id);

create table public.application_forms (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null unique references public.services (id) on delete cascade,
  title text not null default 'Application form',
  fields jsonb not null default '[]'::jsonb check (jsonb_typeof(fields) = 'array'),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.website_settings (
  setting_key text primary key check (setting_key ~ '^[a-z][a-z0-9_-]{0,79}$'),
  setting_value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.homepage_sections (
  id uuid primary key default gen_random_uuid(),
  section_key text not null unique check (section_key ~ '^[a-z][a-z0-9_-]{0,79}$'),
  content jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null check (length(trim(question)) between 4 and 500),
  answer text not null check (length(trim(answer)) between 1 and 5000),
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 2 and 140),
  message text not null check (length(trim(message)) between 1 and 2000),
  starts_at timestamptz,
  ends_at timestamptz,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  application_reference text not null unique
    default ('EKT-' || upper(encode(gen_random_bytes(5), 'hex'))),
  service_id uuid not null references public.services (id) on delete restrict,
  customer_id uuid not null references auth.users (id) on delete restrict,
  customer_name text not null check (length(trim(customer_name)) between 2 and 120),
  customer_phone text,
  customer_email text,
  form_data jsonb not null default '{}'::jsonb check (jsonb_typeof(form_data) = 'object'),
  status public.application_status not null default 'submitted',
  customer_status_message text not null default 'Your application has been received.',
  payment_state public.payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (customer_phone is not null and length(customer_phone) <= 30)
    or (customer_email is not null and length(customer_email) <= 254)
  )
);
create index applications_customer_recent_idx
  on public.applications (customer_id, created_at desc);
create index applications_service_recent_idx
  on public.applications (service_id, created_at desc);
create index applications_status_recent_idx
  on public.applications (status, created_at desc);

create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null unique,
  original_file_name text not null check (length(original_file_name) between 1 and 255),
  content_type text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png')),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  created_at timestamptz not null default now()
);
create index application_documents_application_idx
  on public.application_documents (application_id);

create table public.payment_configuration (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.services (id) on delete cascade,
  display_name text not null default 'Payment',
  upi_id text,
  upi_link text,
  instructions text not null default '',
  qr_image_path text,
  is_enabled boolean not null default false,
  sort_order integer not null default 0,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  check (
    upi_id is null
    or (length(upi_id) <= 150 and upi_id ~ '^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$')
  ),
  check (upi_link is null or (length(upi_link) <= 1000 and upi_link ~ '^upi://pay(\?|$)')),
  check (qr_image_path is null or length(qr_image_path) <= 500)
);
create index payment_configuration_service_idx
  on public.payment_configuration (service_id, is_enabled, sort_order);

create table public.payment_records (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  customer_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(10, 2) check (amount is null or amount >= 0),
  payment_reference text check (payment_reference is null or length(payment_reference) <= 150),
  payment_state public.payment_status not null default 'pending',
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (payment_state = 'verified' and verified_by is not null and verified_at is not null)
    or (payment_state <> 'verified')
  )
);
create index payment_records_application_idx on public.payment_records (application_id);
create index payment_records_customer_created_idx
  on public.payment_records (customer_id, created_at desc);

-- Internal staff notes are intentionally separate from customer-readable application rows.
create table public.application_staff_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete restrict,
  note text not null check (length(trim(note)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index application_staff_notes_application_idx
  on public.application_staff_notes (application_id, created_at desc);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (length(action) between 1 and 100),
  entity_type text not null check (length(entity_type) between 1 and 80),
  entity_id text not null check (length(entity_id) between 1 and 120),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_recent_idx on public.audit_logs (created_at desc);

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active
      and p.role in ('staff', 'admin')
  );
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active
      and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.service_categories
  for each row execute function public.set_updated_at();
create trigger services_set_updated_at before update on public.services
  for each row execute function public.set_updated_at();
create trigger application_forms_set_updated_at before update on public.application_forms
  for each row execute function public.set_updated_at();
create trigger website_settings_set_updated_at before update on public.website_settings
  for each row execute function public.set_updated_at();
create trigger homepage_sections_set_updated_at before update on public.homepage_sections
  for each row execute function public.set_updated_at();
create trigger faqs_set_updated_at before update on public.faqs
  for each row execute function public.set_updated_at();
create trigger announcements_set_updated_at before update on public.announcements
  for each row execute function public.set_updated_at();
create trigger applications_set_updated_at before update on public.applications
  for each row execute function public.set_updated_at();
create trigger payment_configuration_set_updated_at before update on public.payment_configuration
  for each row execute function public.set_updated_at();

-- Do not let a customer choose the tracking number, initial workflow state,
-- payment state, owner, or timestamps in a public application request.
create or replace function public.prepare_application_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.application_reference := 'EKT-' || upper(encode(gen_random_bytes(5), 'hex'));
  new.customer_id := auth.uid();
  new.status := 'submitted';
  new.customer_status_message := 'Your application has been received.';
  new.payment_state := 'pending';
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create trigger applications_prepare_insert before insert on public.applications
  for each row execute function public.prepare_application_insert();

-- Every completed/failed verification is an explicit staff action; an
-- uploaded payment screenshot or entered UPI reference never marks a payment paid.
create or replace function public.prepare_payment_record_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.customer_id := auth.uid();
  new.payment_state := 'submitted';
  new.verified_by := null;
  new.verified_at := null;
  new.created_at := now();
  return new;
end;
$$;

create trigger payment_records_prepare_insert before insert on public.payment_records
  for each row execute function public.prepare_payment_record_insert();

create or replace function public.submit_application(
  p_service_id uuid,
  p_customer_name text,
  p_form_data jsonb
)
returns table (
  application_id uuid,
  application_reference text,
  status public.application_status
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_phone text;
  v_email_confirmed_at timestamptz;
  v_phone_confirmed_at timestamptz;
  v_fields jsonb;
  v_field jsonb;
  v_field_name text;
  v_field_type text;
  v_value jsonb;
  v_recent_count integer;
  v_inserted public.applications%rowtype;
begin
  if v_user_id is null then
    raise exception 'Sign-in is required.' using errcode = '42501';
  end if;

  select u.email, u.phone, u.email_confirmed_at, u.phone_confirmed_at
    into v_email, v_phone, v_email_confirmed_at, v_phone_confirmed_at
  from auth.users u
  where u.id = v_user_id
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now());

  if not found
     or (v_email_confirmed_at is null and v_phone_confirmed_at is null) then
    raise exception 'Verify your email or phone before applying.' using errcode = '42501';
  end if;
  if p_service_id is null
     or length(trim(coalesce(p_customer_name, ''))) < 2
     or length(trim(p_customer_name)) > 120
     or p_form_data is null
     or jsonb_typeof(p_form_data) is distinct from 'object'
     or octet_length(p_form_data::text) > 24000 then
    raise exception 'Check your application details and try again.' using errcode = '22023';
  end if;

  select af.fields
    into v_fields
  from public.application_forms af
  join public.services s on s.id = af.service_id
  where af.service_id = p_service_id
    and af.is_active
    and s.is_published;

  if not found or jsonb_typeof(v_fields) is distinct from 'array' then
    raise exception 'This service is not accepting applications.' using errcode = '22023';
  end if;
  if jsonb_array_length(v_fields) > 100 then
    raise exception 'This service form is not configured correctly.' using errcode = '22023';
  end if;

  for v_field in select item.value from jsonb_array_elements(v_fields) as item(value)
  loop
    if jsonb_typeof(v_field) is distinct from 'object' then
      raise exception 'This service form is not configured correctly.' using errcode = '22023';
    end if;
    v_field_name := v_field ->> 'name';
    if v_field_name is null or v_field_name !~ '^[a-zA-Z][a-zA-Z0-9_]{0,39}$' then
      raise exception 'This service form is not configured correctly.' using errcode = '22023';
    end if;
    v_field_type := coalesce(v_field ->> 'type', 'text');
    if v_field_type not in ('text', 'textarea', 'email', 'tel', 'number', 'date', 'select', 'checkbox') then
      raise exception 'This service form is not configured correctly.' using errcode = '22023';
    end if;
    if v_field_type = 'select' then
      if jsonb_typeof(v_field -> 'options') is distinct from 'array' then
        raise exception 'This service form is not configured correctly.' using errcode = '22023';
      end if;
      if jsonb_array_length(v_field -> 'options') not between 1 and 50 then
        raise exception 'This service form is not configured correctly.' using errcode = '22023';
      end if;
    end if;

    v_value := p_form_data -> v_field_name;
    if coalesce((v_field ->> 'required')::boolean, false)
       and (
         v_value is null
         or v_value = 'null'::jsonb
         or v_value = '""'::jsonb
         or (jsonb_typeof(v_value) = 'string' and length(trim(v_value #>> '{}')) = 0)
         or (v_field_type = 'checkbox' and v_value <> 'true'::jsonb)
       ) then
      raise exception 'A required application field is missing.' using errcode = '22023';
    end if;
    if v_value is null or v_value = 'null'::jsonb then
      continue;
    end if;

    if v_field_type in ('text', 'textarea', 'email', 'tel', 'date', 'select')
       and jsonb_typeof(v_value) <> 'string' then
      raise exception 'An application field has an invalid value.' using errcode = '22023';
    end if;
    if v_field_type = 'select'
       and not exists (
         select 1
         from jsonb_array_elements_text(v_field -> 'options') as option_value(value)
         where option_value.value = v_value #>> '{}'
       ) then
      raise exception 'Choose a listed option for each selection field.' using errcode = '22023';
    end if;
    if v_field_type = 'email'
       and (v_value #>> '{}') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'Enter a valid email address.' using errcode = '22023';
    end if;
    if v_field_type = 'date'
       and (v_value #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'Enter a valid date.' using errcode = '22023';
    end if;
    if v_field_type = 'checkbox'
       and jsonb_typeof(v_value) <> 'boolean' then
      raise exception 'An application field has an invalid value.' using errcode = '22023';
    end if;
    if v_field_type = 'number'
       and jsonb_typeof(v_value) <> 'number' then
      raise exception 'An application field has an invalid value.' using errcode = '22023';
    end if;
    if jsonb_typeof(v_value) = 'string'
       and length(v_value #>> '{}') > least(
         greatest(coalesce((v_field ->> 'maxLength')::integer, 4000), 1),
         4000
       ) then
      raise exception 'An application answer is too long.' using errcode = '22023';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_object_keys(p_form_data) as submitted(key)
    where not exists (
      select 1
      from jsonb_array_elements(v_fields) as defined(value)
      where defined.value ->> 'name' = submitted.key
    )
  ) then
    raise exception 'The application has fields not included in this service form.' using errcode = '22023';
  end if;

  -- Serialize requests per account to enforce a small hourly submission limit
  -- even when a client retries or sends concurrent requests.
  perform pg_advisory_xact_lock(
    hashtextextended('application:' || v_user_id::text, 0)
  );
  select count(*)::integer
    into v_recent_count
  from public.applications a
  where a.customer_id = v_user_id
    and a.created_at >= now() - interval '1 hour';
  if v_recent_count >= 5 then
    raise exception 'Too many applications. Please try again later.' using errcode = 'P0001';
  end if;

  insert into public.applications (
    service_id,
    customer_id,
    customer_name,
    customer_phone,
    customer_email,
    form_data
  )
  values (
    p_service_id,
    v_user_id,
    trim(p_customer_name),
    case when v_phone_confirmed_at is not null then v_phone else null end,
    case when v_email_confirmed_at is not null then v_email else null end,
    p_form_data
  )
  returning * into v_inserted;

  return query
    select v_inserted.id, v_inserted.application_reference, v_inserted.status;
end;
$$;

revoke all on function public.submit_application(uuid, text, jsonb) from public, anon;
grant execute on function public.submit_application(uuid, text, jsonb) to authenticated;

create or replace function public.submit_payment_reference(
  p_application_id uuid,
  p_payment_reference text
)
returns table (
  payment_record_id uuid,
  application_id uuid,
  amount numeric(10, 2),
  payment_reference text,
  created_at timestamptz,
  payment_state public.payment_status
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_application public.applications%rowtype;
  v_email_confirmed_at timestamptz;
  v_phone_confirmed_at timestamptz;
  v_amount numeric(10, 2);
  v_recent_count integer;
  v_payment_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign-in is required.' using errcode = '42501';
  end if;

  select u.email_confirmed_at, u.phone_confirmed_at
    into v_email_confirmed_at, v_phone_confirmed_at
  from auth.users u
  where u.id = v_user_id
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now());
  if not found
     or (v_email_confirmed_at is null and v_phone_confirmed_at is null) then
    raise exception 'Verify your email or phone before submitting payment details.' using errcode = '42501';
  end if;

  if p_application_id is null
     or length(trim(coalesce(p_payment_reference, ''))) < 3
     or length(trim(p_payment_reference)) > 150
     or p_payment_reference ~ '[[:cntrl:]]' then
    raise exception 'Enter a valid payment reference.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('payment:' || v_user_id::text, 0)
  );

  select a.*
    into v_application
  from public.applications a
  where a.id = p_application_id
    and a.customer_id = v_user_id
  for update;
  if not found then
    raise exception 'The application was not found for this account.' using errcode = '42501';
  end if;
  if v_application.status in ('rejected', 'completed') then
    raise exception 'This application is no longer accepting payment details.' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.payment_configuration pc
    where pc.is_enabled
      and (pc.service_id = v_application.service_id or pc.service_id is null)
  ) then
    raise exception 'The centre has not enabled a payment method for this service.' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.payment_records pr
    where pr.application_id = v_application.id
      and pr.payment_state in ('pending', 'submitted', 'verified')
  ) then
    raise exception 'A payment reference is already awaiting review or verified for this application.' using errcode = '22023';
  end if;

  select count(*)::integer
    into v_recent_count
  from public.payment_records pr
  where pr.customer_id = v_user_id
    and pr.created_at >= now() - interval '1 hour';
  if v_recent_count >= 10 then
    raise exception 'Too many payment references. Please try again later.' using errcode = 'P0001';
  end if;

  select coalesce(s.discounted_price, s.price_amount)
    into v_amount
  from public.services s
  where s.id = v_application.service_id;

  insert into public.payment_records (
    application_id,
    customer_id,
    amount,
    payment_reference
  )
  values (
    v_application.id,
    v_user_id,
    v_amount,
    trim(p_payment_reference)
  )
  returning id into v_payment_id;

  update public.applications
    set payment_state = 'submitted'
  where id = v_application.id;

  return query
    select pr.id, pr.application_id, pr.amount, pr.payment_reference,
           pr.created_at, pr.payment_state
    from public.payment_records pr
    where pr.id = v_payment_id;
end;
$$;

revoke all on function public.submit_payment_reference(uuid, text) from public, anon;
grant execute on function public.submit_payment_reference(uuid, text) to authenticated;

create or replace function public.verify_payment_record(
  p_payment_record_id uuid,
  p_payment_state public.payment_status
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_application_id uuid;
  v_current_state public.payment_status;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not public.is_staff() then
    raise exception 'Active staff access is required.' using errcode = '42501';
  end if;
  if p_payment_state not in ('verified', 'rejected') then
    raise exception 'Choose a valid payment review state.' using errcode = '22023';
  end if;

  select pr.application_id, pr.payment_state
    into v_application_id, v_current_state
  from public.payment_records pr
  where pr.id = p_payment_record_id
  for update;
  if not found then
    raise exception 'Payment record not found.' using errcode = 'P0002';
  end if;
  if v_current_state not in ('pending', 'submitted') then
    raise exception 'This payment record has already been reviewed.' using errcode = '22023';
  end if;

  update public.payment_records
     set payment_state = p_payment_state,
         verified_by = v_user_id,
         verified_at = now()
   where id = p_payment_record_id;

  update public.applications
     set payment_state = p_payment_state
   where id = v_application_id;
end;
$$;

revoke all on function public.verify_payment_record(uuid, public.payment_status) from public, anon;
grant execute on function public.verify_payment_record(uuid, public.payment_status) to authenticated;

create or replace function public.write_redacted_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entity_name text := tg_table_name;
  row_id text;
  action_name text := lower(tg_op);
  safe_details jsonb := '{}'::jsonb;
begin
  if tg_op = 'DELETE' then
    row_id := coalesce(to_jsonb(old) ->> 'id', '');
    if entity_name = 'applications' then
      safe_details := jsonb_build_object('status', to_jsonb(old) ->> 'status');
    end if;
  else
    row_id := coalesce(to_jsonb(new) ->> 'id', '');
    if entity_name = 'applications' and tg_op = 'UPDATE'
       and (to_jsonb(old) ->> 'status') is distinct from (to_jsonb(new) ->> 'status') then
      action_name := 'status_changed';
      safe_details := jsonb_build_object(
        'from', to_jsonb(old) ->> 'status',
        'to', to_jsonb(new) ->> 'status'
      );
    elsif entity_name = 'payment_configuration' then
      safe_details := jsonb_build_object(
        'enabled', to_jsonb(new) ->> 'is_enabled',
        'service_id', to_jsonb(new) ->> 'service_id'
      );
    end if;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), action_name, entity_name, row_id, safe_details);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger services_audit after insert or update or delete on public.services
  for each row execute function public.write_redacted_audit_log();
create trigger applications_audit after insert or update or delete on public.applications
  for each row execute function public.write_redacted_audit_log();
create trigger payment_configuration_audit after insert or update or delete on public.payment_configuration
  for each row execute function public.write_redacted_audit_log();
create trigger website_settings_audit after insert or update or delete on public.website_settings
  for each row execute function public.write_redacted_audit_log();

alter table public.profiles enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.application_forms enable row level security;
alter table public.website_settings enable row level security;
alter table public.homepage_sections enable row level security;
alter table public.faqs enable row level security;
alter table public.announcements enable row level security;
alter table public.applications enable row level security;
alter table public.application_documents enable row level security;
alter table public.payment_configuration enable row level security;
alter table public.payment_records enable row level security;
alter table public.application_staff_notes enable row level security;
alter table public.audit_logs enable row level security;

create policy "Profiles: customers read their own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy "Profiles: admins manage profiles"
  on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Categories: published categories are public"
  on public.service_categories for select to anon, authenticated
  using (is_published or public.is_staff());
create policy "Categories: staff manage categories"
  on public.service_categories for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "Services: published services are public"
  on public.services for select to anon, authenticated
  using (is_published or public.is_staff());
create policy "Services: staff manage services"
  on public.services for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "Application forms: active forms of published services are public"
  on public.application_forms for select to anon, authenticated
  using (
    is_active
    and exists (
      select 1 from public.services s
      where s.id = service_id and s.is_published
    )
  );
create policy "Application forms: staff manage forms"
  on public.application_forms for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "Settings: only explicitly public settings can be read"
  on public.website_settings for select to anon, authenticated
  using (is_public or public.is_staff());
create policy "Settings: staff manage settings"
  on public.website_settings for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "Homepage: published sections are public"
  on public.homepage_sections for select to anon, authenticated
  using (is_published or public.is_staff());
create policy "Homepage: staff manage sections"
  on public.homepage_sections for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "FAQs: published FAQs are public"
  on public.faqs for select to anon, authenticated
  using (is_published or public.is_staff());
create policy "FAQs: staff manage FAQs"
  on public.faqs for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "Announcements: currently published messages are public"
  on public.announcements for select to anon, authenticated
  using (
    is_published
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
    or public.is_staff()
  );
create policy "Announcements: staff manage announcements"
  on public.announcements for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "Applications: customers read only their own"
  on public.applications for select to authenticated
  using (customer_id = auth.uid() or public.is_staff());
create policy "Applications: verified customers submit their own"
  on public.applications for insert to authenticated
  with check (
    customer_id = auth.uid()
    and (
      (customer_phone is not null and customer_phone = (auth.jwt() ->> 'phone'))
      or (customer_email is not null and lower(customer_email) = lower(auth.jwt() ->> 'email'))
    )
    and exists (
      select 1 from public.services s
      where s.id = service_id and s.is_published
    )
  );
create policy "Applications: staff review and manage"
  on public.applications for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "Applications: staff delete"
  on public.applications for delete to authenticated
  using (public.is_staff());

create policy "Documents: customers see their own file metadata and staff see all"
  on public.application_documents for select to authenticated
  using (owner_id = auth.uid() or public.is_staff());
create policy "Documents: customers register files on their applications"
  on public.application_documents for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.customer_id = auth.uid()
    )
    and storage_path like auth.uid()::text || '/' || application_id::text || '/%'
    and exists (
      select 1 from storage.objects o
      where o.bucket_id = 'application-documents'
        and o.name = storage_path
    )
  );
create policy "Documents: staff delete metadata"
  on public.application_documents for delete to authenticated
  using (public.is_staff());

create policy "Payment configuration: enabled QR instructions are public"
  on public.payment_configuration for select to anon, authenticated
  using (is_enabled or public.is_staff());
create policy "Payment configuration: staff manage QR settings"
  on public.payment_configuration for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "Payment records: customers read their own records"
  on public.payment_records for select to authenticated
  using (customer_id = auth.uid() or public.is_staff());
create policy "Payment records: staff delete"
  on public.payment_records for delete to authenticated
  using (public.is_staff());

create policy "Staff notes: staff read notes"
  on public.application_staff_notes for select to authenticated
  using (public.is_staff());
create policy "Staff notes: staff create notes"
  on public.application_staff_notes for insert to authenticated
  with check (public.is_staff() and author_id = auth.uid());
create policy "Staff notes: staff update or delete notes"
  on public.application_staff_notes for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "Staff notes: staff delete notes"
  on public.application_staff_notes for delete to authenticated
  using (public.is_staff());

create policy "Audit log: admins and staff can read history"
  on public.audit_logs for select to authenticated
  using (public.is_staff());

-- Only public site assets belong in this bucket (branding, banners, public QR images).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-assets',
  'site-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Submitted customer documents are private; objects are never public URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-documents',
  'application-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Storage: customers upload into their own application folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and exists (
      select 1 from public.applications a
      where a.id = ((storage.foldername(name))[2])::uuid
        and a.customer_id = auth.uid()
    )
    and storage.extension(name) in ('pdf', 'jpg', 'jpeg', 'png')
  );
create policy "Storage: customers and staff read authorized private documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'application-documents'
    and (
      public.is_staff()
      or (
        (storage.foldername(name))[1] = auth.uid()::text
        and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and exists (
          select 1 from public.applications a
          where a.id = ((storage.foldername(name))[2])::uuid
            and a.customer_id = auth.uid()
        )
      )
    )
  );
create policy "Storage: staff manage public site assets"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'site-assets' and public.is_staff());
create policy "Storage: staff update public site assets"
  on storage.objects for update to authenticated
  using (bucket_id = 'site-assets' and public.is_staff())
  with check (bucket_id = 'site-assets' and public.is_staff());
create policy "Storage: staff delete site assets and private documents"
  on storage.objects for delete to authenticated
  using (
    public.is_staff()
    and bucket_id in ('site-assets', 'application-documents')
  );

-- Supabase PostgREST also needs explicit SQL privileges; RLS alone does not
-- grant table access. RLS remains the authorization boundary for every row.
grant usage on schema public to anon, authenticated;

grant select on
  public.service_categories,
  public.services,
  public.application_forms,
  public.website_settings,
  public.homepage_sections,
  public.faqs,
  public.announcements,
  public.payment_configuration
to anon, authenticated;

grant select, insert, update, delete on
  public.service_categories,
  public.services,
  public.application_forms,
  public.website_settings,
  public.homepage_sections,
  public.faqs,
  public.announcements,
  public.payment_configuration
to authenticated;

grant select, update on public.profiles to authenticated;
grant select on public.applications to authenticated;
grant update, delete on public.applications to authenticated;
grant select, insert, delete on public.application_documents to authenticated;
grant select, delete on public.payment_records to authenticated;
revoke insert, update on public.payment_records from authenticated;
grant select, insert, update, delete on public.application_staff_notes to authenticated;
grant select on public.audit_logs to authenticated;

-- Minimal business configuration. The owner should replace or complete it in
-- the dashboard before publishing rather than advertise guessed contact details.
insert into public.website_settings (setting_key, setting_value, is_public)
values
  ('business', '{"name":"EKTAB COMPUTER","region":"Bihar, India","phone":"","whatsapp":"","email":"","address":"","hours":""}'::jsonb, true),
  ('brand', '{"logo_path":"","logo_alt":"EKTAB COMPUTER","banner_path":""}'::jsonb, true),
  ('theme', '{"primary":"#176b54","accent":"#d5a646","font":"system"}'::jsonb, true),
  ('homepage', '{"announcement":"","hero_title":"Digital services, with a real person to help.","hero_description":"Get clear guidance, apply for services and keep track of your request."}'::jsonb, true)
on conflict (setting_key) do nothing;

insert into public.service_categories (name, slug, description, sort_order)
values
  ('Identity documents', 'identity-documents', 'Guidance for identity-document services.', 10),
  ('Certificates', 'certificates', 'Help preparing local certificate applications.', 20),
  ('Online forms', 'online-forms', 'Assistance with online applications and submissions.', 30),
  ('Print & digital', 'print-digital', 'Everyday printing and digital document services.', 40)
on conflict (slug) do nothing;

-- Starting catalogue from the examples in the supplied project brief. Fees and
-- service-specific document requirements remain unset until the owner verifies them.
insert into public.services (
  category_id, title, slug, short_description, description,
  eligibility, instructions, processing_time, is_published, sort_order
)
select
  c.id, seed.title, seed.slug, seed.short_description, seed.description,
  seed.eligibility, seed.instructions, seed.processing_time, true, seed.sort_order
from (values
  ('Aadhaar Update Assistance', 'aadhaar-update', 'Guidance on the relevant Aadhaar update process.', 'Independent application-preparation assistance only; updates are completed by an authorized provider. No government affiliation is claimed.', 'Requirements depend on the update requested. Confirm with the issuing authority.', 'Contact the centre to confirm current documents, availability and fee before applying.', 'Varies by issuing authority.', 'identity-documents', 10),
  ('PAN Card Assistance', 'pan-card', 'Help preparing a PAN application or correction request.', 'Support with forms and document preparation. PAN applications are decided by the responsible authority.', 'Requirements depend on the application type.', 'Confirm the current document list and fee before applying.', 'Varies by issuing authority.', 'identity-documents', 20),
  ('Ration Card Assistance', 'ration-card', 'Guidance for a ration card application or update.', 'Help preparing a ration card request for the relevant local process.', 'Requirements depend on the applicant and local rules.', 'Confirm eligibility and current documents with the responsible authority.', 'Varies by responsible authority.', 'identity-documents', 30),
  ('Income Certificate Assistance', 'income-certificate', 'Help preparing an income certificate application.', 'Application-preparation support for the relevant local income certificate process.', 'Eligibility and evidence depend on current local requirements.', 'Confirm requirements with the responsible authority before applying.', 'Varies by responsible authority.', 'certificates', 40),
  ('Caste Certificate Assistance', 'caste-certificate', 'Help preparing a caste certificate application.', 'Application-preparation support. Certificates are issued only by the responsible authority.', 'Eligibility and evidence depend on current local requirements.', 'Confirm requirements with the responsible authority before applying.', 'Varies by responsible authority.', 'certificates', 50),
  ('Residential Certificate Assistance', 'residential-certificate', 'Help preparing a residential certificate application.', 'Application-preparation support for the relevant local certificate process.', 'Eligibility and evidence depend on current local requirements.', 'Confirm requirements with the responsible authority before applying.', 'Varies by responsible authority.', 'certificates', 60),
  ('Online Form Assistance', 'online-form', 'Assistance entering information in online application forms.', 'Get help understanding fields and submitting a form to the organization that operates it.', 'Requirements depend on the organization and form.', 'Bring the form instructions and the documents it asks for.', 'Depends on the form and receiving organization.', 'online-forms', 70),
  ('Printing & Scanning', 'printing', 'Printing, scanning and document-copy assistance.', 'Local help preparing digital or paper copies of documents.', 'No eligibility requirement.', 'Ask the centre to confirm current availability and price.', 'Usually while you wait; subject to availability.', 'print-digital', 80),
  ('Other Digital Services', 'other-services', 'Ask about an online task not listed here.', 'Contact the centre to confirm whether assistance is available before sharing documents.', 'Depends on the requested task.', 'The centre will confirm availability, requirements and the fee before work begins.', 'Confirmed after review.', 'online-forms', 90)
) as seed(title, slug, short_description, description, eligibility, instructions, processing_time, category_slug, sort_order)
join public.service_categories c on c.slug = seed.category_slug
on conflict (slug) do nothing;

insert into public.application_forms (service_id, title, fields, is_active)
select s.id, 'Application details', '[]'::jsonb, true
from public.services s
where s.slug in (
  'aadhaar-update', 'pan-card', 'ration-card', 'income-certificate',
  'caste-certificate', 'residential-certificate', 'online-form',
  'printing', 'other-services'
)
on conflict (service_id) do nothing;

insert into public.faqs (question, answer, sort_order, is_published)
values
  ('Is EKTAB COMPUTER a government office?', 'No. EKTAB COMPUTER is an independent service centre and is not a government portal or issuing authority. Government decisions are made by the responsible authority.', 10, true),
  ('How much does a service cost?', 'The centre will confirm its service fee before starting. Any government or authority fee is separate and depends on the service.', 20, true),
  ('How can I check an application?', 'Sign in using the verified contact method attached to the application, then enter your reference number on the tracking page.', 30, true),
  ('Is an uploaded payment receipt proof that payment was accepted?', 'No. An uploaded receipt or UPI reference is not confirmation of payment. Staff must verify payment separately.', 40, true)
on conflict do nothing;
