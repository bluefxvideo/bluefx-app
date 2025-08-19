import useLayoutStore from "../store/use-layout-store";
import { Texts } from "./texts";
import { Audios } from "./audios";
import { Elements } from "./elements";
import { ImagesAI } from "./images-ai";
import { Videos } from "./videos";
import { VoiceOver } from "./voice-over";
import { useIsLargeScreen } from "@/hooks/use-media-query";
import { Uploads } from "./uploads";
import Captions from "./captions";
import AIAssets from "./ai-assets";

const ActiveMenuItem = () => {
	const { activeMenuItem } = useLayoutStore();

	if (activeMenuItem === "texts") {
		return <Texts />;
	}
	if (activeMenuItem === "shapes") {
		return <Elements />;
	}
	if (activeMenuItem === "videos") {
		return <Videos />;
	}

	if (activeMenuItem === "audios") {
		return <Audios />;
	}

	if (activeMenuItem === "images") {
		return <ImagesAI />;
	}

	if (activeMenuItem === "voiceOver") {
		return <VoiceOver />;
	}
	if (activeMenuItem === "elements") {
		return <Elements />;
	}
	if (activeMenuItem === "uploads") {
		return <Uploads />;
	}

	if (activeMenuItem === "captions") {
		return <Captions />;
	}

	if (activeMenuItem === "ai-assets") {
		return <AIAssets />;
	}

	return null;
};

export const MenuItem = () => {
	const isLargeScreen = useIsLargeScreen();

	return (
		<div className={`${isLargeScreen ? "w-[300px]" : "w-full"} flex-1 flex`}>
			<ActiveMenuItem />
		</div>
	);
};
