export const download = async (url: string, filename: string) => {
	// Ensure filename doesn't already have .mp4 extension
	const cleanFilename = filename.endsWith('.mp4') ? filename.slice(0, -4) : filename;
	const finalFilename = `${cleanFilename}.mp4`;
	
	console.log('🔽 Starting download:', { url, filename: finalFilename });
	
	// Since downloads are problematic due to CORS/deployment issues,
	// the most reliable approach is to open in a new tab where users can:
	// 1. Right-click → Save as...
	// 2. Use browser's download button in video player
	
	try {
		// First attempt: Try direct download with anchor element
		const link = document.createElement('a');
		link.href = url;
		link.download = finalFilename;
		link.target = '_blank';
		link.style.display = 'none';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		
		console.log('✅ Download link clicked - if download doesn\'t start, video will open in new tab');
		
		// Also open in new tab as backup
		// This ensures users can always access and save the video
		setTimeout(() => {
			console.log('📂 Opening video in new tab for manual save...');
			window.open(url, '_blank');
		}, 1000);
		
	} catch (error) {
		console.error('❌ Download failed:', error);
		// Fallback: Just open in new tab
		console.log('📂 Opening video in new tab for manual save...');
		window.open(url, '_blank');
	}
};
