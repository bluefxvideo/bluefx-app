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
		const remotionServerUrl = process.env.REMOTION_SERVER_URL || "http://localhost:3003";
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
		const internalRemotionUrl = process.env.REMOTION_SERVER_URL || 'http://remotion:3001';
		const buildInternalUrl = (relativeUrl: string) =>
			relativeUrl.startsWith('/') ? `${internalRemotionUrl}${relativeUrl}` : relativeUrl;

		// Helper: build proxy download URL (client-safe, goes through our own domain)
		const buildProxyUrl = (relativeUrl: string) => {
			const internalUrl = buildInternalUrl(relativeUrl);
			return `/api/download?url=${encodeURIComponent(internalUrl)}&filename=${encodeURIComponent(id)}`;
		};

		// When render is completed, upload to Supabase and return the Supabase URL
		// The progress stays at 99% during upload, but the Download button works instantly
		if (statusData.status === 'completed' && videoUrl) {
			const { searchParams } = new URL(request.url);
			const scriptVideoId = searchParams.get('videoId');
			const userId = searchParams.get('userId');
			// Prefer Docker internal URL for server-to-server calls (avoids DNS/SSL issues)
			const mainAppUrl = process.env.NEXT_PUBLIC_MAIN_APP_URL || searchParams.get('apiUrl');

			if (scriptVideoId && userId && mainAppUrl) {
				const internalVideoUrl = buildInternalUrl(videoUrl);
				console.log(`📤 Uploading video to Supabase via ${mainAppUrl}: ${internalVideoUrl}`);

				try {
					const storeResponse = await fetch(`${mainAppUrl}/api/script-video/store-export`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'x-api-key': process.env.INTERNAL_API_KEY || '',
						},
						body: JSON.stringify({
							video_url: internalVideoUrl,
							video_id: scriptVideoId,
							user_id: userId,
							batch_id: id,
						}),
					});

					if (storeResponse.ok) {
						const storeResult = await storeResponse.json();
						videoUrl = storeResult.video_url; // Supabase public URL — instant download
						console.log(`✅ Video stored to Supabase: ${videoUrl}`);
					} else {
						const errorBody = await storeResponse.text().catch(() => 'no body');
						console.error(`❌ Store-export failed: ${storeResponse.status} - ${errorBody}`);
						videoUrl = buildProxyUrl(videoUrl);
					}
				} catch (e) {
					console.error('❌ Failed to store to Supabase:', e);
					videoUrl = buildProxyUrl(videoUrl);
				}
			} else {
				console.warn(`⚠️ Missing params for store-export: videoId=${scriptVideoId}, userId=${userId}, mainAppUrl=${mainAppUrl}`);
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