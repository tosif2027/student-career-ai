import { useEffect, useMemo, useState } from "react";
import "./AdminDashboard.css";
import { apiFetch } from "./api";


function AdminDashboard({ onLogout }) {
  // =====================================================
  // STATE
  // =====================================================

  const [activePage, setActivePage] = useState("Overview");

  const [admin, setAdmin] = useState(null);

  const [overview, setOverview] = useState({
    total_users: 0,
    total_students: 0,
    total_faculty: 0,
    total_admins: 0
  });

  // CREATE MODAL
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState("faculty");
  const [creating, setCreating] = useState(false);

  const [createForm, setCreateForm] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    enrollment_no: "",
    department: "",
    semester: ""
  });

  const [students, setStudents] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [users, setUsers] = useState([]);

  const [pageLoading, setPageLoading] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  // =====================================================
  // LOAD ADMIN
  // =====================================================

  useEffect(() => {
    try {
      const storedUser = JSON.parse(
        sessionStorage.getItem("student") ||
          localStorage.getItem("student") ||
          "{}"
      );

      setAdmin(storedUser);
    } catch (error) {
      console.error("Admin load error:", error);
      setAdmin({});
    }
  }, []);

  // =====================================================
  // FETCH OVERVIEW
  // =====================================================

  const fetchOverview = async () => {
    try {
      const response = await apiFetch(
        `/api/admin/overview`
      );

      const data = await response.json();

      if (response.ok && data.status === "success") {
        setOverview({
          total_users: data.total_users || 0,
          total_students: data.total_students || 0,
          total_faculty: data.total_faculty || 0,
          total_admins: data.total_admins || 0
        });
      }
    } catch (error) {
      console.error("Overview error:", error);
    }
  };

  // =====================================================
  // FETCH STUDENTS
  // =====================================================

  const fetchStudents = async () => {
    setPageLoading(true);
    setError("");

    try {
      const response = await apiFetch(
        `/api/admin/students`
      );

      const data = await response.json();

      if (response.ok && data.status === "success") {
        setStudents(data.students || []);
      } else {
        setError(
          data.message || "Unable to load students."
        );
      }
    } catch (error) {
      console.error("Students error:", error);

      setError(
        "Unable to connect to backend."
      );
    } finally {
      setPageLoading(false);
    }
  };

  // =====================================================
  // FETCH FACULTY
  // =====================================================

  const fetchFaculty = async () => {
    setPageLoading(true);
    setError("");

    try {
      const response = await apiFetch(
        `/api/admin/faculty`
      );

      const data = await response.json();

      if (response.ok && data.status === "success") {
        setFaculty(data.faculty || []);
      } else {
        setError(
          data.message || "Unable to load faculty."
        );
      }
    } catch (error) {
      console.error("Faculty error:", error);

      setError(
        "Unable to connect to backend."
      );
    } finally {
      setPageLoading(false);
    }
  };

  // =====================================================
  // FETCH USERS
  // =====================================================

  const fetchUsers = async () => {
    setPageLoading(true);
    setError("");

    try {
      const response = await apiFetch(
        `/api/admin/users`
      );

      const data = await response.json();

      if (response.ok && data.status === "success") {
        setUsers(data.users || []);
      } else {
        setError(
          data.message || "Unable to load users."
        );
      }
    } catch (error) {
      console.error("Users error:", error);

      setError(
        "Unable to connect to backend."
      );
    } finally {
      setPageLoading(false);
    }
  };

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    fetchOverview();
    fetchStudents();
    fetchFaculty();
    fetchUsers();
  }, []);

  // =====================================================
  // CHANGE PAGE
  // =====================================================

  const handlePageChange = (page) => {
    setActivePage(page);
    setSearch("");
    setError("");
  };

  // =====================================================
  // OPEN CREATE MODAL
  // =====================================================

  const openCreateModal = (type) => {
    setCreateType(type);

    setCreateForm({
      username: "",
      email: "",
      password: "",
      full_name: "",
      enrollment_no: "",
      department: "",
      semester: ""
    });

    setError("");

    setShowCreateModal(true);
  };

  // =====================================================
  // CLOSE CREATE MODAL
  // =====================================================

  const closeCreateModal = () => {
    if (creating) {
      return;
    }

    setShowCreateModal(false);

    setCreateForm({
      username: "",
      email: "",
      password: "",
      full_name: "",
      enrollment_no: "",
      department: "",
      semester: ""
    });
  };

  // =====================================================
  // HANDLE CREATE INPUT
  // =====================================================

  const handleCreateInput = (e) => {
    const { name, value } = e.target;

    setCreateForm((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  // =====================================================
  // CREATE FACULTY / STUDENT
  // =====================================================

  const handleCreateUser = async (e) => {
    e.preventDefault();

    setCreating(true);

    try {
      const endpoint =
        createType === "faculty"
          ? `/api/admin/faculty`
          : `/api/admin/students`;

      const payload =
        createType === "faculty"
          ? {
              username: createForm.username.trim(),
              email: createForm.email.trim(),
              password: createForm.password
            }
          : {
              username: createForm.username.trim(),
              email: createForm.email.trim(),
              password: createForm.password,
              full_name: createForm.full_name.trim(),
              enrollment_no:
                createForm.enrollment_no.trim(),
              department:
                createForm.department.trim(),
              semester: Number(createForm.semester)
            };

      const response = await apiFetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        alert(
          data.message ||
            "Unable to create account."
        );

        return;
      }

      alert(
        createType === "faculty"
          ? "Faculty created successfully."
          : "Student created successfully."
      );

      setShowCreateModal(false);

      setCreateForm({
        username: "",
        email: "",
        password: "",
        full_name: "",
        enrollment_no: "",
        department: "",
        semester: ""
      });

      await fetchOverview();
      await fetchUsers();

      if (createType === "faculty") {
        await fetchFaculty();
      } else {
        await fetchStudents();
      }
    } catch (error) {
      console.error(
        "Create user error:",
        error
      );

      alert(
        "Unable to connect to backend."
      );
    } finally {
      setCreating(false);
    }
  };

  // =====================================================
  // UPDATE ROLE
  // =====================================================

  const handleRoleChange = async (
    userId,
    newRole
  ) => {
    const confirmed = window.confirm(
      `Change this user's role to ${newRole}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await apiFetch(
        `/api/admin/users/${userId}/role`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            role: newRole
          })
        }
      );

      const data = await response.json();

      if (response.ok) {
        await fetchUsers();
        await fetchOverview();
        await fetchStudents();
        await fetchFaculty();
      } else {
        alert(
          data.message ||
            "Unable to update user role."
        );
      }
    } catch (error) {
      console.error(error);

      alert(
        "Unable to connect to backend."
      );
    }
  };

  // =====================================================
  // DELETE USER
  // =====================================================

  const handleDeleteUser = async (user) => {
    if (user.role === "admin") {
      alert(
        "Admin users cannot be deleted."
      );

      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${user.username}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await apiFetch(
        `/api/admin/users/${user.user_id}`,
        {
          method: "DELETE"
        }
      );

      const data = await response.json();

      if (response.ok) {
        await fetchUsers();
        await fetchStudents();
        await fetchFaculty();
        await fetchOverview();

        alert(
          "User deleted successfully."
        );
      } else {
        alert(
          data.message ||
            "Unable to delete user."
        );
      }
    } catch (error) {
      console.error(error);

      alert(
        "Unable to connect to backend."
      );
    }
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout = () => {
    onLogout();
  };

  // =====================================================
  // FILTER STUDENTS
  // =====================================================

  const filteredStudents = useMemo(() => {
    const text = search.toLowerCase();

    return students.filter((student) => {
      return (
        student.full_name
          ?.toLowerCase()
          .includes(text) ||
        student.enrollment_no
          ?.toLowerCase()
          .includes(text) ||
        student.email
          ?.toLowerCase()
          .includes(text) ||
        student.department
          ?.toLowerCase()
          .includes(text)
      );
    });
  }, [students, search]);

  // =====================================================
  // FILTER FACULTY
  // =====================================================

  const filteredFaculty = useMemo(() => {
    const text = search.toLowerCase();

    return faculty.filter((member) => {
      return (
        member.username
          ?.toLowerCase()
          .includes(text) ||
        member.email
          ?.toLowerCase()
          .includes(text)
      );
    });
  }, [faculty, search]);

  // =====================================================
  // FILTER USERS
  // =====================================================

  const filteredUsers = useMemo(() => {
    const text = search.toLowerCase();

    return users.filter((user) => {
      return (
        user.username
          ?.toLowerCase()
          .includes(text) ||
        user.email
          ?.toLowerCase()
          .includes(text) ||
        user.role
          ?.toLowerCase()
          .includes(text)
      );
    });
  }, [users, search]);

  // =====================================================
  // PAGE HEADER
  // =====================================================

  const renderPageHeader = (
    eyebrow,
    title,
    description
  ) => {
    return (
      <div className="admin-page-heading">
        <div>
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
    );
  };

  // =====================================================
  // OVERVIEW
  // =====================================================

  const renderOverview = () => {
    return (
      <div className="admin-overview">

        <div className="admin-welcome">

          <div>
            <span>
              ADMIN CONTROL CENTER
            </span>

            <h1>
              Welcome back,{" "}
              <strong>
                {admin?.full_name ||
                  admin?.username ||
                  "Admin"}
              </strong>
            </h1>

            <p>
              Manage students, faculty and
              platform users from one place.
            </p>
          </div>

          <div className="admin-welcome-badge">

            <div className="admin-shield">
              AD
            </div>

            <div>
              <strong>
                Administrator
              </strong>

              <span>
                Full system access
              </span>
            </div>

          </div>

        </div>

        <div className="admin-stat-grid">

          <div className="admin-stat-card">

            <div className="admin-stat-icon">
              US
            </div>

            <div>
              <span>Total Users</span>

              <strong>
                {overview.total_users}
              </strong>
            </div>

          </div>

          <div className="admin-stat-card">

            <div className="admin-stat-icon">
              ST
            </div>

            <div>
              <span>Students</span>

              <strong>
                {overview.total_students}
              </strong>
            </div>

          </div>

          <div className="admin-stat-card">

            <div className="admin-stat-icon">
              FC
            </div>

            <div>
              <span>Faculty</span>

              <strong>
                {overview.total_faculty}
              </strong>
            </div>

          </div>

          <div className="admin-stat-card">

            <div className="admin-stat-icon">
              AD
            </div>

            <div>
              <span>Administrators</span>

              <strong>
                {overview.total_admins}
              </strong>
            </div>

          </div>

        </div>

        <div className="admin-dashboard-grid">

          <div className="admin-panel">

            <div className="admin-panel-header">

              <div>
                <span>
                  USER DISTRIBUTION
                </span>

                <h2>
                  Platform Overview
                </h2>
              </div>

            </div>

            <div className="distribution-list">

              <div className="distribution-item">

                <div>
                  <span>Students</span>

                  <strong>
                    {overview.total_students}
                  </strong>
                </div>

                <div className="distribution-bar">

                  <span
                    style={{
                      width: `${
                        overview.total_users
                          ? (overview.total_students /
                              overview.total_users) *
                            100
                          : 0
                      }%`
                    }}
                  />

                </div>

              </div>

              <div className="distribution-item">

                <div>
                  <span>Faculty</span>

                  <strong>
                    {overview.total_faculty}
                  </strong>
                </div>

                <div className="distribution-bar">

                  <span
                    style={{
                      width: `${
                        overview.total_users
                          ? (overview.total_faculty /
                              overview.total_users) *
                            100
                          : 0
                      }%`
                    }}
                  />

                </div>

              </div>

              <div className="distribution-item">

                <div>
                  <span>Admins</span>

                  <strong>
                    {overview.total_admins}
                  </strong>
                </div>

                <div className="distribution-bar">

                  <span
                    style={{
                      width: `${
                        overview.total_users
                          ? (overview.total_admins /
                              overview.total_users) *
                            100
                          : 0
                      }%`
                    }}
                  />

                </div>

              </div>

            </div>

          </div>

          <div className="admin-panel quick-actions">

            <div className="admin-panel-header">

              <div>
                <span>
                  QUICK ACCESS
                </span>

                <h2>
                  Management
                </h2>
              </div>

            </div>

            <button
              onClick={() =>
                handlePageChange("Students")
              }
            >
              <span className="quick-icon">
                ST
              </span>

              <div>
                <strong>
                  Manage Students
                </strong>

                <small>
                  View all student profiles
                </small>
              </div>

              <span className="arrow">
                →
              </span>

            </button>

            <button
              onClick={() =>
                handlePageChange("Faculty")
              }
            >
              <span className="quick-icon">
                FC
              </span>

              <div>
                <strong>
                  Manage Faculty
                </strong>

                <small>
                  View faculty accounts
                </small>
              </div>

              <span className="arrow">
                →
              </span>

            </button>

            <button
              onClick={() =>
                handlePageChange("Users")
              }
            >
              <span className="quick-icon">
                US
              </span>

              <div>
                <strong>
                  Manage Users
                </strong>

                <small>
                  Control users and roles
                </small>
              </div>

              <span className="arrow">
                →
              </span>

            </button>

          </div>

        </div>

      </div>
    );
  };

  // =====================================================
  // STUDENTS
  // =====================================================

  const renderStudents = () => {
    return (
      <div>

        {renderPageHeader(
          "STUDENT MANAGEMENT",
          "Students",
          "View and manage registered student accounts."
        )}

        <div className="admin-toolbar">

          <div className="admin-search">

            <span>⌕</span>

            <input
              type="text"
              placeholder="Search students by name, enrollment, email or department..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />

          </div>

          <div className="admin-toolbar-right">

            <div className="result-count">
              {filteredStudents.length} Students
            </div>

            <button
              className="create-primary-btn"
              onClick={() =>
                openCreateModal("student")
              }
            >
              + New Student
            </button>

          </div>

        </div>

        {pageLoading ? (

          <div className="admin-state">
            <div className="admin-loader" />
            Loading students...
          </div>

        ) : error ? (

          <div className="admin-error">
            {error}
          </div>

        ) : filteredStudents.length === 0 ? (

          <div className="admin-state">
            No students found.
          </div>

        ) : (

          <div className="admin-table-card">

            <div className="admin-table-wrapper">

              <table className="admin-table">

                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Enrollment</th>
                    <th>Department</th>
                    <th>Semester</th>
                    <th>Email</th>
                    <th>Account</th>
                  </tr>
                </thead>

                <tbody>

                  {filteredStudents.map(
                    (student) => (

                      <tr
                        key={
                          student.student_id
                        }
                      >

                        <td>

                          <div className="person-cell">

                            <div className="person-avatar">

                              {(
                                student.full_name ||
                                "S"
                              )
                                .charAt(0)
                                .toUpperCase()}

                            </div>

                            <div>

                              <strong>
                                {
                                  student.full_name
                                }
                              </strong>

                              <span>
                                @{student.username}
                              </span>

                            </div>

                          </div>

                        </td>

                        <td>

                          <span className="mono-text">
                            {
                              student.enrollment_no
                            }
                          </span>

                        </td>

                        <td>

                          <span className="department-badge">
                            {
                              student.department
                            }
                          </span>

                        </td>

                        <td>
                          Semester{" "}
                          {student.semester}
                        </td>

                        <td>

                          <span className="email-text">
                            {student.email}
                          </span>

                        </td>

                        <td>

                          <span className="status-badge active-status">
                            Active
                          </span>

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          </div>

        )}

      </div>
    );
  };

  // =====================================================
  // FACULTY
  // =====================================================

  const renderFaculty = () => {
    return (
      <div>

        {renderPageHeader(
          "FACULTY MANAGEMENT",
          "Faculty",
          "Manage faculty accounts and access."
        )}

        <div className="admin-toolbar">

          <div className="admin-search">

            <span>⌕</span>

            <input
              type="text"
              placeholder="Search faculty by username or email..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />

          </div>

          <div className="admin-toolbar-right">

            <div className="result-count">
              {filteredFaculty.length} Faculty
            </div>

            <button
              className="create-primary-btn"
              onClick={() =>
                openCreateModal("faculty")
              }
            >
              + New Faculty
            </button>

          </div>

        </div>

        {pageLoading ? (

          <div className="admin-state">
            <div className="admin-loader" />
            Loading faculty...
          </div>

        ) : error ? (

          <div className="admin-error">
            {error}
          </div>

        ) : filteredFaculty.length === 0 ? (

          <div className="admin-state">
            No faculty accounts found.
          </div>

        ) : (

          <div className="faculty-grid">

            {filteredFaculty.map(
              (member) => (

                <div
                  className="faculty-card"
                  key={member.user_id}
                >

                  <div className="faculty-card-top">

                    <div className="faculty-big-avatar">

                      {(
                        member.username ||
                        "F"
                      )
                        .charAt(0)
                        .toUpperCase()}

                    </div>

                    <span className="status-badge active-status">
                      Active
                    </span>

                  </div>

                  <h3>
                    {member.username}
                  </h3>

                  <p>
                    {member.email}
                  </p>

                  <div className="faculty-card-info">

                    <div>
                      <span>Role</span>
                      <strong>
                        Faculty
                      </strong>
                    </div>

                    <div>
                      <span>User ID</span>

                      <strong>
                        #{member.user_id}
                      </strong>
                    </div>

                  </div>

                  <button
                    className="danger-outline-btn"
                    onClick={() =>
                      handleDeleteUser(
                        member
                      )
                    }
                  >
                    Delete Faculty
                  </button>

                </div>

              )
            )}

          </div>

        )}

      </div>
    );
  };

  // =====================================================
  // USERS
  // =====================================================

  const renderUsers = () => {
    return (
      <div>

        {renderPageHeader(
          "USER MANAGEMENT",
          "Users",
          "Manage platform accounts and their roles."
        )}

        <div className="admin-toolbar">

          <div className="admin-search">

            <span>⌕</span>

            <input
              type="text"
              placeholder="Search by username, email or role..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />

          </div>

          <div className="result-count">
            {filteredUsers.length} Users
          </div>

        </div>

        {pageLoading ? (

          <div className="admin-state">
            <div className="admin-loader" />
            Loading users...
          </div>

        ) : error ? (

          <div className="admin-error">
            {error}
          </div>

        ) : filteredUsers.length === 0 ? (

          <div className="admin-state">
            No users found.
          </div>

        ) : (

          <div className="admin-table-card">

            <div className="admin-table-wrapper">

              <table className="admin-table">

                <thead>

                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>

                </thead>

                <tbody>

                  {filteredUsers.map(
                    (user) => (

                      <tr
                        key={
                          user.user_id
                        }
                      >

                        <td>

                          <div className="person-cell">

                            <div
                              className={`person-avatar ${
                                user.role ===
                                "admin"
                                  ? "admin-avatar"
                                  : ""
                              }`}
                            >
                              {(
                                user.username ||
                                "U"
                              )
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div>

                              <strong>
                                {
                                  user.username
                                }
                              </strong>

                              <span>
                                ID #{user.user_id}
                              </span>

                            </div>

                          </div>

                        </td>

                        <td>

                          <span className="email-text">
                            {user.email}
                          </span>

                        </td>

                        <td>

                          <select
                            className={`role-select ${user.role}`}
                            value={
                              user.role
                            }
                            disabled={
                              user.role ===
                              "admin"
                            }
                            onChange={(e) =>
                              handleRoleChange(
                                user.user_id,
                                e.target.value
                              )
                            }
                          >

                            <option value="student">
                              Student
                            </option>

                            <option value="faculty">
                              Faculty
                            </option>

                            <option value="admin">
                              Admin
                            </option>

                          </select>

                        </td>

                        <td>

                          {user.created_at
                            ? new Date(
                                user.created_at
                              ).toLocaleDateString()
                            : "—"}

                        </td>

                        <td>

                          {user.role ===
                          "admin" ? (

                            <span className="protected-label">
                              Protected
                            </span>

                          ) : (

                            <button
                              className="delete-btn"
                              onClick={() =>
                                handleDeleteUser(
                                  user
                                )
                              }
                            >
                              Delete
                            </button>

                          )}

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          </div>

        )}

      </div>
    );
  };

  // =====================================================
  // CONTENT
  // =====================================================

  const renderContent = () => {

    if (activePage === "Overview") {
      return renderOverview();
    }

    if (activePage === "Students") {
      return renderStudents();
    }

    if (activePage === "Faculty") {
      return renderFaculty();
    }

    if (activePage === "Users") {
      return renderUsers();
    }

    return null;
  };

  // =====================================================
  // MENU
  // =====================================================

  const menuItems = [
    {
      name: "Overview",
      icon: "OV"
    },
    {
      name: "Students",
      icon: "ST"
    },
    {
      name: "Faculty",
      icon: "FC"
    },
    {
      name: "Users",
      icon: "US"
    }
  ];

  // =====================================================
  // MAIN UI
  // =====================================================

  return (
    <div className="admin-dashboard">

      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside className="admin-sidebar">

        <div>

          {/* BRAND */}

          <div className="admin-brand">

            <div className="admin-logo">
              SC
            </div>

            <div>

              <strong>
                STUDENT
                <br />
                CAREER AI
              </strong>

              <span>
                Administration
              </span>

            </div>

          </div>

          <div className="admin-access-label">
            ADMIN ACCESS
          </div>

          {/* NAVIGATION */}

          <nav className="admin-nav">

            {menuItems.map(
              (item) => (

                <button
                  key={item.name}
                  className={
                    activePage ===
                    item.name
                      ? "admin-nav-item active"
                      : "admin-nav-item"
                  }
                  onClick={() =>
                    handlePageChange(
                      item.name
                    )
                  }
                >

                  <span className="admin-nav-icon">
                    {item.icon}
                  </span>

                  <span>
                    {item.name}
                  </span>

                  {activePage ===
                    item.name && (
                    <span className="nav-active-dot" />
                  )}

                </button>

              )
            )}

          </nav>

        </div>

        {/* SIDEBAR BOTTOM */}

        <div className="admin-sidebar-bottom">

          <div className="admin-profile">

            <div className="admin-profile-avatar">

              {(
                admin?.full_name ||
                admin?.username ||
                "A"
              )
                .charAt(0)
                .toUpperCase()}

            </div>

            <div>

              <strong>
                {admin?.full_name ||
                  admin?.username ||
                  "Administrator"}
              </strong>

              <span>
                Administrator
              </span>

            </div>

          </div>

          <button
            className="admin-logout"
            onClick={onLogout}
          >
            <span>↪</span>
            Logout
          </button>

        </div>

      </aside>

      {/* =================================================
          MAIN
      ================================================= */}

      <main className="admin-main">

        {/* TOPBAR */}

        <header className="admin-topbar">

          <div>

            <span>
              ADMIN /{" "}
              {activePage.toUpperCase()}
            </span>

            <h2>
              {activePage ===
              "Overview"
                ? "Dashboard"
                : activePage}
            </h2>

          </div>

          <div className="admin-top-right">

            <div className="system-status">

              <span />

              System Online

            </div>

            <div className="top-admin-avatar">

              {(
                admin?.full_name ||
                admin?.username ||
                "A"
              )
                .charAt(0)
                .toUpperCase()}

            </div>

          </div>

        </header>

        {/* CONTENT */}

        <div className="admin-content">
          {renderContent()}
        </div>

      </main>

      {/* =================================================
          CREATE FACULTY / STUDENT MODAL
      ================================================= */}

      {showCreateModal && (

        <div
          className="create-modal-overlay"
          onClick={(e) => {
            if (
              e.target ===
              e.currentTarget
            ) {
              closeCreateModal();
            }
          }}
        >

          <div className="create-modal">

            {/* MODAL HEADER */}

            <div className="create-modal-header">

              <div>

                <span>
                  {createType ===
                  "faculty"
                    ? "FACULTY MANAGEMENT"
                    : "STUDENT MANAGEMENT"}
                </span>

                <h2>
                  Create New{" "}
                  {createType ===
                  "faculty"
                    ? "Faculty"
                    : "Student"}
                </h2>

              </div>

              <button
                type="button"
                className="modal-close"
                onClick={
                  closeCreateModal
                }
                disabled={creating}
              >
                ×
              </button>

            </div>

            {/* FORM */}

            <form
              onSubmit={
                handleCreateUser
              }
            >

              <div className="form-grid">

                {/* STUDENT ONLY FIELDS */}

                {createType ===
                  "student" && (
                  <>
                    <div className="form-group full-width">

                      <label>
                        Full Name
                      </label>

                      <input
                        name="full_name"
                        value={
                          createForm.full_name
                        }
                        onChange={
                          handleCreateInput
                        }
                        placeholder="Enter student's full name"
                        required
                      />

                    </div>

                    <div className="form-group">

                      <label>
                        Enrollment Number
                      </label>

                      <input
                        name="enrollment_no"
                        value={
                          createForm.enrollment_no
                        }
                        onChange={
                          handleCreateInput
                        }
                        placeholder="e.g. 0101CS231001"
                        required
                      />

                    </div>

                    <div className="form-group">

                      <label>
                        Department
                      </label>

                      <input
                        name="department"
                        value={
                          createForm.department
                        }
                        onChange={
                          handleCreateInput
                        }
                        placeholder="e.g. CSE"
                        required
                      />

                    </div>

                    <div className="form-group">

                      <label>
                        Semester
                      </label>

                      <select
                        name="semester"
                        value={
                          createForm.semester
                        }
                        onChange={
                          handleCreateInput
                        }
                        required
                      >

                        <option value="">
                          Select semester
                        </option>

                        {[1, 2, 3, 4, 5, 6, 7, 8].map(
                          (sem) => (

                            <option
                              key={sem}
                              value={sem}
                            >
                              Semester{" "}
                              {sem}
                            </option>

                          )
                        )}

                      </select>

                    </div>
                  </>
                )}

                {/* USERNAME */}

                <div className="form-group">

                  <label>
                    Username
                  </label>

                  <input
                    name="username"
                    value={
                      createForm.username
                    }
                    onChange={
                      handleCreateInput
                    }
                    placeholder="Enter username"
                    required
                  />

                </div>

                {/* EMAIL */}

                <div className="form-group">

                  <label>
                    Email
                  </label>

                  <input
                    type="email"
                    name="email"
                    value={
                      createForm.email
                    }
                    onChange={
                      handleCreateInput
                    }
                    placeholder="Enter email address"
                    required
                  />

                </div>

                {/* PASSWORD */}

                <div className="form-group full-width">

                  <label>
                    Password
                  </label>

                  <input
                    type="password"
                    name="password"
                    value={
                      createForm.password
                    }
                    onChange={
                      handleCreateInput
                    }
                    placeholder="Create password"
                    minLength={6}
                    required
                  />

                </div>

              </div>

              {/* FOOTER */}

              <div className="create-modal-footer">

                <button
                  type="button"
                  className="cancel-btn"
                  onClick={
                    closeCreateModal
                  }
                  disabled={creating}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="create-submit-btn"
                  disabled={creating}
                >
                  {creating
                    ? "Creating..."
                    : `Create ${
                        createType ===
                        "faculty"
                          ? "Faculty"
                          : "Student"
                      }`}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}

export default AdminDashboard;