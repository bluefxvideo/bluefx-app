import { NextResponse } from "next/server";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;

		if (!id) {
			return NextResponse.json(
				{ message: "Render ID is required" },
				{ status: 400 },
			);
		}

		// Call your Remotion server progress endpoint
		const remotionServerUrl = process.env.REMOTION_SERVER_URL || "http://localhost:3001";
		const response = await fetch(`${remotionServerUrl}/progress/${id}`, {
			headers: {
				"X-API-Key": process.env.REMOTION_API_KEY || "default-key",
			},
		});

		if (!response.ok) {
			console.error(`❌ Failed to fetch render progress for ID: ${id}`);
			return NextResponse.json(
				{ message: "Failed to fetch export status" },
				{ status: response.status },
			);
		}

		const statusData = await response.json();
		console.log(`📊 Remotion progress for ${id}:`, statusData);

		// Get the relative video URL from Remotion
		let videoUrl = statusData.downloadUrl || statusData.outputUrl || statusData.url;

		// Helper: build internal Remotion URL (server-to-server, no SSL issues)
		const internalRemotionUrl = process.env.REMOTION_SERVER_URL || 'http://localhost:3001';
		const buildInternalUrl = (relativeUrl: string) =>
			relativeUrl.startsWith('/') ? `${internalRemotionUrl}${relativeUrl}` : relativeUrl;

		// Helper: build proxy download URL (client-safe, goes through our own domain)
		const buildProxyUrl = (relativeUrl: string) => {
			const internalUrl = buildInternalUrl(relativeUrl);
			return `/api/download?url=${encodeURIComponent(internalUrl)}&filename=${encodeURIComponent(id)}`;
		};

		// Remotion server now uploads to Supabase directly after render.
		// The downloadUrl in progress data will be a Supabase URL if upload succeeded,
		// or a /output/ relative URL as fallback.
		if (statusData.status === 'completed' && videoUrl) {
			// If it's already a Supabase URL, use it directly
			if (videoUrl.startsWith('http')) {
				// Already a full URL (Supabase) — use as-is
			} else {
				// Relative /output/ URL — proxy it
				videoUrl = buildProxyUrl(videoUrl);
			}
		} else if (videoUrl && videoUrl.startsWith('/')) {
			videoUrl = buildProxyUrl(videoUrl);
		}

		const editorResponse = {
			video: {
				id: id,
				status: statusData.status === 'completed' ? 'COMPLETED' :
				        statusData.status === 'failed' ? 'FAILED' : 'PENDING',
				progress: Math.round((statusData.progress || 0) * 100),
				url: videoUrl,
				...(statusData.error && { error: statusData.error })
			}
		};

		return NextResponse.json(editorResponse, { status: 200 });
	} catch (error) {
		console.error('❌ Progress API error:', error);
		return NextResponse.json(
			{ message: "Internal server error" },
			{ status: 500 },
		);
	}
}