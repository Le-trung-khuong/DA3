/**
 * src/layouts/LayoutAdmin.tsx
 * ─────────────────────────────────────────────────────────────
 * Admin shell layout với Firebase Auth integration.
 *
 * Exports:
 *   default LayoutAdmin      – full shell (sidebar + topbar + content)
 *   AdminRouteGuard          – bảo vệ route: chỉ cho role "admin" vào
 *   Sidebar                  – nav dọc (desktop), slide-in (mobile)
 *   SidebarItem              – 1 nav item với active state
 *   TopBar                   – header: search, notifications, user menu
 *
 * Routing:
 *   Dùng React Router v6 (useLocation / useNavigate).
 *   Nếu dùng Next.js App Router: đổi useNavigate → router.push,
 *   useLocation → usePathname, Link → next/link.
 *
 * Auth flow:
 *   loading  → skeleton screen
 *   no user  → redirect /admin/login
 *   not admin→ 403 screen
 *   admin    → render children
 *
 * Realtime role: AuthContext lắng nghe onSnapshot users/{uid}
 * → nếu admin bị hạ cấp role, layout tự redirect về 403 mà không cần reload.
 *
 * Dependencies: lucide-react  react-router-dom  @/contexts/AuthContext
 */

"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
  type CSSProperties,
} from "react";

import { Outlet, useNavigate, useLocation } from 'react-router-dom';

// ─── Icons ─────────────────────────────────────────────────────────────────────
import {
  LayoutDashboard, BookOpen, Users, MessageSquare, BarChart2,
  Settings, LogOut, Bell, Search, ChevronRight, Menu, X,
  Shield, AlertTriangle, Loader, RefreshCw, Home,
  TrendingUp, Flag, Zap, Hash, CreditCard, Star,
  ChevronDown, ExternalLink, Activity, Lock, Radio,
  Info, ShieldOff,
} from "lucide-react";

// ─── Auth hook (swap with your path if needed) ─────────────────────────────────
// import { useNavigate, useLocation, Link } from "react-router-dom";

// ─── Mock hook (remove in production) ──────────────────────────────────────────
type UserRole = "admin" | "moderator" | "instructor" | "user";
interface MockAuth {
  currentUser:  { uid: string; email: string; displayName: string } | null;
  userProfile:  { displayName: string; role: UserRole; email: string; level: number; totalXP: number; photoURL: string | null } | null;
  role:         UserRole | null;
  loading:      boolean;
  error:        Error | null;
  logout:       () => Promise<void>;
}
function useMockAuth(): MockAuth {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 700); return () => clearTimeout(t); }, []);
  return {
    currentUser:  { uid: "admin_001", email: "admin@smartreview.vn", displayName: "Admin SR" },
    userProfile:  { displayName: "Admin SR", role: "admin", email: "admin@smartreview.vn", level: 99, totalXP: 125_000, photoURL: null },
    role:         loading ? null : "admin",
    loading,
    error:        null,
    logout:       async () => { alert("Logout called → signOut(auth)"); },
  };
}
// In production replace the line below with:
const useAuth = useMockAuth;

// ─── Mock routing (remove in production) ───────────────────────────────────────
// function useMockLocation() { return { pathname: "/admin/dashboard" }; }
// function useMockNavigate() { return (path: string) => { console.log("[navigate]", path); }; }
// const useLocation  = useMockLocation;
// const useNavigate  = useMockNavigate;

// ═══════════════════════════════════════════════════════════════════════════════
// NAV CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

interface NavItem {
  label:      string;
  path:       string;
  Icon:       React.ElementType;
  badge?:     number | string;
  badgeColor?:string;
  section?:   string;           // group header label
  roles:      UserRole[];       // which roles can see this item
}

