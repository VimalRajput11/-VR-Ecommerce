import { connection } from "next/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getSiteSettings } from "@/server/queries/site";
import { MotionProvider } from "@/components/motion/Reveal";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  await connection(); // business details are editable at any time, so render per request
  const settings = await getSiteSettings();
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[300] focus:rounded focus:bg-ivory focus:px-4 focus:py-2">
        Skip to content
      </a>
      <MotionProvider>
        <Navbar businessName={settings.name} announcement={settings.homepage?.announcement || undefined} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer settings={settings} />
      </MotionProvider>
    </>
  );
}
