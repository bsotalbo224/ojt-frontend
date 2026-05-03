import axios from "./axios";

/* ===============================
COORDINATOR: DEPARTMENT ATTENDANCE
=============================== */
export const getCoordinatorAttendance = async () => {
  const res = await axios.get("/attendance/coordinator");
  return res.data;
};

/* ===============================
STUDENT: TODAY ATTENDANCE (FIXED)
=============================== */
export const getStudentAttendance = async () => {
  const res = await axios.get("/attendance/student");

  // normalize response
  return res.data || null;
};

/* ===============================
STUDENT: ATTENDANCE HISTORY
=============================== */
export const getStudentAttendanceHistory = async () => {
  const res = await axios.get("/attendance/history");

  // ensure safe structure
  return {
    success: res.data?.success ?? true,
    today: res.data?.today || null,
    history: res.data?.history || []
  };
};

/* ===============================
STUDENT: TIME IN (FIXED - SESSION SUPPORT)
=============================== */
export const timeIn = async (latitude, longitude, session) => {
  const res = await axios.post("/attendance/timein", {
    latitude,
    longitude,
    session
  });

  return {
    success: res.data?.attendance_id !== undefined || res.data?.success !== false,
    data: res.data
  };
};

/* ===============================
STUDENT: TIME OUT (FIXED - SESSION SUPPORT)
=============================== */
export const timeOut = async (session) => {
  const res = await axios.patch("/attendance/timeout", {
    session
  });

  return {
    success: res.data?.success !== false,
    data: res.data
  };
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