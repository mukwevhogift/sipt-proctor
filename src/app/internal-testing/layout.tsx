import type { Metadata } from "next";
import { Roboto } from "next/font/google";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "Create Internal Testing Release - Google Play Console",
  description: "Internal testing releases are available to up to 100 testers that you choose",
};

export default function InternalTestingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Standalone layout — no Navbar/Toaster from root; this page has its own chrome
  return (
    <div className={`${roboto.variable} font-[var(--font-roboto),system-ui,sans-serif] bg-white text-[#202124] min-h-screen`}>
      {children}
    </div>
  );
}
