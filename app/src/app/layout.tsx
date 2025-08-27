import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";

const geistSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  fallback: ["system-ui", "arial"],
});

const geistMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  title: "BlueFX AI - AI Media Machine",
  description: "Create professional videos, images, music and content with BlueFX AI. The ultimate AI media creation platform for content creators, marketers and businesses.",
  keywords: "AI video generator, AI image generator, AI music maker, content creation, video editing, thumbnail maker, logo generator",
  authors: [{ name: "BlueFX" }],
  creator: "BlueFX",
  publisher: "BlueFX",
  robots: "index, follow",
  icons: {
    icon: [
      { url: '/bluefx.svg', type: 'image/svg+xml' },
      { url: '/BLUEFX-LOGO-new.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: '/BLUEFX-LOGO-new.png',
    shortcut: '/bluefx.svg',
  },
  openGraph: {
    title: "BlueFX AI - AI Media Machine",
    description: "Create professional videos, images, music and content with BlueFX AI",
    type: "website",
    locale: "en_US",
    siteName: "BlueFX AI",
    images: ['/BLUEFX-LOGO-new.png'],
  },
  twitter: {
    card: "summary_large_image",
    title: "BlueFX AI - AI Media Machine",
    description: "Create professional videos, images, music and content with BlueFX AI",
    images: ['/BLUEFX-LOGO-new.png'],
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* FastSpring Script */}
        <script 
          id="fsc-api" 
          src="https://d1f8f9xcsvx3ha.cloudfront.net/sbl/0.8.5/fastspring-builder.min.js" 
          type="text/javascript" 
          data-storefront="bluefx.onfastspring.com"
          async
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            {children}
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
