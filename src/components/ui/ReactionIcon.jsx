import { memo, useState, useCallback } from "react";
import { getReactionMeta, isValidReactionCode } from "../../constants/reactions";

const TWEMOJI_BASE_PATH = "/twemoji";
const getTwemojiUrl = (unicode) => `${TWEMOJI_BASE_PATH}/${unicode}.svg`;

const SIZE_MAP = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24 };
const DEFAULT_SIZE = SIZE_MAP.md;

const resolveSize = (size) => {
  if (typeof size === "number" && size > 0) return size;
  if (typeof size === "string" && SIZE_MAP[size]) return SIZE_MAP[size];
  return DEFAULT_SIZE;
};

function ReactionIcon({
  reactionCode,
  size = "md",
  className = "",
  decorative = false,
  onError,
}) {
  const [failed, setFailed] = useState(false);

  const handleError = useCallback(
    (event) => {
      setFailed(true);
      onError?.(event, reactionCode);
    },
    [onError, reactionCode]
  );

  if (!isValidReactionCode(reactionCode) || failed) return null;

  const meta = getReactionMeta(reactionCode);
  if (!meta) return null;

  const pixelSize = resolveSize(size);

  return (
    <img
      src={getTwemojiUrl(meta.unicode)}
      width={pixelSize}
      height={pixelSize}
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={handleError}
      className={`inline-block align-middle select-none ${className}`}
      style={{ width: pixelSize, height: pixelSize }}
      alt={decorative ? "" : meta.label}
      title={decorative ? undefined : meta.label}
      aria-label={decorative ? undefined : meta.label}
      aria-hidden={decorative || undefined}
      role={decorative ? "presentation" : undefined}
    />
  );
}

export default memo(ReactionIcon);