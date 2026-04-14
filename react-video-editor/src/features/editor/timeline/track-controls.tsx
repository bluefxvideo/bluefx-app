import { Eye, EyeOff } from "lucide-react";
import useStore from "../store/use-store";
import { useMemo } from "react";

/**
 * Track visibility controls — renders eye toggles for special layers
 * (Voiceover, Music, Captions) so the user can hide/show them in the player.
 */
export default function TrackControls() {
  const { trackItemsMap, hiddenTrackIds, toggleTrackVisibility } = useStore();

  // Identify toggleable layers from the track items
  const layers = useMemo(() => {
    const result: Array<{
      id: string;
      label: string;
      color: string;
    }> = [];

    for (const item of Object.values(trackItemsMap)) {
      const meta = item.metadata as any;
      if (item.type === "audio" && meta?.generationType === "voice") {
        result.push({ id: item.id, label: "Voiceover", color: "#6c5ce7" });
      } else if (item.type === "audio" && meta?.backgroundMusic) {
        result.push({ id: item.id, label: "Music", color: "#00b894" });
      } else if (
        item.type === "text" &&
        (item.details as any)?.isCaptionTrack
      ) {
        result.push({ id: item.id, label: "Captions", color: "#4A9EFF" });
      }
    }

    return result;
  }, [trackItemsMap]);

  if (layers.length === 0) return null;

  return (
    <div className="flex items-center gap-1 border-l pl-2 ml-1">
      {layers.map((layer) => {
        const isHidden = hiddenTrackIds.has(layer.id);
        return (
          <button
            key={layer.id}
            onClick={() => toggleTrackVisibility(layer.id)}
            className={`flex items-center gap-1 px-1.5 py-1 rounded text-xs transition-all ${
              isHidden
                ? "opacity-40 hover:opacity-70"
                : "opacity-100 hover:opacity-80"
            }`}
            title={`${isHidden ? "Show" : "Hide"} ${layer.label}`}
          >
            {isHidden ? (
              <EyeOff size={13} className="text-muted-foreground" />
            ) : (
              <Eye size={13} style={{ color: layer.color }} />
            )}
            <span
              className={isHidden ? "text-muted-foreground line-through" : ""}
              style={isHidden ? {} : { color: layer.color }}
            >
              {layer.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
