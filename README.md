# EKTAB COMPUTER

A responsive website and secure application portal for an independent digital service centre in Bihar, India. It includes a searchable service catalogue, individual service pages, verified customer applications and tracking, a staff workspace, private document storage, payment instructions, and owner-managed site content.

**EKTAB COMPUTER is not a government website, department, or issuing authority.** Application outcomes are decided by the relevant organization. The supplied service catalogue is a starting point; the owner must verify every service description, fee, document requirement, and availability before publication.

## Project contents

- `src/` — React + TypeScript user interface
- `functions/api/applications.ts` — Cloudflare Pages application endpoint with verified-user checks and server-side form validation
- `supabase/migrations/001_initial_schema.sql` — tables, constraints, role controls, RLS policies, private/public storage buckets, audit trail, and initial catalogue rows
- `public/_redirects` — SPA route fallback for Cloudflare Pages
- `wrangler.toml` — Cloudflare Pages project configuration
- `.env.example` — placeholders for public browser configuration
- `.github/workflows/deploy.yml` — build checks and optional deployment on pushes to `main`

## Requirements

- Node.js 20 or later
- npm (included with Node.js)
- A Supabase project
- A Cloudflare account for deployment

## Run locally

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the Supabase **project URL** and **publishable/anon key**. These are public client settings, not service-role credentials.
3. Install and run:

   ```sh
   npm ci
   npm run dev
   ```

4. Open the local address printed by Vite.

The public catalogue and customer data features stay unavailable until a working Supabase connection and the migration are in place. This is deliberate: the site does not use browser-local demo records.
The Vite development server also runs the same application-validation function for local requests, using the Supabase settings loaded from `.env.local`.

Useful checks:

```sh
npm run typecheck
npm run build
npm run preview
```

For the Replit workspace version, use:

```sh
pnpm --filter @workspace/ektab-computer run dev
pnpm --filter @workspace/ektab-computer run typecheck
pnpm --filter @workspace/ektab-computer run build
```

## Set up Supabase

1. Create a Supabase project and keep its database, authentication, and storage in the same project.
2. Open **SQL Editor** and run `supabase/migrations/001_initial_schema.sql` once.
3. In **Project Settings → API**, copy the project URL and publishable key (or legacy anon key) into `.env.local`. Never use `service_role` or a secret key in `VITE_` variables, frontend code, or GitHub.
4. In **Authentication → URL Configuration**, set the local development URL as a redirect URL. Add the final Cloudflare domain before enabling customer sign-in there.
5. Enable the email OTP/magic-link provider. If you want phone verification, enable phone OTP and configure an SMS provider in Supabase. Phone sign-in requires an international number (for example, `+91…`).
6. Set authentication email templates and rate limits before launch. Confirm email/phone verification is required.
7. Create the owner's staff account through the Supabase Auth console and verify it. Then run this query in the Supabase SQL Editor, replacing the example email with the one verified account:

   ```sql
   update public.profiles p
      set role = 'admin', is_active = true
     from auth.users u
    where p.id = u.id
      and lower(u.email) = lower('owner@example.com')
      and u.email_confirmed_at is not null;
   ```

   The signup trigger only creates a `customer` profile. It never grants administrator access. Do not promote an account you have not verified yourself.
8. Sign in at `/admin`. The database's `is_staff()` check and row-level security policies protect staff operations; a hidden route or frontend check is not treated as authorization.
9. Review the initial catalogue rows. The included services come from the supplied brief, but current local availability, exact requirements, and prices were not supplied. Confirm them with the business before publishing or accepting applications.
10. Add the actual address, phone, WhatsApp, email, hours, business name, policies, fees, and service-specific form fields from the admin workspace.

### Storage and privacy

- `application-documents` is a **private** bucket limited to PDF, JPEG, and PNG files up to 10 MB each. Customer objects are placed in their own application folder. The private bucket has no public-read policy.
- `site-assets` is a **public** bucket for non-sensitive branding and payment QR images. Never upload identity documents or receipts to it.
- Customer status access uses Supabase Auth plus row-level security. A reference number alone does not reveal an application.
- Internal staff notes are stored separately from customer-readable application rows.
- Only the owner should decide the retention period for application data and documents and update the Privacy notice to match actual business practice.

## Cloudflare Pages deployment

