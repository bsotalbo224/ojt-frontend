import axios from "./axios";

export const saveNarrative = async (payload) => {
  const res = await axios.post("/narratives/student", payload);
  return res.data;
};

export const getMyNarrative = async () => {
  const res = await axios.get("/narratives/student/me");
  return res.data;
};

export const getStudentNarratives = async (id) => {
  const res = await axios.get(`/narratives/student/${id}`);
  return res.data;
};

export const getNarrativeById = async (id) => {
  const res = await axios.get(`/narratives/view/${id}`);
  return res.data;
};

export const getCoordinatorNarratives = async () => {
  const res = await axios.get("/narratives/coordinator");
  return res.data;
};

export const reviewNarrative = async (id, payload) => {
  const res = await axios.put(`/narratives/review/${id}`, {
    status: payload.status.toLowerCase(),
    remarks: payload.remarks
  });
  return res.data;
};

export const updateNarrativeReview = async (id, data) => {
  const res = await axios.put(`/narratives/review/${id}`, data);
  return res.data;
};