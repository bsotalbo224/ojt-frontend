import { CheckCircle2 } from "lucide-react";
import PaperEditor from "../../components/editor/PaperEditor";
import AttachmentUploader from "../../components/editor/AttachmentUploader";
import ConfirmModal from "../../components/editor/ConfirmModal";
import AlertModal from "../../components/editor/AlertModal";
import NarrativeHeader from "../../components/narrative/NarrativeHeader";
import NarrativeFeedback from "../../components/narrative/NarrativeFeedback";
import ReadOnlyBanner from "../../components/narrative/ReadOnlyBanner";
import NarrativeActionBar from "../../components/narrative/NarrativeActionBar";
import useNarrativeComposer from "../../components/hooks/useNarrativeComposer";
import "../../components/narrative/narrative.css";

const NarrativeComposer = () => {
  const {
    content,
    setContent,
    paperSize,
    setPaperSize,
    status,
    coordinatorFeedback,
    attachments,
    setAttachments,
    saving,
    submitting,
    lastSaved,
    showSubmitConfirm,
    alertModal,
    closeAlert,
    closeSubmitConfirm,
    isEditable,
    canSubmit,
    handleSaveDraft,
    handleSubmitClick,
    handleSubmitConfirm,
    goBack,
  } = useNarrativeComposer();

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
        onCancel={closeSubmitConfirm}
        loading={submitting}
      />
      <AlertModal
        open={alertModal.open}
        title={alertModal.title}
        message={alertModal.message}
        onClose={closeAlert}
      />

      <NarrativeHeader
        onBack={goBack}
        status={status}
        lastSaved={lastSaved}
        paperSize={paperSize}
        onPaperSizeChange={setPaperSize}
      />

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
                color:           `rgb(var(--p700))`,
                backgroundColor: `rgb(var(--p50))`,
                border:          `1px solid rgb(var(--p200))`,
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Narrative Approved
            </div>
          )}
        </div>

        <NarrativeFeedback feedback={coordinatorFeedback} status={status} />

        <ReadOnlyBanner status={status} />

        <PaperEditor
          value={content}
          onChange={setContent}
          editable={isEditable}
          paperSize={paperSize}
        />

        <AttachmentUploader
          attachments={attachments}
          setAttachments={setAttachments}
          editable={isEditable}
        />

        {canSubmit && (
          <NarrativeActionBar
            saving={saving}
            submitting={submitting}
            lastSaved={lastSaved}
            onSave={handleSaveDraft}
            onSubmit={handleSubmitClick}
          />
        )}
      </main>
    </div>
  );
};

export default NarrativeComposer;