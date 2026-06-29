// src/pages/client/ProfilePage.tsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useDocument } from "../../hooks/useFirestore";
import { useUserStats } from "../../hooks/useUserStats";
import { useCertificates } from "../../hooks/useCertificates";
import { useAchievements } from "../../hooks/useAchievements";
import { claimAchievement } from "../../services/achievementService";
import { CertificateCard } from "../../components/certificate/CertificateCard";
import { LevelBadge } from "../../components/common/LevelBadge";
import { LevelProgressBar } from "../../components/common/LevelProgressBar";
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
  Crown,
  MessageSquare,
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

  // 1. Fetch user data
  const { data: userData, loading: userLoading } = useDocument<UserDoc>("users", userId);

  // 2. Custom hooks for stats/achievements
  const { stats, levelInfo, loading: statsLoading } = useUserStats(userId);
  const { certificates, loading: certsLoading } = useCertificates(userId);
  const { achievements, loading: achLoading, refetch: refetchAchievements } = useAchievements(userId);

  // Claim logic
  const handleClaim = async (achId: string) => {
    if (!userId) return;
    const result = await claimAchievement(userId, achId);
    if (result.success) {
      alert(`🎉 Claimed +${result.xpEarned} XP!`);
      refetchAchievements();
    } else {
      alert(result.message || "Failed to claim reward");
    }
  };

  if (userLoading || statsLoading) {
    return (
      <div style={{ color: "#E4E1EE", padding: 40, textAlign: "center", background: "#0F0F1A", minHeight: "100vh" }}>
        Loading Profile...
      </div>
    );
  }

  const displayName = userData?.displayName || userProfile?.displayName || currentUser?.displayName || "User";
  const email = userData?.email || currentUser?.email || "";
  const role = userData?.role || userProfile?.role || "student";
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const totalXP = stats?.totalXP ?? 0;
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
      <div style={{ background: "#0F0F1A", minHeight: "100vh", color: "#E4E1EE", padding: "40px 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          
          {/* Main Grid Layout */}
          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 32, alignItems: "start" }}>
            
            {/* Left Column: User Card */}
            <div
              style={{
                background: "rgba(26,26,46,0.7)",
                borderRadius: 20,
                padding: "32px 24px",
                border: "1px solid rgba(255,255,255,0.06)",
                textAlign: "center",
              }}
            >
              <div style={{ position: "relative", width: 110, height: 110, margin: "0 auto 20px" }}>
                <img
                  src={userData?.photoURL || "https://api.dicebear.com/7.x/bottts/svg?seed=user"}
                  alt="Avatar"
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "3px solid #6C63FF",
                    background: "#1a1a2e",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    bottom: 4,
                    right: 4,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "#45f1c5",
                    border: "3px solid #0F0F1A",
                  }}
                />
              </div>

              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: "0 0 4px 0" }}>
                {displayName}
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: role === "admin" ? "#ffb4ab" : "#6C63FF",
                  background: role === "admin" ? "rgba(255,180,171,0.1)" : "rgba(108,99,255,0.1)",
                  padding: "4px 12px",
                  borderRadius: 999,
                  letterSpacing: ".05em",
                }}
              >
                {role}
              </span>

              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "24px 0" }} />

              {/* Meta Info */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14, textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#C7C4D8" }}>
                  <Mail size={16} color="#47464f" />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{email}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#C7C4D8" }}>
                  <Calendar size={16} color="#47464f" />
                  <span>Joined {userData?.createdAt?.toDate().toLocaleDateString() || "Recent"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#C7C4D8" }}>
                  <Activity size={16} color="#47464f" />
                  <span>Active {userData?.lastActiveAt?.toDate().toLocaleTimeString() || "Now"}</span>
                </div>
              </div>

              {/* Level Badge on side */}
              <div style={{ marginTop: 20 }}>
                <LevelBadge
                  level={levelInfo.level}
                  title={levelInfo.title}
                  icon={levelInfo.icon}
                  color={levelInfo.color}
                  size="lg"
                  showTitle={true}
                />
              </div>
            </div>

            {/* Right Column: Stats & Content */}
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              
              {/* Core Level Banner */}
              <div
                style={{
                  background: `linear-gradient(135deg, ${levelInfo.color}15, rgba(108,99,255,0.06))`,
                  borderRadius: 20,
                  padding: "24px 28px",
                  border: `1px solid ${levelInfo.color}25`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#C7C4D8", textTransform: "uppercase" }}>
                      Current Level
                    </span>
                    <h3 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: "2px 0" }}>
                      {levelInfo.icon} Level {levelInfo.level}
                      <span
                        style={{
                          fontSize: 16,
                          fontWeight: 600,
                          color: levelInfo.color,
                          marginLeft: 12,
                        }}
                      >
                        · {levelInfo.title}
                      </span>
                    </h3>
                  </div>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      background: `${levelInfo.color}20`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 28,
                      border: `1px solid ${levelInfo.color}30`,
                      boxShadow: `0 8px 24px ${levelInfo.color}20`,
                    }}
                  >
                    {levelInfo.icon}
                  </div>
                </div>

                {/* Level Progress Bar */}
                <LevelProgressBar
                  level={levelInfo.level}
                  progress={levelInfo.progress}
                  xpInLevel={levelInfo.xpInLevel}
                  xpToNext={levelInfo.xpToNext}
                  totalXP={levelInfo.totalXP}
                  color={levelInfo.color}
                  icon={levelInfo.icon}
                  title={levelInfo.title}
                  showLabels={true}
                />
              </div>

              {/* Mini Stats Row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                {[
                  { label: "Courses", val: enrolledCourses, icon: BookOpen, col: "#6C63FF" },
                  { label: "Lessons", val: completedLessons, icon: CheckCircle, col: "#45f1c5" },
                  { label: "Streak", val: `${streak} days`, icon: Flame, col: "#FFB785" },
                  { label: "Avg Quiz", val: `${Math.round(avgQuizScore)}%`, icon: Award, col: "#9B59B6" },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "rgba(26,26,46,0.5)",
                      borderRadius: 16,
                      padding: 20,
                      border: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#C7C4D8" }}>{item.label}</span>
                      <item.icon size={16} color={item.col} />
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{item.val}</div>
                  </div>
                ))}
              </div>

              {/* Activity Charts Section */}
              <div
                style={{
                  background: "rgba(26,26,46,0.6)",
                  borderRadius: 20,
                  padding: 24,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                  <TrendingUp size={18} color="#6C63FF" />
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#E4E1EE", margin: 0 }}>Learning Activity (Past 7 Days)</h3>
                </div>
                {xpData.length > 0 ? (
                  <div style={{ width: "100%", height: 180 }}>
                    <ResponsiveContainer>
                      <AreaChart data={xpData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorMins" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: "#C7C4D8", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#C7C4D8", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <RechartsTooltip
                          contentStyle={{ background: "#161624", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}
                          formatter={(value) => [`${value} XP`, "XP Earned"]}
                        />
                        <Area type="monotone" dataKey="xp" stroke="#6C63FF" strokeWidth={2} fillOpacity={1} fill="url(#colorMins)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "#47464f", fontSize: 13 }}>
                    No activity data available yet.
                  </div>
                )}
              </div>

              {/* "MY COMMUNITIES" SECTION */}
              {currentUser && (
                <div style={{ marginTop: 8 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <Crown size={18} color="#FFD700" />
                    My Communities
                  </h2>
                  <div style={{
                    background: "rgba(26,26,46,0.6)",
                    borderRadius: 16,
                    padding: "32px",
                    textAlign: "center",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <MessageSquare size={32} color="#47464f" style={{ marginBottom: 12 }} />
                    <p style={{ fontSize: 14, color: "#C7C4D8", marginBottom: 16, margin: "0 0 16px 0" }}>
                      Connect with instructors and fellow students in your course communities.
                    </p>
                    <Link
                      to="/chat"
                      style={{
                        padding: "8px 20px",
                        borderRadius: 10,
                        background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
                        color: "#fff",
                        textDecoration: "none",
                        fontWeight: 700,
                        fontSize: 13,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "0 4px 12px rgba(108,99,255,0.2)",
                      }}
                    >
                      Go to Chat <span style={{ transition: "transform 0.2s" }}>→</span>
                    </Link>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Certificates Section */}
          <div style={{ marginTop: 40 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Award size={20} color="#45f1c5" /> Verified Certificates ({certificates.length})
            </h3>
            {certsLoading ? (
              <p style={{ color: "#C7C4D8" }}>Loading...</p>
            ) : certificates.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20 }}>
                {certificates.map((cert) => (
                  <CertificateCard key={cert.id} certificate={cert} />
                ))}
              </div>
            ) : (
              <div style={{ background: "rgba(26,26,46,0.4)", borderRadius: 16, padding: "32px", textAlign: "center", border: "1px solid rgba(255,255,255,0.04)", color: "#C7C4D8", fontSize: 14 }}>
                Finish any high-tier course with full module compliance to earn dynamic smart certificates.
              </div>
            )}
          </div>

          {/* Achievements Section */}
          {!achLoading && (
            <>
              {/* Unlocked (claimable) Achievements */}
              {unlockedAchievements.length > 0 && (
                <div style={{ marginTop: 40 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "#FFB785", marginBottom: 16 }}>
                    🎉 Unlocked Rewards
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                    {unlockedAchievements.map((ach) => (
                      <div
                        key={ach.id}
                        style={{
                          background: "rgba(255,183,133,0.06)",
                          border: "1px solid rgba(255,183,133,0.2)",
                          borderRadius: 16,
                          padding: 20,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: "#fff", marginBottom: 4 }}>{ach.title}</div>
                          <div style={{ fontSize: 12, color: "#C7C4D8", marginBottom: 12 }}>{ach.description}</div>
                        </div>
                        <button
                          onClick={() => handleClaim(ach.id)}
                          style={{
                            width: "100%",
                            background: "#FFB785",
                            color: "#0F0F1A",
                            border: "none",
                            borderRadius: 8,
                            padding: "8px 12px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Claim +{ach.xpReward} XP
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Earned Badges */}
              <div style={{ marginTop: 40 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE", marginBottom: 16 }}>
                  🏆 Earned Badges ({achievements.filter(a => a.status === "claimed").length})
                </h3>
                {achievements.filter(a => a.status === "claimed").length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
                    {achievements
                      .filter(a => a.status === "claimed")
                      .map((ach) => (
                        <div
                          key={ach.id}
                          style={{
                            background: "rgba(69,241,197,0.04)",
                            border: "1px solid rgba(69,241,197,0.15)",
                            borderRadius: 14,
                            padding: 16,
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(69,241,197,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#45f1c5", flexShrink: 0 }}>
                            <Award size={20} />
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{ach.title}</div>
                            <div style={{ fontSize: 11, color: "#C7C4D8", marginTop: 2 }}>{ach.description}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p style={{ color: "#47464f", fontSize: 13 }}>No badges unlocked yet.</p>
                )}
              </div>

              {/* Locked Goals */}
              {lockedAchievements.length > 0 && (
                <div style={{ marginTop: 40 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE", marginBottom: 16 }}>
                    🔒 Locked Achievements
                  </h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    {lockedAchievements.map((ach) => (
                      <Tooltip.Root key={ach.id}>
                        <Tooltip.Trigger asChild>
                          <div
                            style={{
                              background: "rgba(255,255,255,0.02)",
                              border: "1px solid rgba(255,255,255,0.05)",
                              borderRadius: 12,
                              padding: "10px 16px",
                              fontSize: 13,
                              color: "#C7C4D8",
                              cursor: "help",
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Award size={14} color="#47464f" />
                            {ach.title}
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
                              color: "#E4E1EE",
                            }}
                          >
                            <strong>{ach.title}</strong><br />
                            {ach.description}<br />
                            <span style={{ color: "#c4c0ff" }}>Condition:</span> {ach.criteria.type.replace("_", " ")} &ge; {ach.criteria.threshold}<br />
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
    </Tooltip.Provider>
  );
}