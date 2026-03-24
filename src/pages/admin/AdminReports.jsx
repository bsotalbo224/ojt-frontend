import { useState, useMemo, useEffect } from 'react';
import api from '../../api/axios';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  FileText, Search, Filter, ChevronDown, Download, Users, Building2,
  BookOpen, Clock, TrendingUp, CheckCircle, Activity, User, Briefcase,
  GraduationCap, Loader2, AlertCircle
} from 'lucide-react';

// ─── Utilities ────────────────────────────────────────────────────────────────

const pct = (a, b) => (b === 0 ? 0 : Math.round((a / b) * 100));

const progressBarColor = (p) => {
  if (p >= 100) return 'bg-blue-500';
  if (p >= 75) return 'bg-green-500';
  if (p >= 50) return 'bg-amber-400';
  return 'bg-red-400';
};

const exportExcel = (data, fileName) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
  saveAs(blob, `${fileName}.xlsx`);
};

const exportPDF = (data, fileName) => {
  const doc = new jsPDF();
  if (!data.length) {
    doc.text('No data available', 20, 20);
    doc.save(`${fileName}.pdf`);
    return;
  }
  const columns = Object.keys(data[0]);
  const rows = data.map((obj) => columns.map((c) => obj[c]));
  autoTable(doc, { head: [columns], body: rows, startY: 20 });
  doc.save(`${fileName}.pdf`);
};

// ─── Shared Components ────────────────────────────────────────────────────────

const LoadingOverlay = () => (
  <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-2xl">
    <div className="flex flex-col items-center gap-2">
      <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      <p className="text-sm font-medium text-green-700">Loading report...</p>
    </div>
  </div>
);

const AvatarCircle = ({ name }) => {
  const initials = name?.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase()).join('') ?? '?';
  return (
    <div className="w-9 h-9 rounded-full bg-linear-to-br from-green-400 to-green-600 flex items-center justify-center shrink-0 shadow-sm">
      <span className="text-white text-sm font-bold">{initials}</span>
    </div>
  );
};

const CompanyAvatar = () => (
  <div className="w-9 h-9 rounded-full bg-linear-to-br from-emerald-400 to-teal-600 flex items-center justify-center shrink-0 shadow-sm">
    <Building2 className="w-4 h-4 text-white" />
  </div>
);

