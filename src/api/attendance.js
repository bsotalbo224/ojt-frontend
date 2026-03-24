import axios from "./axios";

/* ===============================
COORDINATOR: DEPARTMENT ATTENDANCE
=============================== */
export const getCoordinatorAttendance = async () => {
  const res = await axios.get("/attendance/coordinator");
  return res.data;
};

/* ===============================
STUDENT: MY ATTENDANCE
=============================== */
export const getStudentAttendance = async () => {
  const res = await axios.get("/attendance/student");
  return res.data;
};

export const getStudentAttendanceHistory = async () => {
  const res = await axios.get("/attendance/history");
  return res.data;
};

/* ===============================
STUDENT: TIME IN
=============================== */
export const timeIn = async (latitude, longitude) => {
  const res = await axios.post("/attendance/timein", {
    latitude,
    longitude
  });
  return res.data;
};

/* ===============================
STUDENT: TIME OUT
=============================== */
export const timeOut = async () => {
  const res = await axios.patch("/attendance/timeout");
  return res.data;
};

/* ===============================
COORDINATOR: UPDATE LOCATION STATUS
=============================== */
export const updateAttendanceLocationStatus = async (id, status) => {
  const res = await axios.put(
    `/attendance/${id}/location-status`,
    { location_status: status }
  );
  return res.data;
};