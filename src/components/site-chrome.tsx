import PlausibleProvider from "next-plausible";

import "./globals.css";
import { Logo } from "@/components/logo/logo";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { SITE_THEME_STORAGE_KEY } from "@/lib/site-theme";
import Link from "next/link";

/* LINE 24 IS THE SITE LOGO */

const themeInitializationScript = `
  (function () {
    var root = document.documentElement;
    try {
      var theme = window.localStorage.getItem(${JSON.stringify(SITE_THEME_STORAGE_KEY)});
      var isDark = theme === "dark";
      root.classList.toggle("dark", isDark);
      root.style.colorScheme = isDark ? "dark" : "light";
    } catch (error) {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
  })();
`;

export default function SiteChrome({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <PlausibleProvider domain="http://aaronwriight.vercel.app">
      <html lang="en" className="scroll-smooth" suppressHydrationWarning>
        <body className="min-h-screen bg-white font-serif text-sm dark:bg-stone-950 dark:text-stone-400">
          <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
          <div className="flex min-h-screen flex-col gap-4">
            <header className="container m-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-2 px-6 py-10 md:pt-20">
              <div className="flex flex-col">
                <span className="font-serif text-sm lowercase tracking-widest">
                  aaron wright
                </span>
                <span className="text-xs font-serif text-stone-500 lowercase tracking-wider mt-1">
                  cognitive scientist, artist
                </span>
              </div>
              <Logo />
            </header>

            {children}

            <footer className="container mx-auto flex px-6 justify-between gap-4 py-20 text-stone-500">
              <div className="flex items-center gap-3">
                <Link href="/about" className="text-stone-500">
                  wiki
                </Link>
                <ThemeToggle />
              </div>
              <span>© {new Date().getFullYear()} Aaron Wright</span>
            </footer>
          </div>
        </body>
      </html>
    </PlausibleProvider>
  );
}

// import { GeistSans } from "geist/font/sans";
// import { GeistMono } from "geist/font/mono";
// import PlausibleProvider from "next-plausible";

// import "./globals.css";
// import { Logo } from "@/components/logo/logo";
// import Link from "next/link";

// /* LINE 24 IS THE SITE LOGO */

// export default   function SiteChrome({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {

//   return (
//     <PlausibleProvider domain="http://frameitwrightphotography.vercel.app">
//       <html lang="en" className="scroll-smooth">
//         <body
//           className={`${GeistSans.variable} ${GeistMono.variable} bg-stone min-h-screen font-sans text-sm dark:bg-stone-950 dark:text-stone-400`}
//         >
//           <div className="flex min-h-screen flex-col gap-4">
//             <header className="container m-auto flex items-center justify-between gap-4 px-6 py-10 md:pt-20">
//               <Link
//                 href="/"
//                 className="font-mono text-sm lowercase tracking-widest "
//               >
//                 frame it wright photography
//               </Link>
//               <Logo />
//             </header>

//             {children}

//             <footer className="container mx-auto flex  px-6 justify-between gap-4 py-20 text-stone-500">
//               <Link href="/about" className="text-stone-500">
//                 about
//               </Link>{" "}
//               <span>© {new Date().getFullYear()} Aaron Wright</span>
//             </footer>
//           </div>
//         </body>
//       </html>
//     </PlausibleProvider>
//   );
// }
