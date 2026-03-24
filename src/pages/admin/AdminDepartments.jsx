import React, { useState, useEffect } from 'react';
import {
  Users,
  Edit2,
  Trash2,
  Plus,
  Search,
  X,
  Loader2,
  AlertCircle,
  Building2,
  GraduationCap,
} from 'lucide-react';
import apiClient from '../../api/axios';

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

const EmptyState = ({ message, sub }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center">
      <Building2 className="w-7 h-7 text-green-300" />
    </div>
    <p className="text-sm font-semibold text-green-800">{message}</p>
    {sub && <p className="text-xs text-green-400">{sub}</p>}
  </div>
);

const DeptCodeBadge = ({ code }) => {
  if (!code) return <span className="text-green-300 text-xs">—</span>;
  const colors = [
    'bg-green-100 text-green-700',
    'bg-emerald-100 text-emerald-700',
    'bg-teal-100 text-teal-700',
    'bg-cyan-100 text-cyan-700',
    'bg-lime-100 text-lime-700',
  ];
  const idx = code.charCodeAt(0) % colors.length;
  return (
    <span className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-bold tracking-widest uppercase ${colors[idx]}`}>
      {code}
    </span>
  );
};

// ============================================================================
// DEPARTMENT MODAL (Add / Edit)
// ============================================================================

const DepartmentModal = ({ isOpen, onClose, department, onSave }) => {
  const [formData, setFormData] = useState({ department_name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (department) {
      setFormData({ department_name: department.department_name ?? '' });
    } else {
      setFormData({ department_name: '' });
    }
    setError('');
  }, [department, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.department_name.trim()) {
      setError('Department name is required');
      return;
    }
    setLoading(true);
    try {
      if (department) {
        await apiClient.put(`/admin/departments/${department.department_id}`, formData);
      } else {
        await apiClient.post('/admin/departments', formData);
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
  const isEdit = !!department;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-[fadeUp_0.2s_ease]">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-green-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              {isEdit ? <Edit2 className="w-5 h-5 text-green-600" /> : <Plus className="w-5 h-5 text-green-600" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-green-900">
                {isEdit ? 'Edit Department' : 'Add New Department'}
              </h2>
              <p className="text-xs text-green-500">
                {isEdit ? 'Update department information' : 'Create a new academic department'}
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
              Department Name
            </label>
            <input
              type="text"
              value={formData.department_name}
              onChange={(e) => setFormData({ department_name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-green-200 text-sm text-green-900 placeholder-green-300 bg-white transition-all duration-150 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
              placeholder="e.g., College of Engineering"
              autoFocus
            />
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
              disabled={loading}
              className="px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-sm font-semibold transition-all flex items-center gap-2 shadow-sm"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// CONFIRM DELETE MODAL
// ============================================================================

const ConfirmDeleteModal = ({ isOpen, onClose, department, onConfirm, loading }) => {
  if (!isOpen || !department) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-[fadeUp_0.2s_ease]">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-red-50">
          <Trash2 className="w-7 h-7 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-green-900 text-center mb-1">Delete Department</h3>
        <p className="text-sm text-green-600 text-center mb-2">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-green-800">{department.department_name}</span>?
        </p>
        <p className="text-xs text-red-400 text-center mb-6">
          This will remove all student assignments from this department.
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const AdminDepartments = () => {
  const [departments, setDepartments] = useState([]);
  const [filteredDepartments, setFilteredDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const totalStudents = departments.reduce((sum, d) => sum + (d.total_students || 0), 0);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiClient.get('/admin/departments');
      setDepartments(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDepartments(); }, []);

  useEffect(() => {
    let result = [...departments];
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(d =>
        d.department_name.toLowerCase().includes(s) ||
        d.department_code?.toLowerCase().includes(s)
      );
    }
    setFilteredDepartments(result);
  }, [departments, searchTerm]);

  const handleDelete = async () => {
    if (!selectedDepartment) return;
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/admin/departments/${selectedDepartment.department_id}`);
      setDepartments(prev => prev.filter(d => d.department_id !== selectedDepartment.department_id));
      setIsDeleteModalOpen(false);
      setSelectedDepartment(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete department');
    } finally {
      setDeleteLoading(false);
    }
  };

  const openEdit = (dept) => { setSelectedDepartment(dept); setIsEditModalOpen(true); };
  const openDelete = (dept) => { setSelectedDepartment(dept); setIsDeleteModalOpen(true); };

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="min-h-screen bg-linear-to-br from-green-50 to-white p-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center shadow-md">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-green-900">Departments Management</h1>
                <p className="text-sm text-green-500 mt-0.5">Manage academic departments and their information</p>
              </div>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 active:scale-95 text-white font-semibold text-sm rounded-xl shadow-md transition-all duration-150 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add Department
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-sm text-red-600">{error}</span>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                label: 'Total Departments',
                value: departments.length,
                icon: Building2,
                iconClass: 'text-green-600 bg-green-100',
                valueClass: 'text-green-800',
              },
              {
                label: 'Total Students',
                value: totalStudents,
                icon: GraduationCap,
                iconClass: 'text-emerald-600 bg-emerald-100',
                valueClass: 'text-emerald-700',
              },
            ].map(({ label, value, icon: Icon, iconClass, valueClass }) => (
              <div
                key={label}
                className="bg-white rounded-xl shadow-sm border border-green-50 px-5 py-4 flex items-center gap-4 hover:shadow-md transition-shadow"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-green-500 font-medium">{label}</p>
                  {loading ? (
                    <div className="h-6 w-10 bg-green-100 rounded animate-pulse mt-1" />
                  ) : (
                    <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-2xl shadow-md border border-green-50 overflow-hidden">
            {/* Table Header */}
            <div className="px-5 pt-4 pb-3 border-b border-green-50 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-green-800">All Departments</h2>
                {!loading && (
                  <p className="text-xs text-green-400 mt-0.5">
                    {filteredDepartments.length} of {departments.length} department{departments.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-green-400" />
                <input
                  type="text"
                  placeholder="Search by name or code…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-4 py-2 rounded-lg border border-green-200 text-sm text-green-800 placeholder-green-300 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 w-full sm:w-56 transition-all"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-20 gap-3">
                  <Loader2 className="w-7 h-7 text-green-500 animate-spin" />
                  <p className="text-sm text-green-500">Loading departments…</p>
                </div>
              ) : filteredDepartments.length === 0 ? (
                <EmptyState
                  message={searchTerm ? 'No departments match your search' : 'No departments yet'}
                  sub={searchTerm ? 'Try a different name or code.' : 'Add your first department using the button above.'}
                />
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-green-50/60">
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-green-600 uppercase tracking-wider">
                        Department
                      </th>
                      <th className="text-center py-2.5 px-3 text-xs font-semibold text-green-600 uppercase tracking-wider w-24">
                        Code
                      </th>
                      <th className="text-center py-2.5 px-3 text-xs font-semibold text-green-600 uppercase tracking-wider w-28">
                        Students
                      </th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-green-600 uppercase tracking-wider w-24">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDepartments.map((dept) => (
                      <tr
                        key={dept.department_id}
                        className="border-b border-green-50 hover:bg-green-50/40 transition-colors duration-150 group"
                      >
                        {/* Department Name */}
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                              <Building2 className="w-3.5 h-3.5 text-green-500" />
                            </div>
                            <span className="text-sm font-semibold text-green-900 leading-tight">
                              {dept.department_name}
                            </span>
                          </div>
                        </td>

                        {/* Code */}
                        <td className="py-2.5 px-3 text-center">
                          <DeptCodeBadge code={dept.department_code} />
                        </td>

                        {/* Students */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-center gap-1.5 text-sm text-green-700">
                            <Users className="w-3.5 h-3.5 text-green-400 shrink-0" />
                            <span className="font-semibold tabular-nums">{dept.total_students || 0}</span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(dept)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openDelete(dept)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Table Footer */}
            {!loading && filteredDepartments.length > 0 && (
              <div className="px-5 py-2.5 border-t border-green-50 bg-green-50/30">
                <p className="text-xs text-green-400">
                  Showing {filteredDepartments.length} of {departments.length} department{departments.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Modals */}
      <DepartmentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        department={null}
        onSave={fetchDepartments}
      />
      <DepartmentModal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setSelectedDepartment(null); }}
        department={selectedDepartment}
        onSave={fetchDepartments}
      />
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setSelectedDepartment(null); }}
        department={selectedDepartment}
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </>
  );
};

export default AdminDepartments;