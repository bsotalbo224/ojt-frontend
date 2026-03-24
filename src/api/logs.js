import axios from "./axios";

/* =========================
   DAILY LOGS (STUDENT)
========================= */

// Create daily log
export const addLog = async (data) => {
  const res = await axios.post("/logs", {
    log_date: data.log_date,
    narrative: data.narrative
  });
  return res.data;
};

// Get own logs
export const getMyLogs = async () => {
  const res = await axios.get("/logs");
  return res.data;
};

// Edit log (resubmission)
export const updateLog = async (logId, data) => {
  const res = await axios.put(`/logs/${logId}`, {
    narrative: data.narrative
  });
  return res.data;
};

/* =========================
   DAILY LOG EVIDENCE
========================= */

// Upload attachment
export const uploadLogAttachment = async (logId, file) => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await axios.post(
    `/logs/${logId}/attachments`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    }
  );

  return res.data;
};

export const getLogAttachment = async (logId) => {
  const res = await axios.get(`/logs/${logId}`);
  return res.data.attachments || [];
};

// Delete attachment
export const deleteLogAttachment = async (attachmentId) => {
  const res = await axios.delete(`/logs/attachments/${attachmentId}`);
  return res.data;
};

/* =========================
   COORDINATOR ACTIONS
========================= */

// Approve log
export const approveLog = async (logId) => {
  const res = await axios.put(`/logs/${logId}/approve`);
  return res.data;
};

// Reject log (revision)
export const rejectLog = async (logId, feedback) => {
  const res = await axios.put(`/logs/${logId}/reject`, {
    feedback
  });
  return res.data;
};

// Get all logs (coordinator)
export const getCoordinatorLogs = async () => {
  const res = await axios.get("/logs/coordinator");
  return res.data;
};

// Get single log details
export const getCoordinatorLogDetails = async (logId) => {
  const res = await axios.get(`/logs/${logId}`);
  return res.data;
};

// Update evidence for revision (multiple files)
export const updateRevisionAttachment = async (logId, files) => {
  const results = [];

  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await axios.post(
      `/logs/${logId}/attachments`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      }
    );

    results.push(res.data);
  }

  return results;
};

/* =========================
   OPEN ATTACHMENT (SECURE)
========================= */

export const openLogAttachment = async (attachmentId) => {
  const res = await axios.get(
    `/logs/attachments/${attachmentId}`,
    {
      responseType: "blob"
    }
  );

  const url = window.URL.createObjectURL(res.data);
  window.open(url, "_blank");
};