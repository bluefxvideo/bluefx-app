import { NextResponse } from "next/server";
import { convertEditorToRemotionFormat } from "@/utils/editor-to-remotion-converter";

export async function POST(request: Request) {
	try {
		const body = await request.json(); // Parse the request body
		console.log('📦 Received render request:', body);
		
		// Extract design data from request
		const { design, options } = body;
		if (!design) {
			return NextResponse.json(
				{ message: "Design data is required" },
				{ status: 400 }
			);
		}
		
		// Convert editor format to Remotion format
		const remotionData = convertEditorToRemotionFormat(design);
		console.log('🔄 Converted to Remotion format:', {
			layers: {
				audio: remotionData.audioLayers.length,
				image: remotionData.imageLayers.length,
				video: remotionData.videoLayers.length,
				text: remotionData.textLayers.length,
				caption: remotionData.captionLayers.length
			},
			composition: remotionData.composition
		});
		
		// Prepare payload for Remotion server
		const remotionPayload = {
			compositionId: "VideoEditor",
			inputProps: remotionData,
			outputFormat: options?.format || "mp4",
			width: remotionData.composition.width,
			height: remotionData.composition.height,
			fps: remotionData.composition.fps,
			durationInFrames: remotionData.composition.durationInFrames,
			async: true // Enable async rendering for progress tracking
		};

		// Call your Remotion server instead of combo.sh
		const remotionServerUrl = process.env.REMOTION_SERVER_URL || "http://localhost:3000";
		const response = await fetch(`${remotionServerUrl}/render`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-API-Key": process.env.REMOTION_API_KEY || "default-key",
			},
			body: JSON.stringify(remotionPayload),
		});

		const responseData = await response.json();
		if (!response.ok) {
			console.error('❌ Remotion server error:', responseData);
			return NextResponse.json(
				{ message: responseData?.message || "Failed to render video with Remotion" },
				{ status: response.status },
			);
		}

		console.log('✅ Remotion render started:', responseData);
		
		// Transform response to match combo.sh format expected by the editor
		const editorResponse = {
			video: {
				id: responseData.filename || responseData.renderId || responseData.id,
				status: 'PENDING', // Async mode starts as PENDING
				progress: 0,
				url: null // URL provided when complete via progress polling
			}
		};

		return NextResponse.json(editorResponse, { status: 200 });
	} catch (error) {
		console.error('❌ Render API error:', error);
		return NextResponse.json(
			{ message: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const id = searchParams.get("id");
		if (!id) {
			return NextResponse.json(
				{ message: "id parameter is required" },
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
			console.error('❌ Failed to fetch render progress from Remotion server');
			return NextResponse.json(
				{ message: "Failed to fetch export status" },
				{ status: response.status },
			);
		}

		const statusData = await response.json();
		console.log('📊 Remotion progress:', statusData);
		
		// Transform response to match combo.sh format expected by the editor
		// Use download proxy so browser never hits Remotion server directly (avoids SSL issues)
		let videoUrl = statusData.outputUrl || statusData.url;
		if (videoUrl && videoUrl.startsWith('/')) {
			const internalUrl = `${remotionServerUrl}${videoUrl}`;
			videoUrl = `/api/download?url=${encodeURIComponent(internalUrl)}&filename=${encodeURIComponent(id || 'video')}`;
			console.log(`🔗 Converted to proxy URL: ${videoUrl}`);
		}
		
		const editorResponse = {
			video: {
				id: statusData.renderId || id,
				status: statusData.status === 'completed' ? 'COMPLETED' : 
				        statusData.status === 'failed' ? 'FAILED' : 'PENDING',
				progress: Math.round(statusData.progress || 0),
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
