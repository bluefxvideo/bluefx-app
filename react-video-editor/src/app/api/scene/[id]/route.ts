import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Check if there's a local composition file in public/sora-edit/
  const compositionPath = path.join(
    process.cwd(),
    "public",
    "sora-edit",
    "composition.json"
  );

  if (id === "sora-edit" && fs.existsSync(compositionPath)) {
    const content = JSON.parse(fs.readFileSync(compositionPath, "utf-8"));
    return NextResponse.json({
      success: true,
      scene: { content },
      project: { name: "Sora Killed - Edited" },
    });
  }

  return NextResponse.json(
    { success: false, error: "Scene not found" },
    { status: 404 }
  );
}
