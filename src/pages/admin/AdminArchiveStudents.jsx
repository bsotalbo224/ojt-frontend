import { useEffect, useState } from 'react';
import { Archive, Loader2, Search } from 'lucide-react';
import apiClient from '../../api/axios';

// ─── API ──────────────────────────────────────────────────────────────────────

const fetchArchivedStudents = async () => {
  const res = await apiClient.get('/admin/archived-students');
  return res.data;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const AvatarCircle = ({ name }) => {
  const initials =
    name
      ?.split(' ')
      .slice(0, 2)
      .map((n) => n.charAt(0).toUpperCase())
      .join('') ?? '?';

  return (
    <div className="w-8 h-8 text-xs rounded-full bg-linear-to-br from-green-400 to-green-600 flex items-center justify-center shrink-0 shadow-sm">
      <span className="text-white font-bold">{initials}</span>
    </div>
  );
};

const EmptyState = ({ filtered }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-3">
    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
      <Archive className="w-8 h-8 text-green-300" />
    </div>
    <p className="text-base font-semibold text-green-800">
      {filtered ? 'No students match your search' : 'No archived students'}
    </p>
    <p className="text-sm text-green-500">
      {filtered
        ? 'Try a different name, email, or course.'
        : 'Archived students will appear here.'}
    </p>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const AdminArchivedStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchArchivedStudents();
        setStudents(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load archived students:', err);
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return (
      `${s.f_name} ${s.l_name}`.toLowerCase().includes(q) ||
      (s.email ?? '').toLowerCase().includes(q) ||
      (s.course_name ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-linear-to-br from-green-50 to-white p-6">
      <div className="max-w-7xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-green-100 p-3 rounded-xl">
            <Archive className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-green-800">Archived Students</h1>
            <p className="text-green-600 mt-0.5">
              Students automatically archived due to inactivity
            </p>
          </div>
        </div>

        {/* ── Card ── */}
        <div className="bg-white rounded-2xl shadow-md border border-green-50 overflow-hidden">

          {/* ── Card Header + Search ── */}
          <div className="px-6 pt-5 pb-4 border-b border-green-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-green-800">Student Records</h2>
              {!loading && (
                <p className="text-xs text-green-500 mt-0.5">
                  {filtered.length} record{filtered.length !== 1 ? 's' : ''} found
                </p>
              )}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, email, or course…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-green-200 bg-green-50/50 text-green-900 placeholder-green-400 focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-300 transition"
              />
            </div>
          </div>

          {/* ── Table Body ── */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
                <p className="text-sm text-green-500">Loading archived students…</p>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState filtered={search.length > 0} />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-green-50/60">
                    {['Name', 'Email', 'Course', 'Archived Date'].map((col) => (
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
                  {filtered.map((student) => (
                    <tr
                      key={student.student_id}
                      className="border-b border-green-50 hover:bg-green-50/50 transition-colors duration-150"
                    >
                      {/* Name */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <AvatarCircle name={`${student.f_name} ${student.l_name}`} />
                          <span className="text-sm font-semibold text-green-900 whitespace-nowrap">
                            {student.f_name} {student.l_name}
                          </span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-4 px-4 text-sm text-green-700 whitespace-nowrap">
                        {student.email ?? '—'}
                      </td>

                      {/* Course */}
                      <td className="py-4 px-4 text-sm font-semibold text-green-700 whitespace-nowrap">
                        {student.course_name ?? '—'}
                      </td>

                      {/* Archived Date */}
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                          <Archive className="w-3 h-3" />
                          {new Date(student.archived_at).toLocaleDateString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Card Footer ── */}
          {!loading && filtered.length > 0 && (
            <div className="px-6 py-3 border-t border-green-50 bg-green-50/30">
              <p className="text-xs text-green-500">
                {filtered.length} record{filtered.length !== 1 ? 's' : ''} shown
                {search && ` for "${search}"`}
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AdminArchivedStudents;