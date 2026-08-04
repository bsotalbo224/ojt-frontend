import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../api/axios";

const todayISO = () => new Date().toISOString().split("T")[0];

const isEmptyContent = (html) =>
  !html || html.replace(/<[^>]*>/g, "").trim() === "";

const useNarrativeComposer = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const revisionId =
    location.state?.narrativeId ||
    new URLSearchParams(location.search).get("revision");

  // Editor state
  const [content, setContent] = useState("");
  const [paperSize, setPaperSize] = useState("A4");

  // Narrative metadata
  const [narrativeId, setNarrativeId] = useState(null);
  const [narrativeDate, setNarrativeDate] = useState(null);
  const [status, setStatus] = useState("draft");
  const [coordinatorFeedback, setCoordinatorFeedback] = useState("");

  // Attachments
  const [attachments, setAttachments] = useState([]);

  // Submission state
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // Modal state
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [alertModal, setAlertModal] = useState({ open: false, title: "", message: "" });

  const showAlert = useCallback((title, message) => {
    setAlertModal({ open: true, title, message });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertModal({ open: false, title: "", message: "" });
  }, []);

  // Load narrative (today's draft, or a specific revision)
  useEffect(() => {
    const applyNarrative = (narrative, fallbackStatus) => {
      setNarrativeId(narrative.narrative_id);
      setContent(narrative.content || "");
      setStatus(narrative.status || fallbackStatus);
      setCoordinatorFeedback(narrative.coordinator_remarks || "");
      setNarrativeDate((narrative.narrative_date || "").split("T")[0]);
    };

    const resetToNewDraft = () => {
      setNarrativeId(null);
      setContent("");
      setStatus("draft");
      setCoordinatorFeedback("");
      setNarrativeDate(todayISO());
    };

    const loadNarrative = async () => {
      if (revisionId) {
        try {
          const res = await api.get(`/narratives/${revisionId}`);
          const narrative = res.data.data || res.data;
          if (!narrative) {
            navigate("/student/narrative", { replace: true });
            return;
          }
          applyNarrative(narrative, "revision");
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
          applyNarrative(todayNarrative, "draft");
        } else {
          resetToNewDraft();
        }
      } catch (err) {
        console.error("Failed to check today's narrative:", err);
        resetToNewDraft();
      }
    };

    loadNarrative();
  }, [revisionId, navigate]);

  // Shared multipart payload builder for save/submit
  const buildFormData = useCallback(
    (targetStatus) => {
      const formData = new FormData();
      formData.append("narrative_date", narrativeDate);
      formData.append("content", content);
      formData.append("status", targetStatus);
      if (narrativeId) formData.append("narrative_id", narrativeId);

      // Only new files carry a .file property; saved attachments are skipped
      attachments.forEach((att) => {
        if (att.file) formData.append("attachments", att.file);
      });

      return formData;
    },
    [narrativeDate, content, narrativeId, attachments]
  );

  const persistNarrative = useCallback(
    async (targetStatus) => {
      const formData = buildFormData(targetStatus);
      const res = await api.post("/narratives/student", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (!narrativeId && res.data?.narrative_id) {
        setNarrativeId(res.data.narrative_id);
      }
      return res;
    },
    [buildFormData, narrativeId]
  );

  // Save draft
  const handleSaveDraft = useCallback(async () => {
    setSaving(true);
    try {
      await persistNarrative("draft");
      setStatus("draft");
      setLastSaved(new Date());
    } catch {
      showAlert("Save Failed", "Failed to save draft.");
    } finally {
      setSaving(false);
    }
  }, [persistNarrative, showAlert]);

  // Submit validation
  const handleSubmitClick = useCallback(() => {
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
  }, [content, attachments, showAlert]);

  // Submit confirm
  const handleSubmitConfirm = useCallback(async () => {
    setSubmitting(true);
    try {
      await persistNarrative("submitted");
      setStatus("submitted");
      setShowSubmitConfirm(false);
    } catch {
      showAlert("Submission Failed", "Failed to submit narrative.");
    } finally {
      setSubmitting(false);
    }
  }, [persistNarrative, showAlert]);

  const closeSubmitConfirm = useCallback(() => {
    if (!submitting) setShowSubmitConfirm(false);
  }, [submitting]);

  // Navigation
  const goBack = useCallback(() => navigate("/student/logs"), [navigate]);

  const isEditable = status === "draft" || status === "revision";
  const canSubmit = status === "draft" || status === "revision";

  return {
    // editor
    content,
    setContent,
    paperSize,
    setPaperSize,

    // metadata
    status,
    coordinatorFeedback,

    // attachments
    attachments,
    setAttachments,

    // submission
    saving,
    submitting,
    lastSaved,

    // modals
    showSubmitConfirm,
    alertModal,
    closeAlert,
    closeSubmitConfirm,

    // derived
    isEditable,
    canSubmit,

    // actions
    handleSaveDraft,
    handleSubmitClick,
    handleSubmitConfirm,
    goBack,
  };
};

export default useNarrativeComposer;