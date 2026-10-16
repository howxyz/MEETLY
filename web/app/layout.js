// Fonts are bundled with the site (no call to Google): only the weights and scripts we use.
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-700.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-400.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-500.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-600.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-700.css";
import "./globals.css";
import "./landing.css";
import "./app.css";
import { Providers } from "@/lib/i18n";

export const metadata = {
  title: "Meetly — every meeting, on the record",
  description: "Meetly turns any meeting recording into minutes, sends them to everyone invited, and answers questions about it.",
};

// Sets language, direction and theme before the first paint (no flash). The studio is dark unless you pick light.
const boot = `try{var l=localStorage.getItem('lang');if(l!=='ar'&&l!=='en')l=(navigator.language||'').indexOf('ar')===0?'ar':'en';
document.documentElement.lang=l;document.documentElement.dir=l==='ar'?'rtl':'ltr';
var t=localStorage.getItem('theme');if(t!=='dark'&&t!=='light')t='dark';
document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr" data-theme="dark" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0a0a0a" />
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230A0A0A'/%3E%3Cg transform='translate(9.6 9.6) scale(.7)' fill='%23FF3B2F'%3E%3Crect x='6.5' y='10' width='7' height='44' rx='3.5'/%3E%3Crect x='17.5' y='10' width='7' height='22' rx='3.5'/%3E%3Crect x='28.5' y='10' width='7' height='32' rx='3.5' fill='%23F5F5F0'/%3E%3Crect x='39.5' y='10' width='7' height='22' rx='3.5'/%3E%3Crect x='50.5' y='10' width='7' height='44' rx='3.5'/%3E%3C/g%3E%3C/svg%3E" />
        <script dangerouslySetInnerHTML={{ __html: boot }} />
      </head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
