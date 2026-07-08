// src/pages/client/CourseCatalog.tsx
/**
 * Danh sách khóa học — polished UI, filter chips, skeleton loading
 */
"use client";

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../../utils/config";
import { useAuth } from "../../contexts/AuthContext";
import { BookOpen, Clock, Star, Users, Search, Loader, Sparkles, TrendingUp, Zap } from "lucide-react";

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  category: string;
  level: string;
  price: number;
  rating: number;
  totalStudents: number;
  totalDurationHours: number;
  modulesCount: number;
}

const LEVEL_COLOR: Record<string, { color: string; bg: string }> = {
  beginner:     { color: "#45f1c5", bg: "rgba(69,241,197,0.12)" },
  intermediate: { color: "#FFB785", bg: "rgba(255,183,133,0.12)" },
  advanced:     { color: "#ffb4ab", bg: "rgba(255,180,171,0.12)" },
};

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced",
};

function SkeletonCard() {
  return (
    <div style={{
      background: "rgba(26,26,46,0.7)", borderRadius: 20,
      border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden",
    }}>
      <div style={{
        aspectRatio: "16/9",
        background: "linear-gradient(90deg,rgba(255,255,255,.03) 25%,rgba(255,255,255,.07) 50%,rgba(255,255,255,.03) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
      }} />
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ height: 12, width: "40%", borderRadius: 6, background: "rgba(255,255,255,0.05)" }} />
        <div style={{ height: 18, width: "85%", borderRadius: 6, background: "rgba(255,255,255,0.07)" }} />
        <div style={{ height: 12, width: "70%", borderRadius: 6, background: "rgba(255,255,255,0.04)" }} />
        <div style={{ height: 12, width: "55%", borderRadius: 6, background: "rgba(255,255,255,0.04)" }} />
        <div style={{ height: 24, width: "35%", borderRadius: 6, background: "rgba(255,255,255,0.06)", marginTop: 4 }} />
      </div>
    </div>
  );
}

