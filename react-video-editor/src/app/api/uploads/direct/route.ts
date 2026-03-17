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
	return "videos"; // Default to videos
}

function getExtensionFromContentType(contentType: string): string {
	const map: Record<string, string> = {
		"video/mp4": "mp4",
		"video/webm": "webm",
		"video/quicktime": "mov",
		"video/x-msvideo": "avi",
		"image/jpeg": "jpg",
		"image/png": "png",
		"image/webp": "webp",
		"image/gif": "gif",
		"audio/mpeg": "mp3",
		"audio/wav": "wav",
		"audio/ogg": "ogg",
		"audio/mp4": "m4a",
	};
	return map[contentType] || contentType.split("/")[1] || "bin";
}

export async function POST(request: NextRequest) {
	try {
		const formData = await request.formData();
		const file = formData.get("file") as File | null;
		const userId = (formData.get("userId") as string) || "anonymous";

		if (!file) {
			return NextResponse.json({ error: "No file provided" }, { status: 400 });
		}

		const supabase = getSupabaseAdmin();
		const contentType = file.type || "application/octet-stream";
		const bucket = getBucketForContentType(contentType);
		const extension = getExtensionFromContentType(contentType);
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const sanitizedName = file.name
			.replace(/\.[^/.]+$/, "") // Remove extension
			.replace(/[^a-zA-Z0-9_-]/g, "_") // Sanitize
			.substring(0, 50); // Limit length
		const filePath = `editor-uploads/${userId}/${sanitizedName}_${timestamp}.${extension}`;

		// Convert File to Buffer
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// Upload to Supabase storage
		const { data, error } = await supabase.storage
			.from(bucket)
			.upload(filePath, buffer, {
				contentType,
				upsert: true,
			});

		if (error) {
			console.error("❌ Supabase upload error:", error);
			return NextResponse.json(
				{ error: "Upload failed", details: error.message },
				{ status: 500 },
			);
		}

		// Get public URL
		const {
			data: { publicUrl },
		} = supabase.storage.from(bucket).getPublicUrl(filePath);

		return NextResponse.json({
			success: true,
			uploads: [
				{
					fileName: file.name,
					filePath: data.path,
					contentType,
					url: publicUrl,
					folder: `editor-uploads/${userId}`,
				},
			],
		});
	} catch (error) {
		console.error("❌ Upload route error:", error);
		return NextResponse.json(
			{
				error: "Internal server error",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		);
	}
}
