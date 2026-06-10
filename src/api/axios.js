import axios from "axios";

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_URL
});

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const academicYearId =
    localStorage.getItem("viewedAcademicYearId");

  if (academicYearId) {
    config.headers["x-academic-year-id"] =
      academicYearId;
  }

  return config;
});

instance.interceptors.request.use(config => {
  const token = localStorage.getItem("token");

  const academicYearId =
    localStorage.getItem("viewedAcademicYearId");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (academicYearId) {
    config.headers["X-Academic-Year-Id"] =
      academicYearId;
  }

  console.log(
    config.url,
    config.headers["X-Academic-Year-Id"]
  );

  return config;
});

export default instance;
