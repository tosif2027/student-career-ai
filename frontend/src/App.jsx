import { useEffect, useState } from "react";
import "./App.css";

import Dashboard from "./Dashboard";
import FacultyDashboard from "./FacultyDashboard";
import AdminDashboard from "./AdminDashboard";
import { API, apiFetch, clearAuth } from "./api";

function App() {
  // =====================================================
  // LOGIN / REGISTER MODE
  // =====================================================

  const [isLogin, setIsLogin] = useState(true);

  // =====================================================
  // AUTH STATE
  // =====================================================

  const getStoredUser = () => {
    try {
      return JSON.parse(sessionStorage.getItem("student") || "null");
    } catch {
      return null;
    }
  };

  const storedUser = getStoredUser();

  const [isLoggedIn, setIsLoggedIn] = useState(!!storedUser);

  const [userRole, setUserRole] = useState(
    storedUser?.role || sessionStorage.getItem("userRole") || ""
  );

  const [authChecking, setAuthChecking] = useState(!!storedUser);

  // =====================================================
  // FORM DATA
  // =====================================================

  const emptyForm = {
    email: "",
    password: "",
    username: "",
    full_name: "",
    enrollment_no: "",
    department: "",
    semester: ""
  };

  const [formData, setFormData] = useState(emptyForm);

  // =====================================================
  // UI STATE
  // =====================================================

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [loading, setLoading] = useState(false);

  // Validate the server-side signed session on every page reload.
  useEffect(() => {
    if (!sessionStorage.getItem("accessToken")) {
      setAuthChecking(false);
      return;
    }

    apiFetch("/api/me")
      .then((data) => {
        if (data.user) {
          sessionStorage.setItem("student", JSON.stringify(data.user));
          sessionStorage.setItem("userRole", data.user.role);
          setUserRole(data.user.role);
          setIsLoggedIn(true);
        }
      })
      .catch(() => {
        clearAuth();
        setIsLoggedIn(false);
        setUserRole("");
      })
      .finally(() => setAuthChecking(false));
  }, []);

  // =====================================================
  // HANDLE INPUT
  // =====================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value
    }));

    // Remove old message when user starts typing again
    if (message) {
      setMessage("");
      setMessageType("");
    }
  };

  // =====================================================
  // SWITCH LOGIN / REGISTER
  // =====================================================

  const switchMode = (loginMode) => {
    setIsLogin(loginMode);
    setMessage("");
    setMessageType("");
    setFormData(emptyForm);
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout = () => {
    clearAuth();

    setIsLoggedIn(false);
    setUserRole("");
    setAuthChecking(false);

    setMessage("");
    setMessageType("");
    setIsLogin(true);
    setFormData(emptyForm);
  };

  // =====================================================
  // LOGIN / REGISTER
  // =====================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setMessage("");
    setMessageType("");

    try {
      // -------------------------------------------------
      // API ENDPOINT
      // -------------------------------------------------

      const endpoint = isLogin
        ? `${API}/api/login`
        : `${API}/api/students`;

      // -------------------------------------------------
      // REQUEST BODY
      // -------------------------------------------------

      let body;

      if (isLogin) {
        body = {
          email: formData.email.trim(),
          password: formData.password
        };
      } else {
        body = {
          username: formData.username.trim(),
          email: formData.email.trim(),
          password: formData.password,
          full_name: formData.full_name.trim(),
          enrollment_no: formData.enrollment_no.trim(),
          department: formData.department.trim(),
          semester: Number(formData.semester)
        };
      }

      // -------------------------------------------------
      // API REQUEST
      // -------------------------------------------------

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      // -------------------------------------------------
      // READ RESPONSE
      // -------------------------------------------------

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      console.log("API Response:", data);

      // =================================================
      // LOGIN SUCCESS
      // =================================================

      if (isLogin && response.ok) {
        const loggedInUser = data.user;

        // -----------------------------------------------
        // Validate user object
        // -----------------------------------------------

        if (!loggedInUser) {
          setMessage("Login successful, but user information was not received.");
          setMessageType("error");
          return;
        }

        // -----------------------------------------------
        // Get role
        // -----------------------------------------------

        const role = String(loggedInUser.role || "").toLowerCase();

        // -----------------------------------------------
        // Save signed access token + user profile
        // -----------------------------------------------

        if (!data.token) {
          setMessage("Login failed: authentication token was not received.");
          setMessageType("error");
          return;
        }

        sessionStorage.setItem("accessToken", data.token);
        sessionStorage.setItem("student", JSON.stringify(loggedInUser));

        // -----------------------------------------------
        // Save role separately
        // -----------------------------------------------

        sessionStorage.setItem("userRole", role);

        // -----------------------------------------------
        // Update React state
        // -----------------------------------------------

        setUserRole(role);
        setIsLoggedIn(true);

        setMessage(
          `Welcome, ${
            loggedInUser.full_name ||
            loggedInUser.username ||
            "User"
          }`
        );

        setMessageType("success");

        return;
      }

      // =================================================
      // REGISTER SUCCESS
      // =================================================

      if (!isLogin && response.ok) {
        setMessage(
          data.message ||
          "Registration successful. You can now login."
        );

        setMessageType("success");

        // -----------------------------------------------
        // Switch to login automatically
        // -----------------------------------------------

        setIsLogin(true);

        // -----------------------------------------------
        // Keep email for easier login
        // -----------------------------------------------

        setFormData({
          ...emptyForm,
          email: formData.email.trim()
        });

        return;
      }

      // =================================================
      // API ERROR
      // =================================================

      setMessage(
        data.message ||
        data.error ||
        "Something went wrong. Please try again."
      );

      setMessageType("error");

    } catch (error) {
      console.error("Authentication error:", error);

      setMessage(
        "Unable to connect to the backend server. Make sure Flask is running on port 5000."
      );

      setMessageType("error");

    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // ROLE BASED DASHBOARD
  // =====================================================

  if (authChecking) {
    return <div className="dashboard-loading"><div className="loader" /><p>Checking session...</p></div>;
  }

  if (isLoggedIn) {

    // ---------------------------------------------------
    // STUDENT
    // ---------------------------------------------------

    if (userRole === "student") {
      return <Dashboard onLogout={handleLogout} />;
    }

    // ---------------------------------------------------
    // FACULTY
    // ---------------------------------------------------

    if (userRole === "faculty") {
      return <FacultyDashboard onLogout={handleLogout} />;
    }

    // ---------------------------------------------------
    // ADMIN
    // ---------------------------------------------------

    if (userRole === "admin") {
      return <AdminDashboard onLogout={handleLogout} />;
    }

    // ---------------------------------------------------
    // UNKNOWN ROLE
    // ---------------------------------------------------

    return (
      <div className="invalid-role-page">

        <div className="invalid-role-card">

          <div className="invalid-role-icon">
            !
          </div>

          <h2>
            Invalid User Role
          </h2>

          <p>
            We couldn't determine your account role.
          </p>

          <button
            type="button"
            onClick={handleLogout}
          >
            Back to Login
          </button>

        </div>

      </div>
    );
  }

  // =====================================================
  // AUTH PAGE
  // =====================================================

  return (
    <div className="app">

      {/* =================================================
          BACKGROUND
      ================================================= */}

      <div className="background-glow glow-one"></div>
      <div className="background-glow glow-two"></div>

      {/* =================================================
          MAIN AUTH CONTAINER
      ================================================= */}

      <div className="auth-container">

        {/* =================================================
            LEFT BRAND SECTION
        ================================================= */}

        <section className="brand-section">

          {/* BRAND */}
          <div className="brand-top">

            <div className="brand-mark">
              SC
            </div>

            <div className="brand-label">
              STUDENT CAREER AI
            </div>

          </div>

          {/* HEADING */}

          <h1>
            Build your career
            <span> with intelligence.</span>
          </h1>

          {/* DESCRIPTION */}

          <p className="brand-description">
            An intelligent career guidance platform designed
            to analyze your academic performance, skills and
            interests to help you discover the right career path.
          </p>

          {/* =================================================
              FEATURES
          ================================================= */}

          <div className="feature-list">

            {/* FEATURE 1 */}

            <div className="feature-item">

              <div className="feature-icon">
                AI
              </div>

              <div className="feature-content">

                <h3>
                  AI Career Recommendations
                </h3>

                <p>
                  Get personalized career suggestions based
                  on your academic profile, skills and interests.
                </p>

              </div>

            </div>

            {/* FEATURE 2 */}

            <div className="feature-item">

              <div className="feature-icon">
                AP
              </div>

              <div className="feature-content">

                <h3>
                  Academic Performance
                </h3>

                <p>
                  Track your CGPA, assessments, attendance
                  and overall academic progress.
                </p>

              </div>

            </div>

            {/* FEATURE 3 */}

            <div className="feature-item">

              <div className="feature-icon">
                SG
              </div>

              <div className="feature-content">

                <h3>
                  Skill Gap Analysis
                </h3>

                <p>
                  Discover missing skills and understand
                  what you need for your target career.
                </p>

              </div>

            </div>

          </div>

        </section>

        {/* =================================================
            AUTH CARD
        ================================================= */}

        <section className="auth-card">

          {/* =================================================
              AUTH HEADER
          ================================================= */}

          <div className="auth-header">

            {/* TABS */}

            <div className="tabs">

              <button
                type="button"
                className={isLogin ? "active" : ""}
                onClick={() => switchMode(true)}
              >
                Login
              </button>

              <button
                type="button"
                className={!isLogin ? "active" : ""}
                onClick={() => switchMode(false)}
              >
                Register
              </button>

            </div>

            {/* TITLE */}

            <h2>
              {isLogin
                ? "Welcome back"
                : "Create your account"}
            </h2>

            {/* SUBTITLE */}

            <p>
              {isLogin
                ? "Sign in to access your career dashboard."
                : "Create your student profile to get started."}
            </p>

          </div>

          {/* =================================================
              FORM
          ================================================= */}

          <form onSubmit={handleSubmit}>

            {/* =================================================
                REGISTER FIELDS
            ================================================= */}

            {!isLogin && (

              <div className="register-fields">

                {/* USERNAME */}

                <div className="input-group">

                  <label htmlFor="username">
                    Username
                  </label>

                  <input
                    id="username"
                    type="text"
                    name="username"
                    placeholder="Enter username"
                    value={formData.username}
                    onChange={handleChange}
                    autoComplete="username"
                    required
                  />

                </div>

                {/* FULL NAME */}

                <div className="input-group">

                  <label htmlFor="full_name">
                    Full Name
                  </label>

                  <input
                    id="full_name"
                    type="text"
                    name="full_name"
                    placeholder="Enter your full name"
                    value={formData.full_name}
                    onChange={handleChange}
                    required
                  />

                </div>

                {/* ENROLLMENT */}

                <div className="input-group">

                  <label htmlFor="enrollment_no">
                    Enrollment Number
                  </label>

                  <input
                    id="enrollment_no"
                    type="text"
                    name="enrollment_no"
                    placeholder="Enter enrollment number"
                    value={formData.enrollment_no}
                    onChange={handleChange}
                    required
                  />

                </div>

                {/* DEPARTMENT + SEMESTER */}

                <div className="input-row">

                  {/* DEPARTMENT */}

                  <div className="input-group">

                    <label htmlFor="department">
                      Department
                    </label>

                    <input
                      id="department"
                      type="text"
                      name="department"
                      placeholder="CSE"
                      value={formData.department}
                      onChange={handleChange}
                      required
                    />

                  </div>

                  {/* SEMESTER */}

                  <div className="input-group">

                    <label htmlFor="semester">
                      Semester
                    </label>

                    <input
                      id="semester"
                      type="number"
                      name="semester"
                      placeholder="5"
                      min="1"
                      max="8"
                      value={formData.semester}
                      onChange={handleChange}
                      required
                    />

                  </div>

                </div>

              </div>
            )}

            {/* =================================================
                EMAIL
            ================================================= */}

            <div className="input-group">

              <label htmlFor="email">
                Email Address
              </label>

              <input
                id="email"
                type="email"
                name="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />

            </div>

            {/* =================================================
                PASSWORD
            ================================================= */}

            <div className="input-group">

              <label htmlFor="password">
                Password
              </label>

              <input
                id="password"
                type="password"
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                autoComplete={
                  isLogin
                    ? "current-password"
                    : "new-password"
                }
                minLength="6"
                required
              />

            </div>

            {/* =================================================
                SUBMIT BUTTON
            ================================================= */}

            <button
              className={`submit-btn ${
                loading ? "loading" : ""
              }`}
              type="submit"
              disabled={loading}
            >

              {loading ? (
                <span className="button-loading">
                  <span className="spinner"></span>
                  Please wait...
                </span>
              ) : (
                isLogin
                  ? "Sign In"
                  : "Create Account"
              )}

            </button>

          </form>

          {/* =================================================
              MESSAGE
          ================================================= */}

          {message && (

            <div
              className={`message ${
                messageType === "success"
                  ? "success"
                  : "error"
              }`}
            >
              {message}
            </div>

          )}

          {/* =================================================
              FOOTER
          ================================================= */}

          <div className="auth-footer">

            <span>
              {isLogin
                ? "Don't have an account?"
                : "Already have an account?"}
            </span>

            <button
              type="button"
              onClick={() => switchMode(!isLogin)}
            >
              {isLogin
                ? "Create one"
                : "Sign in"}
            </button>

          </div>

        </section>

      </div>

      {/* =================================================
          FOOTER
      ================================================= */}

      <div className="page-footer">
        Student Career AI &nbsp;·&nbsp; Intelligent Career Guidance Platform
      </div>

    </div>
  );
}

export default App;