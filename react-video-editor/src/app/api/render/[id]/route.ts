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
		
		// Transform response to match combo.sh format expected by the editor
		// Fix URL construction - convert relative URLs to absolute external URLs
		let videoUrl = statusData.downloadUrl || statusData.outputUrl || statusData.url;
		if (videoUrl && videoUrl.startsWith('/')) {
			// Convert internal Docker URL to external URL that browsers can access
			// In development: http://remotion:3001 → http://localhost:3001
			// In production: Should be set to actual external Remotion URL
			const internalUrl = process.env.REMOTION_SERVER_URL || 'http://localhost:3001';
			const externalUrl = internalUrl
				.replace('http://remotion:3001', 'http://localhost:3001')  // Development
				.replace('https://remotion:3001', 'https://localhost:3001'); // Just in case
			videoUrl = `${externalUrl}${videoUrl}`;
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