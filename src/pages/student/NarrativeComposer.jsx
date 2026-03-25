import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useCallback, useRef } from "react";
import api from "../../api/axios";
import {
  ArrowLeft, Save, Send, AlertCircle, FileText,
  AlignLeft, AlignCenter, AlignRight, Image as ImageIcon,
  Minus, Bold, Italic, List, Paperclip, X, File,
  CheckCircle2, Clock, RotateCcw, Lock, ChevronDown,
  Upload, Loader2
} from "lucide-react";
import {
  useEditor, EditorContent,
  NodeViewWrapper, ReactNodeViewRenderer
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Node, mergeAttributes } from "@tiptap/core";

/* ─────────────────────────────────────────
   Utility: today as YYYY-MM-DD
───────────────────────────────────────────*/
const todayISO = () => new Date().toISOString().split("T")[0];

/* ─────────────────────────────────────────
   Paper size config
───────────────────────────────────────────*/
const PAPER_SIZES = {
  A4: { label: "A4", maxWidth: "794px", minHeight: undefined },
  Letter: { label: "Letter", maxWidth: "816px", minHeight: undefined },
  Legal: { label: "Legal", maxWidth: "816px", minHeight: "1344px" },
};

/* ─────────────────────────────────────────
   FloatImageView — uses CSS vars for accent
───────────────────────────────────────────*/
const FloatImageView = ({ node, updateAttributes, selected }) => {
  const { src, alt, width = "260", float = "none" } = node.attrs;

  const wrapperStyle = {
    none: {
      display: "block", clear: "both", margin: "20px auto", maxWidth: "100%",
    },
    left: {
      float: "left", maxWidth: "45%", marginRight: "16px",
      marginBottom: "10px", marginTop: "6px", marginLeft: "0", clear: "none",
    },
    right: {
      float: "right", maxWidth: "45%", marginLeft: "16px",
      marginBottom: "10px", marginTop: "6px", marginRight: "0", clear: "none",
    },
  }[float] || { display: "block", margin: "20px auto" };

  const handleResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = parseInt(width, 10) || 260;
    const onMouseMove = (me) => {
      updateAttributes({ width: String(Math.max(80, startWidth + (me.clientX - startX))) });
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [width, updateAttributes]);

  const accentColor = "rgb(var(--p600))";
  const accentDarker = "rgb(var(--p700))";
  const accentGlow = "rgb(var(--p500) / 0.15)";

  return (
    <NodeViewWrapper as="span" style={{ display: "contents" }} data-drag-handle>
      <span
        contentEditable={false}
        style={{
          ...wrapperStyle,
          position: "relative",
          display: float === "none" ? "block" : "inline-block",
          userSelect: "none",
          verticalAlign: float !== "none" ? "top" : undefined,
        }}
      >
        <span
          style={{
            display: "inline-block",
            position: "relative",
            outline: selected ? `2.5px solid ${accentColor}` : "2.5px solid transparent",
            outlineOffset: 3,
            borderRadius: 6,
            boxShadow: selected ? `0 0 0 4px ${accentGlow}` : "none",
            transition: "all 0.15s ease",
          }}
        >
          <img
            src={src}
            alt={alt || ""}
            draggable={false}
            style={{ width: `${width}px`, maxWidth: "100%", display: "block", borderRadius: 6 }}
          />

          {selected && (
            <>
              <span style={{
                position: "absolute", top: -12, left: 0,
                background: accentColor, color: "#fff",
                fontSize: 10, fontWeight: 700, padding: "2px 8px",
                borderRadius: "4px 4px 4px 0", userSelect: "none", zIndex: 20,
                letterSpacing: 1, textTransform: "uppercase",
              }}>
                {float === "none" ? "Inline" : `Float ${float}`}
              </span>

              <span style={{
                position: "absolute", top: -12, right: 0,
                background: accentDarker, color: "#fff",
                fontSize: 10, fontWeight: 600, padding: "2px 8px",
                borderRadius: "4px 4px 0 4px", cursor: "grab",
                userSelect: "none", zIndex: 20,
              }} title="Drag to reposition">⠿ drag</span>

              <span
                onMouseDown={handleResizeMouseDown}
                title="Drag to resize"
                style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: 18, height: 18,
                  background: accentColor, borderRadius: "5px 0 5px 0",
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
        {float === "none" && <span style={{ display: "block", clear: "both", height: 0 }} />}
      </span>
    </NodeViewWrapper>
  );
};

/* ─────────────────────────────────────────
   FloatImage TipTap Extension
───────────────────────────────────────────*/
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
      width: { default: "260" },
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
          : el.getAttribute("width") || "260",
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
      style = `display:block;margin:20px auto;width:${width}px`;
    }
    return ["img", mergeAttributes({ src, alt, style })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(FloatImageView);
  },
});

