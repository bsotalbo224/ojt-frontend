import { Routes, Route } from "react-router-dom";
import Login from "./pages/auth/Login";
import FirstPasswordChange from "./pages/auth/FirstPasswordChange";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";

import NotificationsPage from "./pages/notifications/NotificationsPage";
import ProfilePage from "./pages/profile/ProfilePage";
import SettingsPage from "./pages/settings/SettingsPage";

import MessagesPage from "./pages/messages/MessagesPage";

import StudentDashboard from "./pages/student/StudentDashboard";
import CoordinatorDashboard from "./pages/coordinator/CoordinatorDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import NotFound from "./pages/NotFound";

import AdminStudents from "./pages/admin/AdminStudents";
import AdminCoordinators from "./pages/admin/AdminCoordinators";
import AdminDepartments from "./pages/admin/AdminDepartments";
import AdminCourses from "./pages/admin/AdminCourses";
import AdminCompanies from "./pages/admin/AdminCompanies";
import AdminReports from "./pages/admin/AdminReports";
import AdminEvaluationTemplates from "./pages/admin/AdminEvaluationTemplates";

import DailyLogs from "./pages/student/DailyLogs";
import NarrativeComposer from "./pages/student/NarrativeComposer";
import StudentAttendance from "./pages/student/StudentAttendance";
import NarrativesHistory from "./pages/student/NarrativeHistory";
import StudentProgress from "./pages/student/StudentProgress";

import CoordinatorStudents from "./pages/coordinator/CoordinatorStudents";
import CoordinatorDailyLogs from "./pages/coordinator/CoordinatorDailyLogs";
import StudentDailyLogs from "./pages/coordinator/Studentdailylogs";
import CoordinatorNarratives from "./pages/coordinator/CoordinatorNarratives";
import StudentNarrative from "./pages/coordinator/StudentNarrative";
import CoordinatorAttendance from "./pages/coordinator/CoordinatorAttendance";
import StudentAttendanceRecords from "./pages/coordinator/StudentAttendanceRecords";
import CoordinatorEvaluationResponses from "./pages/coordinator/CoordinatorEvaluationResponses";

import PublicEvaluation from "./pages/PublicEvaluation";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import MainLayout from "./components/layout/MainLayout";

function App() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/first-password-change" element={<FirstPasswordChange />} />

      <Route path="/evaluate/:token" element={<PublicEvaluation />} />

      {/* ================= STUDENT ================= */}
      <Route
        path="/student"
        element={
          <ProtectedRoute roles={["student"]}>
            <MainLayout role="student" />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<StudentDashboard />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="logs" element={<DailyLogs />} />
        <Route path="narrative" element={<NarrativeComposer />} />
        <Route path="attendance" element={<StudentAttendance />} />
        <Route path="narratives" element={<NarrativesHistory />} />
        <Route path="progress" element={<StudentProgress />} />
        <Route path="messages" element={<MessagesPage />}/>

        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />

      </Route>

      {/* ================= COORDINATOR ================= */}
      <Route
        path="/coordinator"
        element={
          <ProtectedRoute roles={["coordinator"]}>
            <MainLayout role="coordinator" />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<CoordinatorDashboard />} />
        <Route path="daily-logs" element={<CoordinatorDailyLogs />} />
        <Route path="daily-logs/:studentId" element={<StudentDailyLogs />} />
        <Route path="students" element={<CoordinatorStudents />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="narratives" element={<CoordinatorNarratives />} />
        <Route path="narratives/:studentId" element={<StudentNarrative />} />
        <Route path="attendance" element={<CoordinatorAttendance />} />
        <Route path="attendance/:studentId" element={<StudentAttendanceRecords />} />
        <Route path="responses" element={<CoordinatorEvaluationResponses />} />
        <Route path="messages" element={<MessagesPage />}/>

        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* ================= ADMIN ================= */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["admin"]}>
            <MainLayout role="admin" />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="students" element={<AdminStudents />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="coordinators" element={<AdminCoordinators />} />
        <Route path="departments" element={<AdminDepartments />} />
        <Route path="courses" element={<AdminCourses />} />
        <Route path="companies" element={<AdminCompanies />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="evaluation-templates" element={<AdminEvaluationTemplates />} />


        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;