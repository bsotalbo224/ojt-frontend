import { Building2, X, Loader2, AlertCircle, CalendarClock } from 'lucide-react';
import { formatTime12h } from '../../../utils/attendanceUtils';
import { analyzeShift } from '../../../utils/shiftUtils';

const DEFAULT_START = '08:30';
const DEFAULT_END = '17:00';

const INPUT_CLASS =
  'w-full px-3 py-2.5 text-sm rounded-lg outline-none transition-shadow border ' +
  'border-[rgb(var(--primary-200))] bg-[rgb(var(--primary-50))] text-[rgb(var(--primary-800))] ' +
  'focus:border-[rgb(var(--primary-400))] focus:shadow-[0_0_0_2px_rgb(var(--primary-200))]';

const SELECT_CLASS =
  'w-full px-3 py-2.5 text-sm rounded-lg outline-none transition-shadow appearance-none cursor-pointer border ' +
  'border-[rgb(var(--primary-200))] bg-[rgb(var(--primary-50))] text-[rgb(var(--primary-800))] ' +
  'focus:border-[rgb(var(--primary-300))] focus:shadow-[0_0_0_2px_rgb(var(--primary-300))]';

const CLOSE_BUTTON_CLASS =
  'w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-150 ' +
  'text-[rgb(var(--primary-400))] hover:text-[rgb(var(--primary-700))] hover:bg-[rgb(var(--primary-50))]';

const CANCEL_BUTTON_CLASS =
  'px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150 ' +
  'text-[rgb(var(--primary-700))] bg-[rgb(var(--primary-50))] hover:bg-[rgb(var(--primary-100))]';

const SUBMIT_BUTTON_CLASS =
  'inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors duration-150 shadow-sm ' +
  'disabled:cursor-not-allowed disabled:opacity-50 ' +
  'bg-[rgb(var(--primary-600))] enabled:hover:bg-[rgb(var(--primary-700))]';

const getStudentName = (student) =>
  [student?.f_name, student?.l_name].filter(Boolean).join(' ') || 'Unknown Student';

const isActiveCompany = (company) => Number(company.is_active) === 1;

const getShiftPreviewStyle = ({ isHalfDay, isNightShift }) => {
  if (isHalfDay) return { background: '#fefce8', border: '#fde68a', color: '#a16207' };
  if (isNightShift) return { background: '#f5f3ff', border: '#ddd6fe', color: '#6d28d9' };
  return { background: `rgb(var(--primary-50))`, border: `rgb(var(--primary-100))`, color: `rgb(var(--primary-700))` };
};

const AssignCompanyModal = ({
  student, companies, loadingCompanies,
  selectedCompanyId, onSelectCompany,
  startTime, endTime, onStartTime, onEndTime,
  onSubmit, onClose, submitting,
}) => {
  const studentName = getStudentName(student);
  const companyName = student?.company || student?.company_name || null;
  const hasCompany = Boolean(companyName);
  const hasSchedule = Boolean(student?.start_time || student?.end_time);
  const activeCompanies = companies.filter(isActiveCompany);

  const previewShift = analyzeShift(startTime, endTime);
  const previewStyle = getShiftPreviewStyle(previewShift);

  return (
    <>
      <div className="fixed inset-0 z-9998 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-xl"
          style={{ border: `1px solid rgb(var(--primary-100))`, animation: 'modalIn 0.2s ease-out forwards' }}>
          <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `rgb(var(--primary-50))` }}>
                <Building2 className="w-4 h-4" style={{ color: `rgb(var(--primary-600))` }} />
              </div>
              <div>
                <h3 className="text-base font-bold" style={{ color: `rgb(var(--primary-800))` }}>
                  {hasCompany ? 'Change Company & Schedule' : 'Assign Company & Schedule'}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: `rgb(var(--primary-500))` }}>{studentName}</p>
              </div>
            </div>
            <button onClick={onClose} title="Close" aria-label="Close" className={CLOSE_BUTTON_CLASS}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            {hasCompany && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg"
                style={{ backgroundColor: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))` }}>
                <Building2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: `rgb(var(--primary-500))` }} />
                <p className="text-xs" style={{ color: `rgb(var(--primary-700))` }}>
                  <span className="font-semibold">Current: </span>{companyName}
                  {hasSchedule && (
                    <span className="ml-2 opacity-70">· {formatTime12h(student.start_time) ?? DEFAULT_START} – {formatTime12h(student.end_time) ?? DEFAULT_END}</span>
                  )}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="assign-company-select" className="block text-sm font-semibold" style={{ color: `rgb(var(--primary-800))` }}>Select Company</label>
              {loadingCompanies ? (
                <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg" style={{ border: `1px solid rgb(var(--primary-200))`, backgroundColor: `rgb(var(--primary-50))` }}>
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: `rgb(var(--primary-500))` }} />
                  <span className="text-sm" style={{ color: `rgb(var(--primary-500))` }}>Loading companies…</span>
                </div>
              ) : (
                <select id="assign-company-select" value={selectedCompanyId ?? ''} onChange={(e) => onSelectCompany(e.target.value)} className={SELECT_CLASS}>
                  <option value="" disabled>— Choose a company —</option>
                  {activeCompanies.map((c) => (
                    <option key={c.company_id} value={c.company_id}>{c.company_name}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-3.5 h-3.5" style={{ color: `rgb(var(--primary-500))` }} />
                  <span className="text-sm font-semibold" style={{ color: `rgb(var(--primary-800))` }}>Work Schedule</span>
                </div>
                {startTime && endTime && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: previewStyle.background, border: `1px solid ${previewStyle.border}`, color: previewStyle.color }}>
                    {previewShift.shiftType}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="assign-start-time" className="text-xs font-semibold uppercase tracking-wide" style={{ color: `rgb(var(--primary-600))` }}>Start Time</label>
                  <input id="assign-start-time" type="time" value={startTime} onChange={(e) => onStartTime(e.target.value)} className={INPUT_CLASS} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="assign-end-time" className="text-xs font-semibold uppercase tracking-wide" style={{ color: `rgb(var(--primary-600))` }}>End Time</label>
                  <input id="assign-end-time" type="time" value={endTime} onChange={(e) => onEndTime(e.target.value)} className={INPUT_CLASS} />
                </div>
              </div>
              <p className="text-[11px] mt-2 flex items-start gap-1" style={{ color: `rgb(var(--primary-400))` }}>
                <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                Schedule is informational only — supports night shifts, overtime, and weekend duty.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 pb-5">
            <button onClick={onClose} className={CANCEL_BUTTON_CLASS}>
              Cancel
            </button>
            <button onClick={onSubmit} disabled={!selectedCompanyId || submitting || loadingCompanies} className={SUBMIT_BUTTON_CLASS}>
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {hasCompany ? 'Update Assignment' : 'Assign Company'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AssignCompanyModal;