/* ─────────────────────────────────────────
   Set float on selected image
───────────────────────────────────────────*/
const setSelectedImageFloat = (editor, float) => {
  const { state, dispatch } = editor.view;
  const { selection } = state;
  if (selection.node?.type?.name === "floatImage") {
    dispatch(state.tr.setNodeMarkup(selection.from, undefined, {
      ...selection.node.attrs, float,
    }));
  }
};

/* ─────────────────────────────────────────
   Status config
───────────────────────────────────────────*/
const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    icon: Clock,
    className: "bg-slate-100 text-slate-600 border border-slate-300",
    dot: "bg-slate-400",
  },
  submitted: {
    label: "Submitted",
    icon: Send,
    className: "border",
    dot: null,
  },
  revision: {
    label: "For Revision",
    icon: RotateCcw,
    className: "bg-amber-50 text-amber-700 border border-amber-300",
    dot: "bg-amber-500",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    className: "border",
    dot: null,
  },
};

/* ─────────────────────────────────────────
   StatusBadge
───────────────────────────────────────────*/
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  const isPrimary = status === "submitted" || status === "approved";

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full ${cfg.className}`}
      style={isPrimary ? {
        backgroundColor: `rgb(var(--p50))`,
        color: `rgb(var(--p700))`,
        borderColor: `rgb(var(--p400))`,
      } : {}}
    >
      <span
        className={cfg.dot ? `w-1.5 h-1.5 rounded-full ${cfg.dot}` : "w-1.5 h-1.5 rounded-full"}
        style={isPrimary ? { backgroundColor: `rgb(var(--p500))` } : {}}
      />
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

/* ─────────────────────────────────────────
   Toolbar Button Helpers
───────────────────────────────────────────*/
const TB = ({ active, onClick, title, disabled, children }) => (
  <button
    onClick={onClick}
    title={title}
    disabled={disabled}
    className={`
      h-8 px-2.5 rounded-md text-sm font-medium transition-all duration-100 flex items-center gap-1.5 border
      ${disabled
        ? "bg-transparent text-slate-300 border-transparent cursor-not-allowed"
        : "bg-transparent border-transparent"
      }
    `}
    style={
      active
        ? { backgroundColor: `rgb(var(--p600))`, color: "white", borderColor: `rgb(var(--p600))` }
        : disabled
          ? {}
          : undefined
    }
    onMouseEnter={e => {
      if (!active && !disabled) {
        e.currentTarget.style.backgroundColor = `rgb(var(--p50))`;
        e.currentTarget.style.color = `rgb(var(--p700))`;
        e.currentTarget.style.borderColor = `rgb(var(--p200))`;
      }
    }}
    onMouseLeave={e => {
      if (!active && !disabled) {
        e.currentTarget.style.backgroundColor = "";
        e.currentTarget.style.color = "";
        e.currentTarget.style.borderColor = "";
      }
    }}
  >
    {children}
  </button>
);

const Divider = () => (
  <span className="w-px h-5 bg-slate-200 mx-0.5 inline-block self-center" />
);

/* ─────────────────────────────────────────
   File icon helper
───────────────────────────────────────────*/
const FileTypeIcon = ({ name }) => {
  const ext = name.split(".").pop().toLowerCase();
  const colors = {
    pdf: "text-red-500", docx: "text-blue-500", doc: "text-blue-500",
    jpg: "text-purple-500", jpeg: "text-purple-500", png: "text-purple-500",
  };
  return <File className={`w-4 h-4 ${colors[ext] || "text-slate-400"}`} />;
};

/* ─────────────────────────────────────────
   PaperEditor
───────────────────────────────────────────*/
const PaperEditor = ({ value, onChange, editable, paperSize = "A4" }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      FloatImage,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value || "",
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", false);
    }
  }, [value, editor]);

  if (!editor) return null;

  // FIX: Use VITE_BASE_URL so uploaded images resolve to /uploads/...
  // instead of /api/uploads/... which would happen with VITE_API_URL
  const handleImageUpload = async (file) => {
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await api.post("/upload/narrative-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const baseURL = import.meta.env.VITE_BASE_URL;
      const fullUrl = `${baseURL}${res.data.url}`;
      editor
        .chain()
        .focus()
        .insertContent([
          { type: "floatImage", attrs: { src: fullUrl, float: "none", width: "260" } },
          { type: "paragraph" },
        ])
        .run();
    } catch (err) {
      console.error("Image upload failed:", err);
    }
  };

  const selNode = editor.state.selection.node;
  const isImgSelected = selNode?.type?.name === "floatImage";
  const currentFloat = isImgSelected ? selNode.attrs.float : null;

  const paperStyle = {
    maxWidth: PAPER_SIZES[paperSize]?.maxWidth ?? "794px",
    minHeight: PAPER_SIZES[paperSize]?.minHeight,
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <style>{`
        .nc-editor .ProseMirror {
          outline: none;
          font-family: 'Georgia', 'Times New Roman', serif;
          font-size: 15.5px;
          line-height: 1.85;
          color: #1e293b;
          min-height: 560px;
          padding: 52px 64px;
        }
        .nc-editor .ProseMirror::after {
          content: ""; display: table; clear: both;
        }
        .nc-editor .ProseMirror h1 {
          font-family: 'Georgia', serif;
          font-size: 21px; font-weight: 700;
          color: #0f172a; margin: 0 0 12px;
          border-bottom: 2px solid rgb(var(--p100));
          padding-bottom: 8px; clear: both;
          letter-spacing: 0.01em;
        }
        .nc-editor .ProseMirror h2 {
          font-family: 'Georgia', serif;
          font-size: 16.5px; font-weight: 700;
          color: rgb(var(--p800)); margin: 24px 0 8px;
          padding-bottom: 4px;
          border-bottom: 1px solid rgb(var(--p200));
        }
        .nc-editor .ProseMirror p {
          margin-bottom: 14px;
          text-align: justify;
          overflow: hidden;
        }
        .nc-editor .ProseMirror ul {
          padding-left: 24px; margin-bottom: 14px; overflow: hidden;
        }
        .nc-editor .ProseMirror li { margin-bottom: 6px; }
        .nc-editor .ProseMirror strong { color: #0f172a; }
        .nc-editor .ProseMirror em { color: #374151; }
        @media (max-width: 640px) {
          .nc-editor .ProseMirror { padding: 28px 20px; }
        }
      `}</style>

      {/* Toolbar */}
      {editable && (
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 flex flex-wrap gap-0.5 items-center sticky top-0 z-10">
          <TB active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
            <Bold className="w-3.5 h-3.5" />
          </TB>
          <TB active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
            <Italic className="w-3.5 h-3.5" />
          </TB>

          <Divider />

          <TB active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">
            <span className="font-bold text-xs">H1</span>
          </TB>
          <TB active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
            <span className="font-bold text-xs">H2</span>
          </TB>

          <Divider />

          <TB active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
            <List className="w-3.5 h-3.5" />
          </TB>

          <Divider />

          <TB active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Align left">
            <AlignLeft className="w-3.5 h-3.5" />
          </TB>
          <TB active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Align center">
            <AlignCenter className="w-3.5 h-3.5" />
          </TB>
          <TB active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Align right">
            <AlignRight className="w-3.5 h-3.5" />
          </TB>

          <Divider />

          {/* Image upload */}
          <label
            className="h-8 px-2.5 rounded-md text-sm font-medium transition-all duration-100 flex items-center gap-1.5 border border-transparent text-slate-600 cursor-pointer"
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = `rgb(var(--p50))`;
              e.currentTarget.style.color = `rgb(var(--p700))`;
              e.currentTarget.style.borderColor = `rgb(var(--p200))`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = "";
              e.currentTarget.style.color = "";
              e.currentTarget.style.borderColor = "";
            }}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Image</span>
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
                e.target.value = "";
              }}
            />
          </label>

          <Divider />

          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest self-center mr-1">
            Wrap:
          </span>
          <TB active={isImgSelected && currentFloat === "left"} onClick={() => setSelectedImageFloat(editor, "left")} title="Float left" disabled={!isImgSelected}>
            <AlignLeft className="w-3.5 h-3.5" /><span className="text-xs">Left</span>
          </TB>
          <TB active={isImgSelected && currentFloat === "right"} onClick={() => setSelectedImageFloat(editor, "right")} title="Float right" disabled={!isImgSelected}>
            <AlignRight className="w-3.5 h-3.5" /><span className="text-xs">Right</span>
          </TB>
          <TB active={isImgSelected && currentFloat === "none"} onClick={() => setSelectedImageFloat(editor, "none")} title="Inline" disabled={!isImgSelected}>
            <Minus className="w-3.5 h-3.5" /><span className="text-xs">Inline</span>
          </TB>

          {!isImgSelected && (
            <span className="text-[10px] text-slate-400 italic ml-1 self-center">
              (select image to wrap)
            </span>
          )}
        </div>
      )}

      {/* Paper area */}
      <div className="nc-editor bg-[#fafafa] px-4 py-4">
        <div
          className="bg-white shadow-[0_1px_4px_rgba(0,0,0,0.08),0_4px_24px_rgba(0,0,0,0.06)] rounded-sm mx-auto w-full transition-all duration-300"
          style={paperStyle}
        >
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Read-only hint */}
      {!editable && (
        <div className="border-t border-slate-100 bg-slate-50 py-2 px-4 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400">This narrative is locked for editing.</span>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────
   AttachmentUploader
───────────────────────────────────────────*/
const AttachmentUploader = ({ attachments, setAttachments, editable }) => {
  const dropRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = (files) => {
    const newItems = Array.from(files).map((f) => ({
      id: crypto.randomUUID(), file: f, name: f.name, size: f.size,
    }));
    setAttachments((prev) => [...prev, ...newItems]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (editable) addFiles(e.dataTransfer.files);
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `rgb(var(--p50))` }}
        >
          <Paperclip className="w-4 h-4" style={{ color: `rgb(var(--p600))` }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Evidence & Attachments</p>
          <p className="text-xs text-slate-500">Upload supporting documents, images, or PDFs</p>
        </div>
        <span className="ml-auto text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          {attachments.length} file{attachments.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {editable && (
          <div
            ref={dropRef}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className="relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer"
            style={{
              borderColor: dragging ? `rgb(var(--p400))` : `rgb(var(--p200) / 0.8)`,
              backgroundColor: dragging ? `rgb(var(--p50))` : "white",
            }}
            onMouseEnter={e => {
              if (!dragging) {
                e.currentTarget.style.borderColor = `rgb(var(--p300))`;
                e.currentTarget.style.backgroundColor = `rgb(var(--p50) / 0.4)`;
              }
            }}
            onMouseLeave={e => {
              if (!dragging) {
                e.currentTarget.style.borderColor = `rgb(var(--p200) / 0.8)`;
                e.currentTarget.style.backgroundColor = "white";
              }
            }}
          >
            <label className="absolute inset-0 cursor-pointer">
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                hidden
                onChange={(e) => addFiles(e.target.files)}
              />
            </label>
            <Upload
              className="w-8 h-8 mx-auto mb-3"
              style={{ color: dragging ? `rgb(var(--p500))` : "#cbd5e1" }}
            />
            <p className="text-sm font-medium text-slate-600 mb-1">
              Drop files here or{" "}
              <span
                className="underline underline-offset-2"
                style={{ color: `rgb(var(--p600))` }}
              >
                browse
              </span>
            </p>
            <p className="text-xs text-slate-400">Supports images, PDF, DOCX</p>
          </div>
        )}

        {attachments.length > 0 && (
          <ul className="space-y-2">
            {attachments.map((att) => (
              <li
                key={att.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50 group hover:border-slate-200 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm shrink-0">
                  <FileTypeIcon name={att.name} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{att.name}</p>
                  {att.size && <p className="text-xs text-slate-400">{formatSize(att.size)}</p>}
                </div>
                {editable && (
                  <button
                    onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-500 text-slate-400 transition-all shrink-0"
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!editable && attachments.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">No attachments uploaded.</p>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   ConfirmModal
───────────────────────────────────────────*/
const ConfirmModal = ({ open, title, message, confirmLabel = "Confirm", onConfirm, onCancel, loading = false }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={!loading ? onCancel : undefined}
      />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `rgb(var(--p50))` }}
          >
            <Send className="w-5 h-5" style={{ color: `rgb(var(--p600))` }} />
          </div>
          <h2 className="text-base font-bold text-slate-800">{title}</h2>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-semibold border-2 border-slate-200 text-slate-600
              hover:bg-slate-50 hover:border-slate-300 transition-all duration-150
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white
              disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150"
            style={{
              background: `linear-gradient(to bottom right, rgb(var(--p500)), rgb(var(--p600)))`,
              boxShadow: `0 4px 14px rgb(var(--p500) / 0.3)`,
            }}
            onMouseEnter={e => e.currentTarget.style.background = `linear-gradient(to bottom right, rgb(var(--p600)), rgb(var(--p700)))`}
            onMouseLeave={e => e.currentTarget.style.background = `linear-gradient(to bottom right, rgb(var(--p500)), rgb(var(--p600)))`}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Submitting…</>
            ) : (
              <><Send className="w-4 h-4" />{confirmLabel}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   AlertModal
───────────────────────────────────────────*/
const AlertModal = ({ open, title, message, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-500" />
          </div>
          <h2 className="text-base font-bold text-slate-800">{title}</h2>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">{message}</p>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-semibold
              bg-linear-to-br from-slate-700 to-slate-800 text-white
              hover:from-slate-800 hover:to-slate-900
              transition-all duration-150 shadow-sm"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   NarrativeComposer (main component)
───────────────────────────────────────────*/
const NarrativeComposer = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const revisionId =
    location.state?.narrativeId ||
    new URLSearchParams(location.search).get("revision");

  const [narrativeId, setNarrativeId] = useState(null);
  const [narrativeDate, setNarrativeDate] = useState(null);
  const [status, setStatus] = useState("draft");
  const [coordinatorFeedback, setCoordinatorFeedback] = useState("");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [paperSize, setPaperSize] = useState("A4");
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [alertModal, setAlertModal] = useState({ open: false, title: "", message: "" });

  const showAlert = (title, message) => setAlertModal({ open: true, title, message });

  /* ── LOAD NARRATIVE ── */
  useEffect(() => {
    const loadNarrative = async () => {
      if (revisionId) {
        try {
          const res = await api.get(`/narratives/${revisionId}`);
          const narrative = res.data.data || res.data;
          if (!narrative) { navigate("/student/narrative", { replace: true }); return; }
          setNarrativeId(narrative.narrative_id);
          setContent(narrative.content || "");
          setStatus(narrative.status || "revision");
          setCoordinatorFeedback(narrative.coordinator_remarks || "");
          setNarrativeDate((narrative.narrative_date || "").split("T")[0]);
        } catch (err) {
          console.error("Failed to load narrative:", err);
          navigate("/student/narrative", { replace: true });
        }
        return;
      }

      try {
        const res = await api.get("/narratives/student/me");
        const narratives = res.data || [];
        const todayNarrative = narratives.find((n) => n.narrative_date === todayISO());
        if (todayNarrative) {
          setNarrativeId(todayNarrative.narrative_id);
          setContent(todayNarrative.content || "");
          setStatus(todayNarrative.status || "draft");
          setCoordinatorFeedback(todayNarrative.coordinator_remarks || "");
          setNarrativeDate((todayNarrative.narrative_date || "").split("T")[0]);
        } else {
          setNarrativeId(null); setContent(""); setStatus("draft");
          setCoordinatorFeedback(""); setNarrativeDate(todayISO());
        }
      } catch (err) {
        console.error("Failed to check today's narrative:", err);
        setNarrativeId(null); setContent(""); setStatus("draft");
        setCoordinatorFeedback(""); setNarrativeDate(todayISO());
      }
    };
    loadNarrative();
  }, [revisionId, navigate]);

  /* ── SAVE DRAFT ──
     Sends multipart/form-data so multer (upload.array("attachments"))
     can parse both text fields and file uploads in one request.
  ── */
  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("narrative_date", narrativeDate);
      formData.append("content", content);
      formData.append("status", "draft");
      if (narrativeId) {
        formData.append("narrative_id", narrativeId);
      }
      // Append each attachment file under the key "attachments"
      attachments.forEach((att) => {
        if (att.file) {
          formData.append("attachments", att.file);
        }
      });

      const res = await api.post("/narratives/student", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (!narrativeId && res.data?.narrative_id) {
        setNarrativeId(res.data.narrative_id);
      }
      setStatus("draft");
      setLastSaved(new Date());
    } catch (err) {
      showAlert("Save Failed", "Failed to save draft.");
    } finally {
      setSaving(false);
    }
  };

  /* ── SUBMIT ── */
  const handleSubmitClick = () => {
    const isEmptyContent = (html) => {
      return !html || html.replace(/<[^>]*>/g, "").trim() === "";
    };

    // FIX: Allow submission when content exists OR attachments exist
    const hasContent = !isEmptyContent(content);
    const hasAttachments = attachments.length > 0;

    if (!hasContent && !hasAttachments) {
      showAlert(
        "Empty Submission",
        "Please write a narrative or upload at least one attachment before submitting."
      );
      return;
    }
    setShowSubmitConfirm(true);
  };

  /* ── SUBMIT CONFIRM ──
     Sends multipart/form-data so multer (upload.array("attachments"))
     can parse both text fields and file uploads in one request.
  ── */
  const handleSubmitConfirm = async () => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("narrative_date", narrativeDate);
      formData.append("content", content);
      formData.append("status", "submitted");
      if (narrativeId) {
        formData.append("narrative_id", narrativeId);
      }
      // Append each attachment file under the key "attachments"
      attachments.forEach((att) => {
        if (att.file) {
          formData.append("attachments", att.file);
        }
      });

      const res = await api.post("/narratives/student", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (!narrativeId && res.data?.narrative_id) {
        setNarrativeId(res.data.narrative_id);
      }
      setStatus("submitted");
      setShowSubmitConfirm(false);
    } catch (err) {
      showAlert("Submission Failed", "Failed to submit narrative.");
    } finally {
      setSubmitting(false);
    }
  };

  const isEditable = status === "draft" || status === "revision";
  const canSubmit = status === "draft" || status === "revision";

  return (
    <div
      className="min-h-screen"
      style={{ background: `linear-gradient(to bottom right, #f8fafc, rgb(var(--p50) / 0.3), rgb(var(--p50) / 0.4))` }}
    >
      <ConfirmModal
        open={showSubmitConfirm}
        title="Submit Narrative"
        message="Submit your narrative? You will not be able to edit it after submission."
        confirmLabel="Submit Narrative"
        onConfirm={handleSubmitConfirm}
        onCancel={() => !submitting && setShowSubmitConfirm(false)}
        loading={submitting}
      />
      <AlertModal
        open={alertModal.open}
        title={alertModal.title}
        message={alertModal.message}
        onClose={() => setAlertModal({ open: false, title: "", message: "" })}
      />

      {/* ── TOP NAV BAR ── */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-slate-200/80 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-4">
          <button
            onClick={() => navigate("/student/logs")}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Back to logs"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm shrink-0"
              style={{ background: `linear-gradient(to bottom right, rgb(var(--p500)), rgb(var(--p600)))` }}
            >
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-800 leading-none truncate">Daily Narrative</h1>
              <p className="text-[11px] text-slate-400 leading-none mt-0.5 hidden sm:block">
                Document your daily OJT experience
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastSaved && (
              <span className="text-[11px] text-slate-400 hidden sm:block">
                Saved {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}

            <StatusBadge status={status} />

            {/* Paper size picker */}
            <div className="relative hidden sm:flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <div className="relative">
                <select
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value)}
                  className="appearance-none text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 cursor-pointer transition-colors outline-none"
                  onFocus={e => e.target.style.boxShadow = `0 0 0 2px rgb(var(--p400))`}
                  onBlur={e => e.target.style.boxShadow = "none"}
                >
                  {Object.entries(PAPER_SIZES).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── PAGE BODY ── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

        {/* Date strip */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            {new Date().toLocaleDateString("en-PH", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
            })}
          </span>
          {status === "approved" && (
            <div
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
              style={{
                color: `rgb(var(--p700))`,
                backgroundColor: `rgb(var(--p50))`,
                border: `1px solid rgb(var(--p200))`,
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Narrative Approved
            </div>
          )}
        </div>

        {/* Coordinator Feedback */}
        {coordinatorFeedback && status !== "approved" && (
          <div className="flex gap-3 items-start bg-amber-50 border border-amber-200 border-l-4 border-l-amber-400 rounded-xl p-4 shadow-sm">
            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-1.5">
                Coordinator Feedback
              </p>
              <p className="text-sm text-amber-900 leading-relaxed">{coordinatorFeedback}</p>
            </div>
          </div>
        )}

        {/* Read-only banner */}
        {(status === "submitted" || status === "approved") && (
          <div className="flex gap-3 items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
            <Lock className="w-4 h-4 text-slate-400 shrink-0" />
            <p className="text-sm text-slate-500">
              {status === "approved"
                ? "This narrative has been approved and is locked for editing."
                : "This narrative has been submitted and is locked for editing."}
            </p>
          </div>
        )}

        {/* Editor */}
        <PaperEditor value={content} onChange={setContent} editable={isEditable} paperSize={paperSize} />

        {/* Attachments */}
        <AttachmentUploader attachments={attachments} setAttachments={setAttachments} editable={isEditable} />

        {/* Action bar */}
        {canSubmit && (
          <div className="flex items-center justify-between pt-1 pb-6">
            <p className="text-xs text-slate-400">
              {saving
                ? "Saving…"
                : lastSaved
                  ? `Last saved at ${lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : "Unsaved changes"}
            </p>

            <div className="flex gap-3">
              {/* Save Draft */}
              <button
                onClick={handleSaveDraft}
                disabled={saving || submitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                  bg-white transition-all duration-150 shadow-sm
                  disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ border: `2px solid rgb(var(--p400))`, color: `rgb(var(--p700))` }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = `rgb(var(--p50))`;
                  e.currentTarget.style.borderColor = `rgb(var(--p500))`;
                  e.currentTarget.style.color = `rgb(var(--p800))`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = "white";
                  e.currentTarget.style.borderColor = `rgb(var(--p400))`;
                  e.currentTarget.style.color = `rgb(var(--p700))`;
                }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving…" : "Save Draft"}
              </button>

              {/* Submit Narrative */}
              <button
                onClick={handleSubmitClick}
                disabled={submitting || saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
                  disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150"
                style={{
                  background: `linear-gradient(to bottom right, rgb(var(--p500)), rgb(var(--p600)))`,
                  boxShadow: `0 4px 14px rgb(var(--p500) / 0.3)`,
                }}
                onMouseEnter={e => e.currentTarget.style.background = `linear-gradient(to bottom right, rgb(var(--p600)), rgb(var(--p700)))`}
                onMouseLeave={e => e.currentTarget.style.background = `linear-gradient(to bottom right, rgb(var(--p500)), rgb(var(--p600)))`}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitting ? "Submitting…" : "Submit Narrative"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default NarrativeComposer;