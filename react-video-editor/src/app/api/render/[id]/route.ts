import { NextResponse } from "next/server";

// Render IDs whose finished video we've already reported to the main app.
// In-memory dedup so repeated status polls after completion don't re-upload
// the file / re-deduct credits (process-local; a restart re-firing once is
// harmless because the main app just overwrites the same record).
const storedExports = new Set<string>();

/**
 * Write the finished render back to the main app so the video lands in the
 * user's history/library (script_to_video_history.video_url). Without this
 * call the export "succeeds" (user gets the file) but the record stays a
 * draft forever and never shows in My Library.
 */
async function reportExportToMainApp(opts: {
	renderId: string;
	videoUrl: string;
	scriptVideoId: string;
	userId: string;
	apiUrlFallback: string | null;
}) {
	const { renderId, videoUrl, scriptVideoId, userId, apiUrlFallback } = opts;
	if (storedExports.has(renderId)) return;

	const internalApiKey = process.env.INTERNAL_API_KEY;
	// Prefer the in-cluster URL (container-to-container); fall back to the
	// public URL the browser passed along.
	const mainAppUrl = process.env.NEXT_PUBLIC_MAIN_APP_URL || apiUrlFallback;
	if (!internalApiKey || !mainAppUrl) {
		console.warn('⚠️ store-export skipped: INTERNAL_API_KEY or main app URL missing');
		return;
	}

	try {
		const response = await fetch(`${mainAppUrl}/api/script-video/store-export`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': internalApiKey,
			},
			body: JSON.stringify({
				video_url: videoUrl,
				video_id: scriptVideoId,
				user_id: userId,
			}),
		});
		if (response.ok) {
			storedExports.add(renderId);
			console.log(`✅ Export stored in main app: video ${scriptVideoId} (render ${renderId})`);
		} else {
			console.error(`❌ store-export failed (${response.status}):`, await response.text());
		}
	} catch (error) {
		console.error('❌ store-export call error:', error);
	}
}

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
			// Write the finished video back to the main app's history record so
			// it shows up in My Library. Must run BEFORE proxying: store-export
			// downloads the file server-side, so it needs a Supabase URL or the
			// internal Remotion URL — not our browser-only /api/download proxy.
			const { searchParams } = new URL(request.url);
			const scriptVideoId = searchParams.get('videoId');
			const userIdParam = searchParams.get('userId');
			const apiUrlParam = searchParams.get('apiUrl');
			// The client interpolates raw values into the query string, so a
			// missing param arrives as the literal string "null"/"undefined".
			const isValid = (v: string | null): v is string => !!v && v !== 'null' && v !== 'undefined';
			if (isValid(scriptVideoId) && isValid(userIdParam)) {
				await reportExportToMainApp({
					renderId: id,
					videoUrl: videoUrl.startsWith('http') ? videoUrl : buildInternalUrl(videoUrl),
					scriptVideoId,
					userId: userIdParam,
					apiUrlFallback: isValid(apiUrlParam) ? apiUrlParam : null,
				});
			} else {
				console.warn(`⚠️ Completed render ${id} has no videoId/userId params — export not written to history`);
			}

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