const NAV_ITEMS: NavItem[] = [
  // ── OVERVIEW ────────────────────────────────────────────────────────────────
  { section: "Overview",    label: "Dashboard",    path: "/admin/dashboard",    Icon: LayoutDashboard, roles: ["admin","moderator","instructor"] },

  // ── CONTENT ─────────────────────────────────────────────────────────────────
  { section: "Content",     label: "Courses",      path: "/admin/courses",      Icon: BookOpen,    roles: ["admin","moderator","instructor"] },
  {                         label: "Analytics",    path: "/admin/analytics",    Icon: BarChart2,   roles: ["admin"] },
  {                         label: "Revenue",      path: "/admin/revenue",      Icon: TrendingUp,  roles: ["admin"] },
  {                         label: "Transactions", path: "/admin/transactions", Icon: CreditCard,  roles: ["admin"] },

  // ── USERS ───────────────────────────────────────────────────────────────────
  { section: "Users",       label: "All Users",    path: "/admin/users",        Icon: Users,       roles: ["admin","moderator"] },
  {                         label: "Reviews",      path: "/admin/reviews",      Icon: Star,        roles: ["admin","moderator"] },

  // ── COMMUNITY ───────────────────────────────────────────────────────────────
  { section: "Community",   label: "Chat Rooms",   path: "/admin/community",    Icon: Hash,        roles: ["admin","moderator"] },
  {                         label: "Reports",      path: "/admin/reports",      Icon: Flag,        badge: 7, badgeColor: "#ffb4ab", roles: ["admin","moderator"] },

  // ── SYSTEM ──────────────────────────────────────────────────────────────────
  { section: "System",      label: "Settings",     path: "/admin/settings",     Icon: Settings,    roles: ["admin"] },
  {                         label: "Notifications",path: "/admin/notifications",Icon: Bell,        roles: ["admin"] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const T: Record<string, string | number | CSSProperties> = {
  bg:      "#0F0F1A",
  sidebar: "rgba(15,15,26,.98)",
  glass:   "rgba(26,26,46,.7)",
  border:  "rgba(255,255,255,.06)",
  primary: "#6C63FF",
  text:    "#E4E1EE",
  muted:   "#C7C4D8",
  dim:     "#47464f",
};

// ═══════════════════════════════════════════════════════════════════════════════
// SidebarItem
// ═══════════════════════════════════════════════════════════════════════════════

interface SidebarItemProps {
  item:       NavItem;
  collapsed:  boolean;
  active:     boolean;
  onClick:    () => void;
}

function SidebarItem({ item, collapsed, active, onClick }: SidebarItemProps) {
  const { Icon, label, badge, badgeColor = "#ffb4ab" } = item;
  const [hovered, setHovered] = useState(false);

  const isActive = active || hovered;

  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      onMouseOver={() => setHovered(true)}
      onMouseOut={()  => setHovered(false)}
      style={{
        width: "100%", display: "flex", alignItems: "center",
        gap: 11, padding: collapsed ? "11px 0" : "11px 14px",
        justifyContent: collapsed ? "center" : "flex-start",
        borderRadius: 13, fontSize: 13, fontWeight: active ? 800 : 600,
        cursor: "pointer", transition: "all .18s", border: "none",
        background: active
          ? "linear-gradient(135deg,rgba(108,99,255,.22),rgba(155,89,182,.15))"
          : hovered
          ? "rgba(255,255,255,.05)"
          : "transparent",
        color: active ? "#e3dfff" : isActive ? T.text as string : T.muted as string,
        boxShadow: active ? "inset 0 0 0 1px rgba(108,99,255,.28)" : "none",
        position: "relative",
      }}
    >
      {/* Active indicator bar */}
      {active && (
        <span style={{
          position: "absolute", left: 0, top: "20%", bottom: "20%",
          width: 3, borderRadius: "0 3px 3px 0",
          background: "linear-gradient(180deg,#6C63FF,#9B59B6)",
          boxShadow: "0 0 8px rgba(108,99,255,.6)",
        }} />
      )}

      <Icon size={17} style={{ flexShrink: 0, transition: "transform .2s", transform: hovered && !active ? "translateX(2px)" : "none" }} />

      {!collapsed && (
        <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
      )}

      {/* Badge */}
      {badge !== undefined && !collapsed && (
        <span style={{
          background: `${badgeColor}20`, border: `1px solid ${badgeColor}40`,
          color: badgeColor, fontSize: 9, fontWeight: 800, padding: "1px 7px",
          borderRadius: 999, letterSpacing: ".04em",
        }}>
          {badge}
        </span>
      )}
      {badge !== undefined && collapsed && (
        <span style={{
          position: "absolute", top: 6, right: 6, width: 8, height: 8,
          borderRadius: "50%", background: badgeColor,
          boxShadow: `0 0 6px ${badgeColor}`,
        }} />
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sidebar
// ═══════════════════════════════════════════════════════════════════════════════

interface SidebarProps {
  collapsed:  boolean;
  mobileOpen: boolean;
  onClose:    () => void;
  role:       UserRole | null;
}

function Sidebar({ collapsed, mobileOpen, onClose, role }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const width = collapsed ? 68 : 240;

  // Filter nav items by role
  const visibleItems = NAV_ITEMS.filter((item) =>
    role ? item.roles.includes(role) : false
  );

  // Group by section
  const sections: { label?: string; items: NavItem[] }[] = [];
  let currentSection: { label?: string; items: NavItem[] } | null = null;
  for (const item of visibleItems) {
    if (item.section) {
      currentSection = { label: item.section, items: [] };
      sections.push(currentSection);
    }
    currentSection?.items.push(item);
  }

  const sidebarStyle: CSSProperties = {
    position:        "fixed",
    top:             0,
    left:            0,
    bottom:          0,
    width,
    zIndex:          60,
    background:      T.sidebar as string,
    borderRight:     `1px solid ${T.border}`,
    backdropFilter:  "blur(20px)",
    display:         "flex",
    flexDirection:   "column",
    transition:      "width .25s cubic-bezier(.4,0,.2,1), transform .25s",
    overflowX:       "hidden",
    // On mobile: slide in/out
    transform:       `translateX(${mobileOpen ? "0" : "-100%"})`,
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={onClose}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)", zIndex: 59 }}
        />
      )}

      <nav style={sidebarStyle}>
        {/* Logo */}
        <div style={{ padding: collapsed ? "20px 0" : "20px 18px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${T.border}`, flexShrink: 0, justifyContent: collapsed ? "center" : "flex-start" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 14px rgba(108,99,255,.4)" }}>
            <Shield size={18} color="#fff" />
          </div>
          {!collapsed && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                SMART REVIEW
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#9B59B6", textTransform: "uppercase", letterSpacing: ".1em" }}>
                Admin Console
              </div>
            </div>
          )}
          {/* Mobile close */}
          {mobileOpen && (
            <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: T.muted as string }}>
              <X size={18} />
            </button>
          )}
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: collapsed ? "12px 6px" : "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          {sections.map((sec) => (
            <div key={sec.label ?? "root"} style={{ marginBottom: 6 }}>
              {sec.label && !collapsed && (
                <div style={{ fontSize: 9, fontWeight: 800, color: T.dim as string, textTransform: "uppercase", letterSpacing: ".12em", padding: "10px 14px 5px", userSelect: "none" }}>
                  {sec.label}
                </div>
              )}
              {sec.items.map((item) => (
                <SidebarItem
                  key={item.path}
                  item={item}
                  collapsed={collapsed}
                  active={location.pathname.startsWith(item.path)}
                  onClick={() => { navigate(item.path); if (mobileOpen) onClose(); }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Bottom: live indicator */}
        {!collapsed && (
          <div style={{ padding: "10px 18px", borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#45f1c5", fontWeight: 700, flexShrink: 0 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#45f1c5", display: "inline-block", animation: "pulse 2s infinite" }} />
            Live · Firebase onSnapshot
          </div>
        )}
      </nav>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TopBar
// ═══════════════════════════════════════════════════════════════════════════════

interface TopBarProps {
  sidebarWidth: number;
  onToggle:     () => void;
  collapsed:    boolean;
}

function TopBar({ sidebarWidth, onToggle, collapsed }: TopBarProps) {
  const { userProfile, logout, role } = useAuth();
  const navigate = useNavigate();

  const [search,      setSearch]      = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen,    setNotifOpen]   = useState(false);

  const userMenuRef  = useRef<HTMLDivElement>(null);
  const notifRef     = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (userMenuRef.current  && !userMenuRef.current.contains(e.target as Node))  setUserMenuOpen(false);
      if (notifRef.current     && !notifRef.current.contains(e.target as Node))     setNotifOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const avatarLetter = (userProfile?.displayName ?? "A").charAt(0).toUpperCase();

  // Mock notifications
  const notifs = [
    { id: 1, text: "7 messages flagged for review",     color: "#ffb4ab", time: "5m ago" },
    { id: 2, text: "New user registered: Nguyễn Minh",  color: "#45f1c5", time: "12m ago" },
    { id: 3, text: "Transaction #TXN_9821 refund req.",  color: "#FFB785", time: "1h ago" },
  ];

  return (
    <header style={{
      position:    "fixed",
      top:         0,
      left:        sidebarWidth,
      right:       0,
      height:      62,
      zIndex:      50,
      background:  "rgba(15,15,26,.92)",
      backdropFilter: "blur(18px)",
      borderBottom: `1px solid ${T.border}`,
      display:     "flex",
      alignItems:  "center",
      gap:         16,
      padding:     "0 22px",
      transition:  "left .25s cubic-bezier(.4,0,.2,1)",
      fontFamily:  "Inter,sans-serif",
    }}>

      {/* Mobile menu toggle */}
      <button onClick={onToggle}
        style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,.04)", border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.muted as string, flexShrink: 0 }}>
        {collapsed ? <Menu size={16} /> : <Menu size={16} />}
      </button>

      {/* Search */}
      <div style={{ position: "relative", flex: 1, maxWidth: 420 }}>
        <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.dim as string }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users, courses, transactions…"
          style={{
            width: "100%", background: "rgba(255,255,255,.04)", border: `1px solid ${T.border}`,
            borderRadius: 12, padding: "8px 12px 8px 34px", color: T.text as string,
            fontSize: 13, outline: "none", fontFamily: "Inter,sans-serif",
            transition: "border-color .2s",
          }}
          onFocus={(e)  => (e.target.style.borderColor = "rgba(108,99,255,.45)")}
          onBlur={(e)   => (e.target.style.borderColor = T.border as string)}
        />
        {search && (
          <button onClick={() => setSearch("")}
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.dim as string }}>
            <X size={12} />
          </button>
        )}
      </div>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        {/* Role badge */}
        <span style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 999, background: "rgba(108,99,255,.12)", border: "1px solid rgba(108,99,255,.28)", color: "#c4c0ff", fontSize: 11, fontWeight: 800, letterSpacing: ".06em" }}>
          <Shield size={11} /> {role?.toUpperCase() ?? "—"}
        </span>

        {/* Notifications */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <button onClick={() => setNotifOpen((p) => !p)}
            style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,.04)", border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.muted as string, position: "relative" }}>
            <Bell size={16} />
            <span style={{ position: "absolute", top: 7, right: 7, width: 8, height: 8, borderRadius: "50%", background: "#ffb4ab", border: "2px solid #0F0F1A", boxShadow: "0 0 6px rgba(255,180,171,.7)" }} />
          </button>
          {notifOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 320, background: "rgba(26,26,46,.97)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 18, padding: 10, boxShadow: "0 16px 50px rgba(0,0,0,.5)", animation: "fadeDown .2s ease", zIndex: 80 }}>
              <div style={{ padding: "8px 10px 10px", fontSize: 12, fontWeight: 800, color: T.text as string, borderBottom: `1px solid ${T.border}`, marginBottom: 6 }}>
                Notifications <span style={{ color: "#ffb4ab" }}>({notifs.length})</span>
              </div>
              {notifs.map((n) => (
                <div key={n.id} style={{ display: "flex", gap: 10, padding: "9px 10px", borderRadius: 10, cursor: "pointer", transition: "background .15s" }}
                  onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.04)")}
                  onMouseOut={(e)  => (e.currentTarget.style.background = "transparent")}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: n.color, marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, color: T.text as string, fontWeight: 600, lineHeight: 1.4 }}>{n.text}</div>
                    <div style={{ fontSize: 10, color: T.dim as string, marginTop: 2 }}>{n.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User menu */}
        <div ref={userMenuRef} style={{ position: "relative" }}>
          <button onClick={() => setUserMenuOpen((p) => !p)}
            style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 10px 6px 6px", borderRadius: 12, background: "rgba(255,255,255,.04)", border: `1px solid ${T.border}`, cursor: "pointer", transition: "all .15s" }}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = "rgba(108,99,255,.35)")}
            onMouseOut={(e)  => (e.currentTarget.style.borderColor = T.border as string)}
          >
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff" }}>
              {avatarLetter}
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.text as string, lineHeight: 1.2 }}>{userProfile?.displayName ?? "Admin"}</div>
              <div style={{ fontSize: 10, color: T.muted as string, lineHeight: 1 }}>{userProfile?.email}</div>
            </div>
            <ChevronDown size={12} color={T.dim as string} style={{ transition: "transform .2s", transform: userMenuOpen ? "rotate(180deg)" : "none" }} />
          </button>

          {userMenuOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 220, background: "rgba(26,26,46,.97)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 16, padding: 8, boxShadow: "0 16px 50px rgba(0,0,0,.5)", animation: "fadeDown .2s ease", zIndex: 80 }}>
              {/* User info strip */}
              <div style={{ padding: "10px 12px 10px", borderBottom: `1px solid ${T.border}`, marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.text as string }}>{userProfile?.displayName}</div>
                <div style={{ fontSize: 11, color: "#9B59B6" }}>Level {userProfile?.level} · {(userProfile?.totalXP ?? 0).toLocaleString()} XP</div>
              </div>
              {[
                { Icon: Home,         label: "Main App",   action: () => navigate("/"),          color: T.muted as string },
                { Icon: Settings,     label: "Settings",   action: () => navigate("/admin/settings"), color: T.muted as string },
                { Icon: ExternalLink, label: "Docs",       action: () => {},                     color: T.muted as string },
              ].map(({ Icon, label, action, color }) => (
                <button key={label} onClick={() => { action(); setUserMenuOpen(false); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "none", border: "none", color, transition: "all .15s", textAlign: "left" }}
                  onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.05)")}
                  onMouseOut={(e)  => (e.currentTarget.style.background = "none")}>
                  <Icon size={14} /> {label}
                </button>
              ))}
              <div style={{ borderTop: `1px solid ${T.border}`, margin: "6px 0 2px" }} />
              <button onClick={async () => { await logout(); navigate("/admin/login"); setUserMenuOpen(false); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "none", border: "none", color: "#ffb4ab", transition: "all .15s", textAlign: "left" }}
                onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,180,171,.08)")}
                onMouseOut={(e)  => (e.currentTarget.style.background = "none")}>
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AdminRouteGuard
// ═══════════════════════════════════════════════════════════════════════════════

