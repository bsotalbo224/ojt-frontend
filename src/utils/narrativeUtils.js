export const formatLastSaved = (date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });