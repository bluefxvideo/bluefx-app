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
		const remotionServerUrl = process.env.REMOTION_SERVER_URL || "http://localhost:3000";
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

		// When render is completed, upload to Supabase via store-export using internal URL
		if (statusData.status === 'completed' && videoUrl) {
			const { searchParams } = new URL(request.url);
			const scriptVideoId = searchParams.get('videoId');
			const userId = searchParams.get('userId');
			const apiUrl = searchParams.get('apiUrl') || process.env.NEXT_PUBLIC_MAIN_APP_URL;

			if (scriptVideoId && userId && apiUrl) {
				const internalVideoUrl = buildInternalUrl(videoUrl);
				console.log(`📤 Storing video to Supabase via internal URL: ${internalVideoUrl}`);

				try {
					const storeResponse = await fetch(`${apiUrl}/api/script-video/store-export`, {
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
						videoUrl = storeResult.video_url; // Use Supabase URL!
						console.log(`✅ Video stored to Supabase: ${videoUrl}`);
					} else {
						const errorText = await storeResponse.text();
						console.error(`❌ Store-export failed: ${storeResponse.status} - ${errorText}`);
						videoUrl = buildProxyUrl(videoUrl);
					}
				} catch (e) {
					console.error('❌ Failed to store to Supabase:', e);
					videoUrl = buildProxyUrl(videoUrl);
				}
			} else {
				console.warn('⚠️ Missing videoId, userId, or apiUrl - using download proxy');
				videoUrl = buildProxyUrl(videoUrl);
			}
		} else if (videoUrl && videoUrl.startsWith('/')) {
			// Not completed yet, use proxy URL for any intermediate needs
			videoUrl = buildProxyUrl(videoUrl);
			console.log(`🔗 Converted URL (pending): ${videoUrl}`);
		}

		const editorResponse = {
			video: {
				id: id,
				status: statusData.status === 'completed' ? 'COMPLETED' :
				        statusData.status === 'failed' ? 'FAILED' : 'PENDING',
				progress: Math.round((statusData.progress || 0) * 100),
				url: videoUrl
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