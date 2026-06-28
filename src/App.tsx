// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { PomodoroProvider } from "./contexts/PomodoroContext";
import LayoutAdmin from "./layout/LayoutAdmin";
import LayoutClient from "./layout/LayoutClient";
import LayoutInstructor from "./layout/LayoutInstructor";
import Login from "./pages/admin/Login";          // vẫn dùng component cũ, chỉ đổi route
import Register from "./pages/client/Register";
import { LoadingSpinner } from "./components/common/LoadingSpinner";

// --------------------- CLIENT PAGES ---------------------
const Home             = lazy(() => import("./pages/client/Home"));
const CourseCatalog    = lazy(() => import("./pages/client/CourseCatalog"));
const CourseDetail     = lazy(() => import("./pages/client/CourseDetail"));
const LessonPlayer     = lazy(() => import("./pages/client/LessonPlayer"));
const NotificationsPage = lazy(() => import("./pages/client/NotificationsPage"));
const ChatRooms        = lazy(() => import("./pages/client/ChatRooms"));
const ChatRoom         = lazy(() => import("./pages/client/ChatRoom"));
const ProfilePage      = lazy(() => import("./pages/client/ProfilePage"));
const LeaderboardPage  = lazy(() => import("./pages/client/LeaderboardPage"));

// --------------------- ADMIN PAGES ---------------------
const DashboardAdmin      = lazy(() => import("./pages/admin/dashboard/DashboardAdmin"));
const UserListAdmin       = lazy(() => import("./pages/admin/users/UserListAdmin"));
const UserDetailAdmin     = lazy(() => import("./pages/admin/users/UserDetailAdmin"));
const CourseListAdmin     = lazy(() => import("./pages/admin/courses/CourseListAdmin"));
const CourseDetailAdmin   = lazy(() => import("./pages/admin/courses/CourseDetailAdmin"));
const CourseFormAdmin     = lazy(() => import("./pages/admin/courses/CourseFormAdmin"));
const TransactionListAdmin = lazy(() => import("./pages/admin/transactions/TransactionListAdmin"));
const LeaderboardAdmin    = lazy(() => import("./pages/admin/leaderboard/LeaderboardAdmin"));
const NotificationAdmin   = lazy(() => import("./pages/admin/notifications/NotificationAdmin"));
const CommunityAdmin      = lazy(() => import("./pages/admin/community/CommunityAdmin"));
const ReviewListAdmin     = lazy(() => import("./pages/admin/reviews/ReviewListAdmin"));
const EventManager        = lazy(() => import("./pages/admin/events/EventManager"));

// --------------------- INSTRUCTOR PAGES ---------------------
const InstructorDashboard = lazy(() => import("./pages/instructor/InstructorDashboard"));
const InstructorCourseList = lazy(() => import("./pages/instructor/InstructorCourseList"));
const InstructorEarnings   = lazy(() => import("./pages/instructor/InstructorEarnings"));

// Placeholder
const PlaceholderPage = ({ title }: { title: string }) => (
  <div style={{ padding: 40, textAlign: "center" }}>
    <h2 style={{ color: "#e3dfff" }}>{title}</h2>
    <p style={{ color: "#C7C4D8", marginTop: 12 }}>Trang này đang được xây dựng.</p>
  </div>
);

const Wrap = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
);

function App() {
  return (
    <AuthProvider>
      <PomodoroProvider>
        <BrowserRouter>
          <Routes>

            {/* ── Auth (ngoài layout) ── */}
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Giữ backward-compat: ai vào /admin/login cũ → redirect về /login */}
            <Route path="/admin/login" element={<Navigate to="/login" replace />} />

            {/* ── Client routes ── */}
            <Route element={<LayoutClient />}>
              <Route index element={<Wrap><Home /></Wrap>} />
              <Route path="courses"                               element={<Wrap><CourseCatalog /></Wrap>} />
              <Route path="courses/:courseId"                     element={<Wrap><CourseDetail /></Wrap>} />
              <Route path="learn/:courseId/:moduleId/:lessonId"   element={<Wrap><LessonPlayer /></Wrap>} />
              <Route path="chat"                                  element={<Wrap><ChatRooms /></Wrap>} />
              <Route path="chat/:roomId"                          element={<Wrap><ChatRoom /></Wrap>} />
              <Route path="notifications"                         element={<Wrap><NotificationsPage /></Wrap>} />
              <Route path="profile"                               element={<Wrap><ProfilePage /></Wrap>} />
              <Route path="leaderboard"                           element={<Wrap><LeaderboardPage /></Wrap>} />
            </Route>

            {/* ── Admin routes ── */}
            <Route element={<LayoutAdmin />}>
              {/* /admin → dashboard */}
              <Route path="admin"                element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="admin/dashboard"      element={<Wrap><DashboardAdmin /></Wrap>} />
              <Route path="admin/analytics"      element={<Wrap><PlaceholderPage title="Analytics" /></Wrap>} />
              <Route path="admin/revenue"        element={<Wrap><PlaceholderPage title="Revenue" /></Wrap>} />
              <Route path="admin/settings"       element={<Wrap><PlaceholderPage title="Settings" /></Wrap>} />

              <Route path="admin/users"          element={<Wrap><UserListAdmin /></Wrap>} />
              <Route path="admin/users/:userId"  element={<Wrap><UserDetailAdmin /></Wrap>} />

              <Route path="admin/courses"                       element={<Wrap><CourseListAdmin /></Wrap>} />
              <Route path="admin/courses/new"                   element={<Wrap><CourseFormAdmin /></Wrap>} />
              <Route path="admin/courses/:courseId"             element={<Wrap><CourseDetailAdmin /></Wrap>} />
              <Route path="admin/courses/:courseId/edit"        element={<Wrap><CourseFormAdmin /></Wrap>} />

              <Route path="admin/reviews"        element={<Wrap><ReviewListAdmin /></Wrap>} />
              <Route path="admin/transactions"   element={<Wrap><TransactionListAdmin /></Wrap>} />
              <Route path="admin/leaderboard"    element={<Wrap><LeaderboardAdmin /></Wrap>} />
              <Route path="admin/notifications"  element={<Wrap><NotificationAdmin /></Wrap>} />
              <Route path="admin/community"      element={<Wrap><CommunityAdmin /></Wrap>} />
              <Route path="admin/reports"        element={<Wrap><CommunityAdmin /></Wrap>} />
              <Route path="admin/events"         element={<Wrap><EventManager /></Wrap>} />
            </Route>

            {/* ── Instructor routes ── */}
            <Route element={<LayoutInstructor />}>
              <Route path="instructor/dashboard" element={<Wrap><InstructorDashboard /></Wrap>} />
              <Route path="instructor/courses"   element={<Wrap><InstructorCourseList /></Wrap>} />
              <Route path="instructor/earnings"  element={<Wrap><InstructorEarnings /></Wrap>} />
            </Route>

          </Routes>
        </BrowserRouter>
      </PomodoroProvider>
    </AuthProvider>
  );
}

export default App;