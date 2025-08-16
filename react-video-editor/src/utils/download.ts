export const download = (url: string, filename: string) => {
	// Ensure filename doesn't already have .mp4 extension
	const cleanFilename = filename.endsWith('.mp4') ? filename.slice(0, -4) : filename;
	
	// Add download parameter to force Content-Disposition header
	const downloadUrl = `${url}${url.includes('?') ? '&' : '?'}download=true`;
	
	// Use direct download approach
	const link = document.createElement("a");
	link.href = downloadUrl;
	link.setAttribute("download", `${cleanFilename}.mp4`);
	
	// Force download
	link.style.display = "none";
	document.body.appendChild(link);
	link.click();
	
	// Clean up
	setTimeout(() => {
		document.body.removeChild(link);
	}, 100);
};
