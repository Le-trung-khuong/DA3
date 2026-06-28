/**
 * src/pages/client/ChatRooms.tsx
 * Danh sách phòng chat – chia PUBLIC / PREMIUM COMMUNITIES
 * ✅ UI Polish: phân biệt rõ Public vs Premium, card hover, premium glow, empty state đẹp hơn
 */

"use client";

import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useCollection } from "../../hooks/useFirestore";
import { where } from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import { useOwnPresence } from "../../hooks/usePresence";
import {
  Search,
  Hash,
  Users,
  MessageSquare,
  Clock,
  Lock,
  Loader,
  Crown,
  MessageCircle,
} from "lucide-react";
import type { ChatRoom } from "../../types/chat";

// ─── Helpers ─────────────────────────────────────────────────────────────

const toMillis = (value: any): number => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  return 0;
};

const timeAgo = (value: any) => {
  const millis = toMillis(value);
  if (millis === 0) return "just now";
  const s = (Date.now() - millis) / 1000;
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const fmtNum = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact" }).format(n);

const ROOM_TYPE_LABEL: Record<ChatRoom["type"], string> = {
  general: "General",
  study: "Study",
  course: "Course",
  announcement: "Announcement",
};

// ─── Main Component ──────────────────────────────────────────────────────

export default function ChatRooms() {
  const [search, setSearch] = useState("");
  const { currentUser, userProfile } = useAuth();

  useOwnPresence(currentUser?.uid);

  const { data: roomsData, loading, error } = useCollection<ChatRoom>(
    "chat_rooms",
    [where("isActive", "==", true)],
    []
  );

  const rooms = (roomsData || []) as ChatRoom[];

  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(true);

  React.useEffect(() => {
    if (!currentUser) {
      setEnrolledCourseIds([]);
      setLoadingEnrollments(false);
      return;
    }
    import("../../services/enrollmentService")
      .then(({ getUserEnrolledCourses }) =>
        getUserEnrolledCourses(currentUser.uid)
      )
      .then((ids) => {
        setEnrolledCourseIds(ids);
        setLoadingEnrollments(false);
      })
      .catch(() => setLoadingEnrollments(false));
  }, [currentUser]);

  const { publicRooms, communityRooms } = useMemo(() => {
    const publicList: ChatRoom[] = [];
    const communityList: ChatRoom[] = [];

    rooms.forEach((room) => {
      if (room.type === "course" && room.isPrivate === true) {
        const isInstructor = room.instructorId === currentUser?.uid;
        const isEnrolled = room.courseId
          ? enrolledCourseIds.includes(room.courseId)
          : false;
        const isAdmin = userProfile?.role === "admin";
        if (isInstructor || isEnrolled || isAdmin) {
          communityList.push(room);
        }
      } else {
        publicList.push(room);
      }
    });

    const sortFn = (a: ChatRoom, b: ChatRoom) =>
      toMillis(b.lastMessageAt) - toMillis(a.lastMessageAt);

    return {
      publicRooms: publicList.sort(sortFn),
      communityRooms: communityList.sort(sortFn),
    };
  }, [rooms, currentUser, enrolledCourseIds, userProfile]);

  const filteredPublic = useMemo(() => {
    if (!search.trim()) return publicRooms;
    const q = search.toLowerCase();
    return publicRooms.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
    );
  }, [publicRooms, search]);

  const filteredCommunity = useMemo(() => {
    if (!search.trim()) return communityRooms;
    const q = search.toLowerCase();
    return communityRooms.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
    );
  }, [communityRooms, search]);

  if (loading || loadingEnrollments) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "60vh",
        }}
      >
        <Loader
          size={36}
          color="#6C63FF"
          style={{ animation: "spin 0.8s linear infinite" }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "#ffb4ab" }}>
        <p>Error loading chat rooms: {error.message}</p>
      </div>
    );
  }

  // ── Public room card ──
  const renderPublicCard = (room: ChatRoom) => {
    const unreadCount = currentUser?.uid
      ? room.unreadCount?.[currentUser.uid] || 0
      : 0;

    return (
      <Link
        key={room.id}
        to={`/chat/${room.id}`}
        style={{ textDecoration: "none", display: "block" }}
      >
        <div
          style={{
            background: "rgba(26,26,46,0.6)",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.07)",
            padding: "20px 24px",
            transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
            cursor: "pointer",
            height: "100%",
            position: "relative",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = "translateY(-3px)";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)";
            e.currentTarget.style.borderColor = "rgba(108,99,255,0.25)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
          }}
        >
          {/* Unread badge */}
          {unreadCount > 0 && (
            <div
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                background: "#EF4444",
                color: "#fff",
                borderRadius: 999,
                padding: "2px 9px",
                fontSize: 11,
                fontWeight: 700,
                lineHeight: "18px",
              }}
            >
              {unreadCount}
            </div>
          )}

          {/* Icon + name row */}
          <div
            style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Hash size={20} color="#fff" />
            </div>
            <div>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#E4E1EE",
                  marginBottom: 4,
                  lineHeight: 1.2,
                }}
              >
                #{room.name}
              </h3>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: ".05em",
                    color: "#C7C4D8",
                    background: "rgba(255,255,255,0.07)",
                    padding: "2px 8px",
                    borderRadius: 999,
                  }}
                >
                  {ROOM_TYPE_LABEL[room.type] || room.type}
                </span>
                {room.isLocked && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: ".05em",
                      color: "#FFB785",
                      background: "rgba(255,183,133,0.1)",
                      padding: "2px 8px",
                      borderRadius: 999,
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <Lock size={9} /> Locked
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <p
            style={{
              fontSize: 13,
              color: "#9694A8",
              marginBottom: 14,
              lineHeight: 1.55,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {room.description}
          </p>

          {/* Stats */}
          <div
            style={{
              display: "flex",
              gap: 14,
              fontSize: 12,
              color: "#6B6882",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Users size={12} /> {fmtNum(room.memberCount)}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <MessageSquare size={12} /> {fmtNum(room.messageCount)}
            </span>
          </div>

          {/* Last message */}
          {room.lastMessage && (
            <div
              style={{
                fontSize: 11,
                color: "#47464f",
                borderTop: "1px solid rgba(255,255,255,0.05)",
                paddingTop: 10,
                marginTop: 12,
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "70%",
                }}
              >
                <span style={{ color: "#6B6882", fontWeight: 600 }}>
                  {room.lastMessageUser}:
                </span>{" "}
                {room.lastMessage}
              </span>
              {room.lastMessageAt && (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    flexShrink: 0,
                  }}
                >
                  <Clock size={10} /> {timeAgo(room.lastMessageAt)}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    );
  };

  // ── Premium community card ──
  const renderCommunityCard = (room: ChatRoom) => {
    const unreadCount = currentUser?.uid
      ? room.unreadCount?.[currentUser.uid] || 0
      : 0;

    return (
      <Link
        key={room.id}
        to={`/chat/${room.id}`}
        style={{ textDecoration: "none", display: "block" }}
      >
        <div
          style={{
            background: "rgba(26,26,46,0.75)",
            borderRadius: 20,
            border: "1px solid rgba(255,215,0,0.18)",
            padding: "20px 24px",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
            cursor: "pointer",
            height: "100%",
            position: "relative",
            boxShadow: unreadCount > 0
              ? "0 0 18px rgba(255,215,0,0.07)"
              : "none",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = "translateY(-4px)";
            e.currentTarget.style.boxShadow =
              "0 14px 32px rgba(0,0,0,0.35), 0 0 28px rgba(255,215,0,0.08)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow =
              unreadCount > 0 ? "0 0 18px rgba(255,215,0,0.07)" : "none";
          }}
        >
          {/* Unread badge */}
          {unreadCount > 0 && (
            <div
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                background: "#EF4444",
                color: "#fff",
                borderRadius: 999,
                padding: "2px 9px",
                fontSize: 11,
                fontWeight: 700,
                lineHeight: "18px",
              }}
            >
              {unreadCount}
            </div>
          )}

          {/* Icon + name row */}
          <div
            style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "linear-gradient(135deg,#FFD700,#FFA500)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 4px 12px rgba(255,215,0,0.25)",
              }}
            >
              <Crown size={20} color="#1a1a2e" />
            </div>
            <div>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#E4E1EE",
                  marginBottom: 4,
                  lineHeight: 1.2,
                }}
              >
                {room.name}
              </h3>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: ".06em",
                    color: "#FFD700",
                    background: "rgba(255,215,0,0.12)",
                    padding: "2px 8px",
                    borderRadius: 999,
                  }}
                >
                  PREMIUM
                </span>
                {room.isLocked && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#FFB785",
                      background: "rgba(255,183,133,0.1)",
                      padding: "2px 8px",
                      borderRadius: 999,
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <Lock size={9} /> Locked
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <p
            style={{
              fontSize: 13,
              color: "#9694A8",
              marginBottom: 14,
              lineHeight: 1.55,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {room.description}
          </p>

          {/* Stats */}
          <div
            style={{
              display: "flex",
              gap: 14,
              fontSize: 12,
              color: "#6B6882",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Users size={12} /> {fmtNum(room.memberCount)}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <MessageSquare size={12} /> {fmtNum(room.messageCount)}
            </span>
          </div>

          {/* Last message */}
          {room.lastMessage && (
            <div
              style={{
                fontSize: 11,
                color: "#47464f",
                borderTop: "1px solid rgba(255,215,0,0.08)",
                paddingTop: 10,
                marginTop: 12,
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "70%",
                }}
              >
                <span style={{ color: "#6B6882", fontWeight: 600 }}>
                  {room.lastMessageUser}:
                </span>{" "}
                {room.lastMessage}
              </span>
              {room.lastMessageAt && (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    flexShrink: 0,
                  }}
                >
                  <Clock size={10} /> {timeAgo(room.lastMessageAt)}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    );
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: "#E4E1EE",
            marginBottom: 6,
            letterSpacing: "-0.5px",
          }}
        >
          Community Chat
        </h1>
        <p style={{ fontSize: 15, color: "#9694A8" }}>
          Join discussions with fellow learners and instructors
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ position: "relative", maxWidth: 400 }}>
          <Search
            size={15}
            style={{
              position: "absolute",
              left: 13,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#6B6882",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search rooms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: "10px 12px 10px 38px",
              color: "#E4E1EE",
              fontSize: 14,
              outline: "none",
              transition: "border-color 0.2s",
              boxSizing: "border-box",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(108,99,255,0.4)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
            }}
          />
        </div>
      </div>

      {/* ─── PUBLIC ROOMS ─── */}
      <div style={{ marginBottom: 48 }}>
        {/* Section header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 20,
            paddingBottom: 10,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <MessageCircle size={18} color="#6C63FF" />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE" }}>
            Public Rooms
          </h2>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#6B6882",
              marginLeft: "auto",
            }}
          >
            {filteredPublic.length} rooms
          </span>
        </div>

        {filteredPublic.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 24px",
              color: "#6B6882",
              background: "rgba(255,255,255,0.02)",
              borderRadius: 16,
              border: "1px dashed rgba(255,255,255,0.06)",
            }}
          >
            <MessageSquare
              size={28}
              style={{ opacity: 0.3, marginBottom: 10, display: "inline-block" }}
            />
            <p style={{ fontSize: 14 }}>No public rooms match your search.</p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {filteredPublic.map(renderPublicCard)}
          </div>
        )}
      </div>

      {/* ─── PREMIUM COMMUNITIES ─── */}
      <div>
        {/* Section header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 20,
            paddingBottom: 10,
            borderBottom: "2px solid rgba(255,215,0,0.18)",
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#FFD700,#FFA500)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 2px 8px rgba(255,215,0,0.25)",
            }}
          >
            <Crown size={14} color="#1a1a2e" />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#FFD700" }}>
            Premium Communities
          </h2>
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: ".08em",
              color: "#FFD700",
              background: "rgba(255,215,0,0.12)",
              padding: "3px 10px",
              borderRadius: 999,
            }}
          >
            EXCLUSIVE
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#6B6882",
              marginLeft: "auto",
            }}
          >
            {filteredCommunity.length} communities
          </span>
        </div>

        {filteredCommunity.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "56px 32px",
              color: "#9694A8",
              background: "rgba(255,215,0,0.025)",
              borderRadius: 20,
              border: "2px dashed rgba(255,215,0,0.12)",
            }}
          >
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: "50%",
                background: "rgba(255,215,0,0.07)",
                border: "1px solid rgba(255,215,0,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <Crown size={28} color="#FFD700" style={{ opacity: 0.55 }} />
            </div>
            <p
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#E4E1EE",
                marginBottom: 6,
              }}
            >
              No Premium Communities Yet
            </p>
            <p
              style={{
                fontSize: 13,
                color: "#6B6882",
                maxWidth: 380,
                margin: "0 auto 20px",
                lineHeight: 1.6,
              }}
            >
              Enroll in a course with community enabled to access exclusive
              discussions with instructors and fellow students.
            </p>
            <Link
              to="/courses"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 24px",
                borderRadius: 12,
                background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
                color: "#fff",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 14,
                transition: "opacity 0.2s",
              }}
            >
              Browse Courses →
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {filteredCommunity.map(renderCommunityCard)}
          </div>
        )}
      </div>
    </div>
  );
}