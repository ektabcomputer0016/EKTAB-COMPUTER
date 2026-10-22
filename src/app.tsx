import { lazy, Suspense, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  AboutPage, ApplyPage, ContactPage, FAQPage, HomePage, LegalPage,
  ServiceDetailPage, ServicesPage, TrackPage,
} from '@/features/Portal';

const StaffProvider = lazy(() =>
  import('@/features/Admin').then((module) => ({ default: module.StaffProvider })),
);
const AdminDashboardPage = lazy(() =>
  import('@/features/Admin').then((module) => ({ default: module.AdminDashboardPage })),
);
const AdminServicesPage = lazy(() =>
  import('@/features/Admin').then((module) => ({ default: module.AdminServicesPage })),
);
const AdminApplicationsPage = lazy(() =>
  import('@/features/Admin').then((module) => ({ default: module.AdminApplicationsPage })),
);
const AdminSettingsPage = lazy(() =>
  import('@/features/Admin').then((module) => ({ default: module.AdminSettingsPage })),
);

const queryClient = new QueryClient();
function RouteMeta() {
  const [path] = useLocation();
  useEffect(() => {
    const slug = path.split('/').filter(Boolean).at(-1)?.replace(/-/g, ' ') || '';
    const named: Record<string, [string,string]> = {
      '/': ['Local forms, less overwhelming', 'Independent help with document and online-form services. Understand the process before you begin.'],
      '/services': ['Services', 'Search the live service catalogue, compare published fees and review requirements.'],
      '/track': ['Track an application', 'Verify your account to view the private customer-facing status of an application.'],
      '/about': ['About EKTAB COMPUTER', 'Learn about this independent digital service centre in Bihar.'],
      '/contact': ['Contact EKTAB COMPUTER', 'Find verified contact information configured by the service centre.'],
      '/faq': ['Frequently asked questions', 'Read answers published by EKTAB COMPUTER about applications, privacy and payments.'],
      '/privacy': ['Privacy notice', 'How authenticated application data and private documents are processed.'],
      '/terms': ['Terms of service', 'Terms for using independent digital application support.'],
      '/admin': ['Staff sign in and dashboard', 'Secure staff workspace for EKTAB COMPUTER.'],
      '/admin/services': ['Manage services', 'Manage EKTAB COMPUTER published services, forms and ordering.'],
      '/admin/applications': ['Manage applications', 'Review applications, private notes, documents and payment references.'],
      '/admin/settings': ['Website settings', 'Manage owner-configured business details, FAQs, announcements and payment options.'],
    };
    const [title, description] = named[path] || (path.startsWith('/apply/')
      ? [`Apply · ${slug}`, `Securely apply for ${slug} with a verified account.`]
      : path.startsWith('/services/')
        ? [`${slug} · Service details`, `Published details, fee and requirements for ${slug}.`]
        : ['Page not found', 'The requested EKTAB COMPUTER page could not be found.']);
    document.title = `${title} | EKTAB COMPUTER`;
    const updateMeta = (selector: string, attr: string, value: string) => {
      let node = document.querySelector(selector);
      if (!node) { node = document.createElement('meta'); document.head.appendChild(node); }
      node.setAttribute(attr, value);
    };
    updateMeta('meta[name="description"]', 'name', 'description');
    updateMeta('meta[name="description"]', 'content', description);
    updateMeta('meta[property="og:title"]', 'property', 'og:title');
    updateMeta('meta[property="og:title"]', 'content', `${title} | EKTAB COMPUTER`);
    updateMeta('meta[property="og:description"]', 'property', 'og:description');
    updateMeta('meta[property="og:description"]', 'content', description);
  }, [path]);
  return null;
}
function SlugService() { const { slug = '' } = useParams<{ slug: string }>(); return <ServiceDetailPage slug={slug}/>; }
function SlugApply() { const { slug = '' } = useParams<{ slug: string }>(); return <ApplyPage slug={slug}/>; }
function AdminOverview() { return <StaffProvider><AdminDashboardPage/></StaffProvider>; }
function AdminServices() { return <StaffProvider><AdminServicesPage/></StaffProvider>; }
function AdminApplications() { return <StaffProvider><AdminApplicationsPage/></StaffProvider>; }
function AdminSettings() { return <StaffProvider><AdminSettingsPage/></StaffProvider>; }
function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><RouteMeta/><Switch>
    <Route path="/" component={HomePage}/>
    <Route path="/services" component={ServicesPage}/>
    <Route path="/services/:slug" component={SlugService}/>
    <Route path="/apply/:slug" component={SlugApply}/>
    <Route path="/track" component={TrackPage}/>
    <Route path="/about" component={AboutPage}/>
    <Route path="/contact" component={ContactPage}/>
    <Route path="/faq" component={FAQPage}/>
    <Route path="/privacy" component={()=><LegalPage/>}/>
    <Route path="/terms" component={()=><LegalPage terms/>}/>
    <Route path="/admin" component={AdminOverview}/>
    <Route path="/admin/services" component={AdminServices}/>
    <Route path="/admin/applications" component={AdminApplications}/>
    <Route path="/admin/settings" component={AdminSettings}/>
    <Route component={NotFound}/>
  </Switch></ErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Suspense fallback={<div className="min-h-dvh p-8 text-sm text-muted-foreground" role="status">Loading secure workspace…</div>}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router/></WouterRouter></Suspense><Toaster/></TooltipProvider></QueryClientProvider>;
}
export default App;
