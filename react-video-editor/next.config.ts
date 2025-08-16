import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	reactStrictMode: false,
	output: "standalone",
	eslint: {
		// Disable ESLint during builds for deployment
		ignoreDuringBuilds: true,
	},
	typescript: {
		// Enable builds even with TypeScript errors (for deployment)
		ignoreBuildErrors: true,
	},
};

export default nextConfig;
