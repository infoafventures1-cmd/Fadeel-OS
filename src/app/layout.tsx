import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { APP_NAME } from "@/config";
import { OfflineSupport } from "@/components/layout/offline";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Fadeel's personal command center for work, academics, business and life.",
  icons: { icon: "/mark.svg", apple: "/apple-touch-icon.png" },
  robots: { index: false, follow: false },
  // Installed on an iPhone home screen it opens full screen, named "Fadeel OS"
  appleWebApp: { capable: true, title: "Fadeel OS", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // stops iPhone zooming in each time a text box is tapped; pinch-zoom still works on iOS
  maximumScale: 1,
  // content runs edge to edge; the tab bar and buttons already pad for the home indicator
  viewportFit: "cover",
  themeColor: "#f3f0e8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`h-full ${bricolage.variable} ${inter.variable} ${instrument.variable} ${jetbrains.variable}`}
    >
      <body className="min-h-full font-sans antialiased">
        <div className="noise-overlay" />
        <OfflineSupport />
        {children}
      </body>
    </html>
  );
}
