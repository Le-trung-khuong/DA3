/**
 * Smart Review — Admin User List (Firestore Realtime)
 * FIX: Đã khôi phục orderBy(createdAt) vì tất cả users đã có createdAt
 */

"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
} from "firebase/firestore";
import { auth, db } from "../../../utils/config";
import { banUser, restoreUser, sendResetPasswordEmail } from "../../../services/adminService";

// Icons
import {
  Search,
  Shield,
  ShieldOff,
  RotateCcw,
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Users,
  UserCheck,
  UserX,
  Zap,
  Crown,
  Loader,
  Check,
} from "lucide-react";

// ==================== TYPES ====================
type UserStatus = "active" | "banned" | "suspended";
type UserRole = "student" | "instructor" | "admin" | "moderator";

interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  level: number;
  xp: number;
  status: UserStatus;
  role: UserRole;
  createdAt: Date;
  lastLogin: Date;
  currentStreak?: number;
  totalLessons?: number;
}

// ==================== HELPERS ====================
const fmtDate = (d: Date) => d.toLocaleDateString("vi-VN");
const fmtRelative = (d: Date) => {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins}p trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h trước`;
  const days = Math.floor(hrs / 24);
  return `${days}d trước`;
};
const fmtNum = (n: number) => new Intl.NumberFormat("vi-VN").format(n);

const STATUS_CFG: Record<UserStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  active:    { label: "Active", color: "#45f1c5", bg: "rgba(69,241,197,.12)", border: "rgba(69,241,197,.28)", dot: "#45f1c5" },
  banned:    { label: "Banned", color: "#ffb4ab", bg: "rgba(255,180,171,.12)", border: "rgba(255,180,171,.28)", dot: "#ffb4ab" },
  suspended: { label: "Suspended", color: "#FFB785", bg: "rgba(255,183,133,.12)", border: "rgba(255,183,133,.28)", dot: "#FFB785" },
};

const ROLE_CFG: Record<UserRole, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  student:    { label: "Student", color: "#c4c0ff", bg: "rgba(196,192,255,.10)", Icon: Users },
  instructor: { label: "Instructor", color: "#45f1c5", bg: "rgba(69,241,197,.10)", Icon: Users },
  moderator:  { label: "Moderator", color: "#FFB785", bg: "rgba(255,183,133,.10)", Icon: Shield },
  admin:      { label: "Admin", color: "#FFD700", bg: "rgba(255,215,0,.12)", Icon: Crown },
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
}

const AVATAR_GRADS = [
  "linear-gradient(135deg,#6C63FF,#9B59B6)",
  "linear-gradient(135deg,#00D4AA,#0F9E7B)",
  "linear-gradient(135deg,#FFB785,#FF8C42)",
  "linear-gradient(135deg,#45f1c5,#00A878)",
  "linear-gradient(135deg,#c4c0ff,#6C63FF)",
  "linear-gradient(135deg,#FFD700,#FF8C42)",
];
const gradFor = (uid: string) => AVATAR_GRADS[uid.charCodeAt(uid.length - 1) % AVATAR_GRADS.length];

// ==================== COMPONENTS ====================
const ResetPasswordButton = ({ email, onReset }: { email: string; onReset: (email: string) => void }) => {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const handleClick = async () => {
    setLoading(true);
    await onReset(email);
    setLoading(false);
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };
  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        width: 32, height: 32, borderRadius: 8,
        background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: loading ? "wait" : "pointer", color: "#C7C4D8",
      }}
    >
      {loading ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> : sent ? <Check size={14} color="#45f1c5" /> : <RotateCcw size={14} />}
    </button>
  );
};

const BanConfirmDialog = ({ user, action, onConfirm, onCancel }: {
  user: AppUser; action: "ban" | "unban"; onConfirm: () => void; onCancel: () => void;
}) => {
  const isBan = action === "ban";
  const color = isBan ? "#ffb4ab" : "#45f1c5";
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={{ background: "#1a1a2e", borderRadius: 24, padding: 24, maxWidth: 400, border: `1px solid ${color}` }}>
        <h3>{isBan ? "Ban user?" : "Unban user?"}</h3>
        <p>{user.displayName} ({user.email}) sẽ bị {isBan ? "cấm" : "khôi phục"}.</p>
        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onConfirm} style={{ background: color, color: "#000" }}>Confirm</button>
        </div>
      </div>
    </div>
  );
};

const UserDetailModal = ({ user, onClose }: { user: AppUser; onClose: () => void }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
    <div style={{ background: "#1a1a2e", borderRadius: 24, padding: 24, maxWidth: 500 }} onClick={e => e.stopPropagation()}>
      <h3>{user.displayName}</h3>
      <p>Email: {user.email}</p>
      <p>Role: {user.role}</p>
      <p>Status: {user.status}</p>
      <p>XP: {user.xp}</p>
      <p>Level: {user.level}</p>
      <button onClick={onClose}>Close</button>
    </div>
  </div>
);

// ==================== MAIN ====================
export default function UserListAdmin() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [page, setPage] = useState(1);
  const [banTarget, setBanTarget] = useState<AppUser | null>(null);
  const [banAction, setBanAction] = useState<"ban" | "unban">("ban");
  const [viewUser, setViewUser] = useState<AppUser | null>(null);
  const pageSize = 8;

  // ========== REALTIME LISTENER - ĐÃ KHÔI PHỤC orderBy ==========
  useEffect(() => {
    console.log("[UserList] Setting up Firestore listener with orderBy(createdAt)");
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (users.length === 0 && snapshot.size > 0) {
          console.log(`✅ Loaded ${snapshot.size} users from Firestore`);
        }

        const userList: AppUser[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          userList.push({
            uid: docSnap.id,
            email: data.email || "",
            displayName: data.displayName || data.name || "No name",
            photoURL: data.photoURL || null,
            level: data.level || 1,
            xp: data.xp || 0,
            status: data.status || "active",
            role: (data.role === "admin" ? "admin" : 
                   data.role === "instructor" ? "instructor" : 
                   data.role === "moderator" ? "moderator" : "student") as UserRole,
            createdAt: data.createdAt?.toDate?.() ?? new Date(0),
            lastLogin: data.lastLogin?.toDate?.() ?? new Date(),
            currentStreak: data.currentStreak || 0,
            totalLessons: data.totalLessons || 0,
          });
        });

        // Không cần sort client-side nữa vì Firestore đã sort sẵn
        setUsers(userList);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("❌ Firestore error:", err);
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // ========== FILTERS & PAGINATION ==========
  const filtered = useMemo(() => {
    let data = [...users];
    const q = search.toLowerCase();
    if (q) data = data.filter(u => u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    if (statusFilter !== "all") data = data.filter(u => u.status === statusFilter);
    if (roleFilter !== "all") data = data.filter(u => u.role === roleFilter);
    return data;
  }, [users, search, statusFilter, roleFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleBan = async (user: AppUser, actionType: "ban" | "unban") => {
    try {
      if (actionType === "ban") {
        await banUser(user.uid, "Admin action", false);
      } else {
        await restoreUser(user.uid);
      }
      alert(`✅ User ${actionType === "ban" ? "banned" : "unbanned"} successfully`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
    setBanTarget(null);
  };

  const handleResetPassword = async (email: string) => {
    const result = await sendResetPasswordEmail(email);
    if (!result.success) alert(result.message);
  };

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.status === "active").length,
    banned: users.filter(u => u.status === "banned").length,
    staff: users.filter(u => u.role === "admin" || u.role === "moderator").length,
  }), [users]);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader size={32} style={{ animation: "spin 1s linear infinite" }} /> Loading users...</div>;
  if (error) return <div style={{ textAlign: "center", padding: 40, color: "#ffb4ab" }}>Error: {error}</div>;

  return (
    <div style={{ padding: 24, background: "#0F0F1A", minHeight: "100vh" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE" }}>User Management</h1>
          <p style={{ color: "#C7C4D8" }}>Firestore: <code>users</code> • Realtime with orderBy(createdAt)</p>
        </div>
        <button onClick={() => window.location.reload()} style={{ padding: "8px 16px", borderRadius: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", color: "#C7C4D8" }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Users", value: stats.total, icon: Users, color: "#c4c0ff" },
          { label: "Active", value: stats.active, icon: UserCheck, color: "#45f1c5" },
          { label: "Banned", value: stats.banned, icon: UserX, color: "#ffb4ab" },
          { label: "Staff", value: stats.staff, icon: Crown, color: "#FFD700" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{ background: "rgba(26,26,46,.7)", borderRadius: 16, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={20} color={color} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#C7C4D8" }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE" }}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#C7C4D8" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..." style={{ width: "100%", background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "9px 12px 9px 34px", color: "#E4E1EE" }} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} style={{ background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "8px 12px", color: "#E4E1EE" }}>
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
          <option value="suspended">Suspended</option>
        </select>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)} style={{ background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "8px 12px", color: "#E4E1EE" }}>
          <option value="all">All roles</option>
          <option value="student">Student</option>
          <option value="instructor">Instructor</option>
          <option value="moderator">Moderator</option>
          <option value="admin">Admin</option>
        </select>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#C7C4D8" }}>{filtered.length} users</span>
      </div>

      {/* Table */}
      <div style={{ background: "rgba(26,26,46,.6)", borderRadius: 20, border: "1px solid rgba(255,255,255,.06)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>User</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Role</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Level / XP</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Last Login</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Actions</th>
               </tr>
            </thead>
            <tbody>
              {paginated.map(user => {
                const statusCfg = STATUS_CFG[user.status];
                const roleCfg = ROLE_CFG[user.role];
                const RoleIcon = roleCfg.Icon;
                return (
                  <tr key={user.uid} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: gradFor(user.uid), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>
                          {initials(user.displayName)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "#E4E1EE" }}>{user.displayName}</div>
                          <div style={{ fontSize: 11, color: "#C7C4D8" }}>{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 8, background: roleCfg.bg, color: roleCfg.color, fontSize: 11, fontWeight: 700 }}>
                        <RoleIcon size={10} /> {roleCfg.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div>Lv. {user.level}</div>
                      <div style={{ fontSize: 12, color: "#FFB785", display: "flex", alignItems: "center", gap: 4 }}><Zap size={11} /> {fmtNum(user.xp)} XP</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, color: statusCfg.color, fontSize: 11, fontWeight: 700 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusCfg.dot }} /> {statusCfg.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#C7C4D8" }}>
                      {fmtRelative(user.lastLogin)}<br/>{fmtDate(user.lastLogin)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button onClick={() => setViewUser(user)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(108,99,255,.08)", border: "1px solid rgba(108,99,255,.2)", cursor: "pointer", color: "#6C63FF" }}>
                          <Eye size={14} />
                        </button>
                        <ResetPasswordButton email={user.email} onReset={handleResetPassword} />
                        <button onClick={() => { setBanAction(user.status === "banned" ? "unban" : "ban"); setBanTarget(user); }} style={{ width: 32, height: 32, borderRadius: 8, background: user.status === "banned" ? "rgba(69,241,197,.08)" : "rgba(255,180,171,.08)", border: `1px solid ${user.status === "banned" ? "rgba(69,241,197,.2)" : "rgba(255,180,171,.2)"}`, cursor: "pointer", color: user.status === "banned" ? "#45f1c5" : "#ffb4ab" }}>
                          {user.status === "banned" ? <Shield size={14} /> : <ShieldOff size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#C7C4D8" }}>{(page-1)*pageSize+1}–{Math.min(page*pageSize, filtered.length)} of {filtered.length}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button disabled={page===1} onClick={() => setPage(p=>p-1)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", cursor: page===1?"not-allowed":"pointer", color: page===1?"#47464f":"#C7C4D8" }}><ChevronLeft size={14} /></button>
              <span style={{ padding: "0 12px", fontSize: 13 }}>{page} / {totalPages}</span>
              <button disabled={page===totalPages} onClick={() => setPage(p=>p+1)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", cursor: page===totalPages?"not-allowed":"pointer", color: page===totalPages?"#47464f":"#C7C4D8" }}><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {banTarget && <BanConfirmDialog user={banTarget} action={banAction} onConfirm={() => handleBan(banTarget, banAction)} onCancel={() => setBanTarget(null)} />}
      {viewUser && <UserDetailModal user={viewUser} onClose={() => setViewUser(null)} />}
    </div>
  );
}