/**
 * src/pages/client/ChatRooms.tsx
 * Danh sách phòng chat (chỉ hiển thị phòng isActive === true)
 */

"use client";

import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useCollection } from "../../hooks/useFirestore";
import { where } from "firebase/firestore";
import { Search, Hash, Users, MessageSquare, Clock, Lock, Loader } from "lucide-react";

interface ChatRoom {
  id: string;
  name: string;
  description: string;
  type: "general" | "study" | "course" | "announcement";
  isActive: boolean;
  isLocked: boolean;
  memberCount: number;
  messageCount: number;
  lastMessage?: string;
  lastMessageAt?: any; // Timestamp from Firestore
  lastMessageUser?: string;
}

// Helper chuyển Timestamp hoặc Date thành milliseconds
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

const fmtNum = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(n);

const ROOM_TYPE_LABEL: Record<ChatRoom["type"], string> = {
  general: "General",
  study: "Study",
  course: "Course",
  announcement: "Announcement",
};

export default function ChatRooms() {
  const [search, setSearch] = useState("");

  const { data: roomsData, loading, error } = useCollection<ChatRoom>(
    "chat_rooms",
    [where("isActive", "==", true)],
    []
  );

  const rooms = (roomsData || []) as ChatRoom[];

  // Sort client-side: mới nhất lên đầu
  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      const timeA = toMillis(a.lastMessageAt);
      const timeB = toMillis(b.lastMessageAt);
      return timeB - timeA;
    });
  }, [rooms]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sortedRooms;
    const q = search.toLowerCase();
    return sortedRooms.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
    );
  }, [sortedRooms, search]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <Loader size={36} color="#6C63FF" style={{ animation: "spin 0.8s linear infinite" }} />
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

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#E4E1EE", marginBottom: 8 }}>
          Community Chat
        </h1>
        <p style={{ fontSize: 16, color: "#C7C4D8" }}>
          Join discussions with fellow learners and instructors
        </p>
      </div>

      <div style={{ marginBottom: 32 }}>
        <div style={{ position: "relative", maxWidth: 400 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#C7C4D8" }} />
          <input
            type="text"
            placeholder="Search rooms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              background: "#0d0d18",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: "10px 12px 10px 36px",
              color: "#E4E1EE",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#C7C4D8" }}>
          <MessageSquare size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
          <p>No chat rooms available.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
          {filtered.map((room) => (
            <Link
              key={room.id}
              to={`/chat/${room.id}`}
              style={{ textDecoration: "none", display: "block" }}
            >
              <div
                style={{
                  background: "rgba(26,26,46,0.7)",
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.06)",
                  padding: 20,
                  transition: "transform 0.2s, box-shadow 0.2s",
                  cursor: "pointer",
                  height: "100%",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 12px 30px rgba(0,0,0,0.3)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Hash size={24} color="#fff" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE", marginBottom: 4 }}>
                      #{room.name}
                    </h3>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#c4c0ff",
                        background: "rgba(108,99,255,0.12)",
                        padding: "2px 8px",
                        borderRadius: 999,
                      }}
                    >
                      {ROOM_TYPE_LABEL[room.type]}
                    </span>
                  </div>
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: "#C7C4D8",
                    marginBottom: 16,
                    lineHeight: 1.5,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {room.description}
                </p>
                <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#C7C4D8", marginBottom: 12 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Users size={12} /> {fmtNum(room.memberCount)}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <MessageSquare size={12} /> {fmtNum(room.messageCount)}
                  </span>
                  {room.isLocked && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#FFB785" }}>
                      <Lock size={12} /> Locked
                    </span>
                  )}
                </div>
                {room.lastMessage && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "#47464f",
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                      paddingTop: 10,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
                      {room.lastMessageUser}: {room.lastMessage}
                    </span>
                    {room.lastMessageAt && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={10} /> {timeAgo(room.lastMessageAt)}</span>}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}