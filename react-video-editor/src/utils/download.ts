export const download = async (url: string, filename: string) => {
	// Ensure filename doesn't already have .mp4 extension
	const cleanFilename = filename.endsWith('.mp4') ? filename.slice(0, -4) : filename;
	const finalFilename = `${cleanFilename}.mp4`;
	
	console.log('🔽 Starting download:', { url, filename: finalFilename });
	
	try {
		// Use proxy endpoint to avoid CORS issues
		// This is the most reliable method for cross-origin video downloads
		const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(finalFilename)}`;
		
		// Create a hidden anchor element and trigger download
		const link = document.createElement('a');
		link.href = proxyUrl;
		link.download = finalFilename;
		link.style.display = 'none';
		document.body.appendChild(link);
		link.click();
		
		// Clean up
		setTimeout(() => {
			document.body.removeChild(link);
		}, 100);
		
		console.log('✅ Download initiated via proxy');
		
	} catch (error) {
		console.error('❌ Download failed:', error);
		
		// Fallback: Try direct download
		try {
			const link = document.createElement('a');
			link.href = url;
			link.download = finalFilename;
			link.target = '_blank';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			console.log('✅ Fallback: Direct download attempted');
		} catch (fallbackError) {
			// Last resort: Open in new tab
			console.error('❌ All download methods failed, opening in new tab');
			window.open(url, '_blank');
		}
	}
};
