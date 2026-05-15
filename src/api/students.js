import axios from "./axios";

const authHeaders = () => {
  const token = localStorage.getItem("token");

  return token ? { Authorization: `Bearer ${token}` } : {};
};

// =============================
// COORDINATOR STUDENTS
// =============================
export const getCoordinatorStudents = async () => {
  const res = await axios.get("/coordinators/students");
  return res.data;
};

// =============================
// STUDENT PROGRESS
// =============================
export const getStudentProgress = async (id) => {
  const res = await axios.get(
    `/coordinators/student-progress/${id}`,
    { headers: authHeaders() }
  );
  return res.data;
};

// =============================
// ASSIGN COMPANY
// =============================
export const assignCompany = async (studentId, payload) => {
  const res = await axios.put(
    `/coordinators/students/${studentId}/assign-company`,
    payload,
    { headers: authHeaders() }
  );

  return res.data;
};