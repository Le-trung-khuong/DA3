// src/pages/admin/events/EventManager.tsx
import React, { useState, useEffect } from "react";
import { useEvents } from "../../../hooks/useEvents";
import { createEvent, updateEvent, deleteEvent, toggleEvent, GameEvent } from "../../../services/eventService";
import { Calendar, Clock, Zap, Flame, Plus, Edit3, Trash2, Save, X, Loader, CheckCircle, XCircle, RefreshCw } from "lucide-react";

const EVENT_TYPES = [
  { value: "double_xp", label: "Double XP", color: "#45f1c5", defaultMultiplier: 2 },
  { value: "triple_xp", label: "Triple XP", color: "#6C63FF", defaultMultiplier: 3 },
  { value: "streak_bonus", label: "Streak Bonus", color: "#FFB785", defaultMultiplier: 1.5 },
  { value: "flash_sale", label: "Flash Sale", color: "#ff6b6b", defaultMultiplier: 2 },
  { value: "custom", label: "Custom", color: "#c4c0ff", defaultMultiplier: 1.5 },
];

function formatDate(date: Date) {
  return date.toISOString().slice(0, 16);
}

export default function EventManager() {
  const { events, loading, error } = useEvents();
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<GameEvent | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "double_xp" as GameEvent["type"],
    multiplier: 2,
    startDate: new Date().toISOString().slice(0, 16),
    endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
    description: "",
    color: "#45f1c5",
    icon: "⚡",
  });
  const [saving, setSaving] = useState(false);

  const handleTypeChange = (type: GameEvent["type"]) => {
    const config = EVENT_TYPES.find(t => t.value === type);
    setForm({
      ...form,
      type,
      multiplier: config?.defaultMultiplier || 2,
      color: config?.color || "#c4c0ff",
    });
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const eventData = {
        name: form.name,
        type: form.type,
        multiplier: form.multiplier,
        startDate: new Date(form.startDate),
        endDate: new Date(form.endDate),
        isActive: false,
        description: form.description,
        color: form.color,
        icon: form.icon,
      };
      if (editingEvent) {
        await updateEvent(editingEvent.id!, eventData);
      } else {
        await createEvent(eventData);
      }
      setShowForm(false);
      setEditingEvent(null);
      setForm({
        name: "",
        type: "double_xp",
        multiplier: 2,
        startDate: new Date().toISOString().slice(0, 16),
        endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
        description: "",
        color: "#45f1c5",
        icon: "⚡",
      });
    } catch (err) {
      console.error(err);
      alert("Lỗi khi lưu sự kiện");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (event: GameEvent) => {
    await toggleEvent(event.id!, !event.isActive);
  };

  const handleDelete = async (eventId: string) => {
    if (window.confirm("Xóa sự kiện này?")) {
      await deleteEvent(eventId);
    }
  };

  const handleEdit = (event: GameEvent) => {
    setEditingEvent(event);
    setForm({
      name: event.name,
      type: event.type,
      multiplier: event.multiplier,
      startDate: formatDate(event.startDate),
      endDate: formatDate(event.endDate),
      description: event.description,
      color: event.color,
      icon: event.icon,
    });
    setShowForm(true);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <Loader size={32} color="#6C63FF" style={{ animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#E4E1EE", display: "flex", alignItems: "center", gap: 12 }}>
            <Zap size={28} color="#FFD700" /> Quản lý sự kiện XP
          </h1>
          <p style={{ color: "#C7C4D8" }}>Tạo sự kiện nhân đôi XP, Triple XP, Streak Bonus...</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingEvent(null); }}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 12, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
          <Plus size={16} /> Tạo sự kiện
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {events.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#C7C4D8" }}>Chưa có sự kiện nào. Hãy tạo sự kiện đầu tiên!</div>
        ) : (
          events.map((event) => {
            const now = new Date();
            const isActiveNow = event.isActive && event.startDate <= now && event.endDate >= now;
            const isExpired = event.endDate < now;
            return (
              <div key={event.id} style={{ background: "rgba(26,26,46,.7)", borderRadius: 20, border: `1px solid ${event.color}40`, padding: 20, transition: "transform 0.2s" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 50, height: 50, borderRadius: 12, background: `${event.color}20`, border: `1px solid ${event.color}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{event.icon}</div>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE" }}>{event.name}</h3>
                      <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 999, background: `${event.color}20`, color: event.color, fontSize: 12, fontWeight: 700 }}>×{event.multiplier} XP</span>
                        <span style={{ fontSize: 12, color: "#C7C4D8", display: "flex", alignItems: "center", gap: 4 }}><Calendar size={12} /> {event.startDate.toLocaleDateString()} → {event.endDate.toLocaleDateString()}</span>
                        {isActiveNow && <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#45f1c5" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#45f1c5", animation: "pulse 1.5s infinite" }} /> Đang hoạt động</span>}
                        {isExpired && <span style={{ fontSize: 12, color: "#47464f" }}>Đã kết thúc</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleToggle(event)} style={{ width: 40, height: 40, borderRadius: 10, background: event.isActive ? "rgba(69,241,197,.12)" : "rgba(255,255,255,.05)", border: `1px solid ${event.isActive ? "rgba(69,241,197,.3)" : "rgba(255,255,255,.08)"}`, cursor: "pointer", color: event.isActive ? "#45f1c5" : "#C7C4D8" }}>
                      {event.isActive ? <CheckCircle size={18} /> : <XCircle size={18} />}
                    </button>
                    <button onClick={() => handleEdit(event)} style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(108,99,255,.08)", border: "1px solid rgba(108,99,255,.2)", cursor: "pointer", color: "#6C63FF" }}><Edit3 size={16} /></button>
                    <button onClick={() => handleDelete(event.id!)} style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,180,171,.08)", border: "1px solid rgba(255,180,171,.2)", cursor: "pointer", color: "#ffb4ab" }}><Trash2 size={16} /></button>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: "#C7C4D8", marginTop: 12 }}>{event.description}</p>
              </div>
            );
          })
        )}
      </div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => e.target === e.currentTarget && !saving && setShowForm(false)}>
          <div style={{ width: "100%", maxWidth: 500, background: "#1a1a2e", borderRadius: 24, padding: 24, border: "1px solid rgba(108,99,255,.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#E4E1EE" }}>{editingEvent ? "Sửa sự kiện" : "Tạo sự kiện mới"}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#C7C4D8" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tên sự kiện (VD: Double XP Weekend)" style={{ background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 14px", color: "#E4E1EE" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <select value={form.type} onChange={(e) => handleTypeChange(e.target.value as any)} style={{ background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 14px", color: "#E4E1EE" }}>
                  {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input type="number" step="0.5" value={form.multiplier} onChange={(e) => setForm({ ...form, multiplier: parseFloat(e.target.value) })} placeholder="Hệ số nhân" style={{ background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 14px", color: "#E4E1EE" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={{ fontSize: 11, color: "#C7C4D8" }}>Bắt đầu</label><input type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} style={{ width: "100%", background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 14px", color: "#E4E1EE" }} /></div>
                <div><label style={{ fontSize: 11, color: "#C7C4D8" }}>Kết thúc</label><input type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} style={{ width: "100%", background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 14px", color: "#E4E1EE" }} /></div>
              </div>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Mô tả sự kiện..." rows={2} style={{ background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 14px", color: "#E4E1EE", resize: "vertical" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
                <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Màu sắc (hex)" style={{ background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 14px", color: "#E4E1EE" }} />
                <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="Icon (emoji)" style={{ width: 80, background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 14px", color: "#E4E1EE", textAlign: "center" }} />
              </div>
              <button onClick={handleSubmit} disabled={saving} style={{ padding: "12px", borderRadius: 12, fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff", cursor: saving ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {saving ? <Loader size={16} style={{ animation: "spin .8s linear infinite" }} /> : <Save size={16} />}
                {editingEvent ? "Cập nhật" : "Tạo sự kiện"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}