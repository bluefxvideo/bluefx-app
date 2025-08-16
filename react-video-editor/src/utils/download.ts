export const download = (url: string, filename: string) => {
	// Ensure filename doesn't already have .mp4 extension
	const cleanFilename = filename.endsWith('.mp4') ? filename.slice(0, -4) : filename;
	
	fetch(url)
		.then((response) => {
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			return response.blob();
		})
		.then((blob) => {
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.setAttribute("download", `${cleanFilename}.mp4`);
			document.body.appendChild(link);
			link.click();
			link.parentNode?.removeChild(link);
			window.URL.revokeObjectURL(url);
		})
		.catch((error) => {
			console.error("Download error:", error);
			// Fallback to direct download if blob fails
			const link = document.createElement("a");
			link.href = url;
			link.setAttribute("download", `${cleanFilename}.mp4`);
			link.target = "_blank";
			document.body.appendChild(link);
			link.click();
			link.parentNode?.removeChild(link);
		});
};
