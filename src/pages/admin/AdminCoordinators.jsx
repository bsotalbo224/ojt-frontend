import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Edit2,
  Mail,
  Building2,
  X,
  AlertCircle,
  ChevronDown,
  Loader2,
  UserCog,
} from 'lucide-react';
import apiClient from '../../api/axios';

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

const AvatarCircle = ({ name }) => {
  const initials =
    name
      ?.split(' ')
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join('') ?? '?';

  return (
    <div className="w-9 h-9 rounded-full bg-linear-to-br from-green-400 to-green-600 flex items-center justify-center shrink-0 shadow-sm">
      <span className="text-white text-sm font-bold">{initials}</span>
    </div>
  );
};

const EmptyState = ({ hasSearch }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-3">
    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
      <UserCog className="w-8 h-8 text-green-300" />
    </div>
    <p className="text-base font-semibold text-green-800">
      {hasSearch ? 'No coordinators match your search' : 'No coordinators yet'}
    </p>
    <p className="text-sm text-green-400">
      {hasSearch
        ? 'Try a different name, email, or department.'
        : 'Add your first coordinator using the button above.'}
    </p>
  </div>
);

// ============================================================================
// COORDINATOR MODAL (Add / Edit)
// ============================================================================

const CoordinatorModal = ({ isOpen, onClose, coordinator, departments, onSave }) => {
  const isEdit = !!coordinator;

  const [formData, setFormData] = useState({
    f_name: '',
    l_name: '',
    email: '',
    department_id: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (coordinator) {
      setFormData({
        f_name: coordinator.f_name,
        l_name: coordinator.l_name,
        email: coordinator.email,
        department_id: coordinator.department_id || '',
      });
    } else {
      setFormData({ f_name: '', l_name: '', email: '', department_id: '' });
    }
    setError('');
  }, [coordinator, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (
      !formData.f_name.trim() ||
      !formData.l_name.trim() ||
      !formData.email.trim() ||
      !formData.department_id
    ) {
      setError('All fields are required');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      if (isEdit) {
        await apiClient.put(`/coordinators/${coordinator.coordinator_id}`, formData);
      } else {
        await apiClient.post('/coordinators', formData);
      }
      onSave();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const field = (key) => (e) => setFormData((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-[fadeUp_0.2s_ease]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-green-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              {isEdit
                ? <Edit2 className="w-5 h-5 text-green-600" />
                : <UserPlus className="w-5 h-5 text-green-600" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-green-900">
                {isEdit ? 'Edit Coordinator' : 'Add New Coordinator'}
              </h2>
              <p className="text-xs text-green-500">
                {isEdit ? 'Update coordinator information' : 'Create a new coordinator account'}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Name row */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'First Name', key: 'f_name', placeholder: 'First Name' },
              { label: 'Last Name',  key: 'l_name', placeholder: 'Last Name' },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                  {label}
                </label>
                <input
                  type="text"
                  value={formData[key]}
                  onChange={field(key)}
                  placeholder={placeholder}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-green-200 text-sm text-green-900 placeholder-green-300 bg-white outline-none transition-all focus:border-green-400 focus:ring-2 focus:ring-green-100"
                />
              </div>
            ))}
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-green-700 uppercase tracking-wide">
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={field('email')}
              placeholder="coordinator@example.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-green-200 text-sm text-green-900 placeholder-green-300 bg-white outline-none transition-all focus:border-green-400 focus:ring-2 focus:ring-green-100"
            />
          </div>

          {/* Department */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-green-700 uppercase tracking-wide">
              Department
            </label>
            <div className="relative">
              <select
                value={formData.department_id}
                onChange={field('department_id')}
                className="w-full px-3.5 py-2.5 rounded-lg border border-green-200 text-sm text-green-900 bg-white appearance-none outline-none transition-all focus:border-green-400 focus:ring-2 focus:ring-green-100 pr-9"
              >
                <option value="">Select department…</option>
                {departments.map((dept) => (
                  <option key={dept.department_id} value={dept.department_id}>
                    {dept.department_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400 pointer-events-none" />
            </div>
          </div>

          {/* Credential notice */}
          <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-100 rounded-lg">
            <AlertCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
            <p className="text-xs text-green-600 leading-relaxed">
              Login credentials will be automatically generated and sent to the coordinator's email.
            </p>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-green-50 -mx-6 px-6 pb-1 mt-2">
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
              {isEdit ? 'Save Changes' : 'Create Coordinator'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const AdminCoordinators = () => {
  const [coordinators, setCoordinators]   = useState([]);
  const [departments, setDepartments]     = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [searchTerm, setSearchTerm]       = useState('');

  // Modal state
  const [modalOpen, setModalOpen]                   = useState(false);
  const [selectedCoordinator, setSelectedCoordinator] = useState(null); // null = add, obj = edit

  // ── Derived ──────────────────────────────────────────────────────────────────
  const filtered = coordinators.filter((c) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      c.f_name.toLowerCase().includes(q) ||
      c.l_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.department_code?.toLowerCase().includes(q)
    );
  });

  // ── API ───────────────────────────────────────────────────────────────────────
  const fetchCoordinators = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiClient.get('/coordinators');
      setCoordinators(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load coordinators. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await apiClient.get('/admin/departments');
      setDepartments(res.data);
    } catch {
      console.error('Failed to load departments');
    }
  };

  useEffect(() => {
    fetchCoordinators();
    fetchDepartments();
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const openAdd  = ()            => { setSelectedCoordinator(null); setModalOpen(true); };
  const openEdit = (coordinator) => { setSelectedCoordinator(coordinator); setModalOpen(true); };
  const closeModal = ()          => { setModalOpen(false); setSelectedCoordinator(null); };

  const handleSave = () => {
    fetchCoordinators();
  };

  // ── Render ───────────────────────────────────────────────────────────────────
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

          {/* ── Page Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-green-800">Coordinators Management</h1>
              <p className="text-green-600 mt-1">Manage OJT coordinators and their department assignments</p>
            </div>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 active:scale-95 text-white font-semibold text-sm rounded-xl shadow-md transition-all duration-150 whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" />
              Add Coordinator
            </button>
          </div>

          {/* ── Error Alert ── */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-6">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-sm text-red-600">{error}</span>
              <button
                onClick={fetchCoordinators}
                className="ml-auto text-sm text-red-600 font-semibold underline underline-offset-2 whitespace-nowrap"
              >
                Try again
              </button>
            </div>
          )}

          {/* ── Stat Card ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-green-50 px-5 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-green-600 bg-green-100">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-green-500 font-medium">Total Coordinators</p>
                {loading
                  ? <div className="h-6 w-10 bg-green-100 rounded animate-pulse mt-1" />
                  : <p className="text-2xl font-bold text-green-800">{coordinators.length}</p>
                }
              </div>
            </div>

            {/* Spacer cards keep the grid visually balanced */}
            <div className="hidden sm:block" />
            <div className="hidden sm:block" />
          </div>

          {/* ── Table Card ── */}
          <div className="bg-white rounded-2xl shadow-md border border-green-50 overflow-hidden">

            {/* Toolbar */}
            <div className="px-6 pt-5 pb-4 border-b border-green-50 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-green-800">All Coordinators</h2>
                {!loading && (
                  <p className="text-xs text-green-500 mt-0.5">
                    {filtered.length} record{filtered.length !== 1 ? 's' : ''} found
                  </p>
                )}
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search name, email, department…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-green-200 text-sm text-green-800 placeholder-green-300 bg-green-50/50 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-24 gap-3">
                  <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
                  <p className="text-sm text-green-500">Loading coordinators…</p>
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState hasSearch={!!searchTerm} />
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-green-50/60">
                      {['Name', 'Email', 'Department', 'Actions'].map((col) => (
                        <th
                          key={col}
                          className={`text-left py-3 px-4 text-xs font-semibold text-green-600 uppercase tracking-wider whitespace-nowrap ${col === 'Actions' ? 'w-20' : ''}`}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((coordinator) => (
                      <tr
                        key={coordinator.coordinator_id}
                        className="border-b border-green-50 hover:bg-green-50/40 transition-colors duration-150"
                      >
                        {/* Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <AvatarCircle name={`${coordinator.f_name} ${coordinator.l_name}`} />
                            <span className="text-sm font-semibold text-green-900 whitespace-nowrap">
                              {coordinator.f_name} {coordinator.l_name}
                            </span>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-sm text-green-600">
                            <Mail className="w-3.5 h-3.5 text-green-400 shrink-0" />
                            <span className="truncate max-w-52">{coordinator.email}</span>
                          </div>
                        </td>

                        {/* Department */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-sm text-green-700">
                            <Building2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                            <span className="truncate max-w-44">
                              {coordinator.department_code || '—'}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => openEdit(coordinator)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors duration-150"
                            title="Edit coordinator"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            {!loading && filtered.length > 0 && (
              <div className="px-6 py-3 border-t border-green-50 bg-green-50/30">
                <p className="text-xs text-green-500">
                  Showing {filtered.length} of {coordinators.length} coordinator{coordinators.length !== 1 ? 's' : ''}
                  {searchTerm && ` for "${searchTerm}"`}
                </p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Modal ── */}
      <CoordinatorModal
        isOpen={modalOpen}
        onClose={closeModal}
        coordinator={selectedCoordinator}
        departments={departments}
        onSave={handleSave}
      />
    </>
  );
};

export default AdminCoordinators;