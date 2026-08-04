import { memo, useCallback, useEffect, useMemo, useState } from "react";

import {
  AlignLeft, AlignCenter, AlignRight, Image as ImageIcon,
  Minus, Bold, Italic, List, Lock,
} from "lucide-react";
import {
  useEditor, EditorContent,
  NodeViewWrapper, ReactNodeViewRenderer,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Node, mergeAttributes } from "@tiptap/core";

import AlertModal from "./AlertModal";

import api from "../../api/axios";

import {
  PAPER_SIZES,
  ACCENT,
  ACCENT_500_GLOW,
  MIN_IMAGE_WIDTH,
  MAX_IMAGE_WIDTH,
  DEFAULT_IMAGE_WIDTH,
  MAX_IMAGE_UPLOAD_BYTES,
  FLOAT_WRAPPER_STYLES,
} from "./editorConstants";

import "./editor.css";

// Re-exported so `import { PAPER_SIZES } from "./PaperEditor"` keeps working.
export { PAPER_SIZES };

// Drag-to-resize handler for image nodes: throttles updates to one per
// animation frame and clamps the width to a sane range.
const createImageResizeHandler = ({ getStartWidth, onWidthChange }) => (e) => {
  e.preventDefault();
  e.stopPropagation();

  const startX = e.clientX;
  const startWidth = getStartWidth();

  let rafId = null;
  let pendingWidth = startWidth;

  const applyPendingWidth = () => {
    onWidthChange(String(pendingWidth));
    rafId = null;
  };

  const onMouseMove = (me) => {
    const requested = startWidth + (me.clientX - startX);
    pendingWidth = Math.min(MAX_IMAGE_WIDTH, Math.max(MIN_IMAGE_WIDTH, requested));
    if (rafId == null) rafId = requestAnimationFrame(applyPendingWidth);
  };
  const onMouseUp = () => {
    if (rafId != null) cancelAnimationFrame(rafId);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
};

// Renders an inline/floated image node with a drag handle, resize handle,
// and float-mode badge while selected.
const FloatImageView = memo(function FloatImageView({ node, updateAttributes, selected }) {
  const { src, alt, width = DEFAULT_IMAGE_WIDTH, float = "none" } = node.attrs;

  const wrapperStyle = FLOAT_WRAPPER_STYLES[float] || FLOAT_WRAPPER_STYLES.none;

  const handleResizeMouseDown = useCallback(
    createImageResizeHandler({
      getStartWidth: () => parseInt(width, 10) || Number(DEFAULT_IMAGE_WIDTH),
      onWidthChange: (newWidth) => updateAttributes({ width: newWidth }),
    }),
    [width, updateAttributes]
  );

  return (
    <NodeViewWrapper as="span" style={{ display: "contents" }}>
      <span
        contentEditable={false}
        style={{
          ...wrapperStyle,
          position: "relative",
          display: "inline-block",
          userSelect: "none",
          verticalAlign: "top",
        }}
      >
        <span
          style={{
            display: "inline-block",
            position: "relative",
            outline: selected ? `2.5px solid ${ACCENT[600]}` : "2.5px solid transparent",
            outlineOffset: 3,
            borderRadius: 6,
            boxShadow: selected ? `0 0 0 4px ${ACCENT_500_GLOW}` : "none",
            transition: "all 0.15s ease",
          }}
        >
          <img
            src={src}
            alt={alt || ""}
            draggable={false}
            loading="lazy"
            decoding="async"
            style={{ width: `${width}px`, maxWidth: "100%", display: "block", borderRadius: 6 }}
          />

          {selected && (
            <>
              <span style={{
                position: "absolute", top: -12, left: 0,
                background: ACCENT[600], color: "#fff",
                fontSize: 10, fontWeight: 700, padding: "2px 8px",
                borderRadius: "4px 4px 4px 0", userSelect: "none", zIndex: 20,
                letterSpacing: 1, textTransform: "uppercase",
              }}>
                {float === "none" ? "Inline" : `Float ${float}`}
              </span>

              {/* data-drag-handle scopes ProseMirror's node drag to this element only */}
              <span
                data-drag-handle
                style={{
                  position: "absolute", top: -12, right: 0,
                  background: ACCENT[700], color: "#fff",
                  fontSize: 10, fontWeight: 600, padding: "2px 8px",
                  borderRadius: "4px 4px 0 4px", cursor: "grab",
                  userSelect: "none", zIndex: 20,
                }}
                title="Drag to reposition"
              >⠿ drag</span>

              <span
                onMouseDown={handleResizeMouseDown}
                title="Drag to resize"
                style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: 18, height: 18,
                  background: ACCENT[600], borderRadius: "5px 0 5px 0",
                  cursor: "se-resize", display: "flex",
                  alignItems: "center", justifyContent: "center", zIndex: 20,
                }}
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1 7L7 1M4 7L7 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
            </>
          )}
        </span>
      </span>
    </NodeViewWrapper>
  );
});

