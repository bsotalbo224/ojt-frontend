// Native browser Notification API helper.
// Does not touch src/api/notification.js or the DB notification system.

function canShowBrowserNotification() {
  try {
    return (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    );
  } catch {
    return false;
  }
}

// Shows a native browser notification. Safe to call unconditionally —
// checks support/permission internally and never throws.
function showBrowserNotification({ title, body, icon, data, onClick } = {}) {
  if (!canShowBrowserNotification()) return null;

  let notification;
  try {
    notification = new Notification(title || "New message", {
      body: body || "",
      ...(icon ? { icon } : {}),
      data,
    });
  } catch (err) {
    console.error("[browserNotifications] Failed to show notification:", err);
    return null;
  }

  notification.onclick = () => {
    try {
      window.focus();
    } catch {
      // ignore
    }
    if (typeof onClick === "function") {
      try {
        onClick(data);
      } catch (err) {
        console.error("[browserNotifications] onClick handler failed:", err);
      }
    }
    try {
      notification.close();
    } catch {
      // ignore
    }
  };

  return notification;
}

export { canShowBrowserNotification, showBrowserNotification };