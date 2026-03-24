import api from "./axios";

// Student (self progress)
export const getMyProgress = async () => {
  const res = await api.get("/progress/me");
  return res.data;
};