// FloatImage TipTap extension
const FloatImage = Node.create({
  name: "floatImage",
  group: "block",
  inline: false,
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      float: { default: "none" },
      width: { default: DEFAULT_IMAGE_WIDTH },
    };
  },
  parseHTML() {
    return [{
      tag: "img[src]",
      getAttrs: (el) => ({
        src: el.getAttribute("src"),
        alt: el.getAttribute("alt") || "",
        float: el.style.float || "none",
        width: el.style.width
          ? el.style.width.replace("px", "")
          : el.getAttribute("width") || DEFAULT_IMAGE_WIDTH,
      }),
    }];
  },
  renderHTML({ HTMLAttributes }) {
    const { float, width, src, alt } = HTMLAttributes;
    let style;
    if (float === "left") {
      style = `float:left;max-width:45%;margin-right:16px;margin-bottom:10px;width:${width}px`;
    } else if (float === "right") {
      style = `float:right;max-width:45%;margin-left:16px;margin-bottom:10px;width:${width}px`;
    } else {
      style = `display:inline-block;vertical-align:top;margin:6px 10px 6px 0;max-width:100%;width:${width}px`;
    }
    return ["img", mergeAttributes({ src, alt, style })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(FloatImageView);
  },
});

/** Sets the float attribute on the currently-selected image node, if any. */
const setSelectedImageFloat = (editor, float) => {
  const { state, dispatch } = editor.view;
  const { selection } = state;
  if (selection.node?.type?.name === "floatImage") {
    dispatch(state.tr.setNodeMarkup(selection.from, undefined, {
      ...selection.node.attrs, float,
    }));
  }
};

// Inserts a floatImage node at the current selection. If the cursor sits in
// an empty paragraph right after another inline image, the new image is
// inserted beside it instead of splitting the paragraph between them, so
// consecutive inline images can flow on the same line.
const insertFloatImageAtSelection = (editor, imageUrl) => {
  const { state, view } = editor;
  const { doc, selection } = state;
  const { $from } = selection;

  const attrs = { src: imageUrl, alt: "", float: "none", width: DEFAULT_IMAGE_WIDTH };

  if (
    $from.depth === 1 &&
    $from.parent.type.name === "paragraph" &&
    $from.parent.content.size === 0
  ) {
    const boundaryPos = $from.before($from.depth);
    const nodeBeforeBoundary = doc.resolve(boundaryPos).nodeBefore;

    if (
      nodeBeforeBoundary?.type.name === "floatImage" &&
      nodeBeforeBoundary.attrs.float === "none"
    ) {
      const imageNode = state.schema.nodes.floatImage.create(attrs);
      const tr = state.tr.insert(boundaryPos, imageNode);
      view.dispatch(tr);
      editor.commands.focus();
      return;
    }
  }

  editor
    .chain()
    .focus()
    .insertContent([
      { type: "floatImage", attrs },
      { type: "paragraph" },
    ])
    .run();
};

/** Client-side gate before an image ever hits the network. */
const validateImageFile = (file) => {
  if (!file.type.startsWith("image/")) {
    return {
      valid: false,
      title: "Unsupported file",
      message: "Please choose an image file (PNG, JPG, GIF, WEBP, or SVG).",
    };
  }
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return {
      valid: false,
      title: "Image too large",
      message: `Please choose an image under ${MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024)}MB.`,
    };
  }
  return { valid: true };
};

