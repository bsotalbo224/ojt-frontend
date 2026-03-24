import axios from "./axios";

/* ============================= */
export const getAdminDashboardStats = async () => {
  const res = await axios.get("/admin/stats");
  return res.data;
};

/* ============================= */
export const getAdminStudentsOverview = async () => {
  const res = await axios.get("/admin/students");
  return res.data;
};

/* ============================= */
export const getAdminCoordinatorsSummary = async () => {
  const res = await axios.get("/admin/coordinators");
  return res.data;
};

/* ============================= */
export const getAdminCompaniesSummary = async () => {
  const res = await axios.get("/companies/summary");
  return res.data;
};

/* ============================= */
export const getAdminRecentActivity = async () => {
  const res = await axios.get("/admin/recent-activity");
  return res.data;
};