interface AdminRouteGuardProps {
  children:      ReactNode;
  allowedRoles?: UserRole[];   // defaults to ["admin"]
}

export function AdminRouteGuard({
  children,
  allowedRoles = ["admin"],
}: AdminRouteGuardProps) {
  const { currentUser, role, loading, error } = useAuth();
  const navigate = useNavigate();

  // Redirect to login when auth resolves to no user
  useEffect(() => {
    if (!loading && !currentUser) navigate("/admin/login");
  }, [loading, currentUser, navigate]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0F0F1A", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: "Inter,sans-serif" }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 30px rgba(108,99,255,.5)", animation: "pulse 1.5s ease infinite" }}>
          <Shield size={26} color="#fff" />
        </div>
        <div style={{ fontSize: 13, color: "#C7C4D8", fontWeight: 600 }}>Verifying admin access…</div>
        <div style={{ display: "flex", gap: 5 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#6C63FF", display: "inline-block", animation: `bounce .9s ${i * .18}s ease infinite` }} />
          ))}
        </div>
      </div>
    );
  }

  // ── Not logged in (transitioning) ────────────────────────────────────────────
  if (!currentUser) return null;

  // ── Firestore error ──────────────────────────────────────────────────────────
  if (error) {
    const code = (error as { code?: string }).code ?? "";
    return <FirebaseErrorScreen code={code} error={error} onRetry={() => window.location.reload()} />;
  }

  // ── Role still loading ───────────────────────────────────────────────────────
  if (role === null) {
    return (
      <div style={{ minHeight: "100vh", background: "#0F0F1A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter,sans-serif" }}>
        <Loader size={28} color="#6C63FF" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  // ── 403 ─────────────────────────────────────────────────────────────────────
  if (!allowedRoles.includes(role)) {
    return <ForbiddenScreen role={role} onGoHome={() => navigate("/")} />;
  }

  // ── Authorised ───────────────────────────────────────────────────────────────
  return <>{children}</>;
}

// ─── Firebase Error Screen ──────────────────────────────────────────────────────

interface FirebaseErrorScreenProps { code: string; error: Error; onRetry: () => void; }
function FirebaseErrorScreen({ code, error, onRetry }: FirebaseErrorScreenProps) {
  const cfg: Record<string, { title: string; desc: string; color: string; Icon: React.ElementType }> = {
    "permission-denied":  { title: "Permission Denied",    desc: "Your account doesn't have Firestore access. Contact your system administrator.",              color: "#ffb4ab", Icon: Lock },
    "unavailable":        { title: "Service Unavailable",  desc: "Firestore is temporarily unreachable. Check your connection and try again.",                  color: "#FFB785", Icon: Radio },
    "not-found":          { title: "Document Not Found",   desc: "Your admin profile wasn't found in Firestore. Run the setup script or contact support.",      color: "#FFB785", Icon: Info },
    "resource-exhausted": { title: "Quota Exceeded",       desc: "Firestore quota has been exceeded. Upgrade your Firebase plan or wait for quota reset.",      color: "#c4c0ff", Icon: Activity },
    "unauthenticated":    { title: "Not Authenticated",    desc: "Your session has expired. Please sign in again.",                                             color: "#ffb4ab", Icon: ShieldOff },
  };
  const { title, desc, color, Icon } = cfg[code] ?? { title: "Firebase Error", desc: error.message, color: "#ffb4ab", Icon: AlertTriangle };

  return (
    <div style={{ minHeight: "100vh", background: "#0F0F1A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter,sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 440, width: "100%", background: "rgba(26,26,46,.8)", border: `1px solid ${color}30`, borderRadius: 24, padding: 40, textAlign: "center", backdropFilter: "blur(16px)" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: `${color}18`, border: `1px solid ${color}40`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Icon size={28} color={color} />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#E4E1EE", marginBottom: 10 }}>{title}</h1>
        <p style={{ fontSize: 13, color: "#C7C4D8", lineHeight: 1.6, marginBottom: 8 }}>{desc}</p>
        <code style={{ fontSize: 10, color: "#9B59B6", background: "rgba(108,99,255,.1)", padding: "2px 8px", borderRadius: 6 }}>
          Firebase error: {code || "unknown"}
        </code>
        <button onClick={onRetry}
          style={{ marginTop: 24, width: "100%", padding: "12px", borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: "pointer", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 0 18px rgba(108,99,255,.3)" }}>
          <RefreshCw size={15} /> Retry
        </button>
      </div>
    </div>
  );
}

// ─── 403 Screen ────────────────────────────────────────────────────────────────

function ForbiddenScreen({ role, onGoHome }: { role: UserRole; onGoHome: () => void }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0F0F1A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter,sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 440, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 80, fontWeight: 900, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>
          403
        </div>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(255,180,171,.12)", border: "1px solid rgba(255,180,171,.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "16px auto" }}>
          <ShieldOff size={28} color="#ffb4ab" />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#E4E1EE", marginBottom: 10 }}>Access Forbidden</h1>
        <p style={{ fontSize: 13, color: "#C7C4D8", lineHeight: 1.6, marginBottom: 6 }}>
          The admin panel requires the <strong style={{ color: "#c4c0ff" }}>admin</strong> role.
        </p>
        <p style={{ fontSize: 12, color: "#47464f", marginBottom: 28 }}>
          Your current role: <span style={{ color: "#FFB785", fontWeight: 700 }}>{role}</span>
        </p>
        <button onClick={onGoHome}
          style={{ padding: "12px 32px", borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: "pointer", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff", boxShadow: "0 0 18px rgba(108,99,255,.3)" }}>
          ← Back to App
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LayoutAdmin (main export)
// ═══════════════════════════════════════════════════════════════════════════════

interface LayoutAdminProps {
  children:      ReactNode;
  allowedRoles?: UserRole[];
}

export default function LayoutAdmin({ children, allowedRoles }: LayoutAdminProps) {
  const { role } = useAuth();
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);

  // On narrow screens default sidebar to hidden
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const handleChange = (e: MediaQueryListEvent) => { if (e.matches) setCollapsed(true); };
    if (mq.matches) setCollapsed(true);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  const sidebarWidth = collapsed ? 68 : 240;

  return (
    <AdminRouteGuard allowedRoles={allowedRoles}>
      <div style={{ minHeight: "100vh", background: "#0F0F1A", color: "#E4E1EE", fontFamily: "Inter,sans-serif" }}>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
          *{box-sizing:border-box;margin:0;padding:0;}
          @keyframes fadeDown  {from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
          @keyframes scaleIn   {from{opacity:0;transform:scale(.93)}to{opacity:1;transform:scale(1)}}
          @keyframes slideInR  {from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
          @keyframes spin      {to{transform:rotate(360deg)}}
          @keyframes pulse     {0%,100%{opacity:1}50%{opacity:.45}}
          @keyframes bounce    {0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
          @keyframes shimmer   {0%{background-position:200% 0}100%{background-position:-200% 0}}
          input,select,textarea,button{font-family:Inter,sans-serif;}
          ::-webkit-scrollbar{width:4px;}
          ::-webkit-scrollbar-track{background:transparent;}
          ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:10px;}
        `}</style>

        {/* Sidebar — desktop: persistent; mobile: slide-in */}
        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          role={role}
        />

        {/* TopBar */}
        <TopBar
          sidebarWidth={sidebarWidth}
          onToggle={() => {
            if (window.innerWidth < 1024) {
              setMobileOpen((p) => !p);
            } else {
              setCollapsed((p) => !p);
            }
          }}
          collapsed={collapsed}
        />

        {/* Main content area */}
        <main style={{
          marginLeft:  sidebarWidth,
          paddingTop:  62,
          minHeight:   "100vh",
          transition:  "margin-left .25s cubic-bezier(.4,0,.2,1)",
          background:  "radial-gradient(circle at 5% 0%, rgba(108,99,255,.05) 0%, transparent 55%)",
        }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px" }}>
            <Outlet />
          </div>
        </main>
      </div>
    </AdminRouteGuard>
  );
}
