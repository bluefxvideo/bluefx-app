export const download = async (url: string, filename: string) => {
	// Ensure filename doesn't already have .mp4 extension
	const cleanFilename = filename.endsWith('.mp4') ? filename.slice(0, -4) : filename;
	const finalFilename = `${cleanFilename}.mp4`;
	
	console.log('🔽 Starting download:', { url, filename: finalFilename });
	
	try {
		// Fetch the video as a blob to trigger proper download
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch video: ${response.status}`);
		}
		
		const blob = await response.blob();
		const blobUrl = URL.createObjectURL(blob);
		
		// Create download link with blob URL
		const link = document.createElement('a');
		link.href = blobUrl;
		link.download = finalFilename;
		link.style.display = 'none';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		
		// Clean up blob URL after a delay
		setTimeout(() => {
			URL.revokeObjectURL(blobUrl);
		}, 100);
		
		console.log('✅ Download started:', finalFilename);
		
	} catch (error) {
		console.error('❌ Download failed, trying direct link:', error);
		
		// Fallback: Try direct download without fetching blob
		const link = document.createElement('a');
		link.href = url;
		link.download = finalFilename;
		link.style.display = 'none';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		
		console.log('📥 Direct download link clicked');
	}
};
