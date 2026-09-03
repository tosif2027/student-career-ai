import { useEffect, useMemo, useState } from "react";
import "./Dashboard.css";
import { apiFetch, clearAuth } from "./api";

const empty = (value) => !Array.isArray(value) || value.length === 0;

function Dashboard({ onLogout }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("student") || "null"); }
    catch { return null; }
  });
  const [activePage, setActivePage] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [skills, setSkills] = useState([]);
  const [projects, setProjects] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [academics, setAcademics] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [career, setCareer] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [toast, setToast] = useState("");

  const studentId = user?.student_id;

  const logout = () => {
    clearAuth();
    onLogout?.();
  };

  useEffect(() => {
    const expired = () => logout();
    window.addEventListener("auth-expired", expired);
    return () => window.removeEventListener("auth-expired", expired);
  }, []);

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  };

  const loadAll = async () => {
    if (!studentId) {
      setError("Student profile is not available.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [skillRes, projectRes, attendanceRes, academicRes, assessmentRes, careerRes] = await Promise.all([
        apiFetch(`/api/skills/${studentId}`),
        apiFetch(`/api/projects/${studentId}`),
        apiFetch(`/api/attendance/${studentId}`),
        apiFetch(`/api/academics/${studentId}`),
        apiFetch(`/api/assessments/${studentId}`),
        apiFetch(`/api/career-ai/${studentId}`),
      ]);
      setSkills(skillRes.skills || []);
      setProjects(projectRes.projects || []);
      setAttendance(attendanceRes.attendance || []);
      setAcademics(academicRes.academics || []);
      setAssessments(assessmentRes.assessments || []);
      setCareer(careerRes.career_recommendation || null);
    } catch (err) {
      setError(err.message || "Unable to load your dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [studentId]);

  const nav = useMemo(() => [
    ["overview", "OV", "Overview"],
    ["attendance", "AT", "Attendance"],
    ["academics", "AC", "Academics"],
    ["assessment", "AS", "Assessment"],
    ["skills", "SK", "Skills"],
    ["projects", "PR", "Projects"],
    ["career", "AI", "Career AI"],
  ], []);

  const openSkill = (item = null) => {
    setModal({ type: "skill", item });
    setForm(item ? { skill_name: item.skill_name, skill_level: item.skill_level } : { skill_name: "", skill_level: 1 });
  };

  const openProject = (item = null) => {
    setModal({ type: "project", item });
    setForm(item ? {
      project_name: item.project_name,
      description: item.description || "",
      technology_used: item.technology_used || "",
      project_type: item.project_type || "Web Application",
    } : { project_name: "", description: "", technology_used: "", project_type: "Web Application" });
  };

  const closeModal = () => { setModal(null); setForm({}); };

  const save = async (event) => {
    event.preventDefault();
    if (!modal) return;
    try {
      if (modal.type === "skill") {
        const payload = { student_id: Number(studentId), skill_name: form.skill_name.trim(), skill_level: Number(form.skill_level) };
        if (!payload.skill_name || payload.skill_level < 1 || payload.skill_level > 5) throw new Error("Enter a skill name and a level from 1 to 5.");
        if (modal.item) await apiFetch(`/api/skills/${modal.item.skill_id}`, { method: "PUT", body: JSON.stringify(payload) });
        else await apiFetch("/api/skills", { method: "POST", body: JSON.stringify(payload) });
      } else {
        const payload = { student_id: Number(studentId), ...form, project_name: String(form.project_name || "").trim() };
        if (!payload.project_name) throw new Error("Project name is required.");
        if (modal.item) await apiFetch(`/api/projects/${modal.item.project_id}`, { method: "PUT", body: JSON.stringify(payload) });
        else await apiFetch("/api/projects", { method: "POST", body: JSON.stringify(payload) });
      }
      closeModal();
      await loadAll();
      showToast("Saved successfully.");
    } catch (err) { showToast(err.message || "Unable to save."); }
  };

  const remove = async (type, id) => {
    if (!window.confirm(`Delete this ${type}?`)) return;
    try {
      await apiFetch(`/api/${type === "skill" ? "skills" : "projects"}/${id}`, { method: "DELETE" });
      await loadAll();
      showToast(`${type === "skill" ? "Skill" : "Project"} deleted.`);
    } catch (err) { showToast(err.message || "Unable to delete."); }
  };

  const totalAttendance = attendance.length
    ? attendance.reduce((sum, r) => sum + Number(r.attendance_percentage || 0), 0) / attendance.length
    : 0;
  const avgCgpa = academics.length
    ? academics.reduce((sum, r) => sum + Number(r.cgpa || 0), 0) / academics.length
    : 0;
  const assessmentPct = assessments.length
    ? assessments.reduce((sum, r) => sum + (Number(r.max_score) ? Number(r.score) / Number(r.max_score) * 100 : 0), 0) / assessments.length
    : 0;

  const title = {
    overview: ["STUDENT DASHBOARD", "Overview", "Your personal academic and career snapshot."],
    attendance: ["ACADEMIC RECORD", "Attendance", "Attendance records maintained by faculty."],
    academics: ["ACADEMIC RECORD", "Academics", "Semester-wise academic performance."],
    assessment: ["ACADEMIC RECORD", "Assessment", "Assessment results and marks."],
    skills: ["PERSONAL PROFILE", "Skills", "Manage the skills in your own profile."],
    projects: ["PERSONAL PROFILE", "Projects", "Manage the projects in your own profile."],
    career: ["AI CAREER ANALYSIS", "Career AI", "Recommendations generated from your real profile data."],
  }[activePage];

  if (loading) return <div className="dashboard-loading"><div className="loader" /><p>Loading your dashboard...</p></div>;

  return (
    <div className="dashboard-app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">SC</div>
          <div><div className="sidebar-brand-title">Student Career AI</div><div className="sidebar-brand-subtitle">Student Portal</div></div>
        </div>
        <div className="sidebar-section-label">MENU</div>
        <nav className="sidebar-nav">
          {nav.map(([id, icon, label]) => (
            <button key={id} className={`sidebar-nav-item ${activePage === id ? "active" : ""}`} onClick={() => setActivePage(id)}>
              <span className="nav-icon">{icon}</span><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="sidebar-nav-item logout-btn" onClick={logout}><span className="nav-icon">LO</span><span>Logout</span></button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-title-area"><div className="header-eyebrow">{title[0]}</div><h1>{title[1]}</h1><p>{title[2]}</p></div>
          <div className="header-user"><div className="header-avatar">{String(user?.full_name || user?.username || "S").charAt(0).toUpperCase()}</div><div className="header-user-info"><strong>{user?.full_name || user?.username || "Student"}</strong><span>{user?.department || "Student"} · Sem {user?.semester || "—"}</span></div></div>
        </header>

        <section className="dashboard-content">
          {error && <div className="dashboard-error-inline">{error}<button onClick={loadAll}>Retry</button></div>}

          {activePage === "overview" && (
            <>
              <div className="welcome-card"><div className="welcome-content"><span>WELCOME BACK</span><h2>{user?.full_name || user?.username || "Student"}</h2><p>Your portal contains only your real records. Attendance, academics and assessments are view-only; skills and projects are editable by you.</p></div><div className="welcome-ai">AI</div></div>
              <div className="stats-grid">
                <Stat label="Attendance" value={`${totalAttendance.toFixed(1)}%`} note="Current average" icon="AT" />
                <Stat label="Average CGPA" value={avgCgpa ? avgCgpa.toFixed(2) : "—"} note="From academic records" icon="AC" />
                <Stat label="Assessments" value={assessments.length} note={assessmentPct ? `${assessmentPct.toFixed(1)}% average` : "No records"} icon="AS" />
                <Stat label="Projects" value={projects.length} note="Your profile" icon="PR" />
              </div>
              <div className="overview-grid">
                <Panel title="Academic Snapshot" subtitle="Read-only records from your faculty." rows={academics.slice(-4).reverse().map(r => [`Semester ${r.semester}`, Number(r.cgpa).toFixed(2)])} empty="No academic records yet." />
                <div className="dark-panel"><div className="panel-header"><div><h3>Career Snapshot</h3><p>{career?.career || "Not enough data yet"}</p></div></div><div className="panel-divider"/><div className="career-score"><div className="score-circle" style={{ background: `conic-gradient(#796bff ${Number(career?.match_percentage || 0) * 3.6}deg, #242a3b 0deg)` }}><span>{Math.round(Number(career?.match_percentage || 0))}</span><small>%</small></div><div><span className="muted">CAREER MATCH</span><h4>{career?.career || "Build your profile"}</h4></div></div></div>
              </div>
            </>
          )}

          {activePage === "attendance" && <ReadOnlyTable title="Attendance Records" columns={["Semester", "Total Classes", "Attended", "Attendance"]} rows={attendance.map(r => [r.semester, r.total_classes, r.attended_classes, `${Number(r.attendance_percentage).toFixed(2)}%`])} empty="No attendance records available." />}
          {activePage === "academics" && <ReadOnlyTable title="Academic Performance" columns={["Semester", "CGPA"]} rows={academics.map(r => [r.semester, Number(r.cgpa).toFixed(2)])} empty="No academic records available." />}
          {activePage === "assessment" && <ReadOnlyTable title="Assessment Results" columns={["Assessment", "Subject", "Score", "Max Score", "Date"]} rows={assessments.map(r => [r.assessment_name, r.subject, r.score, r.max_score, r.assessment_date || "—"])} empty="No assessment records available." />}

          {activePage === "skills" && <EditableSection title="My Skills" addLabel="Add Skill" onAdd={() => openSkill()} items={skills} empty="No skills added yet." renderItem={s => <div className="skill-card"><div className="skill-card-top"><div className="skill-icon">SK</div><div className="skill-actions"><button className="icon-btn edit" onClick={() => openSkill(s)}>✎</button><button className="icon-btn delete" onClick={() => remove("skill", s.skill_id)}>×</button></div></div><h3>{s.skill_name}</h3><div className="skill-level-label"><span>Level</span><strong>{s.skill_level}/5</strong></div><div className="skill-bars">{[1,2,3,4,5].map(n => <span key={n} className={n <= Number(s.skill_level) ? "filled" : ""}/>)}</div></div>} />}

          {activePage === "projects" && <EditableSection title="My Projects" addLabel="Add Project" onAdd={() => openProject()} items={projects} empty="No projects added yet." renderItem={p => <div className="project-card"><div className="project-card-top"><div className="project-icon">PR</div><div className="project-actions"><button className="icon-btn edit" onClick={() => openProject(p)}>✎</button><button className="icon-btn delete" onClick={() => remove("project", p.project_id)}>×</button></div></div><h3>{p.project_name}</h3><p>{p.description || "No description added."}</p><span className="project-type">{p.project_type || "Project"}</span><div className="tech-list">{String(p.technology_used || "").split(",").map(x => x.trim()).filter(Boolean).map(x => <span key={x}>{x}</span>)}</div></div>} />}

          {activePage === "career" && <CareerView career={career} onRefresh={loadAll} />}
        </section>
      </main>

      {toast && <div className="toast toast-success"><span>✓</span>{toast}</div>}

      {modal && <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && closeModal()}><form className="modal" onSubmit={save}><div className="modal-header"><div><span>{modal.type === "skill" ? "PERSONAL PROFILE" : "PERSONAL PROFILE"}</span><h2>{modal.item ? `Edit ${modal.type}` : `Add ${modal.type}`}</h2></div><button type="button" className="modal-close" onClick={closeModal}>×</button></div><div className="modal-form">
        {modal.type === "skill" ? <><Field label="Skill name"><input value={form.skill_name || ""} onChange={e => setForm({...form, skill_name: e.target.value})} placeholder="e.g. Python" required /></Field><Field label="Level (1-5)"><input type="number" min="1" max="5" value={form.skill_level || 1} onChange={e => setForm({...form, skill_level: e.target.value})} required /></Field></> : <><Field label="Project name"><input value={form.project_name || ""} onChange={e => setForm({...form, project_name: e.target.value})} placeholder="Project name" required /></Field><Field label="Description"><textarea value={form.description || ""} onChange={e => setForm({...form, description: e.target.value})} rows="3" /></Field><Field label="Technologies"><input value={form.technology_used || ""} onChange={e => setForm({...form, technology_used: e.target.value})} placeholder="Python, Flask, MySQL" /></Field><Field label="Project type"><input value={form.project_type || ""} onChange={e => setForm({...form, project_type: e.target.value})} /></Field></>}
        <div className="modal-actions"><button type="button" className="cancel-btn" onClick={closeModal}>Cancel</button><button className="save-btn">Save</button></div>
      </div></form></div>}
    </div>
  );
}

function Stat({ label, value, note, icon }) { return <div className="stat-card"><div className="stat-top"><span>{label}</span><div className="stat-icon">{icon}</div></div><strong>{value}</strong><small>{note}</small></div>; }
function Panel({ title, subtitle, rows, empty: emptyText }) { return <div className="dark-panel"><div className="panel-header"><div><h3>{title}</h3><p>{subtitle}</p></div></div><div className="panel-divider"/><div className="mini-list">{rows.length ? rows.map(([a,b]) => <div className="mini-row" key={`${a}-${b}`}><span>{a}</span><strong>{b}</strong></div>) : <div className="empty-state"><div className="empty-icon">AC</div><h3>{emptyText}</h3></div>}</div></div>; }
function ReadOnlyTable({ title, columns, rows, empty }) { return <div className="data-section"><div className="data-section-header"><div><h2>{title}</h2><p>View only — records are managed by authorised staff.</p></div></div><div className="data-section-body">{rows.length ? <div className="table-wrap"><table><thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((v,j) => <td key={j}>{v}</td>)}</tr>)}</tbody></table></div> : <div className="empty-state"><div className="empty-icon">NO</div><h3>{empty}</h3><p>When an authorised faculty/admin user adds records, they will appear here.</p></div>}</div></div>; }
function EditableSection({ title, addLabel, onAdd, items, empty: emptyText, renderItem }) { return <div className="data-section"><div className="data-section-header"><div><h2>{title}</h2><p>You can add, edit or delete your own profile records.</p></div><button className="primary-btn" onClick={onAdd}>+ {addLabel}</button></div>{items.length ? <div className={title.includes("Skill") ? "skills-grid" : "projects-grid"}>{items.map(item => <div key={item.skill_id || item.project_id}>{renderItem(item)}</div>)}</div> : <div className="data-section-body"><div className="empty-state"><div className="empty-icon">+</div><h3>{emptyText}</h3><p>Use the button above to add your first record.</p></div></div>}</div>; }
function CareerView({ career, onRefresh }) { const scores = career?.scores || {}; return <div className="career-page"><div className="career-hero"><div><span className="career-label">AI CAREER RECOMMENDATION</span><h2>{career?.career || "Build your profile"}</h2><p>{career ? "This recommendation is calculated from your real academic, attendance, skill, project and assessment records." : "Add profile data to generate a recommendation."}</p></div><div className="career-main-score"><div className="big-score-circle"><strong>{Math.round(Number(career?.match_percentage || 0))}</strong><span>%</span></div><small>Match score</small></div></div><div className="career-score-grid">{[["Academics",scores.academic_score],["Attendance",scores.attendance_score],["Skills",scores.skill_score],["Projects",scores.project_score],["Assessment",scores.assessment_score]].map(([a,b]) => <div className="career-score-card" key={a}><div className="career-score-top"><span>{a}</span><div>{Number(b||0).toFixed(0)}%</div></div><strong>{Number(b||0).toFixed(0)}%</strong><div className="score-progress"><span style={{width:`${Math.max(0,Math.min(100,Number(b||0)))}%`}}/></div></div>)}</div><div className="career-two-column"><div className="career-info-card"><div className="career-card-heading"><div className="positive-icon">+</div><div><h3>Strengths</h3><p>What is working well</p></div></div><div className="career-list">{(career?.strengths || []).map(x => <div className="career-list-item positive" key={x}><span>✓</span>{x}</div>)}</div></div><div className="career-info-card"><div className="career-card-heading"><div className="warning-icon">!</div><div><h3>Areas to improve</h3><p>Recommended focus</p></div></div><div className="career-list">{(career?.weaknesses || []).map(x => <div className="career-list-item warning" key={x}><span>!</span>{x}</div>)}</div></div></div><div className="career-card"><div className="career-card-title"><div><span>RECOMMENDED SKILLS</span><h3>Next skills to learn</h3></div></div><div className="recommended-skills">{(career?.recommended_skills || []).map((x,i)=><div className="recommended-skill" key={x}><span className="recommend-number">0{i+1}</span><strong>{x}</strong></div>)}</div><div className="roadmap">{(career?.roadmap || []).map((x,i)=><div className="roadmap-item" key={`${i}-${x}`}><div className="roadmap-number">{i+1}</div><div><strong>{x}</strong></div></div>)}</div></div><button className="refresh-ai-btn" onClick={onRefresh}>Refresh analysis</button></div>; }
function Field({ label, children }) { return <div className="form-group"><label>{label}</label>{children}</div>; }

export default Dashboard;
