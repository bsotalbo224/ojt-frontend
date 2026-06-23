import axios from "./axios";

/* ===============================
SHARED HEADERS
=============================== */
const NO_CACHE_HEADERS = {
  "Cache-Control": "no-cache",
  Pragma: "no-cache"
};

const getWithNoCache = (url, config = {}) =>
  axios.get(url, {
    ...config,
    headers: {
      ...(config.headers || {}),
      ...NO_CACHE_HEADERS
    }
  });

function normalizeApiError(err) {
  return {
    message:
      err?.response?.data?.message ||
      err?.message ||
      "Request failed"
  };
}

function sanitizePagination(page, limit) {
  const safePage = Math.max(
    parseInt(page, 10) || 1,
    1
  );

  const safeLimit = Math.min(
    Math.max(parseInt(limit, 10) || 15, 1),
    100
  );

  return { safePage, safeLimit };
}

/* ===============================
COORDINATOR: DEPARTMENT ATTENDANCE
=============================== */
export const getCoordinatorAttendance = async () => {

  const res = await getWithNoCache("/attendance/coordinator");

  return res.data;
};

/* ===============================
STUDENT: TODAY ATTENDANCE
=============================== */
export const getStudentAttendance = async () => {

  const res = await getWithNoCache("/attendance/student");

  return res.data || null;
};

export const getStudentAttendanceHistory = async ({
  page = 1,
  limit = 15
} = {}) => {

  const { safePage, safeLimit } = sanitizePagination(page, limit);

  const res = await getWithNoCache("/attendance/history", {
    params: {
      page: safePage,
      limit: safeLimit
    }
  });

  const history = res.data?.history || [];

  const backendPagination = res.data?.pagination;

  const pagination = backendPagination
    ? {
        page: backendPagination.page ?? safePage,
        limit: backendPagination.limit ?? safeLimit,
        total: backendPagination.total ?? history.length,
        totalPages: backendPagination.totalPages ?? 1,
        hasMore: backendPagination.hasMore ?? false
      }
    : {
        page: safePage,
        limit: safeLimit,
        total: history.length,
        totalPages: 1,
        hasMore: false
      };

  return {
    success: res.data?.success ?? true,
    today: res.data?.today || null,
    history,
    pagination
  };
};

export const getStudentAttendanceHistoryExport = async () => {

  const res = await getWithNoCache("/attendance/history/export");

  return {
    success: res.data?.success ?? true,
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
        headers: NO_CACHE_HEADERS
      }
    );

    return {
      success:
        res.data?.attendance_id !== undefined ||
        res.data?.success !== false,

      data: res.data
    };

  } catch (err) {
    throw normalizeApiError(err);
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
      headers: NO_CACHE_HEADERS
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
      headers: NO_CACHE_HEADERS
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
      headers: NO_CACHE_HEADERS
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
      headers: NO_CACHE_HEADERS
    }
  );

  return res.data;
};

/* ===============================
COORDINATOR: STUDENT ATTENDANCE RECORDS
=============================== */
export const getStudentAttendanceRecords =
  async (studentId) => {

    const res = await getWithNoCache(
      `/attendance/student/${studentId}`
    );

    return res.data;
};

export const getPendingEarlyAttendance = async () => {

  const res = await getWithNoCache("/attendance/pending-early");

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
      headers: NO_CACHE_HEADERS
    }
  );

  return res.data;
};

export const rejectEarlyAttendance = async (attendanceId) => {

  const res = await axios.patch(
    `/attendance/early/${attendanceId}/reject`,
    {},
    {
      headers: NO_CACHE_HEADERS
    }
  );

  return res.data;
};