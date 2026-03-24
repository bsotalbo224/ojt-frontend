import axios from "./axios";

export const getStudentAssignment = async () => {
  const res = await axios.get("/student/assignment");
  return res.data;
};