## Upload the project to GitHub

1. Download and extract `ektab-computer.zip`.
2. Create an empty GitHub repository for the site.
3. In the extracted project folder, make sure `.env.local`, `node_modules`, and `dist` are not included. The provided `.gitignore` excludes them.
4. Push the project files:

   ```sh
   git init
   git add .
   git commit -m "Add EKTAB COMPUTER website"
   git branch -M main
   git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
   git push -u origin main
   ```

   Replace the example GitHub repository URL with the repository you created. Keep the `.github/workflows` directory at the repository root so Actions can run.
5. In GitHub repository **Settings → Secrets and variables → Actions**, add the build variables and Cloudflare credentials listed below.

### Direct CLI deployment

1. Create a Cloudflare Pages project named `ektab-computer`.
2. From this project directory, install dependencies and build:

   ```sh
   npm ci
   npm run typecheck
   npm run build
   ```

3. Set these **build-time variables** in Cloudflare Pages project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. In **Settings → Variables and Secrets**, set these **runtime values for Pages Functions**:
   - `SUPABASE_URL` — same project URL
   - `SUPABASE_ANON_KEY` — same publishable/anon key; the function uses the customer's verified access token and database RLS, not a service-role key
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the build before every deploy, then deploy:

   ```sh
   npx wrangler login
   npm run deploy
   ```

   `wrangler.toml` points Pages at `dist/public`; Pages Functions are discovered from the project-root `functions/` directory.
6. Add the final `*.pages.dev` domain (and any custom domain) to Supabase Auth's allowed redirect URLs and Site URL.
7. For a custom domain, add it under **Cloudflare Pages → Custom domains**, follow Cloudflare's DNS instructions, then update Supabase's allowed redirect URLs.

The client-side Supabase URL and publishable key are visible to website visitors by design. Row-level security—not secrecy of that key—limits access. Do not put Supabase database passwords, service-role keys, Cloudflare tokens, or other secrets in browser variables.

### GitHub Actions deployment

The included workflow builds and type-checks pull requests. On a push to `main`, it deploys the built Pages site if deployment credentials are configured.

In GitHub repository settings:

- Add Actions variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for build-time public configuration.
- Add Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- Add the corresponding Supabase runtime variables/secrets to Cloudflare Pages project settings; they are not embedded into the GitHub bundle.
- Push to `main` or run **Build and deploy → Run workflow**.

The GitHub deployment action uses Wrangler to deploy the static output and Pages Functions. If you prefer Cloudflare's Git connection, use the repository root `artifacts/ektab-computer`, build command `npm run build`, and output directory `dist/public`; keep Functions environment variables configured in Cloudflare.

## Payments

The admin workspace can store an owner-managed UPI ID/link or an uploaded QR image. Only `upi://pay` links are accepted by the database constraint. After an application is created, a customer can submit a payment reference and optionally upload a receipt into the same private document area. References remain pending until staff verify them; a QR code or customer-uploaded receipt is **not** payment confirmation. A staff member must verify payment through their authorized process; the app does not claim to receive or settle funds.

## Security notes

- No service-role key is needed by the browser or application endpoint.
- The application endpoint requires a verified Supabase session, validates the active service form, and submits through a narrowly scoped database function.
- The database function rechecks identity, verified contact, service publication, form fields, and allowed values.
- Customer application records are scoped by `auth.uid()`. Staff access depends on an independently granted `profiles.role` and `is_active`.
- Staff notes and customer-facing status messages are separate.
- Documents use private Supabase Storage policies and short-lived signed links for authorized staff review.
- Supabase Auth applies OTP rate limits; the database submission functions also limit each authenticated account to five applications and ten payment references per hour.
- Set a retention and deletion process before collecting real documents. Do not add personal information to application logs or analytics.

## Known external setup and checks

- A Supabase project, email/SMS provider settings, verified initial administrator, Cloudflare Pages project, domain, and real business details must be supplied by the owner.
- The sample service catalogue and informational/legal copy need review against the business's actual practices and local requirements.
- No live submission, private storage, OTP delivery, admin account, QR payment, production Cloudflare deployment, or authorization policy has been tested against a user-owned Supabase/Cloudflare account in this project.
- The production build and TypeScript checks should be run with the commands above after configuration.
