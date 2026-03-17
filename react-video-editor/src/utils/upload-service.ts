import axios from "axios";

export type UploadProgressCallback = (uploadId: string, progress: number) => void;

export type UploadStatusCallback = (uploadId: string, status: 'uploaded' | 'failed', error?: string) => void;

export interface UploadCallbacks {
  onProgress: UploadProgressCallback;
  onStatus: UploadStatusCallback;
}

function getUserIdFromUrl(): string {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("userId") || "anonymous";
}

export async function processFileUpload(
  uploadId: string,
  file: File,
  callbacks: UploadCallbacks
): Promise<any> {
  try {
    const userId = getUserIdFromUrl();

    // Upload file directly to Supabase via our API route
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", userId);

    const { data } = await axios.post("/api/uploads/direct", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (progressEvent) => {
        const percent = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total || 1)
        );
        callbacks.onProgress(uploadId, percent);
      },
    });

    const uploadInfo = data.uploads[0];

    // Construct upload data
    const uploadData = {
      fileName: uploadInfo.fileName,
      filePath: uploadInfo.filePath,
      fileSize: file.size,
      contentType: uploadInfo.contentType,
      metadata: { uploadedUrl: uploadInfo.url },
      folder: uploadInfo.folder || null,
      type: uploadInfo.contentType.split("/")[0],
      method: "direct",
      origin: "user",
      status: "uploaded",
      isPreview: false,
    };

    callbacks.onStatus(uploadId, 'uploaded');
    return uploadData;
  } catch (error) {
    console.error("❌ File upload error:", error);
    callbacks.onStatus(uploadId, 'failed', (error as Error).message);
    throw error;
  }
}

export async function processUrlUpload(
  uploadId: string,
  url: string,
  callbacks: UploadCallbacks
): Promise<any[]> {
  try {
    const userId = getUserIdFromUrl();

    // Start with 10% progress
    callbacks.onProgress(uploadId, 10);

    // Upload URL via our API route
    const { data } = await axios.post(
      "/api/uploads/url",
      { userId, urls: [url] },
      { headers: { "Content-Type": "application/json" } }
    );

    const { uploads = [] } = data;

    // Update to 50% progress
    callbacks.onProgress(uploadId, 50);

    // Construct upload data from uploads array
    const uploadDataArray = uploads.map((uploadInfo: any) => ({
      fileName: uploadInfo.fileName,
      filePath: uploadInfo.filePath,
      fileSize: 0,
      contentType: uploadInfo.contentType,
      metadata: { uploadedUrl: uploadInfo.url },
      folder: uploadInfo.folder || null,
      type: uploadInfo.contentType.split("/")[0],
      method: "url",
      origin: "user",
      status: "uploaded",
      isPreview: false,
    }));

    // Complete
    callbacks.onProgress(uploadId, 100);
    callbacks.onStatus(uploadId, 'uploaded');
    return uploadDataArray;
  } catch (error) {
    console.error("❌ URL upload error:", error);
    callbacks.onStatus(uploadId, 'failed', (error as Error).message);
    throw error;
  }
}

export async function processUpload(
  uploadId: string,
  upload: { file?: File; url?: string },
  callbacks: UploadCallbacks
): Promise<any> {
  if (upload.file) {
    return await processFileUpload(uploadId, upload.file, callbacks);
  }
  if (upload.url) {
    return await processUrlUpload(uploadId, upload.url, callbacks);
  }
  callbacks.onStatus(uploadId, 'failed', 'No file or URL provided');
  throw new Error('No file or URL provided');
}
