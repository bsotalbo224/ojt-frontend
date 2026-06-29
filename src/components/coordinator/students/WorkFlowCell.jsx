import { formatTime12h } from '../../../utils/attendanceUtils';


const WorkflowCell = ({ start, end, inProgressLabel = 'In progress' }) => {
  if (!start && !end) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
      style={{ backgroundColor: '#f3f4f6', color: '#9ca3af', border: '1px solid #e5e7eb' }}>—</span>
  );
  if (start && !end) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
      style={{ backgroundColor: '#fefce8', color: '#a16207', border: '1px solid #fef08a' }}>
      {inProgressLabel}
    </span>
  );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
      {formatTime12h(start)} → {formatTime12h(end)}
    </span>
  );
};

export default WorkflowCell;