/** Uploads an image to Cloudinary via the existing endpoint and returns its URL. */
const uploadImageFile = async (file) => {
  const formData = new FormData();
  formData.append("image", file);
  const res = await api.post("/upload/image", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.url; // already a full Cloudinary URL
};

// Toolbar building blocks

const TB = memo(function TB({ active, onClick, title, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-pressed={active}
      className={`
        tb-btn h-8 px-2.5 rounded-md text-sm font-medium transition-all duration-100 flex items-center gap-1.5 border
        ${active ? "tb-btn-active" : ""}
        ${disabled
          ? "bg-transparent text-slate-300 border-transparent cursor-not-allowed"
          : "bg-transparent border-transparent"
        }
      `}
      style={
        active
          ? { backgroundColor: ACCENT[600], color: "white", borderColor: ACCENT[600] }
          : undefined
      }
    >
      {children}
    </button>
  );
});

const Divider = () => <span className="w-px h-5 bg-slate-200 mx-0.5 inline-block self-center" aria-hidden="true" />;

// Toolbar button-group data — collapses repeated <TB> blocks into a single
// .map() per group.
const TEXT_STYLE_BUTTONS = [
  { key: "bold", title: "Bold (Ctrl+B)", icon: Bold, isActive: (editor) => editor.isActive("bold") },
  { key: "italic", title: "Italic (Ctrl+I)", icon: Italic, isActive: (editor) => editor.isActive("italic") },
];

const HEADING_BUTTONS = [
  { key: "h1", title: "Heading 1 (Ctrl+Alt+1)", label: "H1", isActive: (editor) => editor.isActive("heading", { level: 1 }) },
  { key: "h2", title: "Heading 2 (Ctrl+Alt+2)", label: "H2", isActive: (editor) => editor.isActive("heading", { level: 2 }) },
];

const ALIGN_BUTTONS = [
  { key: "alignLeft", title: "Align left", icon: AlignLeft, isActive: (editor) => editor.isActive({ textAlign: "left" }) },
  { key: "alignCenter", title: "Align center", icon: AlignCenter, isActive: (editor) => editor.isActive({ textAlign: "center" }) },
  { key: "alignRight", title: "Align right", icon: AlignRight, isActive: (editor) => editor.isActive({ textAlign: "right" }) },
];

// Toolbar actions
const useToolbarActions = (editor) => useMemo(() => {
  if (!editor) return null;
  return {
    bold: () => editor.chain().focus().toggleBold().run(),
    italic: () => editor.chain().focus().toggleItalic().run(),
    h1: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    h2: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    bulletList: () => editor.chain().focus().toggleBulletList().run(),
    alignLeft: () => editor.chain().focus().setTextAlign("left").run(),
    alignCenter: () => editor.chain().focus().setTextAlign("center").run(),
    alignRight: () => editor.chain().focus().setTextAlign("right").run(),
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [editor]);

// PaperEditor — public API: { value, onChange, editable, paperSize }

const PaperEditor = ({ value, onChange, editable, paperSize = "A4" }) => {
  const [alertState, setAlertState] = useState({ open: false, title: "", message: "" });

  const closeAlert = useCallback(() => {
    setAlertState((prev) => ({ ...prev, open: false }));
  }, []);

  const showAlert = useCallback((title, message) => {
    setAlertState({ open: true, title, message });
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      FloatImage,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value || "",
    editable,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  // Keeps the editor in sync when `value` changes externally (e.g. loading a draft).
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", false);
    }
  }, [value, editor]);

  const insertFloatImageNode = useCallback((imageUrl) => {
    if (!editor) return;
    insertFloatImageAtSelection(editor, imageUrl);
  }, [editor]);

  const handleImageUpload = useCallback(async (file) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      showAlert(validation.title, validation.message);
      return;
    }

    try {
      const imageUrl = await uploadImageFile(file);
      insertFloatImageNode(imageUrl);
    } catch (err) {
      showAlert("Upload failed", "We couldn't upload that image. Please try again.");
    }
  }, [insertFloatImageNode, showAlert]);

  const handleImageInputChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    e.target.value = "";
  }, [handleImageUpload]);

  const actions = useToolbarActions(editor);

  const paperStyle = useMemo(() => ({
    maxWidth: PAPER_SIZES[paperSize]?.maxWidth ?? "794px",
    minHeight: PAPER_SIZES[paperSize]?.minHeight,
  }), [paperSize]);

  if (!editor) return null;

  const selNode = editor.state.selection.node;
  const isImgSelected = selNode?.type?.name === "floatImage";
  const currentFloat = isImgSelected ? selNode.attrs.float : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {editable && (
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 flex flex-wrap gap-0.5 items-center sticky top-0 z-10">
          {TEXT_STYLE_BUTTONS.map(({ key, title, icon: Icon, isActive }) => (
            <TB key={key} active={isActive(editor)} onClick={actions[key]} title={title}>
              <Icon className="w-3.5 h-3.5" />
            </TB>
          ))}

          <Divider />

          {HEADING_BUTTONS.map(({ key, title, label, isActive }) => (
            <TB key={key} active={isActive(editor)} onClick={actions[key]} title={title}>
              <span className="font-bold text-xs">{label}</span>
            </TB>
          ))}

          <Divider />

          <TB active={editor.isActive("bulletList")} onClick={actions.bulletList} title="Bullet list (Ctrl+Shift+8)">
            <List className="w-3.5 h-3.5" />
          </TB>

          <Divider />

          {ALIGN_BUTTONS.map(({ key, title, icon: Icon, isActive }) => (
            <TB key={key} active={isActive(editor)} onClick={actions[key]} title={title}>
              <Icon className="w-3.5 h-3.5" />
            </TB>
          ))}

          <Divider />

          <label className="tb-upload-label h-8 px-2.5 rounded-md text-sm font-medium transition-all duration-100 flex items-center gap-1.5 border border-transparent text-slate-600 cursor-pointer">
            <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Image</span>
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={handleImageInputChange}
            />
          </label>

          <Divider />

          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest self-center mr-1">
            Wrap:
          </span>
          <TB
            active={isImgSelected && currentFloat === "left"}
            onClick={() => setSelectedImageFloat(editor, "left")}
            title="Float left"
            disabled={!isImgSelected}
          >
            <AlignLeft className="w-3.5 h-3.5" /><span className="text-xs">Left</span>
          </TB>
          <TB
            active={isImgSelected && currentFloat === "right"}
            onClick={() => setSelectedImageFloat(editor, "right")}
            title="Float right"
            disabled={!isImgSelected}
          >
            <AlignRight className="w-3.5 h-3.5" /><span className="text-xs">Right</span>
          </TB>
          <TB
            active={isImgSelected && currentFloat === "none"}
            onClick={() => setSelectedImageFloat(editor, "none")}
            title="Inline"
            disabled={!isImgSelected}
          >
            <Minus className="w-3.5 h-3.5" /><span className="text-xs">Inline</span>
          </TB>

          {!isImgSelected && (
            <span className="text-[10px] text-slate-400 italic ml-1 self-center">
              (select image to wrap)
            </span>
          )}
        </div>
      )}

      <div className="nc-editor bg-[#fafafa] px-4 py-4">
        <div
          className="bg-white shadow-[0_1px_4px_rgba(0,0,0,0.08),0_4px_24px_rgba(0,0,0,0.06)] rounded-sm mx-auto w-full transition-all duration-300"
          style={paperStyle}
        >
          <EditorContent editor={editor} />
        </div>
      </div>

      {!editable && (
        <div className="border-t border-slate-100 bg-slate-50 py-2 px-4 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span className="text-xs text-slate-400">This narrative is locked for editing.</span>
        </div>
      )}

      <AlertModal
        open={alertState.open}
        title={alertState.title}
        message={alertState.message}
        onClose={closeAlert}
      />
    </div>
  );
};

export default PaperEditor;