const StatCard = ({ label, value, icon: Icon, color, sub }) => (
  <div className="bg-white rounded-xl shadow-sm border border-green-50 px-5 py-4 flex items-center gap-4">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-xs text-green-500 font-medium">{label}</p>
      <p className="text-2xl font-bold text-green-800">{value}</p>
      {sub && <p className="text-xs text-green-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

const ProgressBar = ({ value, color = 'bg-green-500' }) => (
  <div className="flex items-center gap-2 min-w-[32.5">
    <div className="flex-1 h-1.5 bg-green-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
    <span className="text-xs font-semibold text-green-700 w-9 text-right shrink-0">{value}%</span>
  </div>
);

const ThCell = ({ children }) => (
  <th className="text-left py-3 px-4 text-xs font-semibold text-green-600 uppercase tracking-wider whitespace-nowrap">
    {children}
  </th>
);

const TdCell = ({ children, className = '' }) => (
  <td className={`py-3.5 px-4 ${className}`}>{children}</td>
);

const EmptyRows = () => (
  <tr>
    <td colSpan={99}>
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
          <FileText className="w-8 h-8 text-green-300" />
        </div>
        <p className="text-base font-semibold text-green-800">No records match your filters</p>
        <p className="text-sm text-green-400">Try adjusting the search or filter criteria.</p>
      </div>
    </td>
  </tr>
);

const SearchInput = ({ value, onChange, placeholder = 'Search\u2026' }) => (
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="pl-9 pr-4 py-2 rounded-lg border border-green-200 text-sm text-green-800 placeholder-green-300 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 w-full sm:w-56 transition-all"
    />
  </div>
);

const SelectFilter = ({ value, onChange, children }) => (
  <div className="relative">
    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400 pointer-events-none" />
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="pl-9 pr-8 py-2 rounded-lg border border-green-200 text-sm text-green-800 bg-white focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 appearance-none transition-all"
    >
      {children}
    </select>
    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-green-400 pointer-events-none" />
  </div>
);

const ExportButtons = ({ data, fileName }) => (
  <div className="flex items-center gap-2 shrink-0">
    <button
      onClick={() => exportPDF(data, fileName)}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-green-200 text-green-700 text-xs font-semibold hover:bg-green-50 transition-colors"
    >
      <Download className="w-3.5 h-3.5" /> PDF
    </button>
    <button
      onClick={() => exportExcel(data, fileName)}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors shadow-sm"
    >
      <Download className="w-3.5 h-3.5" /> Excel
    </button>
  </div>
);

const TableCard = ({ title, search, setSearch, searchPlaceholder, filters, headers, children, shown, total, label, loading, exportData, exportFileName }) => (
  <div className="relative bg-white rounded-2xl shadow-md border border-green-50 overflow-hidden min-h-100">
    {loading && <LoadingOverlay />}
    <div className="px-6 pt-5 pb-4 border-b border-green-50 flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
      <h2 className="text-lg font-bold text-green-800 shrink-0">{title}</h2>
      <div className="flex flex-wrap gap-2 w-full lg:w-auto items-center justify-between lg:justify-end">
        <div className="flex flex-wrap gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder={searchPlaceholder} />
          {filters}
        </div>
        <ExportButtons data={exportData} fileName={exportFileName} />
      </div>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-green-50/60">
            {headers.map((h) => <ThCell key={h}>{h}</ThCell>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
    {shown > 0 && (
      <div className="px-6 py-3 border-t border-green-50 bg-green-50/30">
        <p className="text-xs text-green-500">
          Showing <span className="font-semibold text-green-700">{shown}</span> of{' '}
          <span className="font-semibold text-green-700">{total}</span> {label}{total !== 1 ? 's' : ''}
        </p>
      </div>
    )}
  </div>
);

// ─── Report Sub-Components ──────────────────────────────────────────────────

const DeploymentReport = ({ data, loading }) => {
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');

  const courses = useMemo(() => [...new Set(data.map((d) => d.course))], [data]);

  const filtered = useMemo(() => data.filter((d) => {
    const t = search.toLowerCase();
    return (
      (!search || d.student.toLowerCase().includes(t) || d.company?.toLowerCase().includes(t))
      && (courseFilter === 'all' || d.course === courseFilter)
    );
  }), [search, courseFilter, data]);

  const assignedCount = data.filter((d) => d.company).length;
  const unassignedCount = data.filter((d) => !d.company).length;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Students" value={data.length} icon={Users} color="text-green-600 bg-green-100" />
        <StatCard label="Assigned to Company" value={assignedCount} icon={Briefcase} color="text-emerald-600 bg-emerald-100" />
        <StatCard label="Unassigned" value={unassignedCount} icon={AlertCircle} color="text-amber-600 bg-amber-100" />
      </div>
      <TableCard
        title="Student Deployment"
        search={search}
        setSearch={setSearch}
        searchPlaceholder="Search student or company\u2026"
        loading={loading}
        shown={filtered.length}
        total={data.length}
        label="student"
        headers={['Student Name', 'Course', 'Company', 'Coordinator']}
        exportData={data}
        exportFileName="deployment-report"
        filters={
          <SelectFilter value={courseFilter} onChange={setCourseFilter}>
            <option value="all">All Courses</option>
            {courses.map((c) => <option key={c} value={c}>{c}</option>)}
          </SelectFilter>
        }
      >
        {filtered.length === 0 ? <EmptyRows /> : filtered.map((d) => (
          <tr key={d.id} className="border-b border-green-50 hover:bg-green-50/40 transition-colors duration-150">
            <TdCell>
              <div className="flex items-center gap-3">
                <AvatarCircle name={d.student} />
                <span className="text-sm font-semibold text-green-900">{d.student}</span>
              </div>
            </TdCell>
            <TdCell>
              <div className="flex items-center gap-1.5 text-sm text-green-700">
                <BookOpen className="w-3.5 h-3.5 text-green-400 shrink-0" />
                {d.course}
              </div>
            </TdCell>
            <TdCell>
              {d.company
                ? <div className="flex items-center gap-1.5 text-sm text-green-700"><Building2 className="w-3.5 h-3.5 text-green-400 shrink-0" />{d.company}</div>
                : <span className="text-xs text-amber-500 font-medium italic">Unassigned</span>
              }
            </TdCell>
            <TdCell>
              {d.coordinator
                ? <div className="flex items-center gap-1.5 text-sm text-green-600"><User className="w-3.5 h-3.5 text-green-400 shrink-0" />{d.coordinator}</div>
                : <span className="text-xs text-green-300 italic">&mdash;</span>
              }
            </TdCell>
          </tr>
        ))}
      </TableCard>
    </>
  );
};

const AttendanceReport = ({ data, loading }) => {
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');

  const courses = useMemo(() => [...new Set(data.map((d) => d.course))], [data]);

  const enriched = useMemo(() => data.map((d) => ({
    ...d,
    completion: pct(d.rendered, d.required),
  })), [data]);

  const filtered = useMemo(() => enriched.filter((d) => {
    const t = search.toLowerCase();
    return (
      (!search || d.student.toLowerCase().includes(t) || d.company?.toLowerCase().includes(t))
      && (courseFilter === 'all' || d.course === courseFilter)
    );
  }), [search, courseFilter, enriched]);

  const totalRendered = enriched.reduce((a, b) => a + (b.rendered_hours || 0), 0);
  const avgRendered = enriched.length ? Math.round(totalRendered / enriched.length) : 0;
  const completedCount = enriched.filter((d) => d.completion >= 100).length;
  const inProgressCount = enriched.filter((d) => d.completion > 0 && d.completion < 100).length;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Avg Hours Rendered" value={`${avgRendered} hrs`} icon={TrendingUp} color="text-green-600 bg-green-100" />
        <StatCard label="Students Completed Hours" value={completedCount} icon={CheckCircle} color="text-blue-600 bg-blue-100" />
        <StatCard label="Students In Progress" value={inProgressCount} icon={Activity} color="text-emerald-600 bg-emerald-100" />
      </div>
      <TableCard
        title="Attendance Summary"
        search={search}
        setSearch={setSearch}
        searchPlaceholder="Search student or company\u2026"
        loading={loading}
        shown={filtered.length}
        total={data.length}
        label="student"
        headers={['Student', 'Course', 'Company', 'Required Hours', 'Rendered Hours', 'Completion']}
        exportData={data}
        exportFileName="attendance-report"
        filters={
          <SelectFilter value={courseFilter} onChange={setCourseFilter}>
            <option value="all">All Courses</option>
            {courses.map((c) => <option key={c} value={c}>{c}</option>)}
          </SelectFilter>
        }
      >
        {filtered.length === 0 ? <EmptyRows /> : filtered.map((d) => (
          <tr key={d.id} className="border-b border-green-50 hover:bg-green-50/40 transition-colors duration-150">
            <TdCell>
              <div className="flex items-center gap-3">
                <AvatarCircle name={d.student} />
                <div>
                  <p className="text-sm font-semibold text-green-900">{d.student}</p>
                  <p className="text-xs text-green-500">{d.course}</p>
                </div>
              </div>
            </TdCell>
            <TdCell>
              <div className="flex items-center gap-1.5 text-sm text-green-700">
                <BookOpen className="w-3.5 h-3.5 text-green-400 shrink-0" />
                {d.course}
              </div>
            </TdCell>
            <TdCell>
              {d.company
                ? <div className="flex items-center gap-1.5 text-sm text-green-700"><Building2 className="w-3.5 h-3.5 text-green-400 shrink-0" />{d.company}</div>
                : <span className="text-xs text-green-300 italic">&mdash;</span>
              }
            </TdCell>
            <TdCell>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-green-800">
                <Clock className="w-3.5 h-3.5 text-green-400" />
                {d.required} hrs
              </div>
            </TdCell>
            <TdCell>
              <span className="text-sm font-semibold text-green-800">{d.rendered} hrs</span>
            </TdCell>
            <TdCell className="min-w-40">
              <ProgressBar value={d.completion} color={progressBarColor(d.completion)} />
            </TdCell>
          </tr>
        ))}
      </TableCard>
    </>
  );
};

const CompaniesReport = ({ data, loading }) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => data.filter((d) =>
    !search || d.company.toLowerCase().includes(search.toLowerCase())
  ), [search, data]);

  const totalPlacements = data.reduce((a, b) => a + (b.assigned || 0), 0);
  const activeCompanies = data.filter((d) => (d.assigned || 0) > 0).length;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Companies" value={data.length} icon={Building2} color="text-green-600 bg-green-100" />
        <StatCard label="Active Companies" value={activeCompanies} icon={Activity} color="text-emerald-600 bg-emerald-100" />
        <StatCard label="Total Placements" value={totalPlacements} icon={GraduationCap} color="text-blue-600 bg-blue-100" />
      </div>
      <TableCard
        title="Company Overview"
        search={search}
        setSearch={setSearch}
        searchPlaceholder="Search company\u2026"
        loading={loading}
        shown={filtered.length}
        total={data.length}
        label="company"
        headers={['Company', 'Students Assigned']}
        exportData={data}
        exportFileName="companies-report"
      >
        {filtered.length === 0 ? <EmptyRows /> : filtered.map((d) => (
          <tr key={d.id} className="border-b border-green-50 hover:bg-green-50/40 transition-colors duration-150">
            <TdCell>
              <div className="flex items-center gap-3">
                <CompanyAvatar />
                <span className="text-sm font-semibold text-green-900">{d.company}</span>
              </div>
            </TdCell>
            <TdCell>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-green-400 shrink-0" />
                <span className="text-sm font-semibold text-green-800">{d.assigned ?? 0}</span>
                <span className="text-xs text-green-500">student{d.assigned !== 1 ? 's' : ''}</span>
              </div>
            </TdCell>
          </tr>
        ))}
      </TableCard>
    </>
  );
};

