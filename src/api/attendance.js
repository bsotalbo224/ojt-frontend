import axios from "./axios";

/* ===============================
COORDINATOR: DEPARTMENT ATTENDANCE
=============================== */
export const getCoordinatorAttendance = async () => {

  const res = await axios.get(
    "/attendance/coordinator",
    {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache"
      }
    }
  );

  return res.data;
};

/* ===============================
STUDENT: TODAY ATTENDANCE
=============================== */
export const getStudentAttendance = async () => {

  const res = await axios.get(
    "/attendance/student",
    {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache"
      }
    }
  );

  return res.data || null;
};

/* ===============================
STUDENT: ATTENDANCE HISTORY
=============================== */
export const getStudentAttendanceHistory = async () => {

  const res = await axios.get(
    "/attendance/history",
    {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache"
      }
    }
  );

  return {
    success: res.data?.success ?? true,
    today: res.data?.today || null,
    history: res.data?.history || []
  };
};

/* ===============================
STUDENT: TIME IN / START OT
=============================== */
export const timeIn = async (
  latitude,
  longitude,
  session = "regular"
) => {

  const res = await axios.post(
    "/attendance/timein",
    {
      latitude,
      longitude,
      session
    },
    {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache"
      }
    }
  );

  return {
    success:
      res.data?.attendance_id !== undefined ||
      res.data?.success !== false,

    data: res.data
  };
};

/* ===============================
STUDENT: START LUNCH / MEAL BREAK
=============================== */
export const startLunchBreak = async () => {

  const res = await axios.patch(
    "/attendance/lunch/start",
    {},
    {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache"
      }
    }
  );

  return {
    success: res.data?.success !== false,
    data: res.data
  };
};

/* ===============================
STUDENT: END LUNCH / MEAL BREAK
=============================== */
export const endLunchBreak = async () => {

  const res = await axios.patch(
    "/attendance/lunch/end",
    {},
    {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache"
      }
    }
  );

  return {
    success: res.data?.success !== false,
    data: res.data
  };
};

/* ===============================
STUDENT: TIME OUT / END OT
=============================== */
export const timeOut = async (
  session = "regular"
) => {

  const res = await axios.patch(
    "/attendance/timeout",
    {
      session
    },
    {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache"
      }
    }
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
    },
    {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache"
      }
    }
  );

  return res.data;
};