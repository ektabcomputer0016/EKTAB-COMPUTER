import { createContext, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowDownRight, ArrowLeft, ArrowRight, BadgeCheck, BookOpen, Check, ChevronDown, CircleAlert, Clock3, FileCheck2, FileText, Headset, Info, LoaderCircle, LockKeyhole, MapPin, Search, ShieldCheck, Sparkles, Upload, X } from 'lucide-react';
import { ApplicationPaymentPanel } from '@/features/PaymentPanel';
import { supabase } from '@/lib/supabase';
import { buildUpiQrValue } from '@/lib/upi';
import {
  APPLICATION_STATUS_LABELS, createApplication, getApplicationForm, getCustomerApplication,
  getPublicAssetUrl, getPublicSettings, getServiceBySlug, listCategories, listPublicAnnouncements,
  listPublicFaqs, listPublicPaymentConfiguration, listPublicServices, sendVerificationCode,
  toSafeUiError, uploadApplicationDocuments, verifyPhoneCode,
} from '@/lib/portal';
import type { Announcement, ApplicationForm, CustomerApplication, FAQ, FormField, PaymentConfiguration, Service, ServiceCategory, WebsiteSettings } from '@/lib/types';

type Remote<T> = { data: T | null; loading: boolean; error: string; reload: () => void };
const SiteSettingsContext = createContext<Remote<WebsiteSettings> | null>(null);
function useRemote<T>(key: string, loader: () => Promise<T>, enabled = true): Remote<T> {
  const loaderRef = useRef(loader); loaderRef.current = loader;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    let live = true; setLoading(true); setError('');
    loaderRef.current().then(value => { if (live) setData(value); }).catch(err => { if (live) setError(toSafeUiError(err)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [key, version, enabled]);
  return { data, loading, error, reload: () => setVersion(v => v + 1) };
}

function Busy({ label = 'Loading securely' }: { label?: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground" role="status"><LoaderCircle className="animate-spin text-accent" size={19}/>{label}</div>;
}
function ErrorPanel({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-950 sm:flex-row sm:items-center sm:justify-between"><span className="flex items-start gap-2"><CircleAlert size={18} className="mt-0.5 shrink-0"/>{message}</span><button onClick={retry} className="rounded-full border border-red-300 px-4 py-2 font-bold">Try again</button></div>;
}
function Empty({ title, copy }: { title: string; copy: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card/70 p-7"><div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-secondary"><FileText size={20}/></div><h2 className="serif text-2xl">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p></div>;
}
function Notice({ title, children, kind = 'info' }: { title: string; children: ReactNode; kind?: 'info' | 'warning' }) {
  return <div role={kind === 'warning' ? 'alert' : 'status'} className={`flex gap-3 rounded-xl border p-4 ${kind === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-border bg-secondary/60 text-foreground'}`}><Info size={19} className="mt-0.5 shrink-0 text-accent"/><div><p className="font-semibold">{title}</p><div className="mt-1 text-sm leading-6 opacity-85">{children}</div></div></div>;
}
function Heading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="mb-9 max-w-2xl"><p className="eyebrow mb-3">{eyebrow}</p><h1 className="serif text-4xl leading-[1.05] tracking-tight md:text-5xl">{title}</h1><p className="mt-4 text-base leading-7 text-muted-foreground">{description}</p></div>;
}
function money(amount: number | null | undefined) {
  if (amount == null) return 'Fee not published';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
}

function BrandMark() {
  const path = useContext(SiteSettingsContext)?.data?.brand?.logo_path;
  const alt = useContext(SiteSettingsContext)?.data?.brand?.logo_alt || 'EKTAB COMPUTER logo';
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [path]);
  return path && !failed ? (
    <img
      src={getPublicAssetUrl(path)}
      alt={alt}
      onError={() => setFailed(true)}
      className="h-[42px] w-[42px] rounded-xl object-contain"
    />
  ) : (
    <span className="brand-mark">e.</span>
  );
}

function PublicHeader() {
  const [path] = useLocation(); const [open, setOpen] = useState(false);
  const nav = [['/services','Services'],['/track','Track application'],['/about','About'],['/contact','Contact']];
  return <header className="topbar sticky top-0 z-30"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 lg:px-8">
    <Link href="/" aria-label="EKTAB COMPUTER home" className="flex items-center gap-3"><BrandMark/><span className="leading-tight"><strong className="block text-[15px] tracking-tight">EKTAB COMPUTER</strong><small className="text-[10px] uppercase tracking-[.18em] text-muted-foreground">Independent digital help</small></span></Link>
    <nav aria-label="Main navigation" className="hidden items-center gap-8 md:flex">{nav.map(([href,label])=><Link key={href} href={href} className={`nav-link text-sm font-semibold ${path===href?'active':''}`}>{label}</Link>)}<Link href="/track" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-accent">Check a reference <ArrowRight size={15} className="ml-1 inline"/></Link></nav>
    <button aria-label={open?'Close menu':'Open menu'} aria-expanded={open} onClick={()=>setOpen(!open)} className="rounded-lg border p-2 md:hidden">{open?<X size={20}/>:<span className="text-lg">Menu</span>}</button>
  </div>{open&&<nav aria-label="Mobile navigation" className="border-t bg-background px-5 py-3 md:hidden">{nav.map(([href,label])=><Link key={href} href={href} onClick={()=>setOpen(false)} className="block border-b border-border/60 py-3 text-sm font-semibold">{label}</Link>)}<Link href="/faq" onClick={()=>setOpen(false)} className="block py-3 text-sm font-semibold">FAQs</Link></nav>}</header>;
}
function Footer() {
  return <footer className="mt-24 border-t border-border bg-[#ede9df]"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
    <div><Link href="/" className="mb-4 flex items-center gap-3"><BrandMark/><strong>EKTAB COMPUTER</strong></Link><p className="max-w-sm text-sm leading-6 text-muted-foreground">A local, independent digital service centre. We help people understand forms and prepare applications. We are not a government office or authority.</p></div>
    <div><h2 className="mb-4 text-xs font-bold uppercase tracking-[.16em]">Explore</h2><div className="grid gap-3 text-sm"><Link href="/services">Services</Link><Link href="/track">Track an application</Link><Link href="/faq">FAQs</Link><Link href="/about">About</Link></div></div>
    <div><h2 className="mb-4 text-xs font-bold uppercase tracking-[.16em]">Important</h2><div className="grid gap-3 text-sm"><Link href="/privacy">Privacy notice</Link><Link href="/terms">Terms of service</Link><Link href="/contact">Contact</Link><Link href="/admin">Staff sign in</Link></div></div>
  </div><div className="border-t border-border/80 px-5 py-4 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} EKTAB COMPUTER · Independent assistance only</div></footer>;
}
function PublicTheme() {
  const state=useContext(SiteSettingsContext);
  useEffect(()=>{
    const theme=state?.data?.theme; if(!theme)return;
    const toHsl=(value:string):string=>{
      const raw=value.trim();
      if(/^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/.test(raw))return raw;
      const match=/^#?([a-f\d]{3}|[a-f\d]{6})$/i.exec(raw);if(!match)return '';
      const hex=match[1].length===3?match[1].split('').map(v=>v+v).join(''):match[1];
      const parts=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255);const max=Math.max(...parts);const min=Math.min(...parts);let h=0;let s=0;const l=(max+min)/2;
      if(max!==min){const d=max-min;s=l>.5?d/(2-max-min):d/(max+min);switch(max){case parts[0]:h=(parts[1]-parts[2])/d+(parts[1]<parts[2]?6:0);break;case parts[1]:h=(parts[2]-parts[0])/d+2;break;default:h=(parts[0]-parts[1])/d+4;}h/=6;}
      return `${Math.round(h*360)} ${Math.round(s*100)}% ${Math.round(l*100)}%`;
    };
    const root=document.documentElement;
    const primary=theme.primary?toHsl(theme.primary):'';const accent=theme.accent?toHsl(theme.accent):'';
    if(primary)root.style.setProperty('--primary',primary);if(accent)root.style.setProperty('--accent',accent);
    if(theme.font&&['DM Sans','Fraunces','system-ui'].includes(theme.font))root.style.setProperty('--app-font-sans',theme.font==='system-ui'?'system-ui, sans-serif':`'${theme.font}', sans-serif`);
    return ()=>{root.style.removeProperty('--primary');root.style.removeProperty('--accent');root.style.removeProperty('--app-font-sans')};
  },[state?.data?.theme]);
  return null;
}
function PublicShell({ children }: { children: ReactNode }) {
  const settings=useRemote<WebsiteSettings>('public-shell-settings',getPublicSettings);
  return <SiteSettingsContext.Provider value={settings}><div className="site-shell"><PublicTheme/><PublicHeader/><main>{children}</main><Footer/></div></SiteSettingsContext.Provider>;
}
function Feature({ icon, n, title, text }: { icon: ReactNode; n: string; title: string; text: string }) {
  return <article className="card-hover rounded-2xl border border-border bg-card p-6"><div className="mb-8 flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary">{icon}</span><span className="text-xs font-bold tracking-wider text-muted-foreground">{n}</span></div><h3 className="serif text-2xl">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></article>;
}

export function HomePage() {
  const settings = useRemote<WebsiteSettings>('public-settings', getPublicSettings);
  const announcements = useRemote<Announcement[]>('public-announcements', listPublicAnnouncements);
  const business = settings.data?.business;
  const homepage = settings.data?.homepage;
  return <PublicShell><section className="hero-grid relative overflow-hidden"><div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 md:grid-cols-[1.05fr_.95fr] md:py-24 lg:px-8">
    <div className="fade-up relative z-10"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-semibold"><span className="status-dot"/>Independent digital service centre</div>
      <h1 className="serif max-w-[700px] text-[clamp(3.5rem,8vw,6.4rem)] leading-[.94] tracking-[-.055em]">{homepage?.hero_title || <>Online forms,<br/><em className="font-medium text-accent">made human.</em></>}</h1>
      <p className="mt-7 max-w-lg text-lg leading-8 text-muted-foreground">{homepage?.hero_description || 'Not sure where to start? We help you understand local document and online-form services, one clear step at a time.'}</p>
      <div className="mt-8 flex flex-wrap gap-3"><Link href="/services" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground hover:bg-accent">Explore services <ArrowRight size={17}/></Link><Link href="/track" className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-6 py-3.5 text-sm font-bold">Track an application <ArrowDownRight size={17}/></Link></div>
      <p className="mt-6 max-w-md text-xs leading-5 text-muted-foreground">EKTAB COMPUTER is independent, not a government office. Fees and timelines are confirmed by the centre.</p>
    </div>
    <div className="relative mx-auto w-full max-w-[500px] py-6"><div className="hero-orbit absolute inset-0 rounded-full"/>{settings.data?.brand?.banner_path&&<img src={getPublicAssetUrl(settings.data.brand.banner_path)} alt="" className="absolute inset-0 h-full w-full rounded-full object-cover opacity-20"/>}<div className="relative mx-auto max-w-[380px] rotate-[1.5deg] rounded-[28px] border border-[#d9d1c0] bg-[#fffdf7] p-5 shadow-[0_32px_80px_rgba(60,53,41,.16)] md:p-7">
      <div className="flex items-center justify-between border-b border-dashed border-border pb-4"><div><div className="eyebrow">The simple way through</div><div className="mt-1 font-semibold">Your application, in steps</div></div><FileCheck2 className="text-accent" size={24}/></div>
      <ol className="mt-5 space-y-5">{[['01','Understand what you need','We explain the service and documents.'],['02','Prepare together','You review the details before anything is sent.'],['03','Keep your reference','Use it to request a private status update.']].map(([n,t,d])=><li key={n} className="flex gap-4"><span className="serif text-2xl text-accent">{n}</span><span><strong className="block text-sm">{t}</strong><small className="mt-1 block leading-5 text-muted-foreground">{d}</small></span></li>)}</ol>
      <div className="mt-6 rounded-xl bg-[#f2eee3] px-4 py-3 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mr-1 inline text-primary" size={15}/> Verified, private document submission.</div></div><div className="absolute -right-1 top-2 rounded-full border border-border bg-background p-3 shadow-md"><BookOpen size={22}/></div></div>
  </div></section>
  {announcements.loading ? <div className="mx-auto max-w-7xl px-5 pt-6"><Busy label="Checking centre announcements"/></div> : announcements.error ? <div className="mx-auto max-w-7xl px-5 pt-6"><ErrorPanel message={announcements.error} retry={announcements.reload}/></div> : announcements.data?.map(item=><div key={item.id} className="mx-auto mt-5 max-w-7xl px-5"><div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><strong>{item.title}</strong><p className="mt-1 text-sm">{item.message}</p></div></div>)}
  {homepage?.announcement&&<div className="mx-auto mt-5 max-w-7xl px-5"><div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">{homepage.announcement}</div></div>}
  <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8"><div className="flex flex-col justify-between gap-7 md:flex-row md:items-end"><div className="max-w-xl"><p className="eyebrow mb-3">A clearer starting point</p><h2 className="serif text-4xl leading-tight md:text-5xl">Help that starts<br/>with a conversation.</h2></div><p className="max-w-md text-sm leading-6 text-muted-foreground">See what a service involves before you apply. Published details come directly from the centre’s catalogue.</p></div><div className="mt-10 grid gap-4 md:grid-cols-3"><Feature icon={<Search size={21}/>} n="01 / Find" title="Know your options" text="Browse plain-language services and what each one asks for."/><Feature icon={<FileText size={21}/>} n="02 / Prepare" title="See what to bring" text="Understand eligibility, documents, steps and published fees."/><Feature icon={<BadgeCheck size={21}/>} n="03 / Follow" title="Keep in the loop" text="Use your verified account and reference for a private status update."/></div></section>
  <section className="mx-auto max-w-7xl px-5 lg:px-8"><div className="soft-panel grid gap-8 rounded-[28px] border border-border p-7 md:grid-cols-[1fr_auto] md:items-center md:p-11"><div><p className="eyebrow mb-3">Already applied?</p><h2 className="serif text-3xl md:text-4xl">Your reference is your key.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Sign in with the verified contact used for your application to view its customer-facing status.</p></div><Link href="/track" className="inline-flex w-fit items-center gap-2 rounded-full bg-accent px-5 py-3 font-bold text-white">Track an application <ArrowRight size={17}/></Link></div></section>
  <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8"><div className="grid gap-8 md:grid-cols-[.7fr_1.3fr]"><div><p className="eyebrow">A note on trust</p><h2 className="serif mt-3 text-4xl">Independent help.<br/>Clear boundaries.</h2></div><div className="grid gap-4 sm:grid-cols-2"><Notice title="Not a government office">We do not represent or speak for any government department.</Notice>{settings.loading?<Busy label="Loading owner-configured contact"/>:settings.error?<ErrorPanel message={settings.error} retry={settings.reload}/>:<Notice title="Contact the centre">{business?.phone || business?.email || business?.address ? <>{business.address}{business.phone && <p>Phone: {business.phone}</p>}{business.email && <p>Email: {business.email}</p>}</> : 'Contact information has not been configured yet.'}</Notice>}</div></div></section>
  </PublicShell>;
}

function ServiceCard({ service }: { service: Service }) {
  return <Link href={`/services/${service.slug}`} className="card-hover group block rounded-2xl border border-border bg-card p-5 md:p-6"><div className="flex items-start justify-between gap-4"><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{service.category?.name || 'Service'}</span><ArrowRight className="text-accent transition-transform group-hover:translate-x-1" size={19}/></div><h2 className="serif mt-6 text-2xl">{service.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{service.short_description || service.description}</p><div className="mt-6 flex items-center justify-between border-t border-border pt-4"><span className="text-sm font-bold">{service.discounted_price != null ? <><span className="text-accent">{money(service.discounted_price)}</span><span className="ml-2 text-xs font-normal text-muted-foreground line-through">{money(service.price_amount)}</span></> : money(service.price_amount)}</span><span className="text-xs font-semibold text-muted-foreground">View details</span></div></Link>;
}
export function ServicesPage() {
  const [search,setSearch]=useState(''); const [category,setCategory]=useState('all');
  const services=useRemote<Service[]>('public-services',listPublicServices);
  const categories=useRemote<ServiceCategory[]>('categories',listCategories);
  const filtered=useMemo(()=>services.data?.filter(s=>(category==='all'||s.category_id===category)&&`${s.title} ${s.short_description} ${s.description} ${s.category?.name}`.toLowerCase().includes(search.toLowerCase().trim()))??[],[services.data,category,search]);
  return <PublicShell><div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8"><Heading eyebrow="Service catalogue" title="Start with what you need." description="Browse published services, understand what to prepare and see the centre’s current fees before you apply."/>
    <div className="mb-8 grid gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-[1fr_auto]"><label className="relative block"><span className="sr-only">Search services</span><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search a service…" className="h-12 w-full rounded-xl border border-input bg-background pl-11 pr-4 text-sm"/></label><label className="relative"><span className="sr-only">Filter by category</span><select value={category} onChange={e=>setCategory(e.target.value)} className="h-12 min-w-48 appearance-none rounded-xl border border-input bg-background px-4 pr-10 text-sm"><option value="all">All categories</option>{categories.data?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"/></label></div>
    {categories.error&&<div className="mb-4"><ErrorPanel message={categories.error} retry={categories.reload}/></div>}
    {services.loading?<div className="grid gap-4 md:grid-cols-2"><Busy/><Busy/></div>:services.error?<ErrorPanel message={services.error} retry={services.reload}/>:!services.data?.length?<Empty title="No services published yet" copy="The centre has not published any services in the live catalogue. Please check back later."/ >:!filtered.length?<Empty title="No matching services" copy="Try a different word or choose another category."/>:<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{filtered.map(s=><ServiceCard key={s.id} service={s}/>)}</div>}
  </div></PublicShell>;
}

export function ServiceDetailPage({ slug }: { slug: string }) {
  const service=useRemote<Service|null>(`service-${slug}`,()=>getServiceBySlug(slug));
  const payments=useRemote<PaymentConfiguration[]>(`public-payments-${service.data?.id||'pending'}`,()=>service.data?listPublicPaymentConfiguration(service.data.id):Promise.resolve([]));
  const [qrErrors,setQrErrors]=useState<Record<string,boolean>>({});
  const servicePrice=service.data?.discounted_price??service.data?.price_amount??null;
  useEffect(()=>{
    if(!service.data)return;
    if(service.data.seo_title)document.title=`${service.data.seo_title} | EKTAB COMPUTER`;
    if(service.data.seo_description){
      let meta=document.querySelector('meta[name="description"]');
      if(!meta){meta=document.createElement('meta');meta.setAttribute('name','description');document.head.appendChild(meta);}
      meta.setAttribute('content',service.data.seo_description);
    }
  },[service.data]);
  return <PublicShell><div className="mx-auto max-w-6xl px-5 py-12 md:py-16"><Link href="/services" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft size={16}/> All services</Link>
    {service.loading?<Busy label="Loading published service"/>:service.error?<ErrorPanel message={service.error} retry={service.reload}/>:!service.data?<Empty title="Service not found" copy="This service is not currently published. Return to the live catalogue to view available services."/>:<>
      <div className="grid gap-10 md:grid-cols-[1fr_300px]"><div><p className="eyebrow">{service.data.category?.name||'Service details'}</p><h1 className="serif mt-3 text-4xl md:text-5xl">{service.data.title}</h1><p className="mt-5 text-lg leading-8 text-muted-foreground">{service.data.short_description}</p><div className="prose prose-slate mt-8 max-w-none"><p>{service.data.description}</p>{service.data.eligibility&&<><h2>Who can apply</h2><p>{service.data.eligibility}</p></>}{service.data.instructions&&<><h2>How it works</h2><p className="whitespace-pre-line">{service.data.instructions}</p></>}</div></div>
      <aside className="h-fit rounded-2xl border border-border bg-card p-6"><p className="eyebrow">Published fee</p><p className="serif mt-2 text-3xl">{service.data.discounted_price!=null?money(service.data.discounted_price):money(service.data.price_amount)}</p>{service.data.discounted_price!=null&&<p className="mt-1 text-sm text-muted-foreground line-through">{money(service.data.price_amount)}</p>}<div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Clock3 size={16}/>{service.data.processing_time||'Processing time not published'}</div><Link href={`/apply/${service.data.slug}`} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground hover:bg-accent">Apply for support <ArrowRight size={17}/></Link><p className="mt-3 text-xs leading-5 text-muted-foreground">Independent service assistance. External decisions and timelines are not guaranteed.</p></aside></div>
      <div className="mt-12 grid gap-6 md:grid-cols-2"><section className="rounded-2xl border border-border bg-card p-6"><h2 className="serif text-2xl">Documents to prepare</h2>{service.data.required_documents.length?<ul className="mt-4 space-y-3">{service.data.required_documents.map((d,i)=><li key={`${i}-${d}`} className="flex gap-3 text-sm"><Check size={17} className="mt-0.5 shrink-0 text-accent"/>{d}</li>)}</ul>:<p className="mt-3 text-sm text-muted-foreground">No document list has been published.</p>}</section>
       <section className="rounded-2xl border border-border bg-card p-6"><h2 className="serif text-2xl">Payment information</h2>{payments.loading?<div className="mt-4"><Busy label="Loading payment options"/></div>:payments.error?<div className="mt-4"><ErrorPanel message={payments.error} retry={payments.reload}/></div>:payments.data?.length?<div className="mt-4 space-y-5">{payments.data.map(p=><div key={p.id} className="border-t border-border pt-4"><h3 className="font-semibold">{p.display_name}</h3>{p.instructions&&<p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">{p.instructions}</p>}{p.upi_id&&<p className="mt-2 text-sm">UPI ID: <span className="font-mono">{p.upi_id}</span></p>}{p.upi_link&&<a href={buildUpiQrValue(p,servicePrice)??p.upi_link} rel="noreferrer" target="_blank" className="mt-2 inline-flex rounded-full border border-border px-4 py-2 text-sm font-semibold">Open UPI app</a>}{p.qr_image_path&&!qrErrors[p.id]&&<img src={getPublicAssetUrl(p.qr_image_path)} alt={`${p.display_name} payment QR code`} onError={()=>setQrErrors(old=>({...old,[p.id]:true}))} className="mt-4 h-48 w-48 rounded-xl border border-border bg-white object-contain p-2"/>}{!p.qr_image_path&&buildUpiQrValue(p,servicePrice)&&<div className="mt-4 inline-block rounded-xl border border-border bg-white p-3"><QRCodeSVG value={buildUpiQrValue(p,servicePrice)!} size={144} level="M" title={`${p.display_name} UPI QR`}/></div>}</div>)}</div>:<p className="mt-3 text-sm text-muted-foreground">No payment configuration has been published for this service.</p>}<Notice title="Payment status is not automatic">A transfer is not verified by this page. Keep your payment reference; the centre must explicitly verify it.</Notice></section></div>
    </>}
  </div></PublicShell>;
}

function useAuthSession() {
  const [session,setSession]=useState<any>(null);
  const [checking,setChecking]=useState(true);
  useEffect(()=>{
    if(!supabase){setChecking(false);return;}
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setChecking(false);}).catch(()=>setChecking(false));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);setChecking(false);});
    return ()=>subscription.unsubscribe();
  },[]);
  return {session,checking};
}
function SignInPanel({ contact, setContact, sent, setSent, code, setCode, busy, setBusy, message, setMessage }: {
  contact:string; setContact:(value:string)=>void; sent:boolean; setSent:(value:boolean)=>void;
  code:string; setCode:(value:string)=>void; busy:boolean; setBusy:(value:boolean)=>void;
  message:string; setMessage:(value:string)=>void;
}) {
  async function request(e:FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try { setMessage(await sendVerificationCode(contact)); setSent(!contact.includes('@')); }
    catch(err) { setMessage(toSafeUiError(err)); }
    finally { setBusy(false); }
  }
  async function verify(e:FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try { await verifyPhoneCode(contact,code); setMessage('Phone verified. Your secure session is ready.'); }
    catch(err) { setMessage(toSafeUiError(err)); }
    finally { setBusy(false); }
  }
  return <div className="rounded-2xl border border-border bg-card p-6">
    <h2 className="serif text-2xl">Verify it’s you</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Use the email address or phone number associated with your application. We’ll send a secure sign-in link or one-time phone code.</p>
    <form onSubmit={request} className="mt-5 flex flex-col gap-3 sm:flex-row"><label className="sr-only" htmlFor="identity-contact">Email or phone</label><input id="identity-contact" required value={contact} onChange={e=>setContact(e.target.value)} placeholder="Email or phone, e.g. +91…" className="h-12 flex-1 rounded-xl border border-input bg-background px-4 text-sm"/><button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">{busy?<LoaderCircle size={16} className="animate-spin"/>:<LockKeyhole size={16}/>} Send verification</button></form>
    {sent&&<form onSubmit={verify} className="mt-4 flex flex-col gap-3 sm:flex-row"><label className="sr-only" htmlFor="identity-code">Phone verification code</label><input id="identity-code" inputMode="numeric" required value={code} onChange={e=>setCode(e.target.value)} placeholder="One-time code" className="h-12 flex-1 rounded-xl border border-input bg-background px-4 text-sm"/><button disabled={busy} className="rounded-full border border-border px-5 py-3 text-sm font-bold disabled:opacity-60">Verify phone code</button></form>}
    {message&&<p role="status" className="mt-4 rounded-lg bg-secondary/70 p-3 text-sm leading-5">{message}</p>}
  </div>;
}
function FieldInput({ field, value, onChange }: { field:FormField; value:string|number|boolean|null; onChange:(next:string|number|boolean|null)=>void }) {
  const common={id:`field-${field.name}`,required:!!field.required,className:'mt-2 w-full rounded-xl border border-input bg-background px-4 text-sm'};
  if(field.type==='textarea') return <textarea {...common} rows={4} maxLength={field.maxLength} value={String(value??'')} onChange={e=>onChange(e.target.value)} />;
  if(field.type==='select') return <select {...common} value={String(value??'')} onChange={e=>onChange(e.target.value)}><option value="">Choose an option</option>{(field.options||[]).map(option=><option value={option} key={option}>{option}</option>)}</select>;
  if(field.type==='checkbox') return <input id={`field-${field.name}`} type="checkbox" required={!!field.required} checked={!!value} onChange={e=>onChange(e.target.checked)} className="mt-3 h-4 w-4 accent-[hsl(var(--accent))]"/>;
  return <input {...common} type={field.type} maxLength={field.maxLength} value={String(value??'')} onChange={e=>onChange(field.type==='number'&&e.target.value!==''?Number(e.target.value):e.target.value)} />;
}

export function ApplyPage({ slug }: { slug:string }) {
  const service=useRemote<Service|null>(`apply-service-${slug}`,()=>getServiceBySlug(slug));
  const formState=useRemote<ApplicationForm|null>(`apply-form-${service.data?.id||'pending'}`,()=>service.data?getApplicationForm(service.data.id):Promise.resolve(null));
  const {session,checking}=useAuthSession();
  const [name,setName]=useState(''); const [values,setValues]=useState<Record<string,string|number|boolean|null>>({});
  const [files,setFiles]=useState<File[]>([]); const [reference,setReference]=useState(''); const [applicationId,setApplicationId]=useState('');
  const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [message,setMessage]=useState('');
  const [contact,setContact]=useState(''); const [sent,setSent]=useState(false); const [code,setCode]=useState(''); const [authBusy,setAuthBusy]=useState(false);
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setMessage('');
    if(!session){setError('Verify your email or phone before submitting.');return;}
    if(!service.data||!formState.data){setError('The application form is unavailable.');return;}
    setBusy(true);
    try {
      const result=await createApplication(service.data.id,name,values);
      setApplicationId(result.id); setReference(result.reference);
      if(files.length) {
        try { const uploaded=await uploadApplicationDocuments(result.id,files); setMessage(`${uploaded.uploaded} private document${uploaded.uploaded===1?'':'s'} uploaded.`); setFiles([]); }
        catch(uploadErr) { setError(`Application ${result.reference} was submitted, but document upload failed: ${toSafeUiError(uploadErr)} If you retry, select only files that were not uploaded.`); }
      }
    } catch(err) {setError(toSafeUiError(err));}
    finally {setBusy(false);}
  }
  async function retryUpload(){
    if(!applicationId||!files.length)return;
    setBusy(true);setError('');
    try{const uploaded=await uploadApplicationDocuments(applicationId,files);setMessage(`${uploaded.uploaded} private document${uploaded.uploaded===1?'':'s'} uploaded.`);setFiles([])}
    catch(err){setError(`Upload did not complete: ${toSafeUiError(err)} If you retry, select only files that were not uploaded.`)}
    finally{setBusy(false)}
  }
  return <PublicShell><div className="mx-auto max-w-5xl px-5 py-12 md:py-16"><Link href={`/services/${slug}`} className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft size={16}/> Service details</Link>
    {service.loading?<Busy label="Loading service"/>:service.error?<ErrorPanel message={service.error} retry={service.reload}/>:!service.data?<Empty title="This service is not published" copy="Applications can only be started for currently published services."/>:<>
      <Heading eyebrow="Application support" title={reference?'Application received.':'Let’s prepare your application.'} description={reference?`Your reference is ${reference}. Keep it for status checks.`:`${service.data.title} · Complete the published form after verifying your contact details.`}/>
       {reference?<div className="max-w-2xl space-y-4"><div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-emerald-950"><Check size={22}/><h2 className="serif mt-2 text-2xl">Reference: {reference}</h2><p className="mt-2 text-sm">This reference was returned by the application service. Save it to track customer-facing updates.</p></div><ApplicationPaymentPanel applicationId={applicationId} serviceId={service.data.id} amount={service.data.discounted_price??service.data.price_amount}/>{message&&<Notice title="Documents uploaded">{message}</Notice>}{error&&<div className="space-y-3"><Notice kind="warning" title="Document upload needs attention">{error}</Notice><label className="block text-sm font-semibold">Select documents to retry<input type="file" accept="application/pdf,image/jpeg,image/png" multiple onChange={e=>setFiles(Array.from(e.currentTarget.files||[]))} className="mt-2 block w-full rounded-xl border border-input bg-background p-3 text-sm"/></label><button disabled={busy||!files.length} onClick={()=>void retryUpload()} className="rounded-full border border-border px-4 py-2 text-sm font-bold disabled:opacity-50">{busy?'Uploading…':'Retry document upload'}</button></div>}<Link href="/track" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground">Track your application <ArrowRight size={16}/></Link></div>
      :<div className="grid gap-10 md:grid-cols-[1fr_.7fr]"><div>
        {!checking&&!session&&<div className="mb-7"><SignInPanel contact={contact} setContact={setContact} sent={sent} setSent={setSent} code={code} setCode={setCode} busy={authBusy} setBusy={setAuthBusy} message={message} setMessage={setMessage}/></div>}
        {checking?<Busy label="Checking secure sign-in"/>:session?<Notice title="Secure session verified">Your account is signed in. Form information is sent only when you submit the application.</Notice>:null}
        {formState.loading?<div className="mt-6"><Busy label="Loading application form"/></div>:formState.error?<div className="mt-6"><ErrorPanel message={formState.error} retry={formState.reload}/></div>:!formState.data?<div className="mt-6"><Empty title="Application form unavailable" copy="The centre has not configured an active form for this service."/></div>:<form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6">
          <label className="block text-sm font-semibold">Applicant name<input required value={name} onChange={e=>setName(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4"/></label>
          <h2 className="serif pt-2 text-2xl">{formState.data.title}</h2>
          {formState.data.fields.map(field=><label key={field.name} className="block text-sm font-semibold">{field.label}{field.type==='checkbox'?<FieldInput field={field} value={values[field.name]??false} onChange={v=>setValues(prev=>({...prev,[field.name]:v}))}/>:<FieldInput field={field} value={values[field.name]??''} onChange={v=>setValues(prev=>({...prev,[field.name]:v}))}/>}</label>)}
          <label className="block text-sm font-semibold">Private documents (optional)<input type="file" accept="application/pdf,image/jpeg,image/png" multiple onChange={e=>setFiles(Array.from(e.currentTarget.files||[]))} className="mt-2 block w-full rounded-xl border border-input bg-background p-3 text-sm"/><small className="mt-1 block font-normal text-muted-foreground">PDF, JPEG or PNG · maximum 10 files · 10 MB each</small></label>
          {files.length>0&&<p className="text-xs text-muted-foreground">{files.map(f=>f.name).join(', ')}</p>}
          {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{error}</p>}
          <button disabled={!session||busy} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{busy?<LoaderCircle className="animate-spin" size={17}/>:<ArrowRight size={17}/>}Submit application</button>
          <p className="text-xs leading-5 text-muted-foreground">By submitting, you ask EKTAB COMPUTER to process your form data for this application. We are an independent service centre, not a government office.</p>
        </form>}
        </div><aside className="h-fit rounded-2xl border border-border bg-card p-6"><div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-secondary"><LockKeyhole size={21}/></div><h2 className="serif text-2xl">Your documents stay private</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Files are submitted to private storage after the application is created. Access remains subject to secure account permissions.</p><div className="mt-5 rounded-xl bg-secondary/70 p-4 text-xs leading-5 text-muted-foreground"><Upload className="mb-2 block text-primary" size={19}/>No public document links are displayed to customers.</div></aside></div>}
    </>}
  </div></PublicShell>;
}

export function TrackPage() {
  const {session,checking}=useAuthSession();
  const [contact,setContact]=useState(''); const [reference,setReference]=useState('');
  const [sent,setSent]=useState(false); const [code,setCode]=useState(''); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
  const [result,setResult]=useState<CustomerApplication|null|undefined>(undefined); const [error,setError]=useState('');
  async function lookup(e:FormEvent) {
    e.preventDefault();setError('');setBusy(true);setResult(undefined);
    try { if(!supabase)throw new Error('Secure sign-in is not configured.'); const {data}=await supabase.auth.getSession(); if(!data.session)throw new Error('Verify your email or phone before checking a private application.'); const app=await getCustomerApplication(reference); setResult(app); if(!app)setError('No application matched that reference for this signed-in account.'); }
    catch(err){setError(toSafeUiError(err));} finally{setBusy(false);}
  }
  return <PublicShell><div className="mx-auto max-w-5xl px-5 py-14 md:py-20"><div className="grid gap-12 md:grid-cols-[1fr_.9fr]"><div><Heading eyebrow="Application tracking" title="A small update can bring peace of mind." description="Sign in with the verified email or phone used for your application. Your status is retrieved through your private account permissions."/>
    {checking?<Busy label="Checking secure sign-in"/>:!session?<SignInPanel contact={contact} setContact={setContact} sent={sent} setSent={setSent} code={code} setCode={setCode} busy={busy} setBusy={setBusy} message={message} setMessage={setMessage}/>:<div className="rounded-2xl border border-border bg-card p-6"><p className="mb-4 text-sm text-muted-foreground">Verified account: {session.user.email||session.user.phone||'Signed in'}</p><form onSubmit={lookup} className="space-y-4"><label className="block text-sm font-semibold">Application reference<input required value={reference} onChange={e=>setReference(e.target.value)} placeholder="Reference from your confirmation" className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4"/></label>{error&&<p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{error}</p>}<button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 font-bold text-primary-foreground">{busy?<LoaderCircle size={17} className="animate-spin"/>:<Search size={17}/>}Check private status</button></form></div>}
     {result&&<><div className="mt-5 rounded-2xl border border-border bg-card p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">Verified application</p><h2 className="serif mt-2 text-2xl">{result.service?.title||'Application'}</h2><p className="mt-1 font-mono text-sm">{result.application_reference}</p></div><span className="status-pill"><span className="status-dot"/>{APPLICATION_STATUS_LABELS[result.status]||result.status}</span></div><p className="mt-4 leading-7">{result.customer_status_message||'No customer update has been published yet.'}</p><p className="mt-4 text-xs text-muted-foreground">Updated {new Date(result.updated_at).toLocaleString()}</p><p className="mt-4 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">Payment: {result.payment_state}. This status is not a payment confirmation unless staff explicitly verified it.</p></div><ApplicationPaymentPanel applicationId={result.id} serviceId={result.service_id} amount={result.service?.discounted_price??result.service?.price_amount??null}/></>}
  </div><aside className="h-fit rounded-[26px] bg-primary p-7 text-primary-foreground md:p-9"><ShieldCheck size={25} className="mb-7 text-[#f2b69f]"/><p className="eyebrow !text-[#f2b69f]">Private by design</p><h2 className="serif mt-3 text-3xl">Only your verified account can see your update.</h2><p className="mt-4 text-sm leading-6 text-primary-foreground/75">The reference alone is not enough. Status access is protected by your secure sign-in and the database’s access rules.</p></aside></div></div></PublicShell>;
}

export function AboutPage() {
  const state=useRemote<WebsiteSettings>('about-settings',getPublicSettings); const b=state.data?.business;
  return <PublicShell><div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8"><Heading eyebrow="Who we are" title="A neighbourly guide to digital paperwork." description="EKTAB COMPUTER is an independent digital service centre in Bihar. We help people make sense of local document and online-form services."/><div className="grid gap-12 md:grid-cols-[1.1fr_.9fr]"><div className="space-y-5 text-base leading-8 text-muted-foreground"><p>Online processes can be difficult to navigate. Our role is to explain steps in straightforward language and help prepare applications where a service is available.</p><p>We are not a government department, authority or representative. We cannot guarantee an external decision or outcome.</p></div><div className="space-y-4"><div className="rounded-2xl border border-border bg-card p-6"><Sparkles className="mb-4 text-accent"/><h2 className="serif text-2xl">Explain first</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Understand what you are applying for, what it costs and what you need before sharing details.</p></div><div className="rounded-2xl border border-border bg-card p-6"><ShieldCheck className="mb-4 text-primary"/><h2 className="serif text-2xl">Respect your information</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Applications and documents are handled using authenticated access and private storage.</p></div></div></div><div className="mt-12">{state.loading?<Busy/>:state.error?<ErrorPanel message={state.error} retry={state.reload}/>:<Notice title={b?.name||'Business details'}>{[b?.region,b?.address,b?.hours].filter(Boolean).join(' · ')||'The centre has not published its address or opening hours.'}</Notice>}</div></div></PublicShell>;
}
export function ContactPage() {
  const state=useRemote<WebsiteSettings>('contact-settings',getPublicSettings); const b=state.data?.business;
  return <PublicShell><div className="mx-auto max-w-6xl px-5 py-14 md:py-20"><Heading eyebrow="Get in touch" title="We’re here when you’re ready." description="Use the business contact details configured by the centre owner."/>
    {state.loading?<Busy/>:state.error?<ErrorPanel message={state.error} retry={state.reload}/>:<div className="grid gap-5 md:grid-cols-2"><section className="rounded-2xl border border-border bg-card p-7"><Headset size={22} className="text-accent"/><h2 className="serif mt-5 text-2xl">Talk to the centre</h2>{b?.phone&&<p className="mt-3 text-sm"><a href={`tel:${b.phone}`} className="underline">{b.phone}</a></p>}{b?.whatsapp&&<p className="mt-3 text-sm"><a href={`https://wa.me/${b.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="underline">WhatsApp the centre</a></p>}{b?.email&&<p className="mt-3 text-sm"><a href={`mailto:${b.email}`} className="underline">{b.email}</a></p>}{!b?.phone&&!b?.whatsapp&&!b?.email&&<p className="mt-3 text-sm leading-6 text-muted-foreground">Phone, email and messaging details have not been published.</p>}</section><section className="rounded-2xl border border-border bg-card p-7"><MapPin size={22} className="text-accent"/><h2 className="serif mt-5 text-2xl">Find the centre</h2><p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">{[b?.address,b?.region,b?.hours].filter(Boolean).join('\n')||'Town, address and opening hours will appear when published by the centre owner.'}</p></section></div>}
  </div></PublicShell>;
}
export function FAQPage() {
  const state=useRemote<FAQ[]>('public-faqs',listPublicFaqs);
  return <PublicShell><div className="mx-auto max-w-4xl px-5 py-14 md:py-20"><Heading eyebrow="Good to know" title="Questions, answered plainly." description="Answers published by the centre, along with essential service boundaries."/><div className="mb-5"><Notice title="Independent service centre">EKTAB COMPUTER is not a government office, department or representative.</Notice></div>{state.loading?<Busy/>:state.error?<ErrorPanel message={state.error} retry={state.reload}/>:state.data?.length?<div className="divide-y divide-border rounded-2xl border border-border bg-card px-5">{state.data.map((f,i)=><details key={f.id} className="group py-5" open={i===0}><summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-semibold"><span>{f.question}</span><ChevronDown className="shrink-0 transition-transform group-open:rotate-180" size={18}/></summary><p className="mt-3 max-w-3xl whitespace-pre-line pr-8 text-sm leading-6 text-muted-foreground">{f.answer}</p></details>)}</div>:<Empty title="No FAQs published yet" copy="The centre has not published any frequently asked questions."/ >}</div></PublicShell>;
}
export function LegalPage({ terms=false }: {terms?:boolean}) {
  return <PublicShell><article className="prose prose-slate mx-auto max-w-3xl px-5 py-14 md:py-20"><p className="eyebrow not-prose">{terms?'Using this website':'Your information'}</p><h1 className="serif !mb-5 !text-5xl">{terms?'Terms of service':'Privacy notice'}</h1>
    {terms?<><p>This website offers independent application support. EKTAB COMPUTER is not affiliated with, authorized by, or a representative of any government body. External outcomes and processing times are not guaranteed.</p><h2>Fees and payment</h2><p>Fees and instructions shown on a published service are configured by the centre. A transfer is never confirmed by this site. Staff must explicitly verify a submitted payment reference before its state is marked verified.</p><h2>Applications</h2><p>Submitting an application requires a verified Supabase session. Submission is processed by the configured application service. Keep your returned reference and use verified sign-in to see the customer-facing status. Service eligibility or external approval is not guaranteed.</p><h2>Contact and availability</h2><p>Services, payment options and contact details can change. Confirm information in the current published catalogue. This site’s availability depends on the secure service connection.</p></>:<><p>When you use the application and tracking features, personal data is processed through the configured Supabase authentication and database services to provide secure account access, submit an application and retrieve its status. The centre’s database access policies govern which information can be read.</p><h2>Authentication and applications</h2><p>Email sign-in links or phone one-time codes verify your account. Form values are sent to the application service with your authenticated session. The application record is associated with that account under database access rules.</p><h2>Private documents</h2><p>Documents you choose to submit are uploaded to private object storage and associated with your application. Authorized staff may access them for service processing. Staff document access uses short-lived signed URLs; do not share them. Documents are not made public by this website.</p><h2>Application status and staff notes</h2><p>Customers can retrieve only the customer-facing status returned under their authenticated permissions. Internal staff notes are separate from customer status and are not displayed to customers.</p><h2>Payment information</h2><p>Payment references and states may be processed for an application. A payment remains pending until a staff member explicitly verifies it. This site does not claim a transfer is successful based on user-provided evidence.</p><h2>Your choices</h2><p>Do not submit information unless you are comfortable sharing it for the service requested. For questions about retention, correction or deletion, contact the centre using its published contact details. Retention and lawful processing are controlled by the service operator.</p></>}</article></PublicShell>;
}