export default function CourseCatalog() {
  const { currentUser } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<"newest" | "popular" | "price_asc" | "price_desc">("newest");
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "courses"),
      where("status", "==", "published"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || "Untitled",
          description: data.description || "",
          thumbnailUrl: data.thumbnailUrl || "",
          category: data.category || "General",
          level: data.level || "beginner",
          price: data.price || 0,
          rating: data.rating || 0,
          totalStudents: data.totalStudents || 0,
          totalDurationHours: data.totalDurationHours || 0,
          modulesCount: data.modules?.length || 0,
        };
      });
      setCourses(list);
      setLoading(false);
    }, (error) => {
      console.error("Error loading courses:", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const categories = ["all", ...new Set(courses.map((c) => c.category))];

  let filteredCourses = courses.filter((course) => {
    const matchSearch = course.title.toLowerCase().includes(search.toLowerCase()) ||
                        course.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === "all" || course.category === category;
    return matchSearch && matchCategory;
  });

  if (sort === "popular")    filteredCourses = [...filteredCourses].sort((a, b) => b.totalStudents - a.totalStudents);
  if (sort === "price_asc")  filteredCourses = [...filteredCourses].sort((a, b) => a.price - b.price);
  if (sort === "price_desc") filteredCourses = [...filteredCourses].sort((a, b) => b.price - a.price);

  const popularIds = [...courses].sort((a, b) => b.totalStudents - a.totalStudents).slice(0, 3).map(c => c.id);
  const newestIds  = courses.slice(0, 3).map(c => c.id);

  return (
    <div style={{ background: "#0F0F1A", minHeight: "100vh" }}>
      <style>{`
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes spin    { to{transform:rotate(360deg)} }
      `}</style>

      <div style={{
        background: "linear-gradient(135deg,rgba(108,99,255,0.15),rgba(155,89,182,0.08),rgba(15,15,26,0))",
        borderBottom: "1px solid rgba(108,99,255,0.1)",
        padding: "48px 0 36px",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Sparkles size={16} color="#6C63FF" />
            <span style={{ fontSize: 11, fontWeight: 800, color: "#6C63FF", textTransform: "uppercase", letterSpacing: ".1em" }}>
              Course Library
            </span>
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: "#E4E1EE", margin: "0 0 8px", letterSpacing: "-.025em" }}>
            Khám phá khóa học
          </h1>
          <p style={{ fontSize: 16, color: "#C7C4D8", margin: 0 }}>
            {courses.length} khóa học từ các chuyên gia hàng đầu
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 28, alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 260px", minWidth: 220 }}>
            <Search size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: searchFocused ? "#6C63FF" : "#C7C4D8", transition: "color .2s" }} />
            <input
              type="text"
              placeholder="Tìm kiếm khóa học..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(26,26,46,0.8)",
                border: `1px solid ${searchFocused ? "rgba(108,99,255,0.4)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 14, padding: "12px 14px 12px 40px",
                color: "#E4E1EE", fontSize: 14, outline: "none",
                transition: "border-color .2s, box-shadow .2s",
                boxShadow: searchFocused ? "0 0 0 3px rgba(108,99,255,0.12)" : "none",
              }}
            />
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            style={{
              background: "rgba(26,26,46,0.8)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14, padding: "12px 14px", color: "#E4E1EE", fontSize: 14, outline: "none",
            }}
          >
            <option value="newest">Mới nhất</option>
            <option value="popular">Phổ biến nhất</option>
            <option value="price_asc">Giá tăng dần</option>
            <option value="price_desc">Giá giảm dần</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: "8px 18px", borderRadius: 999, fontSize: 13, fontWeight: 700,
                cursor: "pointer", transition: "all .2s", border: "none",
                background: category === cat
                  ? "linear-gradient(135deg,#6C63FF,#9B59B6)"
                  : "rgba(255,255,255,0.05)",
                color: category === cat ? "#fff" : "#C7C4D8",
                boxShadow: category === cat ? "0 4px 12px rgba(108,99,255,0.3)" : "none",
              }}
            >
              {cat === "all" ? "Tất cả" : cat}
              {cat === "all" && <span style={{ marginLeft: 6, fontSize: 11, opacity: .7 }}>{courses.length}</span>}
              {cat !== "all" && (
                <span style={{ marginLeft: 6, fontSize: 11, opacity: .7 }}>
                  {courses.filter(c => c.category === cat).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {!loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, color: "#C7C4D8", fontSize: 13 }}>
            <TrendingUp size={14} color="#6C63FF" />
            <span>Hiển thị <strong style={{ color: "#E4E1EE" }}>{filteredCourses.length}</strong> khóa học</span>
          </div>
        )}

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 24 }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredCourses.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "80px 24px",
            background: "rgba(26,26,46,0.4)", borderRadius: 24,
            border: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%", margin: "0 auto 20px",
              background: "rgba(108,99,255,0.1)", border: "1px solid rgba(108,99,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <BookOpen size={32} color="#6C63FF" />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "#E4E1EE", marginBottom: 8 }}>Không tìm thấy khóa học</h3>
            <p style={{ fontSize: 14, color: "#C7C4D8", maxWidth: 320, margin: "0 auto" }}>
              Thử thay đổi từ khóa tìm kiếm hoặc chọn danh mục khác.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 24 }}>
            {filteredCourses.map((course, i) => {
              const isHot  = popularIds.includes(course.id);
              const isNew  = newestIds.includes(course.id) && !isHot;
              const lv = LEVEL_COLOR[course.level] || LEVEL_COLOR.beginner;
              return (
                <Link
                  key={course.id}
                  to={`/courses/${course.id}`}
                  style={{ textDecoration: "none", display: "block", animation: `fadeUp .4s ${i * 0.04}s ease both` }}
                >
                  <div
                    style={{
                      background: "rgba(26,26,46,0.7)", borderRadius: 20,
                      border: "1px solid rgba(255,255,255,0.06)",
                      overflow: "hidden", height: "100%",
                      transition: "transform .2s, box-shadow .2s, border-color .2s",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = "translateY(-5px)";
                      e.currentTarget.style.boxShadow = "0 16px 40px rgba(0,0,0,0.4)";
                      e.currentTarget.style.borderColor = "rgba(108,99,255,0.3)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                    }}
                  >
                    <div style={{ aspectRatio: "16/9", background: "#0a0a15", overflow: "hidden", position: "relative" }}>
                      {course.thumbnailUrl ? (
                        <img
                          src={course.thumbnailUrl} alt={course.title}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform .3s" }}
                          onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.05)"}
                          onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
                        />
                      ) : (
                        <div style={{
                          width: "100%", height: "100%",
                          background: "linear-gradient(135deg,rgba(108,99,255,0.15),rgba(155,89,182,0.08))",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <BookOpen size={36} color="#6C63FF" />
                        </div>
                      )}
                      <div style={{
                        position: "absolute", inset: 0,
                        background: "linear-gradient(to top, rgba(26,26,46,0.6) 0%, transparent 60%)",
                      }} />
                      {(isHot || isNew) && (
                        <div style={{
                          position: "absolute", top: 10, left: 10,
                          fontSize: 10, fontWeight: 800, letterSpacing: ".06em",
                          padding: "4px 10px", borderRadius: 999,
                          background: isHot ? "linear-gradient(135deg,#FFB785,#ff8c42)" : "linear-gradient(135deg,#6C63FF,#9B59B6)",
                          color: "#fff", boxShadow: isHot ? "0 4px 10px rgba(255,140,66,0.4)" : "0 4px 10px rgba(108,99,255,0.4)",
                        }}>
                          {isHot ? "🔥 HOT" : "✨ NEW"}
                        </div>
                      )}
                      {course.price === 0 && (
                        <div style={{
                          position: "absolute", top: 10, right: 10,
                          fontSize: 10, fontWeight: 800, letterSpacing: ".06em",
                          padding: "4px 10px", borderRadius: 999,
                          background: "linear-gradient(135deg,#45f1c5,#00D4AA)",
                          color: "#0F0F1A",
                        }}>FREE</div>
                      )}
                    </div>

                    <div style={{ padding: 18 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#6C63FF", background: "rgba(108,99,255,0.12)", padding: "3px 9px", borderRadius: 999, border: "1px solid rgba(108,99,255,0.2)" }}>
                          {course.category}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: lv.color, background: lv.bg, padding: "3px 9px", borderRadius: 999 }}>
                          {LEVEL_LABEL[course.level] || course.level}
                        </span>
                      </div>

                      <h3 style={{
                        fontSize: 16, fontWeight: 700, color: "#E4E1EE", marginBottom: 8, lineHeight: 1.35,
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}>
                        {course.title}
                      </h3>

                      <p style={{
                        fontSize: 13, color: "#C7C4D8", marginBottom: 14, lineHeight: 1.55,
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}>
                        {course.description}
                      </p>

                      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#FFB785", fontWeight: 600 }}>
                          <Star size={12} fill="#FFB785" color="#FFB785" /> {course.rating.toFixed(1)}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#C7C4D8" }}>
                          <Users size={12} /> {course.totalStudents.toLocaleString()}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#C7C4D8" }}>
                          <Clock size={12} /> {course.totalDurationHours}h
                        </span>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <span style={{ fontSize: 20, fontWeight: 900, color: course.price === 0 ? "#45f1c5" : "#E4E1EE" }}>
                          {course.price === 0
                            ? "Miễn phí"
                            : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(course.price)}
                        </span>
                        <span style={{ fontSize: 12, color: "#C7C4D8" }}>{course.modulesCount} modules</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}