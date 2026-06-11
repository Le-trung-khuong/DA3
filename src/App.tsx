import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import LayoutAdmin from "./layout/LayoutAdmin";
import Login from "./pages/admin/Login";

// Admin pages
import UserListAdmin from "./pages/admin/users/UserListAdmin";
import UserDetailAdmin from "./pages/admin/users/UserDetailAdmin";
import CourseListAdmin from "./pages/admin/courses/CourseListAdmin";
import CourseDetailAdmin from "./pages/admin/courses/CourseDetailAdmin";
import CourseFormAdmin from "./pages/admin/courses/CourseFormAdmin";
import TransactionListAdmin from "./pages/admin/transactions/TransactionListAdmin";
import LeaderboardAdmin from "./pages/admin/leaderboard/LeaderboardAdmin";
import NotificationAdmin from "./pages/admin/notifications/NotificationAdmin";
import CommunityAdmin from "./pages/admin/community/CommunityAdmin";
import DashboardAdmin from "./pages/admin/dashboard/DashboardAdmin";
import EventManager from "./pages/admin/events/EventManager"; // ✅ thêm

// Client pages
import LayoutClient from "./layout/LayoutClient";
import CourseCatalog from "./pages/client/CourseCatalog";
import CourseDetail from "./pages/client/CourseDetail";
import LessonPlayer from "./pages/client/LessonPlayer";
import NotificationsPage from "./pages/client/NotificationsPage";
import ReviewListAdmin from "./pages/admin/reviews/ReviewListAdmin";
import ChatRooms from "./pages/client/ChatRooms";
import ChatRoom from "./pages/client/ChatRoom";
import ProfilePage from "./pages/client/ProfilePage";
import LeaderboardPage from "./pages/client/LeaderboardPage";

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
            <Route index element={<CourseCatalog />} />
            <Route path="courses" element={<CourseCatalog />} />
            <Route path="courses/:courseId" element={<CourseDetail />} />
            <Route path="learn/:courseId/:moduleId/:lessonId" element={<LessonPlayer />} />
            <Route path="chat" element={<ChatRooms />} />
            <Route path="chat/:roomId" element={<ChatRoom />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
          </Route>

          {/* Admin routes */}
          <Route path="/" element={<LayoutAdmin />}>
            <Route index element={<DashboardAdmin />} />
            <Route path="admin/dashboard" element={<DashboardAdmin />} />
            <Route path="admin/analytics" element={<PlaceholderPage title="Analytics" />} />
            <Route path="admin/revenue" element={<PlaceholderPage title="Revenue" />} />
            <Route path="admin/settings" element={<PlaceholderPage title="Settings" />} />

            <Route path="admin/users" element={<UserListAdmin />} />
            <Route path="admin/users/:userId" element={<UserDetailAdmin />} />

            <Route path="admin/courses" element={<CourseListAdmin />} />
            <Route path="admin/courses/:courseId" element={<CourseDetailAdmin />} />
            <Route path="admin/courses/new" element={<CourseFormAdmin />} />
            <Route path="admin/courses/:courseId/edit" element={<CourseFormAdmin />} />

            <Route path="admin/reviews" element={<ReviewListAdmin />} />
            <Route path="/admin/dashboard" element={<DashboardAdmin />} />
            <Route path="admin/transactions" element={<TransactionListAdmin />} />
            <Route path="admin/leaderboard" element={<LeaderboardAdmin />} />
            <Route path="admin/notifications" element={<NotificationAdmin />} />
            <Route path="admin/community" element={<CommunityAdmin />} />
            <Route path="admin/reports" element={<CommunityAdmin />} />
            <Route path="admin/events" element={<EventManager />} /> {/* ✅ thêm */}
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;