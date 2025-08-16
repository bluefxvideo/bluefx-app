export const download = (url: string, filename: string) => {
	// Create a direct download link instead of fetching as blob
	const link = document.createElement("a");
	link.href = url;
	link.setAttribute("download", `${filename}.mp4`);
	link.target = "_blank"; // Open in new tab if download fails
	document.body.appendChild(link);
	link.click();
	link.parentNode?.removeChild(link);
};
