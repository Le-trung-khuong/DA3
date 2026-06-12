// src/pages/client/ProfilePage.tsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useDocument } from "../../hooks/useFirestore";
import { useUserStats } from "../../hooks/useUserStats";
import { useCertificates } from "../../hooks/useCertificates";
import { useAchievements } from "../../hooks/useAchievements";
import { claimAchievement } from "../../services/achievementService";
import { CertificateCard } from "../../components/certificate/CertificateCard";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  User,
  Mail,
  Calendar,
  Activity,
  Zap,
  BookOpen,
  CheckCircle,
  Flame,
  Award,
  TrendingUp,
  Clock,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface UserDoc {
  displayName: string;
  email: string;
  photoURL?: string;
  role: string;
  createdAt: { toDate: () => Date };
  lastActiveAt?: { toDate: () => Date };
}

export default function ProfilePage() {
  const { currentUser, userProfile } = useAuth();
  const userId = currentUser?.uid;
  const { data: userDoc, loading: userLoading } = useDocument<UserDoc>("users", userId);
  const { stats, loading: statsLoading } = useUserStats(userId);
  const { certificates, loading: certsLoading } = useCertificates(userId);
  const { achievements, loading: achLoading, refetch: refetchAchievements } = useAchievements(userId);

  const [joinedDate, setJoinedDate] = useState<Date | null>(null);
  const [lastActive, setLastActive] = useState<Date | null>(null);
  const [toastMessage, setToastMessage] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (userDoc) {
      if (userDoc.createdAt) setJoinedDate(userDoc.createdAt.toDate());
      if (userDoc.lastActiveAt) setLastActive(userDoc.lastActiveAt.toDate());
    }
  }, [userDoc]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleClaim = async (achievementId: string) => {
    if (!userId) return;
    const result = await claimAchievement(userId, achievementId);
    if (result.success) {
      showToast(`🎉 Claimed +${result.xpEarned} XP!`, "success");
      refetchAchievements(); // cập nhật lại danh sách achievements
    } else {
      showToast(result.message || "Failed to claim reward", "error");
    }
  };

  const formatDate = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const formatRelative = (d: Date) => {
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    const days = Math.floor(hrs / 24);
    return `${days} days ago`;
  };

  if (userLoading || statsLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <div className="loader">Loading...</div>
      </div>
    );
  }

  const displayName = userDoc?.displayName || userProfile?.displayName || currentUser?.displayName || "User";
  const email = userDoc?.email || currentUser?.email || "";
  const role = userDoc?.role || userProfile?.role || "student";
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const totalXP = stats?.totalXP ?? 0;
  const level = stats?.level ?? 1;
  const streak = stats?.currentStreak ?? 0;
  const enrolledCourses = stats?.enrolledCourses ?? 0;
  const completedCourses = stats?.completedCourses ?? 0;
  const completedLessons = stats?.completedLessons ?? 0;
  const avgQuizScore = stats?.averageQuizScore ?? 0;

  const xpData = stats?.xpOverTime ?? [];
  const unlockedAchievements = achievements.filter(a => a.status !== "locked");
  const lockedAchievements = achievements.filter(a => a.status === "locked");

  return (
    <Tooltip.Provider>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px", color: "#E4E1EE" }}>
        {/* Toast message */}
        {toastMessage && (
          <div style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            background: toastMessage.type === "success" ? "#45f1c5" : "#ffb4ab",
            color: "#0F0F1A",
            padding: "12px 20px",
            borderRadius: 12,
            fontWeight: 700,
            animation: "slideInRight 0.3s ease",
          }}>
            {toastMessage.msg}
          </div>
        )}

        {/* Header avatar & info */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(108,99,255,0.15), rgba(155,89,182,0.15))",
            borderRadius: 28,
            padding: 32,
            marginBottom: 32,
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 40,
                fontWeight: 800,
                color: "#fff",
                boxShadow: "0 0 30px rgba(108,99,255,0.4)",
              }}
            >
              {avatarLetter}
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>{displayName}</h1>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 14, color: "#C7C4D8" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Mail size={14} /> {email}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <User size={14} /> {role.charAt(0).toUpperCase() + role.slice(1)}
                </span>
                {joinedDate && (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Calendar size={14} /> Joined {formatDate(joinedDate)}
                  </span>
                )}
                {lastActive && (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Clock size={14} /> Last active {formatRelative(lastActive)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 20, marginBottom: 40 }}>
          {[
            { label: "Total XP", value: totalXP, icon: Zap, color: "#FFB785" },
            { label: "Level", value: level, icon: TrendingUp, color: "#c4c0ff" },
            { label: "Current Streak", value: `${streak} days`, icon: Flame, color: "#ff6b6b" },
            { label: "Courses Enrolled", value: enrolledCourses, icon: BookOpen, color: "#45f1c5" },
            { label: "Courses Completed", value: completedCourses, icon: CheckCircle, color: "#6C63FF" },
            { label: "Lessons Completed", value: completedLessons, icon: Activity, color: "#FFD700" },
            { label: "Avg. Quiz Score", value: `${Math.round(avgQuizScore)}%`, icon: Award, color: "#9B59B6" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              style={{
                background: "rgba(26,26,46,0.65)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 20,
                padding: "18px 16px",
                backdropFilter: "blur(12px)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: `${color}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={16} color={color} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#C7C4D8" }}>{label}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Chart: XP Over Time */}
        <div
          style={{
            background: "rgba(26,26,46,0.65)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 24,
            padding: 24,
            marginBottom: 32,
          }}
        >
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
            <TrendingUp size={20} color="#6C63FF" /> XP Earned Over Time
          </h3>
          {xpData.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#C7C4D8" }}>
              Not enough data to display chart. Complete more lessons!
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={xpData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorXp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#C7C4D8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#C7C4D8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <RechartsTooltip
                  contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(108,99,255,0.3)", borderRadius: 12, color: "#fff" }}
                  labelStyle={{ color: "#E4E1EE" }}
                />
                <Area type="monotone" dataKey="xp" stroke="#6C63FF" strokeWidth={2} fill="url(#colorXp)" dot={{ fill: "#6C63FF", r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Certificates Section */}
        {certificates.length > 0 && (
          <div
            style={{
              background: "rgba(26,26,46,0.65)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 24,
              padding: 24,
              marginBottom: 32,
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
              <Award size={20} color="#FFD700" /> Certificates Earned
            </h3>
            {certsLoading ? (
              <div style={{ textAlign: "center", padding: 20, color: "#C7C4D8" }}>Loading certificates...</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                {certificates.map((cert) => (
                  <CertificateCard key={cert.id} certificate={cert} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Achievements Section */}
        <div
          style={{
            background: "rgba(26,26,46,0.65)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 24,
            padding: 24,
            marginBottom: 32,
          }}
        >
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
            <Award size={20} color="#FFD700" /> Badges & Achievements
          </h3>
          {achLoading ? (
            <div style={{ textAlign: "center", padding: 20, color: "#C7C4D8" }}>Loading achievements...</div>
          ) : (
            <>
              {unlockedAchievements.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#45f1c5", marginBottom: 12 }}>Unlocked</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16 }}>
                    {unlockedAchievements.map(ach => (
                      <Tooltip.Root key={ach.id}>
                        <Tooltip.Trigger asChild>
                          <div
                            style={{
                              position: "relative",
                              textAlign: "center",
                              background: ach.status === "claimed" ? "rgba(108,99,255,0.15)" : "rgba(69,241,197,0.1)",
                              borderRadius: 16,
                              padding: 12,
                              border: `1px solid ${ach.status === "claimed" ? "rgba(108,99,255,0.3)" : "rgba(69,241,197,0.3)"}`,
                              cursor: "pointer",
                              transition: "transform 0.15s",
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                            onMouseOut={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                          >
                            <div style={{ fontSize: 32 }}>{ach.icon}</div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#E4E1EE" }}>{ach.title}</div>
                            {ach.status === "unlocked" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleClaim(ach.id);
                                }}
                                style={{
                                  marginTop: 8,
                                  padding: "4px 12px",
                                  borderRadius: 20,
                                  background: "linear-gradient(135deg,#45f1c5,#00D4AA)",
                                  border: "none",
                                  color: "#0F0F1A",
                                  fontWeight: 700,
                                  fontSize: 11,
                                  cursor: "pointer",
                                  width: "100%",
                                }}
                              >
                                Claim Reward
                              </button>
                            )}
                            {ach.status === "claimed" && (
                              <div style={{ fontSize: 10, color: "#45f1c5", marginTop: 4 }}>✓ Claimed</div>
                            )}
                          </div>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content
                            side="top"
                            style={{
                              background: "#1a1a2e",
                              border: "1px solid rgba(108,99,255,0.3)",
                              borderRadius: 12,
                              padding: "10px 14px",
                              fontSize: 12,
                              maxWidth: 260,
                              zIndex: 1000,
                              color: "#E4E1EE",
                            }}
                          >
                            <strong>{ach.title}</strong><br />
                            {ach.description}<br />
                            <span style={{ color: "#c4c0ff" }}>Condition:</span> {ach.criteria.type.replace("_", " ")} ≥ {ach.criteria.threshold}<br />
                            <span style={{ color: "#FFB785" }}>Reward:</span> +{ach.xpReward} XP<br />
                            <span style={{ color: "#45f1c5" }}>Status:</span> {
                              ach.status === "claimed" ? "Claimed" : ach.status === "unlocked" ? "Ready to Claim" : "Locked"
                            }
                            <Tooltip.Arrow style={{ fill: "#1a1a2e" }} />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    ))}
                  </div>
                </div>
              )}
              {lockedAchievements.length > 0 && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#C7C4D8", marginBottom: 12 }}>Locked</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16 }}>
                    {lockedAchievements.map(ach => (
                      <Tooltip.Root key={ach.id}>
                        <Tooltip.Trigger asChild>
                          <div
                            style={{
                              textAlign: "center",
                              background: "rgba(255,255,255,0.03)",
                              borderRadius: 16,
                              padding: 12,
                              opacity: 0.6,
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ fontSize: 32, filter: "grayscale(1)" }}>{ach.icon}</div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#C7C4D8" }}>{ach.title}</div>
                          </div>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content
                            side="top"
                            style={{
                              background: "#1a1a2e",
                              border: "1px solid rgba(108,99,255,0.3)",
                              borderRadius: 12,
                              padding: "10px 14px",
                              fontSize: 12,
                              maxWidth: 260,
                            }}
                          >
                            <strong>{ach.title}</strong><br />
                            {ach.description}<br />
                            <span style={{ color: "#c4c0ff" }}>Condition:</span> {ach.criteria.type.replace("_", " ")} ≥ {ach.criteria.threshold}<br />
                            <span style={{ color: "#FFB785" }}>Reward:</span> +{ach.xpReward} XP<br />
                            <span style={{ color: "#ffb4ab" }}>Status:</span> Locked
                            <Tooltip.Arrow style={{ fill: "#1a1a2e" }} />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </Tooltip.Provider>
  );
}