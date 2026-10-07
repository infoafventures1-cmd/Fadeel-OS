import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { APP_NAME } from "@/config";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Fadeel's personal command center for work, academics, business and life.",
  icons: { icon: "/mark.svg" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`h-full ${bricolage.variable} ${inter.variable} ${instrument.variable} ${jetbrains.variable}`}
    >
      <body className="min-h-full font-sans antialiased">
        <div className="noise-overlay" />
        {children}
      </body>
    </html>
  );
}
