/**
 * src/pages/client/ChatRoom.tsx
 * Chi tiết phòng chat (realtime) với Cloudinary upload
 */

"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useDocument } from "../../hooks/useFirestore";
import { useCollection } from "../../hooks/useFirestore";
import { useAuth } from "../../contexts/AuthContext";
import { orderBy, limit, doc, onSnapshot } from "firebase/firestore";
import { db } from "../../utils/config";
import {
  sendMessage,
  reportMessage,
  deleteMessageByUser,
  updateMessage,
  sendMessageWithFile,
} from "../../services/chatService";
import {
  ArrowLeft,
  Send,
  Flag,
  Loader,
  Hash,
  Users,
  Lock,
  MessageSquare,
  Trash2,
  Edit3,
  Paperclip,
  X,
  AlertTriangle,
} from "lucide-react";

interface ChatRoomInfo {
  id: string;
  name: string;
  description: string;
  type: string;
  isActive: boolean;
  isLocked: boolean;
  memberCount: number;
  messageCount: number;
  createdAt: Date;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: any;
  isReported?: boolean;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  isImage?: boolean;
  isEdited?: boolean;
}

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

export default function ChatRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [reporting, setReporting] = useState<{ messageId: string; reason: string } | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // User status: banned, warningCount
  const [isBanned, setIsBanned] = useState(false);
  const [warningCount, setWarningCount] = useState(0);

  const { data: room, loading: roomLoading, error: roomError } = useDocument<ChatRoomInfo>("chat_rooms", roomId);
  const { data: messagesData, loading: messagesLoading } = useCollection<ChatMessage>(
    `chat_rooms/${roomId}/messages`,
    [orderBy("timestamp", "asc"), limit(100)],
    [roomId]
  );
  const messages = (messagesData || []) as ChatMessage[];

  // Real-time lấy trạng thái user (banned, warningCount)
  useEffect(() => {
    if (!currentUser) return;
    const userRef = doc(db, "users", currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsBanned(data.status === "banned" || data.banned === true);
        setWarningCount(data.warningCount || 0);
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (room && !room.isActive) {
      navigate("/chat");
    }
  }, [room, navigate]);

  const handleSend = async () => {
    if (!newMessage.trim() || !currentUser || sending) return;
    if (isBanned) {
      alert("You are banned from chatting.");
      return;
    }
    setSending(true);
    try {
      await sendMessage({
        roomId: roomId!,
        userId: currentUser.uid,
        userName: userProfile?.displayName || currentUser.email?.split("@")[0] || "Anonymous",
        text: newMessage,
      });
      setNewMessage("");
    } catch (err) {
      console.error("Send message error:", err);
      alert("Không thể gửi tin nhắn. Vui lòng thử lại.");
    } finally {
      setSending(false);
    }
  };

  const handleReport = async (messageId: string, reason: string) => {
    if (!currentUser) return;
    try {
      await reportMessage(roomId!, messageId, currentUser.uid, reason);
      alert("Đã báo cáo tin nhắn. Cảm ơn bạn!");
    } catch (err) {
      console.error(err);
      alert("Không thể gửi báo cáo.");
    } finally {
      setReporting(null);
    }
  };

  const handleDeleteMessage = async (msg: ChatMessage) => {
    if (!currentUser) return;
    const confirmMsg = window.confirm("Delete this message permanently?");
    if (!confirmMsg) return;
    try {
      await deleteMessageByUser(roomId!, msg.id, currentUser.uid);
    } catch (err: any) {
      alert(err.message || "Cannot delete message.");
    }
  };

  const handleEditMessage = (msg: ChatMessage) => {
    setEditingMsg(msg);
    setEditText(msg.text);
  };

  const handleSaveEdit = async () => {
    if (!editingMsg || !currentUser) return;
    if (!editText.trim()) return;
    try {
      await updateMessage(roomId!, editingMsg.id, editText, currentUser.uid);
      setEditingMsg(null);
      setEditText("");
    } catch (err: any) {
      alert(err.message || "Cannot edit message.");
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    if (isBanned) {
      alert("You are banned from chatting.");
      return;
    }
    const file = e.target.files[0];
    if (file.size > 10 * 1024 * 1024) {
      alert("File too large (max 10MB).");
      return;
    }
    setUploadingFile(true);
    try {
      await sendMessageWithFile(
        roomId!,
        currentUser!.uid,
        userProfile?.displayName || currentUser!.email?.split("@")[0] || "Anonymous",
        file
      );
    } catch (err) {
      console.error(err);
      alert("Upload failed. Check Cloudinary preset.");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (roomLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <Loader size={36} color="#6C63FF" style={{ animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (roomError || !room) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "#C7C4D8" }}>
        <p>Room not found or inaccessible.</p>
        <Link to="/chat" style={{ color: "#6C63FF", marginTop: 12, display: "inline-block" }}>← Back to chat</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px", height: "calc(100vh - 64px)", display: "flex", flexDirection: "column" }}>
      {/* Header giống cũ */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Link to="/chat" style={{ display: "flex", alignItems: "center", gap: 6, color: "#C7C4D8", textDecoration: "none" }}>
          <ArrowLeft size={18} /> Back
        </Link>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE", display: "flex", alignItems: "center", gap: 8 }}>
            <Hash size={24} color="#6C63FF" /> {room.name}
          </h1>
          <p style={{ fontSize: 13, color: "#C7C4D8", marginTop: 4 }}>{room.description}</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, fontSize: 12, color: "#C7C4D8" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Users size={14} /> {room.memberCount}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MessageSquare size={14} /> {room.messageCount}</span>
          {room.isLocked && <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#FFB785" }}><Lock size={14} /> Locked</span>}
        </div>
      </div>

      {/* Warning banner */}
      {warningCount > 0 && (
        <div style={{
          background: "rgba(255,183,133,0.15)", border: "1px solid rgba(255,183,133,0.3)",
          borderRadius: 10, padding: "8px 12px", marginBottom: 12, display: "flex",
          alignItems: "center", gap: 8, color: "#FFB785", fontSize: 12,
        }}>
          <AlertTriangle size={16} />
          You have received {warningCount} warning(s). Further violations may lead to a ban.
        </div>
      )}

      {/* Messages container */}
      <div style={{
        flex: 1, overflowY: "auto", background: "rgba(26,26,46,0.4)", borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.06)", padding: "16px", marginBottom: 16,
      }}>
        {messagesLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
            <Loader size={28} color="#6C63FF" style={{ animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#C7C4D8" }}>
            <p>No messages yet. Be the first to say something!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.userId === currentUser?.uid;
            return (
              <div key={msg.id} style={{ display: "flex", justifyContent: isOwn ? "flex-end" : "flex-start", marginBottom: 16 }}>
                <div style={{
                  maxWidth: "70%", background: isOwn ? "rgba(108,99,255,0.15)" : "rgba(255,255,255,0.05)",
                  borderRadius: 16, padding: "10px 14px",
                  border: isOwn ? "1px solid rgba(108,99,255,0.3)" : "1px solid rgba(255,255,255,0.08)",
                  position: "relative",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isOwn ? "#c4c0ff" : "#C7C4D8" }}>
                      {msg.userName}
                    </span>
                    <span style={{ fontSize: 10, color: "#47464f" }}>{timeAgo(msg.timestamp)}</span>
                    {msg.isEdited && <span style={{ fontSize: 9, color: "#47464f" }}>(edited)</span>}
                    {!isOwn && (
                      <button
                        onClick={() => setReporting({ messageId: msg.id, reason: "" })}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#47464f", marginLeft: "auto" }}
                        title="Report"
                      >
                        <Flag size={12} />
                      </button>
                    )}
                    {isOwn && (
                      <>
                        <button onClick={() => handleEditMessage(msg)} style={{ background: "none", border: "none", cursor: "pointer", color: "#C7C4D8", marginLeft: "auto" }} title="Edit">
                          <Edit3 size={12} />
                        </button>
                        <button onClick={() => handleDeleteMessage(msg)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ffb4ab" }} title="Delete">
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>

                  {msg.fileUrl ? (
                    <div style={{ marginTop: 8 }}>
                      {msg.isImage ? (
                        <img src={msg.fileUrl} alt="shared" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, cursor: "pointer" }} onClick={() => window.open(msg.fileUrl)} />
                      ) : (
                        <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#6C63FF", display: "flex", alignItems: "center", gap: 6 }}>
                          <Paperclip size={14} /> {msg.fileName || "Download file"}
                        </a>
                      )}
                    </div>
                  ) : (
                    <p style={{ fontSize: 14, color: "#E4E1EE", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{msg.text}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {room.isLocked ? (
        <div style={{
          background: "rgba(255,183,133,0.1)", border: "1px solid rgba(255,183,133,0.3)",
          borderRadius: 12, padding: "12px 16px", textAlign: "center", color: "#FFB785", fontSize: 13,
        }}>
          This room is locked. You cannot send messages.
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={isBanned ? "You are banned" : "Type your message..."}
            rows={1}
            disabled={isBanned}
            style={{
              flex: 1, background: "#0d0d18", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12, padding: "12px", color: "#E4E1EE", fontSize: 14,
              resize: "none", fontFamily: "Inter,sans-serif", outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: "none" }} accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.*" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isBanned || uploadingFile}
              title="Attach file"
              style={{
                width: 48, height: 48, borderRadius: 12, background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)", cursor: isBanned ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {uploadingFile ? <Loader size={18} style={{ animation: "spin 0.8s linear infinite" }} /> : <Paperclip size={18} />}
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !newMessage.trim() || isBanned}
              style={{
                width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
                border: "none", cursor: sending || !newMessage.trim() || isBanned ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: sending || !newMessage.trim() || isBanned ? 0.6 : 1,
              }}
            >
              {sending ? <Loader size={18} color="#fff" style={{ animation: "spin 0.8s linear infinite" }} /> : <Send size={18} color="#fff" />}
            </button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingMsg && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
            zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
          onClick={(e) => e.target === e.currentTarget && setEditingMsg(null)}
        >
          <div style={{ background: "#1a1a2e", borderRadius: 20, padding: 24, maxWidth: 500, width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE" }}>Edit message</h3>
              <button onClick={() => setEditingMsg(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#C7C4D8" }}>
                <X size={18} />
              </button>
            </div>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              style={{
                width: "100%", background: "#0d0d18", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12, padding: "12px", color: "#E4E1EE", fontSize: 14,
                marginBottom: 20, resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setEditingMsg(null)} style={{ flex: 1, padding: "10px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#C7C4D8", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSaveEdit} disabled={!editText.trim()} style={{ flex: 1, padding: "10px", borderRadius: 12, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff", fontWeight: 700, cursor: editText.trim() ? "pointer" : "not-allowed", opacity: editText.trim() ? 1 : 0.6 }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Report modal */}
      {reporting && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
            zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
          onClick={(e) => e.target === e.currentTarget && setReporting(null)}
        >
          <div style={{ background: "#1a1a2e", borderRadius: 20, padding: 24, maxWidth: 400, width: "100%" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE", marginBottom: 16 }}>Report message</h3>
            <select
              value={reporting.reason}
              onChange={(e) => setReporting({ ...reporting, reason: e.target.value })}
              style={{ width: "100%", background: "#0d0d18", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px", color: "#E4E1EE", marginBottom: 20 }}
            >
              <option value="">Select a reason</option>
              <option value="spam">Spam</option>
              <option value="harassment">Harassment</option>
              <option value="hate_speech">Hate speech</option>
              <option value="inappropriate">Inappropriate content</option>
              <option value="other">Other</option>
            </select>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setReporting(null)} style={{ flex: 1, padding: "10px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#C7C4D8", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => reporting.reason && handleReport(reporting.messageId, reporting.reason)} disabled={!reporting.reason} style={{ flex: 1, padding: "10px", borderRadius: 12, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff", fontWeight: 700, cursor: reporting.reason ? "pointer" : "not-allowed", opacity: reporting.reason ? 1 : 0.6 }}>Report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}