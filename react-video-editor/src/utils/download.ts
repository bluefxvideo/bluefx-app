export const download = async (url: string, filename: string) => {
	// Ensure filename doesn't already have .mp4 extension
	const cleanFilename = filename.endsWith('.mp4') ? filename.slice(0, -4) : filename;
	const finalFilename = `${cleanFilename}.mp4`;

	console.log('🔽 Starting download:', { url, filename: finalFilename });

	// Use the streaming proxy route — avoids buffering the entire file into memory
	// The proxy sets Content-Disposition: attachment and streams immediately
	const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(finalFilename)}`;

	const link = document.createElement('a');
	link.href = proxyUrl;
	link.download = finalFilename;
	link.style.display = 'none';
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);

	console.log('✅ Download started (streaming):', finalFilename);
};
