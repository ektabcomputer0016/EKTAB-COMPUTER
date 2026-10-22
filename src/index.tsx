@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap');
@import 'tailwindcss';
@import 'tw-animate-css';
@plugin "@tailwindcss/typography";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));
  --font-sans: var(--app-font-sans);
  --font-serif: var(--app-font-serif);
  --font-mono: var(--app-font-mono);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

:root {
  --background: 43 43% 96%;
  --foreground: 224 27% 17%;
  --border: 38 20% 84%;
  --input: 38 20% 84%;
  --card: 42 42% 99%;
  --card-foreground: 224 27% 17%;
  --popover: 42 42% 99%;
  --popover-foreground: 224 27% 17%;
  --primary: 224 35% 24%;
  --primary-foreground: 44 50% 96%;
  --secondary: 38 35% 89%;
  --secondary-foreground: 224 27% 17%;
  --muted: 42 23% 91%;
  --muted-foreground: 221 11% 43%;
  --accent: 17 74% 55%;
  --accent-foreground: 42 42% 99%;
  --destructive: 0 68% 48%;
  --destructive-foreground: 0 0% 100%;
  --ring: 17 74% 55%;
  --chart-1: 17 74% 55%;
  --chart-2: 160 32% 42%;
  --chart-3: 224 35% 24%;
  --chart-4: 42 75% 60%;
  --chart-5: 286 25% 54%;
  --sidebar: 224 35% 24%;
  --sidebar-foreground: 44 50% 96%;
  --sidebar-border: 224 24% 32%;
  --sidebar-primary: 17 74% 55%;
  --sidebar-primary-foreground: 42 42% 99%;
  --sidebar-accent: 224 28% 31%;
  --sidebar-accent-foreground: 44 50% 96%;
  --sidebar-ring: 17 74% 55%;
  --app-font-sans: 'DM Sans', sans-serif;
  --app-font-serif: 'Fraunces', Georgia, serif;
  --app-font-mono: 'DM Sans', monospace;
  --radius: 0.85rem;
  --button-outline: rgba(34, 43, 65, .12);
  --badge-outline: rgba(34, 43, 65, .08);
  --elevate-1: rgba(34, 43, 65, .035);
  --elevate-2: rgba(34, 43, 65, .07);
  --shadow: 0 16px 40px rgba(54, 47, 35, .08);
}
.dark {
  --background: 224 25% 13%;
  --foreground: 42 35% 93%;
  --border: 224 18% 29%;
  --input: 224 18% 29%;
  --card: 224 23% 17%;
  --card-foreground: 42 35% 93%;
  --popover: 224 23% 17%;
  --popover-foreground: 42 35% 93%;
  --primary: 42 35% 93%;
  --primary-foreground: 224 27% 17%;
  --secondary: 224 18% 24%;
  --secondary-foreground: 42 35% 93%;
  --muted: 224 18% 24%;
  --muted-foreground: 220 12% 68%;
  --accent: 17 74% 59%;
  --accent-foreground: 224 27% 17%;
  --destructive: 0 65% 53%;
  --destructive-foreground: 0 0% 100%;
  --ring: 17 74% 59%;
}
@layer base {
  * { @apply border-border; }
  body { @apply font-sans antialiased bg-background text-foreground; margin:0; }
  :focus-visible { outline: 3px solid hsl(var(--accent)); outline-offset: 3px; }
}

:root { font-synthesis: none; text-rendering: optimizeLegibility; }
html { scroll-behavior: smooth; }
body { min-width: 320px; }
.serif { font-family: var(--app-font-serif); }
.site-shell { min-height: 100dvh; }
.topbar { border-bottom: 1px solid hsl(var(--border)); background: hsl(var(--background) / .94); backdrop-filter: blur(14px); }
.brand-mark { display:grid; place-items:center; width:42px; height:42px; background:hsl(var(--accent)); color:#fff8e9; font-weight:700; letter-spacing:-.08em; border-radius:13px 13px 13px 4px; }
.nav-link { color: hsl(var(--foreground) / .77); transition: color .2s ease; }
.nav-link:hover, .nav-link.active { color:hsl(var(--accent)); }
.eyebrow { text-transform:uppercase; letter-spacing:.16em; font-size:.7rem; font-weight:700; color:hsl(var(--accent)); }
.hero-grid { background-image: linear-gradient(hsl(var(--foreground) / .04) 1px, transparent 1px), linear-gradient(90deg,hsl(var(--foreground) / .04) 1px,transparent 1px); background-size:42px 42px; }
.hero-orbit { background: radial-gradient(circle at 45% 46%, hsl(42 67% 88%), hsl(38 47% 83%) 47%, transparent 48%); }
.fade-up { animation: rise .55s both cubic-bezier(.2,.75,.25,1); }
@keyframes rise { from {opacity:0; transform:translateY(12px)} to {opacity:1; transform:translateY(0)} }
.card-hover { transition: transform .22s ease, box-shadow .22s ease; }
.card-hover:hover { transform:translateY(-3px); box-shadow:0 18px 38px rgba(54,47,35,.1); }
.soft-panel { background:linear-gradient(135deg,hsl(42 42% 99%),hsl(42 31% 93%)); }
.admin-shell { min-height:100dvh; background:hsl(43 35% 94%); }
.status-pill { display:inline-flex; align-items:center; gap:.45rem; border-radius:999px; padding:.35rem .7rem; background:hsl(var(--secondary)); font-size:.75rem; font-weight:600; }
.status-dot { width:7px; height:7px; border-radius:99px; background:hsl(160 32% 42%); }
@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration:.01ms !important; transition-duration:.01ms !important; scroll-behavior:auto !important; } }
