import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "System Design Prep - Ace the System Design Interview",
    template: "%s | System Design Prep",
  },
  description:
    "Every core system design concept, 28 classic interview case studies with rapid MVP implementation guides, a back-of-envelope calculator, flashcards, and a step-by-step interview framework.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-screen flex-col">
        <Nav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
