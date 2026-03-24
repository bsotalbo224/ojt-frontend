import axios from "./axios";

// Student Dashboard
export const getDashboardStats = async () => {
  const res = await axios.get("/student/dashboard-stats");
  return res.data;
};

// Coordinator Dashboard
export const getCoordinatorDashboardStats = async () => {
  const res = await axios.get("/coordinators/stats");
  return res.data;
};