import type { Metadata } from "next";
import { Outfit, Readex_Pro } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const readex = Readex_Pro({
  variable: "--font-readex",
  subsets: ["latin", "arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Radd — Clinic AI Messaging",
  description:
    "AI receptionist for clinics: unified WhatsApp inbox, knowledge base, and appointment scheduling.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${outfit.variable} ${readex.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
