import type { Metadata } from "next/types";

export function createMetadata(override: Metadata): Metadata {
	return {
		...override,
		openGraph: {
			title: override.title ?? undefined,
			description: override.description ?? undefined,
			url: "https://editor.bluefx.net",
			images: "/banner.png",
			siteName: "BlueFX Editor",
			...override.openGraph,
		},
		twitter: {
			card: "summary_large_image",
			creator: "@BlueFX",
			title: override.title ?? undefined,
			description: override.description ?? undefined,
			images: "/banner.png",
			...override.twitter,
		},
		icons: {
			icon: "/bluefx.svg",
		},
	};
}

export const baseUrl =
	process.env.NODE_ENV === "development"
		? new URL("http://localhost:3002")
		: new URL("https://editor.bluefx.net");
