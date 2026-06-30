import { useState, useEffect, useCallback } from "react";
import "./App.css";
import { RiLogoutCircleRLine, RiSunLine, RiMoonClearLine } from "react-icons/ri";
import { BiTask } from "react-icons/bi";
import { AiTwotoneDelete } from "react-icons/ai";




const API = "https://task-scheduler-backend-qu03.onrender.com";

const STATUS_OPTIONS = ["To-Do", "In Progress", "Completed"];

const STATUS_COLORS = {
  "To-Do":       { color: "#7ea6ff", bg: "rgba(126,166,255,0.10)", border: "rgba(126,166,255,0.28)" },
  "In Progress": { color: "#ffbb55", bg: "rgba(255,187,85,0.10)",  border: "rgba(255,187,85,0.28)"  },
  "Completed":   { color: "#3ecf8e", bg: "rgba(62,207,142,0.10)",  border: "rgba(62,207,142,0.28)"  },
};

const api = {
  login:      (email, password) => fetch(`${API}/auth/login`,  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }).then(r => { if (!r.ok) return r.json().then(e => Promise.reject(e.detail)); return r.json(); }),
  logout:     ()                => fetch(`${API}/auth/logout`, { method: "POST" }),
  getTasks:   ()                => fetch(`${API}/tasks`).then(r => r.json()),
  createTask: (task)            => fetch(`${API}/tasks`, { method: "POST",  headers: { "Content-Type": "application/json" }, body: JSON.stringify(task) }).then(r => r.json()),
  updateTask: (id, data)        => fetch(`${API}/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
  deleteTask: (id)              => fetch(`${API}/tasks/${id}`, { method: "DELETE" }),
};

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, type }) {
  return (
    <div className={`toast toast--${type}`}>
      <span className="toast-icon">{type === "error" ? "✕" : "✓"}</span>
      {message}
    </div>
  );
}

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [showPwd,  setShowPwd]  = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const user = await api.login(email.trim(), password.trim());
      onLogin(user);
    } catch (msg) {
      setError(typeof msg === "string" ? msg : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-icon"><BiTask /></span>
          <span className="brand-name">Task Manager</span>
        </div>
        <p className="login-sub">AI &amp; Tech Board — sign in to continue</p>

        <div className="login-field">
          <label className="login-label">Email</label>
          <input
            type="email"
            className={`login-input${error ? " login-input--err" : ""}`}
            placeholder="you@example.com"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            autoFocus
          />
        </div>

        <div className="login-field">
          <label className="login-label">Password</label>
          <div className="login-pwd-wrap">
            <input
              type={showPwd ? "text" : "password"}
              className={`login-input login-input--pwd${error ? " login-input--err" : ""}`}
              placeholder="••••••••"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
            <button
              type="button"
              className="pwd-toggle"
              onClick={() => setShowPwd(v => !v)}
              tabIndex={-1}
            >
              {showPwd ? "🙈" : "👁"}
            </button>
          </div>
        </div>

        {error && <p className="login-error">{error}</p>}

        <button
          className={`login-btn${loading ? " login-btn--loading" : ""}`}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? <span className="login-spinner" /> : "Sign In"}
        </button>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ user, onLogoutClick, theme, onToggleTheme }) {
  return (
    <aside className="sidebar sidebar--fade-in">
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <span className="brand-icon"><BiTask /></span>
          <span className="brand-name">Task Manager</span>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-nav-item sidebar-nav-item--active">
            <span className="sidebar-nav-icon">▦</span>
            <span className="sidebar-nav-label">Tasks</span>
          </div>
        </nav>
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <span className="sidebar-avatar">{user.name.charAt(0).toUpperCase()}</span>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user.name}</span>
            <span className="sidebar-user-email">{user.email}</span>
          </div>
        </div>
        <button className="sidebar-theme-btn" onClick={onToggleTheme} title="Toggle theme">
          <span className="sidebar-theme-icon">{theme === "dark" ? <RiSunLine /> : <RiMoonClearLine />}</span>
          <span className="sidebar-theme-label">{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
        </button>
        <button className="sidebar-logout-btn" onClick={onLogoutClick} title="Sign out">
          <span className="sidebar-logout-icon"><RiLogoutCircleRLine /></span>
          <span className="sidebar-logout-label">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

// ── Logout Confirm Modal ──────────────────────────────────────────────────────
function LogoutConfirmModal({ onCancel, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <p className="modal-message">Are you sure you really want to Signout?</p>
        <div className="modal-actions">
          <button className="modal-btn modal-btn--cancel" onClick={onCancel}>Cancel</button>
          <button className="modal-btn modal-btn--confirm" onClick={onConfirm}>Signout</button>
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [user,      setUser]      = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("pm_user")) || null; } catch { return null; }
  });
  const [tasks,     setTasks]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [newTitle,  setNewTitle]  = useState("");
  const [newStatus, setNewStatus] = useState("To-Do");
  const [adding,    setAdding]    = useState(false);
  const [search,    setSearch]    = useState("");
  const [toast,     setToast]     = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("pm_theme") || "dark"; } catch { return "dark"; }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("pm_theme", theme); } catch {}
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === "dark" ? "light" : "dark"));

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = (userData) => {
    sessionStorage.setItem("pm_user", JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await api.logout().catch(() => {});
    sessionStorage.removeItem("pm_user");
    setUser(null);
    setTasks([]);
  };

  const handleLogoutClick = () => setShowLogoutConfirm(true);
  const handleLogoutCancel = () => setShowLogoutConfirm(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setTasks(await api.getTasks());
    } catch {
      showToast("Failed to load tasks", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      const created = await api.createTask({ title: newTitle.trim(), status: newStatus });
      setTasks(prev => [created, ...prev]);
      setNewTitle(""); setNewStatus("To-Do");
      showToast("Task added");
    } catch {
      showToast("Failed to add task", "error");
    } finally {
      setAdding(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    try {
      await api.updateTask(id, { status });
      showToast("Status updated");
    } catch {
      showToast("Failed to update", "error");
      loadData();
    }
  };

  const handleDelete = async (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      await api.deleteTask(id);
      showToast("Task deleted");
    } catch {
      showToast("Failed to delete", "error");
      loadData();
    }
  };

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  const filtered = (search
    ? tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()))
    : tasks
  ).slice().sort((a, b) => {
    const aCompleted = a.status === "Completed" ? 1 : 0;
    const bCompleted = b.status === "Completed" ? 1 : 0;
    return aCompleted - bCompleted;
  });

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span>Loading tasks…</span>
      </div>
    );
  }

  return (
    <div className="page">
      <Sidebar user={user} onLogoutClick={handleLogoutClick} theme={theme} onToggleTheme={toggleTheme} />

      <div className="main-area">
        {/* Header */}
        <header className="app-header">
          <span className="header-sub">AI &amp; Tech Board</span>
          <div className="header-right">
            <div className="search-wrap">
              <span className="search-ico">⌕</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search tasks…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="user-chip">
              <span className="user-avatar">{user.name.charAt(0).toUpperCase()}</span>
              <span className="user-name">{user.name}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="content">
          <div className="table-card table-card--fade-up">

            <div className="table-head">
              <span>Task</span>
              <span>Status</span>
              <span />
            </div>

            <div className="add-row">
              <input
                type="text"
                className="add-input"
                placeholder="New task title…"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
              <select
                className="add-select"
                value={newStatus}
                onChange={e => setNewStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button
                className={`add-btn${adding || !newTitle.trim() ? " add-btn--disabled" : ""}`}
                onClick={handleAdd}
                disabled={adding || !newTitle.trim()}
                title="Add task"
              >
                {adding ? "…" : "+"}
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="empty-state">
                {search ? "No tasks match your search." : "Nothing here yet — add a task above."}
              </div>
            ) : filtered.map((task, idx) => {
              const sc = STATUS_COLORS[task.status] || { color: "#94a3b8", bg: "transparent", border: "#94a3b844" };
              return (
                <div key={task.id} className="task-row">
                  <div className="task-title-cell">
                    <span className="task-num">{idx + 1}</span>
                    <span className={`task-title${task.status === "Completed" ? " task-title--done" : ""}`}>
                      {task.title}
                    </span>
                  </div>
                  <select
                    value={task.status}
                    onChange={e => handleStatusChange(task.id, e.target.value)}
                    className="status-select"
                    style={{ color: sc.color, background: sc.bg, borderColor: sc.border }}
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s} style={{ color: "#e2e8f0", background: "#161f35" }}>{s}</option>
                    ))}
                  </select>
                  <button className="delete-btn" onClick={() => handleDelete(task.id)} title="Delete"><AiTwotoneDelete /></button>
                </div>
              );
            })}

            {tasks.length > 0 && (
              <div className="table-footer">
                {STATUS_OPTIONS.map(s => {
                  const sc = STATUS_COLORS[s] || {};
                  return (
                    <span key={s} className="footer-stat">
                      <span className="footer-dot" style={{ background: sc.color, boxShadow: `0 0 5px ${sc.color}` }} />
                      <span style={{ color: sc.color, fontWeight: 700 }}>{tasks.filter(t => t.status === s).length}</span>
                      <span className="footer-label">{s}</span>
                    </span>
                  );
                })}
                <span className="footer-total">{tasks.length} total</span>
              </div>
            )}
          </div>
        </main>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}

      {showLogoutConfirm && (
        <LogoutConfirmModal onCancel={handleLogoutCancel} onConfirm={handleLogout} />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        select option { background: #161f35; color: #e2e8f0; }
      `}</style>
    </div>
  );
}
