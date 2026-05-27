/**
 * src/pages/client/CourseCatalog.tsx
 * Danh sách khóa học (chỉ hiển thị published)
 */

"use client";

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../../utils/config";
import { useAuth } from "../../contexts/AuthContext";
import { BookOpen, Clock, Star, Users, Search, Loader } from "lucide-react";

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

export default function CourseCatalog() {
  const { currentUser } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    const q = query(
      collection(db, "courses"),
      where("status", "==", "published"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
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
      },
      (error) => {
        console.error("Error loading courses:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const filteredCourses = courses.filter((course) => {
    const matchSearch = course.title.toLowerCase().includes(search.toLowerCase()) ||
                        course.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === "all" || course.category === category;
    return matchSearch && matchCategory;
  });

  const categories = ["all", ...new Set(courses.map((c) => c.category))];

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <Loader size={36} color="#6C63FF" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#E4E1EE", marginBottom: 8 }}>Explore Courses</h1>
        <p style={{ fontSize: 16, color: "#C7C4D8" }}>Master new skills with our expert-led courses</p>
      </div>

      {/* Search & Filter */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 32 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#C7C4D8" }} />
          <input
            type="text"
            placeholder="Search courses..."
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
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{
            background: "#0d0d18",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: "10px 12px",
            color: "#E4E1EE",
            fontSize: 14,
          }}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat === "all" ? "All Categories" : cat}
            </option>
          ))}
        </select>
      </div>

      {/* Course Grid */}
      {filteredCourses.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#C7C4D8" }}>
          <BookOpen size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
          <p>No courses found. Try adjusting your search.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
          {filteredCourses.map((course) => (
            <Link
              key={course.id}
              to={`/courses/${course.id}`}
              style={{ textDecoration: "none", display: "block" }}
            >
              <div
                style={{
                  background: "rgba(26,26,46,0.7)",
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.06)",
                  overflow: "hidden",
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
                <div style={{ aspectRatio: "16/9", background: "#0a0a15", overflow: "hidden" }}>
                  {course.thumbnailUrl ? (
                    <img src={course.thumbnailUrl} alt={course.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(108,99,255,0.1)" }}>
                      <BookOpen size={32} color="#6C63FF" />
                    </div>
                  )}
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#6C63FF", background: "rgba(108,99,255,0.12)", padding: "2px 8px", borderRadius: 999 }}>
                      {course.category}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#FFB785", background: "rgba(255,183,133,0.12)", padding: "2px 8px", borderRadius: 999 }}>
                      {course.level === "beginner" ? "Beginner" : course.level === "intermediate" ? "Intermediate" : "Advanced"}
                    </span>
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE", marginBottom: 8, lineHeight: 1.3 }}>
                    {course.title}
                  </h3>
                  <p style={{ fontSize: 13, color: "#C7C4D8", marginBottom: 12, lineHeight: 1.5 }}>
                    {course.description.slice(0, 80)}...
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#FFB785" }}>
                      <Star size={12} fill="#FFB785" /> {course.rating.toFixed(1)}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#C7C4D8" }}>
                      <Users size={12} /> {course.totalStudents.toLocaleString()}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#C7C4D8" }}>
                      <Clock size={12} /> {course.totalDurationHours}h
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: "#45f1c5" }}>
                      {course.price === 0 ? "Free" : `$${course.price}`}
                    </span>
                    <span style={{ fontSize: 12, color: "#C7C4D8" }}>{course.modulesCount} modules</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}