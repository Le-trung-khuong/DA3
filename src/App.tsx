import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import LayoutAdmin from "./layout/LayoutAdmin";
import LayoutClient from "./layout/LayoutClient";
import Login from "./pages/admin/Login";
import { LoadingSpinner } from "./components/common/LoadingSpinner";

// --------------------- CLIENT PAGES ---------------------
const CourseCatalog = lazy(() => import("./pages/client/CourseCatalog"));
const CourseDetail = lazy(() => import("./pages/client/CourseDetail"));
const LessonPlayer = lazy(() => import("./pages/client/LessonPlayer"));
const NotificationsPage = lazy(() => import("./pages/client/NotificationsPage"));
const ChatRooms = lazy(() => import("./pages/client/ChatRooms"));
const ChatRoom = lazy(() => import("./pages/client/ChatRoom"));
const ProfilePage = lazy(() => import("./pages/client/ProfilePage"));
const LeaderboardPage = lazy(() => import("./pages/client/LeaderboardPage"));

// --------------------- ADMIN PAGES ---------------------
const DashboardAdmin = lazy(() => import("./pages/admin/dashboard/DashboardAdmin"));
const UserListAdmin = lazy(() => import("./pages/admin/users/UserListAdmin"));
const UserDetailAdmin = lazy(() => import("./pages/admin/users/UserDetailAdmin"));
const CourseListAdmin = lazy(() => import("./pages/admin/courses/CourseListAdmin"));
const CourseDetailAdmin = lazy(() => import("./pages/admin/courses/CourseDetailAdmin"));
const CourseFormAdmin = lazy(() => import("./pages/admin/courses/CourseFormAdmin"));
const TransactionListAdmin = lazy(() => import("./pages/admin/transactions/TransactionListAdmin"));
const LeaderboardAdmin = lazy(() => import("./pages/admin/leaderboard/LeaderboardAdmin"));
const NotificationAdmin = lazy(() => import("./pages/admin/notifications/NotificationAdmin"));
const CommunityAdmin = lazy(() => import("./pages/admin/community/CommunityAdmin"));
const ReviewListAdmin = lazy(() => import("./pages/admin/reviews/ReviewListAdmin"));
const EventManager = lazy(() => import("./pages/admin/events/EventManager"));

// Placeholder cho các trang chưa có
const PlaceholderPage = ({ title }: { title: string }) => (
  <div style={{ padding: 40, textAlign: "center" }}>
    <h2 style={{ color: "#e3dfff" }}>{title}</h2>
    <p style={{ color: "#C7C4D8", marginTop: 12 }}>Trang này đang được xây dựng.</p>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/admin/login" element={<Login />} />

          {/* Client routes */}
          <Route element={<LayoutClient />}>
            <Route index element={<Suspense fallback={<LoadingSpinner />}><CourseCatalog /></Suspense>} />
            <Route path="courses" element={<Suspense fallback={<LoadingSpinner />}><CourseCatalog /></Suspense>} />
            <Route path="courses/:courseId" element={<Suspense fallback={<LoadingSpinner />}><CourseDetail /></Suspense>} />
            <Route path="learn/:courseId/:moduleId/:lessonId" element={<Suspense fallback={<LoadingSpinner />}><LessonPlayer /></Suspense>} />
            <Route path="chat" element={<Suspense fallback={<LoadingSpinner />}><ChatRooms /></Suspense>} />
            <Route path="chat/:roomId" element={<Suspense fallback={<LoadingSpinner />}><ChatRoom /></Suspense>} />
            <Route path="notifications" element={<Suspense fallback={<LoadingSpinner />}><NotificationsPage /></Suspense>} />
            <Route path="profile" element={<Suspense fallback={<LoadingSpinner />}><ProfilePage /></Suspense>} />
            <Route path="leaderboard" element={<Suspense fallback={<LoadingSpinner />}><LeaderboardPage /></Suspense>} />
          </Route>

          {/* Admin routes */}
          <Route element={<LayoutAdmin />}>
            <Route index element={<Suspense fallback={<LoadingSpinner />}><DashboardAdmin /></Suspense>} />
            <Route path="admin/dashboard" element={<Suspense fallback={<LoadingSpinner />}><DashboardAdmin /></Suspense>} />
            <Route path="admin/analytics" element={<Suspense fallback={<LoadingSpinner />}><PlaceholderPage title="Analytics" /></Suspense>} />
            <Route path="admin/revenue" element={<Suspense fallback={<LoadingSpinner />}><PlaceholderPage title="Revenue" /></Suspense>} />
            <Route path="admin/settings" element={<Suspense fallback={<LoadingSpinner />}><PlaceholderPage title="Settings" /></Suspense>} />

            <Route path="admin/users" element={<Suspense fallback={<LoadingSpinner />}><UserListAdmin /></Suspense>} />
            <Route path="admin/users/:userId" element={<Suspense fallback={<LoadingSpinner />}><UserDetailAdmin /></Suspense>} />

            <Route path="admin/courses" element={<Suspense fallback={<LoadingSpinner />}><CourseListAdmin /></Suspense>} />
            <Route path="admin/courses/:courseId" element={<Suspense fallback={<LoadingSpinner />}><CourseDetailAdmin /></Suspense>} />
            <Route path="admin/courses/new" element={<Suspense fallback={<LoadingSpinner />}><CourseFormAdmin /></Suspense>} />
            <Route path="admin/courses/:courseId/edit" element={<Suspense fallback={<LoadingSpinner />}><CourseFormAdmin /></Suspense>} />

            <Route path="admin/reviews" element={<Suspense fallback={<LoadingSpinner />}><ReviewListAdmin /></Suspense>} />
            <Route path="admin/transactions" element={<Suspense fallback={<LoadingSpinner />}><TransactionListAdmin /></Suspense>} />
            <Route path="admin/leaderboard" element={<Suspense fallback={<LoadingSpinner />}><LeaderboardAdmin /></Suspense>} />
            <Route path="admin/notifications" element={<Suspense fallback={<LoadingSpinner />}><NotificationAdmin /></Suspense>} />
            <Route path="admin/community" element={<Suspense fallback={<LoadingSpinner />}><CommunityAdmin /></Suspense>} />
            <Route path="admin/reports" element={<Suspense fallback={<LoadingSpinner />}><CommunityAdmin /></Suspense>} />
            <Route path="admin/events" element={<Suspense fallback={<LoadingSpinner />}><EventManager /></Suspense>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;