// ─── Main Admin Reports Component ──────────────────────────────────────────────

export default function AdminReports() {
  const [activeTab, setActiveTab] = useState('deployment');
  const [loading, setLoading] = useState(false);

  const [deploymentData, setDeploymentData] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [companiesData, setCompaniesData] = useState([]);

  const tabs = [
    { id: 'deployment', label: 'Deployment', icon: Briefcase },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'companies', label: 'Companies', icon: Building2 },
  ];

  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/admin-reports/${activeTab}`);
        switch (activeTab) {
          case 'deployment': setDeploymentData(response.data); break;
          case 'attendance': setAttendanceData(response.data); break;
          case 'companies': setCompaniesData(response.data); break;
          default: break;
        }
      } catch (error) {
        console.error(`Error fetching ${activeTab} reports:`, error);
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [activeTab]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-green-900 tracking-tight">Admin Analytics</h1>
          <p className="text-green-600 mt-1 font-medium">Monitor OJT progress and compliance across all departments</p>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 bg-green-100/50 rounded-xl w-fit border border-green-100 overflow-x-auto max-w-full">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all shrink-0 ${
                isActive
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-green-500 hover:text-green-700 hover:bg-white/50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-green-600' : 'text-green-400'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-125">
        {activeTab === 'deployment' && <DeploymentReport data={deploymentData} loading={loading} />}
        {activeTab === 'attendance' && <AttendanceReport data={attendanceData} loading={loading} />}
        {activeTab === 'companies' && <CompaniesReport data={companiesData} loading={loading} />}
      </div>
    </div>
  );
}