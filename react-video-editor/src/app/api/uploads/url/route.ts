import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!url || !serviceKey) {
		throw new Error("Missing Supabase environment variables");
	}

	return createClient(url, serviceKey);
}

function getBucketForContentType(contentType: string): string {
	if (contentType.startsWith("video/")) return "videos";
	if (contentType.startsWith("image/")) return "images";
	if (contentType.startsWith("audio/")) return "audio";
	return "videos";
}

function getExtensionFromContentType(contentType: string): string {
	const map: Record<string, string> = {
		"video/mp4": "mp4",
		"video/webm": "webm",
		"video/quicktime": "mov",
		"image/jpeg": "jpg",
		"image/png": "png",
		"image/webp": "webp",
		"image/gif": "gif",
		"audio/mpeg": "mp3",
		"audio/wav": "wav",
	};
	return map[contentType] || contentType.split("/")[1] || "bin";
}

interface UploadUrlRequest {
	userId: string;
	urls: string[];
}

export async function POST(request: NextRequest) {
	try {
		const body: UploadUrlRequest = await request.json();
		const { userId, urls } = body;

		if (!urls || !Array.isArray(urls) || urls.length === 0) {
			return NextResponse.json(
				{ error: "urls array is required and must not be empty" },
				{ status: 400 },
			);
		}

		const supabase = getSupabaseAdmin();
		const uploads = [];

		for (const url of urls) {
			try {
				// Download the file from URL
				const response = await fetch(url);
				if (!response.ok) {
					console.error(`❌ Failed to download from URL: ${url} - ${response.status}`);
					continue;
				}

				const contentType =
					response.headers.get("content-type") || "application/octet-stream";
				const buffer = Buffer.from(await response.arrayBuffer());

				// Extract filename from URL
				const urlPath = new URL(url).pathname;
				const originalFileName =
					urlPath.split("/").pop() || "downloaded-file";
				const sanitizedName = originalFileName
					.replace(/[^a-zA-Z0-9._-]/g, "_")
					.substring(0, 50);

				const bucket = getBucketForContentType(contentType);
				const extension = getExtensionFromContentType(contentType);
				const timestamp = new Date()
					.toISOString()
					.replace(/[:.]/g, "-");
				const filePath = `editor-uploads/${userId || "anonymous"}/${sanitizedName}_${timestamp}.${extension}`;

				// Upload to Supabase storage
				const { data, error } = await supabase.storage
					.from(bucket)
					.upload(filePath, buffer, {
						contentType,
						upsert: true,
					});

				if (error) {
					console.error(`❌ Supabase upload error for ${url}:`, error);
					continue;
				}

				// Get public URL
				const {
					data: { publicUrl },
				} = supabase.storage.from(bucket).getPublicUrl(filePath);

				uploads.push({
					fileName: sanitizedName,
					filePath: data.path,
					contentType,
					originalUrl: url,
					url: publicUrl,
					folder: `editor-uploads/${userId || "anonymous"}`,
				});
			} catch (urlError) {
				console.error(`❌ Error processing URL ${url}:`, urlError);
				continue;
			}
		}

		return NextResponse.json({
			success: true,
			uploads,
		});
	} catch (error) {
		console.error("❌ Upload URL route error:", error);
		return NextResponse.json(
			{
				error: "Internal server error",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		);
	}
}
