import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  Building2,
  Clock,
} from 'lucide-react';
import apiClient from '../../api/axios';

const EmptyState = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-3">
    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
      <BookOpen className="w-8 h-8 text-green-300" />
    </div>
    <p className="text-base font-semibold text-green-800">{message}</p>
  </div>
);

const CourseModal = ({ isOpen, onClose, course, onSave, departments }) => {
  const [formData, setFormData] = useState({
    course_name: '',
    department_id: '',
    required_hours: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (course) {
      setFormData({
        course_name: course.course_name || '',
        department_id: course.department_id || '',
        required_hours: course.required_hours !== undefined && course.required_hours !== null ? course.required_hours : '',
      });
    } else {
      setFormData({
        course_name: '',
        department_id: '',
        required_hours: '',
      });
    }
    setError('');
  }, [course, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.course_name.trim()) {
      setError('Course name is required');
      return;
    }
    if (!formData.department_id) {
      setError('Please select a department');
      return;
    }
    if (formData.required_hours === '' || formData.required_hours === null) {
      setError('Required hours is required');
      return;
    }
    const parsedHours = Number(formData.required_hours);
    if (!Number.isInteger(parsedHours) || parsedHours <= 0) {
      setError('Required hours must be a positive whole number');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        course_name: formData.course_name.trim(),
        department_id: Number(formData.department_id),
        required_hours: parsedHours,
      };

      if (course) {
        await apiClient.put(`/courses/${course.course_id}`, payload);
      } else {
        await apiClient.post('/courses', payload);
      }
      onSave();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isEdit = !!course;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-[fadeUp_0.2s_ease]">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-green-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              {isEdit ? (
                <Edit2 className="w-5 h-5 text-green-600" />
              ) : (
                <Plus className="w-5 h-5 text-green-600" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-green-900">
                {isEdit ? 'Edit Course' : 'Add New Course'}
              </h2>
              <p className="text-xs text-green-500">
                {isEdit ? 'Update course information' : 'Create a new academic program'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-green-50 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-green-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-green-700 uppercase tracking-wide">
              Course Name
            </label>
            <input
              type="text"
              value={formData.course_name}
              onChange={(e) => setFormData({ ...formData, course_name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-green-200 text-sm text-green-900 placeholder-green-300 bg-white transition-all duration-150 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
              placeholder="e.g., BS Information Technology"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-green-700 uppercase tracking-wide">
              Department
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400 pointer-events-none" />
              <select
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-green-200 text-sm text-green-900 bg-white transition-all duration-150 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 appearance-none cursor-pointer"
              >
                <option value="" disabled>Select a department…</option>
                {departments.map((dept) => (
                  <option key={dept.department_id} value={dept.department_id}>
                    {dept.department_name}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            {departments.length === 0 && (
              <p className="text-xs text-amber-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                No departments available. Please add departments first.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-green-700 uppercase tracking-wide">
              Required Hours
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400 pointer-events-none" />
              <input
                type="number"
                min="1"
                step="1"
                value={formData.required_hours}
                onChange={(e) => setFormData({ ...formData, required_hours: e.target.value })}
                onKeyDown={(e) => {
                  if (['.', 'e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                }}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-green-200 text-sm text-green-900 placeholder-green-300 bg-white transition-all duration-150 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                placeholder="e.g., 300"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-green-50 bg-green-50/30 -mx-6 px-6 py-4 -mb-5 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg border border-green-200 text-green-700 text-sm font-semibold hover:bg-green-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || departments.length === 0}
              className="px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-sm font-semibold transition-all flex items-center gap-2 shadow-sm"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ConfirmDeleteModal = ({ isOpen, onClose, course, onConfirm, loading }) => {
  if (!isOpen || !course) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-[fadeUp_0.2s_ease]">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-red-50">
          <Trash2 className="w-7 h-7 text-red-500" />
        </div>

        <h3 className="text-lg font-bold text-green-900 text-center mb-1">
          Delete Course
        </h3>

        <p className="text-sm text-green-600 text-center mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-green-800">
            {course.course_name}
          </span>
          ? This action cannot be undone.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg border border-green-200 text-green-700 text-sm font-semibold hover:bg-green-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminCourses = () => {
  const [courses, setCourses] = useState([]);
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiClient.get('/courses');
      setCourses(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await apiClient.get('/admin/departments');
      setDepartments(response.data || []);
    } catch (err) {
      console.error('Failed to load departments:', err);
      setDepartments([]); // ensure array
    }
  };

  const handleDelete = async () => {
    if (!selectedCourse) return;

    setDeleteLoading(true);
    try {
      await apiClient.delete(`/courses/${selectedCourse.course_id}`);
      setCourses(prev => prev.filter(c => c.course_id !== selectedCourse.course_id));
      setIsDeleteModalOpen(false);
      setSelectedCourse(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete course');
    } finally {
      setDeleteLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchDepartments();
  }, []);

  useEffect(() => {
    let result = [...courses];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.course_name.toLowerCase().includes(search) ||
        (c.course_code && c.course_code.toLowerCase().includes(search)) ||
        (c.department_name && c.department_name.toLowerCase().includes(search))
      );
    }

    setFilteredCourses(result);
  }, [courses, searchTerm]);

  const handleEdit = (course) => {
    setSelectedCourse(course);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (course) => {
    setSelectedCourse(course);
    setIsDeleteModalOpen(true);
  };

  const handleModalSave = () => {
    fetchCourses();
  };

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="min-h-screen bg-linear-to-br from-green-50 to-white p-6">
        <div className="max-w-7xl mx-auto">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-green-800">Courses Management</h1>
              <p className="text-green-600 mt-1">Manage academic programs offered by the institution</p>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 active:scale-95 text-white font-semibold text-sm rounded-xl shadow-md transition-all duration-150 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add Course
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-6">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-sm text-red-600">{error}</span>
            </div>
          )}

          <div className="mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-green-50 px-5 py-4 flex items-center gap-4 max-w-xs">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-green-600 bg-green-100">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-green-500 font-medium">Total Courses</p>
                {loading ? (
                  <div className="h-6 w-10 bg-green-100 rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-green-800">{courses.length}</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-md border border-green-50 overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-green-50 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <h2 className="text-lg font-bold text-green-800 shrink-0">All Courses</h2>
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
                <input
                  type="text"
                  placeholder="Search courses…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-lg border border-green-200 text-sm text-green-800 placeholder-green-300 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 w-full sm:w-64 transition-all"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-24 gap-3">
                  <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
                  <p className="text-sm text-green-500">Loading courses…</p>
                </div>
              ) : filteredCourses.length === 0 ? (
                <EmptyState
                  message={searchTerm ? 'No courses match your search' : 'No courses yet'}
                />
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-green-50/60">
                      {['Course Name', 'Department', 'Actions'].map((col) => (
                        <th
                          key={col}
                          className="text-left py-3 px-4 text-xs font-semibold text-green-600 uppercase tracking-wider whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCourses.map((course) => (
                      <tr
                        key={course.course_id}
                        className="border-b border-green-50 hover:bg-green-50/40 transition-colors duration-150 group"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-green-400 shrink-0" />
                            <span className="text-sm font-semibold text-green-900">
                              {course.course_name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                            <span className="text-sm text-green-700">
                              {course.department_name || <span className="text-green-300 italic">No department</span>}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(course)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(course)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {!loading && filteredCourses.length > 0 && (
              <div className="px-6 py-3 border-t border-green-50 bg-green-50/30 flex items-center justify-between">
                <p className="text-xs text-green-500">
                  Showing {filteredCourses.length} of {courses.length} course{courses.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>

        </div>
      </div>

      <CourseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        course={null}
        onSave={handleModalSave}
        departments={departments}
      />

      <CourseModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedCourse(null);
        }}
        course={selectedCourse}
        onSave={handleModalSave}
        departments={departments}
      />

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedCourse(null);
        }}
        course={selectedCourse}
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </>
  );
};

export default AdminCourses;