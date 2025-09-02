import { Geist_Mono, Geist } from "next/font/google";
// import { Toaster } from "@/components/ui/sonner"; // Commented out in JSX
import { baseUrl, createMetadata } from "@/utils/metadata";
import {
	StoreInitializer,
	BackgroundUploadRunner,
} from "@/components/store-initializer";
import { QueryProvider } from "@/components/query-provider";
import { Analytics } from "@vercel/analytics/react";
import { Outfit } from "next/font/google";

import "./globals.css";

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const geist = Geist({
	variable: "--font-geist",
	subsets: ["latin"],
	weight: ["300", "400", "500", "600", "700"],
});

const outfit = Outfit({
	variable: "--font-outfit",
	subsets: ["latin"],
	weight: ["300", "400", "500", "600", "700"],
});

export const metadata = createMetadata({
	title: {
		template: "%s | BlueFX Editor",
		default: "BlueFX Editor",
	},
	description: "Professional AI-powered video editor - Create stunning videos with BlueFX Editor.",
	metadataBase: baseUrl,
});

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body
				className={`${geistMono.variable} ${geist.variable} ${outfit.variable} antialiased dark font-sans bg-muted`}
			>
				<QueryProvider>
					{children}
					<StoreInitializer />
					<BackgroundUploadRunner />
					{/* <Toaster /> */}
				</QueryProvider>
				<Analytics />
			</body>
		</html>
	);
}
