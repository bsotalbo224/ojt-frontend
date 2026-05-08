import axios from "./axios";

/* ===============================
COORDINATOR: DEPARTMENT ATTENDANCE
=============================== */
export const getCoordinatorAttendance = async () => {
  const res = await axios.get("/attendance/coordinator");
  return res.data;
};

/* ===============================
STUDENT: TODAY ATTENDANCE
=============================== */
export const getStudentAttendance = async () => {
  const res = await axios.get("/attendance/student");

  return res.data || null;
};

/* ===============================
STUDENT: ATTENDANCE HISTORY
=============================== */
export const getStudentAttendanceHistory = async () => {

  const res = await axios.get("/attendance/history");

  return {
    success: res.data?.success ?? true,
    today: res.data?.today || null,
    history: res.data?.history || []
  };
};

/* ===============================
STUDENT: TIME IN / START OT
=============================== */
export const timeIn = async (latitude, longitude) => {

  const res = await axios.post("/attendance/timein", {
    latitude,
    longitude
  });

  return {
    success:
      res.data?.attendance_id !== undefined ||
      res.data?.success !== false,

    data: res.data
  };
};

/* ===============================
STUDENT: START LUNCH BREAK
=============================== */
export const startLunchBreak = async () => {

  const res = await axios.patch(
    "/attendance/lunch/start"
  );

  return {
    success: res.data?.success !== false,
    data: res.data
  };
};

/* ===============================
STUDENT: END LUNCH BREAK
=============================== */
export const endLunchBreak = async () => {

  const res = await axios.patch(
    "/attendance/lunch/end"
  );

  return {
    success: res.data?.success !== false,
    data: res.data
  };
};

/* ===============================
STUDENT: TIME OUT / END OT
=============================== */
export const timeOut = async () => {

  const res = await axios.patch(
    "/attendance/timeout"
  );

  return {
    success: res.data?.success !== false,
    data: res.data
  };
};

/* ===============================
COORDINATOR: UPDATE LOCATION STATUS
=============================== */
export const updateAttendanceLocationStatus = async (
  id,
  status
) => {

  const res = await axios.put(
    `/attendance/${id}/location-status`,
    {
      location_status: status
    }
  );

  return res.data;
};