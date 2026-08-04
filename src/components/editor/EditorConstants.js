// Shared, non-visual configuration for the editor components.

// Theme
export const ACCENT = Object.freeze({
  50: "rgb(var(--p50))",
  100: "rgb(var(--p100))",
  200: "rgb(var(--p200))",
  300: "rgb(var(--p300))",
  400: "rgb(var(--p400))",
  500: "rgb(var(--p500))",
  600: "rgb(var(--p600))",
  700: "rgb(var(--p700))",
  800: "rgb(var(--p800))",
});

// Alpha variant needs to be baked into the color value itself.
export const ACCENT_500_GLOW = "rgb(var(--p500) / 0.15)";

// Paper
export const PAPER_SIZES = Object.freeze({
  A4: { label: "A4", maxWidth: "794px", minHeight: undefined },
  Letter: { label: "Letter", maxWidth: "816px", minHeight: undefined },
  Legal: { label: "Legal", maxWidth: "816px", minHeight: "1344px" },
});

// Images
export const MIN_IMAGE_WIDTH = 80; // px
export const MAX_IMAGE_WIDTH = 900; // px
export const DEFAULT_IMAGE_WIDTH = "260";
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

// Float
export const FLOAT_WRAPPER_STYLES = Object.freeze({
  none: {
    display: "inline-block",
    verticalAlign: "top",
    margin: "6px 10px 6px 0",
    maxWidth: "100%",
  },
  left: {
    float: "left", maxWidth: "45%", marginRight: "16px",
    marginBottom: "10px", marginTop: "6px", marginLeft: "0", clear: "none",
  },
  right: {
    float: "right", maxWidth: "45%", marginLeft: "16px",
    marginBottom: "10px", marginTop: "6px", marginRight: "0", clear: "none",
  },
});