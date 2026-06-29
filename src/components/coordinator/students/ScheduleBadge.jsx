import { CalendarClock } from 'lucide-react';
import { analyzeShift } from '../../../utils/shiftUtils';
import { formatTime12h } from '../../../utils/attendanceUtils';

const DEFAULT_START = '08:30';
const DEFAULT_END = '17:00';

const STYLE_DEFAULT = { bg: `rgb(var(--primary-50))`, border: `rgb(var(--primary-100))`, text: `rgb(var(--primary-700))` };
const STYLE_NIGHT_SHIFT = { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9' };
const STYLE_HALF_DAY = { bg: '#fefce8', border: '#fde68a', text: '#a16207' };

const getShiftTypeStyle = ({ isHalfDay, isNightShift }) => {
  if (isHalfDay) return STYLE_HALF_DAY;
  if (isNightShift) return STYLE_NIGHT_SHIFT;
  return STYLE_DEFAULT;
};

const ScheduleBadge = ({ startTime, endTime }) => {
  const normalizedStart = startTime || `${DEFAULT_START}:00`;
  const normalizedEnd = endTime || `${DEFAULT_END}:00`;

  const formattedStart = formatTime12h(normalizedStart);
  const formattedEnd = formatTime12h(normalizedEnd);
  const shiftInfo = analyzeShift(normalizedStart, normalizedEnd);
  const { shiftType } = shiftInfo;
  const typeStyle = getShiftTypeStyle(shiftInfo);

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
        style={{ background: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))`, color: `rgb(var(--primary-700))` }}>
        <CalendarClock className="w-3 h-3 shrink-0" />{`${formattedStart} – ${formattedEnd}`}
      </span>
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
        style={{ background: typeStyle.bg, border: `1px solid ${typeStyle.border}`, color: typeStyle.text }}>
        {shiftType}
      </span>
    </div>
  );
};

export default ScheduleBadge;