import api from "./axios";

export const getAcademicYears = () =>
  api.get("/academic-years");

export const getActiveAcademicYear = () =>
  api.get("/academic-years/active");

export const createAcademicYear = (data) =>
  api.post("/academic-years", data);

export const activateAcademicYear = (id) =>
  api.put(`/academic-years/${id}/activate`);