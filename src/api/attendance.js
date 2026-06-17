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
  early_reason = null,
  early_attachment = null
) => {

  const formData = new FormData();

  if (latitude != null) {
    formData.append("latitude", latitude);
  }

  if (longitude != null) {
    formData.append("longitude", longitude);
  }

  if (early_reason) {
    formData.append("early_reason", early_reason);
  }

  if (early_attachment) {
    formData.append("early_attachment", early_attachment);
  }

  try {

    const res = await axios.post(
      "/attendance/timein",
      formData,
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

  } catch (err) {
    throw {
      message:
        err.response?.data?.message ||
        err.message ||
        "Request failed"
    };
  }
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
export const timeOut = async () => {

  const res = await axios.patch(
    "/attendance/timeout",
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

/* ===============================
COORDINATOR: STUDENT ATTENDANCE RECORDS
=============================== */
export const getStudentAttendanceRecords =
  async (studentId) => {

    const res = await axios.get(
      `/attendance/student/${studentId}`,
      {
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache"
        }
      }
    );

    return res.data;
};

export const getPendingEarlyAttendance = async () => {
  const res = await axios.get(
    "/attendance/pending-early",
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
COORDINATOR: EARLY ATTENDANCE ACTIONS
=============================== */
export const approveEarlyAttendance = async (attendanceId) => {

  const res = await axios.patch(
    `/attendance/early/${attendanceId}/approve`,
    {},
    {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache"
      }
    }
  );

  return res.data;
};

export const rejectEarlyAttendance = async (attendanceId) => {

  const res = await axios.patch(
    `/attendance/early/${attendanceId}/reject`,
    {},
    {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache"
      }
    }
  );

  return res.data;
};