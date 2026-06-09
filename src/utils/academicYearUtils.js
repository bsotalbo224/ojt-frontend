export const STORAGE_KEY = "viewedAcademicYearId";

export const getViewedAcademicYearId = () => {
  return localStorage.getItem(STORAGE_KEY);
};

export const setViewedAcademicYear = (year) => {
  if (!year) return;

  localStorage.setItem(
    STORAGE_KEY,
    year.academic_year_id
  );

  window.dispatchEvent(
    new CustomEvent("academicYearChanged", {
      detail: {
        academic_year_id: year.academic_year_id,
        academic_year_name: year.academic_year_name,
      },
    })
  );
};

export const clearViewedAcademicYear = () => {
  localStorage.removeItem(STORAGE_KEY);
};