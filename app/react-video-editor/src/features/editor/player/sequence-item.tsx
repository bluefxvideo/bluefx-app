import React from "react";
import { IAudio, IImage, ITrackItem, IText, IVideo } from "@designcombo/types";
import { Audio, Image, Text, Video, Caption } from "./items";
import { SequenceItemOptions } from "./base-sequence";
import { ICaptionTrackItem } from "./items/Caption";

export const SequenceItem: Record<
	string,
	(item: ITrackItem, options: SequenceItemOptions) => React.JSX.Element
> = {
	text: (item, options) => Text({ item: item as IText, options }),
	video: (item, options) => Video({ item: item as IVideo, options }),
	audio: (item, options) => Audio({ item: item as IAudio, options }),
	image: (item, options) => Image({ item: item as IImage, options }),
	caption: (item, options) => Caption({ item: item as ICaptionTrackItem, options }),
};
