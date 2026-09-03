import { useEffect, useState } from "react";
import "./FacultyDashboard.css";
import { apiFetch } from "./api";


function FacultyDashboard({ onLogout }) {
  // =====================================================
  // STATE
  // =====================================================

  const [activePage, setActivePage] = useState("Overview");

  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetails, setStudentDetails] = useState(null);

  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [error, setError] = useState("");
  const [detailsError, setDetailsError] = useState("");

  const [faculty, setFaculty] = useState(null);
  const [search, setSearch] = useState("");

  // =====================================================
  // ASSESSMENT
  // =====================================================

  const [showAssessmentForm, setShowAssessmentForm] =
    useState(false);

  const [editingAssessment, setEditingAssessment] =
    useState(null);

  const [assessmentForm, setAssessmentForm] = useState({
    assessment_name: "",
    subject: "",
    score: "",
    max_score: "",
    assessment_date: ""
  });

  const [assessmentLoading, setAssessmentLoading] =
    useState(false);

  const [assessmentMessage, setAssessmentMessage] =
    useState("");

  // =====================================================
  // ACADEMIC
  // =====================================================

  const [showAcademicForm, setShowAcademicForm] =
    useState(false);

  const [editingAcademic, setEditingAcademic] =
    useState(null);

  const [academicForm, setAcademicForm] = useState({
    semester: "",
    cgpa: ""
  });

  const [academicLoading, setAcademicLoading] =
    useState(false);

  const [academicMessage, setAcademicMessage] =
    useState("");

  // =====================================================
  // ATTENDANCE
  // =====================================================

  const [showAttendanceForm, setShowAttendanceForm] =
    useState(false);

  const [editingAttendance, setEditingAttendance] =
    useState(null);

  const [attendanceForm, setAttendanceForm] = useState({
    semester: "",
    total_classes: "",
    attended_classes: ""
  });

  const [attendanceLoading, setAttendanceLoading] =
    useState(false);

  const [attendanceMessage, setAttendanceMessage] =
    useState("");

  // =====================================================
  // LOAD FACULTY
  // =====================================================

  useEffect(() => {
    const storedUser =
      JSON.parse(
        sessionStorage.getItem("student") ||
        localStorage.getItem("student") ||
        "{}"
      );

    setFaculty(storedUser);
  }, []);

  // =====================================================
  // FETCH STUDENTS
  // =====================================================

  const fetchStudents = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch(
        `/api/students`
      );

      const data = await response.json();

      if (
        response.ok &&
        data.status === "success"
      ) {
        setStudents(data.students || []);
      } else {
        setError(
          data.message ||
          "Unable to load students."
        );
      }
    } catch (error) {
      console.error(error);

      setError(
        "Unable to connect to backend."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // =====================================================
  // FETCH STUDENT DETAILS
  // =====================================================

  const fetchStudentDetails = async (
    studentId
  ) => {
    setDetailsLoading(true);
    setDetailsError("");

    try {
      const response = await apiFetch(
        `/api/faculty/student/${studentId}`
      );

      const data = await response.json();

      if (
        response.ok &&
        data.status === "success"
      ) {
        setStudentDetails(data);
      } else {
        setDetailsError(
          data.message ||
          "Unable to load student details."
        );
      }
    } catch (error) {
      console.error(error);

      setDetailsError(
        "Unable to connect to backend."
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  // =====================================================
  // SELECT STUDENT
  // =====================================================

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);

    setShowAcademicForm(false);
    setShowAttendanceForm(false);
    setShowAssessmentForm(false);

    fetchStudentDetails(
      student.student_id
    );
  };

  // =====================================================
  // ACADEMIC FORM
  // =====================================================

  const handleAcademicChange = (e) => {
    setAcademicForm({
      ...academicForm,
      [e.target.name]: e.target.value
    });
  };

  const resetAcademicForm = () => {
    setAcademicForm({
      semester: "",
      cgpa: ""
    });

    setEditingAcademic(null);
    setShowAcademicForm(false);
    setAcademicMessage("");
  };

  // =====================================================
  // ADD / UPDATE ACADEMIC
  // =====================================================

  const handleAcademicSubmit = async (e) => {
    e.preventDefault();

    if (!selectedStudent) {
      return;
    }

    const cgpa = Number(
      academicForm.cgpa
    );

    const semester = Number(
      academicForm.semester
    );

    if (
      semester < 1 ||
      semester > 8
    ) {
      setAcademicMessage(
        "Semester must be between 1 and 8."
      );
      return;
    }

    if (
      cgpa < 0 ||
      cgpa > 10
    ) {
      setAcademicMessage(
        "CGPA must be between 0 and 10."
      );
      return;
    }

    setAcademicLoading(true);
    setAcademicMessage("");

    try {
      const url = editingAcademic
        ? `/api/academics/${editingAcademic.academic_id}`
        : `/api/academics`;

      const method = editingAcademic
        ? "PUT"
        : "POST";

      const response = await apiFetch(
        url,
        {
          method,
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            student_id:
              selectedStudent.student_id,
            semester,
            cgpa
          })
        }
      );

      const data =
        await response.json();

      if (response.ok) {
        setAcademicMessage(
          editingAcademic
            ? "Academic record updated successfully."
            : "Academic record added successfully."
        );

        await fetchStudentDetails(
          selectedStudent.student_id
        );

        setAcademicForm({
          semester: "",
          cgpa: ""
        });

        setEditingAcademic(null);

        setTimeout(() => {
          setShowAcademicForm(false);
          setAcademicMessage("");
        }, 800);
      } else {
        setAcademicMessage(
          data.message ||
          "Unable to save academic record."
        );
      }
    } catch (error) {
      console.error(error);

      setAcademicMessage(
        "Unable to connect to backend."
      );
    } finally {
      setAcademicLoading(false);
    }
  };

  // =====================================================
  // EDIT ACADEMIC
  // =====================================================

  const handleEditAcademic = (
    academic
  ) => {
    setEditingAcademic(academic);

    setAcademicForm({
      semester:
        academic.semester || "",
      cgpa:
        academic.cgpa || ""
    });

    setShowAcademicForm(true);
    setAcademicMessage("");
  };

  // =====================================================
  // DELETE ACADEMIC
  // =====================================================

  const handleDeleteAcademic = async (
    academicId
  ) => {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this academic record?"
      );

    if (!confirmed) {
      return;
    }

    try {
      const response = await apiFetch(
        `/api/academics/${academicId}`,
        {
          method: "DELETE"
        }
      );

      const data =
        await response.json();

      if (response.ok) {
        await fetchStudentDetails(
          selectedStudent.student_id
        );
      } else {
        alert(
          data.message ||
          "Unable to delete academic record."
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
  // ATTENDANCE FORM
  // =====================================================

  const handleAttendanceChange = (
    e
  ) => {
    setAttendanceForm({
      ...attendanceForm,
      [e.target.name]:
        e.target.value
    });
  };

  const resetAttendanceForm = () => {
    setAttendanceForm({
      semester: "",
      total_classes: "",
      attended_classes: ""
    });

    setEditingAttendance(null);
    setShowAttendanceForm(false);
    setAttendanceMessage("");
  };

  // =====================================================
  // ADD / UPDATE ATTENDANCE
  // =====================================================

  const handleAttendanceSubmit =
    async (e) => {
      e.preventDefault();

      if (!selectedStudent) {
        return;
      }

      const semester = Number(
        attendanceForm.semester
      );

      const totalClasses = Number(
        attendanceForm.total_classes
      );

      const attendedClasses = Number(
        attendanceForm.attended_classes
      );

      if (
        semester < 1 ||
        semester > 8
      ) {
        setAttendanceMessage(
          "Semester must be between 1 and 8."
        );
        return;
      }

      if (totalClasses <= 0) {
        setAttendanceMessage(
          "Total classes must be greater than 0."
        );
        return;
      }

      if (
        attendedClasses < 0 ||
        attendedClasses >
          totalClasses
      ) {
        setAttendanceMessage(
          "Attended classes cannot be greater than total classes."
        );
        return;
      }

      setAttendanceLoading(true);
      setAttendanceMessage("");

      try {
        const url =
          editingAttendance
            ? `/api/attendance/${editingAttendance.attendance_id}`
            : `/api/attendance`;

        const method =
          editingAttendance
            ? "PUT"
            : "POST";

        const response =
          await apiFetch(
            url,
            {
              method,
              headers: {
                "Content-Type":
                  "application/json"
              },
              body: JSON.stringify({
                student_id:
                  selectedStudent.student_id,
                semester,
                total_classes:
                  totalClasses,
                attended_classes:
                  attendedClasses
              })
            }
          );

        const data =
          await response.json();

        if (response.ok) {
          setAttendanceMessage(
            editingAttendance
              ? "Attendance updated successfully."
              : "Attendance added successfully."
          );

          await fetchStudentDetails(
            selectedStudent.student_id
          );

          setAttendanceForm({
            semester: "",
            total_classes: "",
            attended_classes: ""
          });

          setEditingAttendance(null);

          setTimeout(() => {
            setShowAttendanceForm(
              false
            );
            setAttendanceMessage("");
          }, 800);
        } else {
          setAttendanceMessage(
            data.message ||
            "Unable to save attendance."
          );
        }
      } catch (error) {
        console.error(error);

        setAttendanceMessage(
          "Unable to connect to backend."
        );
      } finally {
        setAttendanceLoading(false);
      }
    };

  // =====================================================
  // EDIT ATTENDANCE
  // =====================================================

  const handleEditAttendance = (
    attendance
  ) => {
    setEditingAttendance(
      attendance
    );

    setAttendanceForm({
      semester:
        attendance.semester || "",
      total_classes:
        attendance.total_classes || "",
      attended_classes:
        attendance.attended_classes || ""
    });

    setShowAttendanceForm(true);
    setAttendanceMessage("");
  };

  // =====================================================
  // DELETE ATTENDANCE
  // =====================================================

  const handleDeleteAttendance =
    async (attendanceId) => {
      const confirmed =
        window.confirm(
          "Are you sure you want to delete this attendance record?"
        );

      if (!confirmed) {
        return;
      }

      try {
        const response =
          await apiFetch(
            `/api/attendance/${attendanceId}`,
            {
              method: "DELETE"
            }
          );

        const data =
          await response.json();

        if (response.ok) {
          await fetchStudentDetails(
            selectedStudent.student_id
          );
        } else {
          alert(
            data.message ||
            "Unable to delete attendance."
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
  // ASSESSMENT FORM
  // =====================================================

  const handleAssessmentChange = (
    e
  ) => {
    setAssessmentForm({
      ...assessmentForm,
      [e.target.name]:
        e.target.value
    });
  };

  const resetAssessmentForm = () => {
    setAssessmentForm({
      assessment_name: "",
      subject: "",
      score: "",
      max_score: "",
      assessment_date: ""
    });

    setEditingAssessment(null);
    setShowAssessmentForm(false);
    setAssessmentMessage("");
  };

  // =====================================================
  // ADD / UPDATE ASSESSMENT
  // =====================================================

  const handleAssessmentSubmit =
    async (e) => {
      e.preventDefault();

      if (!selectedStudent) {
        return;
      }

      setAssessmentLoading(true);
      setAssessmentMessage("");

      try {
        const url =
          editingAssessment
            ? `/api/assessments/${editingAssessment.assessment_id}`
            : `/api/assessments`;

        const method =
          editingAssessment
            ? "PUT"
            : "POST";

        const response =
          await apiFetch(
            url,
            {
              method,
              headers: {
                "Content-Type":
                  "application/json"
              },
              body: JSON.stringify({
                ...assessmentForm,
                student_id:
                  selectedStudent.student_id
              })
            }
          );

        const data =
          await response.json();

        if (response.ok) {
          setAssessmentMessage(
            editingAssessment
              ? "Assessment updated successfully."
              : "Assessment added successfully."
          );

          await fetchStudentDetails(
            selectedStudent.student_id
          );

          setAssessmentForm({
            assessment_name: "",
            subject: "",
            score: "",
            max_score: "",
            assessment_date: ""
          });

          setEditingAssessment(null);

          setTimeout(() => {
            setShowAssessmentForm(
              false
            );
            setAssessmentMessage("");
          }, 800);
        } else {
          setAssessmentMessage(
            data.message ||
            "Unable to save assessment."
          );
        }
      } catch (error) {
        console.error(error);

        setAssessmentMessage(
          "Unable to connect to backend."
        );
      } finally {
        setAssessmentLoading(false);
      }
    };

  // =====================================================
  // EDIT ASSESSMENT
  // =====================================================

  const handleEditAssessment = (
    assessment
  ) => {
    setEditingAssessment(
      assessment
    );

    setAssessmentForm({
      assessment_name:
        assessment.assessment_name ||
        "",
      subject:
        assessment.subject || "",
      score:
        assessment.score || "",
      max_score:
        assessment.max_score || "",
      assessment_date:
        assessment.assessment_date ||
        ""
    });

    setShowAssessmentForm(true);
    setAssessmentMessage("");
  };

  // =====================================================
  // DELETE ASSESSMENT
  // =====================================================

  const handleDeleteAssessment =
    async (assessmentId) => {
      const confirmed =
        window.confirm(
          "Are you sure you want to delete this assessment?"
        );

      if (!confirmed) {
        return;
      }

      try {
        const response =
          await apiFetch(
            `/api/assessments/${assessmentId}`,
            {
              method: "DELETE"
            }
          );

        const data =
          await response.json();

        if (response.ok) {
          await fetchStudentDetails(
            selectedStudent.student_id
          );
        } else {
          alert(
            data.message ||
            "Unable to delete assessment."
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
  // MENU
  // =====================================================

  const menuItems = [
    "Overview",
    "Students",
    "Academics",
    "Attendance",
    "Assessments"
  ];

  // =====================================================
  // FILTER STUDENTS
  // =====================================================

  const filteredStudents =
    students.filter(
      (student) => {
        const text =
          search.toLowerCase();

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
      }
    );

  // =====================================================
  // OPEN ADD ACADEMIC
  // =====================================================

  const openAcademicForm = () => {
    setEditingAcademic(null);

    setAcademicForm({
      semester: "",
      cgpa: ""
    });

    setAcademicMessage("");
    setShowAcademicForm(true);
  };

  // =====================================================
  // OPEN ADD ATTENDANCE
  // =====================================================

  const openAttendanceForm = () => {
    setEditingAttendance(null);

    setAttendanceForm({
      semester: "",
      total_classes: "",
      attended_classes: ""
    });

    setAttendanceMessage("");
    setShowAttendanceForm(true);
  };

  // =====================================================
  // OPEN ADD ASSESSMENT
  // =====================================================

  const openAssessmentForm = () => {
    setEditingAssessment(null);

    setAssessmentForm({
      assessment_name: "",
      subject: "",
      score: "",
      max_score: "",
      assessment_date: ""
    });

    setAssessmentMessage("");
    setShowAssessmentForm(true);
  };

  // =====================================================
  // STUDENT DETAILS
  // =====================================================

  const renderStudentDetails =
    () => {
      if (!selectedStudent) {
        return null;
      }

      return (
        <section
          className="dashboard-card"
          style={{
            marginTop: "20px"
          }}
        >
          <div className="card-header">
            <div>
              <h3>
                Student Details
              </h3>

              <p>
                {selectedStudent.full_name}
              </p>
            </div>

            <button
              onClick={() => {
                setSelectedStudent(
                  null
                );
                setStudentDetails(
                  null
                );
              }}
            >
              Close
            </button>
          </div>

          {detailsLoading ? (
            <div className="faculty-loading">
              Loading student details...
            </div>
          ) : detailsError ? (
            <div className="faculty-error">
              {detailsError}
            </div>
          ) : studentDetails ? (
            <div>

              {/* =========================================
                  STUDENT BASIC INFO
              ========================================= */}

              <div className="faculty-stats">

                <div className="faculty-stat-card">
                  <div>
                    <span>
                      Name
                    </span>

                    <strong>
                      {
                        studentDetails
                          .student
                          .full_name
                      }
                    </strong>
                  </div>
                </div>

                <div className="faculty-stat-card">
                  <div>
                    <span>
                      Enrollment
                    </span>

                    <strong>
                      {
                        studentDetails
                          .student
                          .enrollment_no
                      }
                    </strong>
                  </div>
                </div>

                <div className="faculty-stat-card">
                  <div>
                    <span>
                      Department
                    </span>

                    <strong>
                      {
                        studentDetails
                          .student
                          .department
                      }
                    </strong>
                  </div>
                </div>

                <div className="faculty-stat-card">
                  <div>
                    <span>
                      Semester
                    </span>

                    <strong>
                      {
                        studentDetails
                          .student
                          .semester
                      }
                    </strong>
                  </div>
                </div>

              </div>

              {/* =========================================
                  ACADEMICS
              ========================================= */}

              <div
                style={{
                  marginTop: "35px"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems: "center",
                    marginBottom: "15px"
                  }}
                >
                  <div>
                    <h3>
                      Academic Performance
                    </h3>

                    <p
                      style={{
                        color:
                          "#7e879b",
                        fontSize:
                          "13px"
                      }}
                    >
                      Semester-wise CGPA
                    </p>
                  </div>

                  <button
                    onClick={
                      openAcademicForm
                    }
                  >
                    + Add Academic
                  </button>
                </div>

                {studentDetails
                  .academics
                  ?.length === 0 ? (
                  <div className="faculty-empty">
                    No academic records.
                  </div>
                ) : (
                  <div className="student-table-wrapper">
                    <table className="student-table">
                      <thead>
                        <tr>
                          <th>
                            Semester
                          </th>

                          <th>
                            CGPA
                          </th>

                          <th>
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {studentDetails.academics.map(
                          (academic) => (
                            <tr
                              key={
                                academic.academic_id
                              }
                            >
                              <td>
                                Semester{" "}
                                {
                                  academic.semester
                                }
                              </td>

                              <td>
                                <strong>
                                  {
                                    academic.cgpa
                                  }
                                </strong>
                              </td>

                              <td>
                                <div
                                  style={{
                                    display:
                                      "flex",
                                    gap:
                                      "8px"
                                  }}
                                >
                                  <button
                                    onClick={() =>
                                      handleEditAcademic(
                                        academic
                                      )
                                    }
                                  >
                                    Edit
                                  </button>

                                  <button
                                    onClick={() =>
                                      handleDeleteAcademic(
                                        academic.academic_id
                                      )
                                    }
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ACADEMIC FORM */}

                {showAcademicForm && (
                  <div
                    style={{
                      marginTop:
                        "20px",
                      padding:
                        "20px",
                      border:
                        "1px solid rgba(255,255,255,0.08)",
                      borderRadius:
                        "12px",
                      background:
                        "#0e1320"
                    }}
                  >
                    <h3>
                      {editingAcademic
                        ? "Edit Academic Record"
                        : "Add Academic Record"}
                    </h3>

                    <form
                      onSubmit={
                        handleAcademicSubmit
                      }
                    >
                      <div
                        style={{
                          display:
                            "grid",
                          gridTemplateColumns:
                            "1fr 1fr",
                          gap:
                            "12px",
                          marginTop:
                            "15px"
                        }}
                      >
                        <input
                          type="number"
                          name="semester"
                          min="1"
                          max="8"
                          placeholder="Semester"
                          value={
                            academicForm.semester
                          }
                          onChange={
                            handleAcademicChange
                          }
                          required
                        />

                        <input
                          type="number"
                          name="cgpa"
                          min="0"
                          max="10"
                          step="0.01"
                          placeholder="CGPA"
                          value={
                            academicForm.cgpa
                          }
                          onChange={
                            handleAcademicChange
                          }
                          required
                        />
                      </div>

                      {academicMessage && (
                        <p
                          style={{
                            marginTop:
                              "10px",
                            color:
                              "#9f91ff"
                          }}
                        >
                          {
                            academicMessage
                          }
                        </p>
                      )}

                      <div
                        style={{
                          display:
                            "flex",
                          gap:
                            "10px",
                          marginTop:
                            "15px"
                        }}
                      >
                        <button
                          type="submit"
                          disabled={
                            academicLoading
                          }
                        >
                          {academicLoading
                            ? "Saving..."
                            : editingAcademic
                            ? "Update"
                            : "Add"}
                        </button>

                        <button
                          type="button"
                          onClick={
                            resetAcademicForm
                          }
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>

              {/* =========================================
                  ATTENDANCE
              ========================================= */}

              <div
                style={{
                  marginTop: "40px"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "center",
                    marginBottom:
                      "15px"
                  }}
                >
                  <div>
                    <h3>
                      Attendance
                    </h3>

                    <p
                      style={{
                        color:
                          "#7e879b",
                        fontSize:
                          "13px"
                      }}
                    >
                      Semester-wise attendance
                    </p>
                  </div>

                  <button
                    onClick={
                      openAttendanceForm
                    }
                  >
                    + Add Attendance
                  </button>
                </div>

                {studentDetails
                  .attendance
                  ?.length === 0 ? (
                  <div className="faculty-empty">
                    No attendance records.
                  </div>
                ) : (
                  <div className="student-table-wrapper">
                    <table className="student-table">
                      <thead>
                        <tr>
                          <th>
                            Semester
                          </th>

                          <th>
                            Total Classes
                          </th>

                          <th>
                            Attended
                          </th>

                          <th>
                            Percentage
                          </th>

                          <th>
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {studentDetails.attendance.map(
                          (
                            attendance
                          ) => (
                            <tr
                              key={
                                attendance.attendance_id
                              }
                            >
                              <td>
                                Semester{" "}
                                {
                                  attendance.semester
                                }
                              </td>

                              <td>
                                {
                                  attendance.total_classes
                                }
                              </td>

                              <td>
                                {
                                  attendance.attended_classes
                                }
                              </td>

                              <td>
                                <strong>
                                  {
                                    attendance.attendance_percentage
                                  }
                                  %
                                </strong>
                              </td>

                              <td>
                                <div
                                  style={{
                                    display:
                                      "flex",
                                    gap:
                                      "8px"
                                  }}
                                >
                                  <button
                                    onClick={() =>
                                      handleEditAttendance(
                                        attendance
                                      )
                                    }
                                  >
                                    Edit
                                  </button>

                                  <button
                                    onClick={() =>
                                      handleDeleteAttendance(
                                        attendance.attendance_id
                                      )
                                    }
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ATTENDANCE FORM */}

                {showAttendanceForm && (
                  <div
                    style={{
                      marginTop:
                        "20px",
                      padding:
                        "20px",
                      border:
                        "1px solid rgba(255,255,255,0.08)",
                      borderRadius:
                        "12px",
                      background:
                        "#0e1320"
                    }}
                  >
                    <h3>
                      {editingAttendance
                        ? "Edit Attendance"
                        : "Add Attendance"}
                    </h3>

                    <form
                      onSubmit={
                        handleAttendanceSubmit
                      }
                    >
                      <div
                        style={{
                          display:
                            "grid",
                          gridTemplateColumns:
                            "repeat(3, 1fr)",
                          gap:
                            "12px",
                          marginTop:
                            "15px"
                        }}
                      >
                        <input
                          type="number"
                          name="semester"
                          min="1"
                          max="8"
                          placeholder="Semester"
                          value={
                            attendanceForm.semester
                          }
                          onChange={
                            handleAttendanceChange
                          }
                          required
                        />

                        <input
                          type="number"
                          name="total_classes"
                          min="1"
                          placeholder="Total classes"
                          value={
                            attendanceForm.total_classes
                          }
                          onChange={
                            handleAttendanceChange
                          }
                          required
                        />

                        <input
                          type="number"
                          name="attended_classes"
                          min="0"
                          placeholder="Attended classes"
                          value={
                            attendanceForm.attended_classes
                          }
                          onChange={
                            handleAttendanceChange
                          }
                          required
                        />
                      </div>

                      {attendanceMessage && (
                        <p
                          style={{
                            marginTop:
                              "10px",
                            color:
                              "#9f91ff"
                          }}
                        >
                          {
                            attendanceMessage
                          }
                        </p>
                      )}

                      <div
                        style={{
                          display:
                            "flex",
                          gap:
                            "10px",
                          marginTop:
                            "15px"
                        }}
                      >
                        <button
                          type="submit"
                          disabled={
                            attendanceLoading
                          }
                        >
                          {attendanceLoading
                            ? "Saving..."
                            : editingAttendance
                            ? "Update"
                            : "Add"}
                        </button>

                        <button
                          type="button"
                          onClick={
                            resetAttendanceForm
                          }
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>

              {/* =========================================
                  SKILLS
              ========================================= */}

              <div
                style={{
                  marginTop: "40px"
                }}
              >
                <h3>
                  Skills
                </h3>

                {studentDetails.skills
                  ?.length === 0 ? (
                  <p>
                    No skills available.
                  </p>
                ) : (
                  <div className="student-table-wrapper">
                    <table className="student-table">
                      <thead>
                        <tr>
                          <th>
                            Skill
                          </th>

                          <th>
                            Level
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {studentDetails.skills.map(
                          (skill) => (
                            <tr
                              key={
                                skill.skill_id
                              }
                            >
                              <td>
                                {
                                  skill.skill_name
                                }
                              </td>

                              <td>
                                {
                                  skill.skill_level
                                }
                                %
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* =========================================
                  PROJECTS
              ========================================= */}

              <div
                style={{
                  marginTop: "40px"
                }}
              >
                <h3>
                  Projects
                </h3>

                {studentDetails.projects
                  ?.length === 0 ? (
                  <p>
                    No projects available.
                  </p>
                ) : (
                  studentDetails.projects.map(
                    (project) => (
                      <div
                        key={
                          project.project_id
                        }
                        style={{
                          padding:
                            "15px 0",
                          borderBottom:
                            "1px solid rgba(255,255,255,0.06)"
                        }}
                      >
                        <strong>
                          {
                            project.project_name
                          }
                        </strong>

                        <p
                          style={{
                            color:
                              "#858da1"
                          }}
                        >
                          {
                            project.project_type
                          }
                        </p>

                        <p>
                          {
                            project.description
                          }
                        </p>

                        <small
                          style={{
                            color:
                              "#8f7dff"
                          }}
                        >
                          {
                            project.technology_used
                          }
                        </small>
                      </div>
                    )
                  )
                )}
              </div>

              {/* =========================================
                  ASSESSMENTS
              ========================================= */}

              <div
                style={{
                  marginTop: "40px"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "center",
                    marginBottom:
                      "15px"
                  }}
                >
                  <div>
                    <h3>
                      Assessments
                    </h3>

                    <p
                      style={{
                        color:
                          "#7e879b",
                        fontSize:
                          "13px"
                      }}
                    >
                      Manage student assessments
                    </p>
                  </div>

                  <button
                    onClick={
                      openAssessmentForm
                    }
                  >
                    + Add Assessment
                  </button>
                </div>

                {studentDetails
                  .assessments
                  ?.length === 0 ? (
                  <div className="faculty-empty">
                    No assessments available.
                  </div>
                ) : (
                  studentDetails.assessments.map(
                    (
                      assessment
                    ) => (
                      <div
                        key={
                          assessment.assessment_id
                        }
                        style={{
                          padding:
                            "16px",
                          marginBottom:
                            "10px",
                          border:
                            "1px solid rgba(255,255,255,0.07)",
                          borderRadius:
                            "10px",
                          background:
                            "#0e1320"
                        }}
                      >
                        <strong>
                          {
                            assessment.assessment_name
                          }
                        </strong>

                        <p>
                          Subject:{" "}
                          {
                            assessment.subject
                          }
                        </p>

                        <p>
                          Score:{" "}
                          <strong>
                            {
                              assessment.score
                            }
                            /
                            {
                              assessment.max_score
                            }
                          </strong>
                        </p>

                        <p>
                          Date:{" "}
                          {
                            assessment.assessment_date
                          }
                        </p>

                        <div
                          style={{
                            display:
                              "flex",
                            gap:
                              "10px"
                          }}
                        >
                          <button
                            onClick={() =>
                              handleEditAssessment(
                                assessment
                              )
                            }
                          >
                            Edit
                          </button>

                          <button
                            onClick={() =>
                              handleDeleteAssessment(
                                assessment.assessment_id
                              )
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )
                  )
                )}

                {/* ASSESSMENT FORM */}

                {showAssessmentForm && (
                  <div
                    style={{
                      marginTop:
                        "20px",
                      padding:
                        "20px",
                      border:
                        "1px solid rgba(255,255,255,0.08)",
                      borderRadius:
                        "12px",
                      background:
                        "#0e1320"
                    }}
                  >
                    <h3>
                      {editingAssessment
                        ? "Edit Assessment"
                        : "Add Assessment"}
                    </h3>

                    <form
                      onSubmit={
                        handleAssessmentSubmit
                      }
                    >
                      <div
                        style={{
                          display:
                            "grid",
                          gap:
                            "12px",
                          marginTop:
                            "15px"
                        }}
                      >
                        <input
                          type="text"
                          name="assessment_name"
                          placeholder="Assessment name"
                          value={
                            assessmentForm.assessment_name
                          }
                          onChange={
                            handleAssessmentChange
                          }
                          required
                        />

                        <input
                          type="text"
                          name="subject"
                          placeholder="Subject"
                          value={
                            assessmentForm.subject
                          }
                          onChange={
                            handleAssessmentChange
                          }
                        />

                        <input
                          type="number"
                          name="score"
                          min="0"
                          placeholder="Score"
                          value={
                            assessmentForm.score
                          }
                          onChange={
                            handleAssessmentChange
                          }
                          required
                        />

                        <input
                          type="number"
                          name="max_score"
                          min="1"
                          placeholder="Maximum score"
                          value={
                            assessmentForm.max_score
                          }
                          onChange={
                            handleAssessmentChange
                          }
                          required
                        />

                        <input
                          type="date"
                          name="assessment_date"
                          value={
                            assessmentForm.assessment_date
                          }
                          onChange={
                            handleAssessmentChange
                          }
                        />
                      </div>

                      {assessmentMessage && (
                        <p
                          style={{
                            marginTop:
                              "10px",
                            color:
                              "#9f91ff"
                          }}
                        >
                          {
                            assessmentMessage
                          }
                        </p>
                      )}

                      <div
                        style={{
                          display:
                            "flex",
                          gap:
                            "10px",
                          marginTop:
                            "15px"
                        }}
                      >
                        <button
                          type="submit"
                          disabled={
                            assessmentLoading
                          }
                        >
                          {assessmentLoading
                            ? "Saving..."
                            : editingAssessment
                            ? "Update"
                            : "Add"}
                        </button>

                        <button
                          type="button"
                          onClick={
                            resetAssessmentForm
                          }
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>

            </div>
          ) : null}
        </section>
      );
    };

  // =====================================================
  // CONTENT
  // =====================================================

  const renderContent = () => {

    // ===================================================
    // OVERVIEW
    // ===================================================

    if (activePage === "Overview") {
      return (
        <div>

          <div className="faculty-welcome">
            <p className="faculty-eyebrow">
              FACULTY PORTAL
            </p>

            <h1>
              Welcome back,{" "}
              <span>
                {faculty?.full_name ||
                  faculty?.username ||
                  "Faculty"}
              </span>
            </h1>

            <p>
              Manage student academic
              performance, attendance and
              assessments from one place.
            </p>
          </div>

          <div className="faculty-stats">

            <div className="faculty-stat-card">
              <div className="stat-icon">
                ST
              </div>

              <div>
                <span>
                  Students
                </span>

                <strong>
                  {students.length}
                </strong>
              </div>
            </div>

            <div className="faculty-stat-card">
              <div className="stat-icon">
                AC
              </div>

              <div>
                <span>
                  Academics
                </span>

                <strong>
                  Manage
                </strong>
              </div>
            </div>

            <div className="faculty-stat-card">
              <div className="stat-icon">
                AT
              </div>

              <div>
                <span>
                  Attendance
                </span>

                <strong>
                  Manage
                </strong>
              </div>
            </div>

            <div className="faculty-stat-card">
              <div className="stat-icon">
                AS
              </div>

              <div>
                <span>
                  Assessments
                </span>

                <strong>
                  Manage
                </strong>
              </div>
            </div>

          </div>

          <div className="faculty-info-card">

            <h2>
              Faculty Control Center
            </h2>

            <p>
              Select a section from the
              sidebar to manage student
              information.
            </p>

            <div className="access-list">
              <div>
                <span>
                  ST
                </span>
                Student Profiles
              </div>

              <div>
                <span>
                  AC
                </span>
                Academic Records
              </div>

              <div>
                <span>
                  AT
                </span>
                Attendance
              </div>

              <div>
                <span>
                  AS
                </span>
                Assessments
              </div>
            </div>

          </div>

        </div>
      );
    }

    // ===================================================
    // STUDENTS
    // ===================================================

    if (activePage === "Students") {
      return (
        <div>

          <div className="page-heading">
            <p>
              STUDENT MANAGEMENT
            </p>

            <h1>
              Students
            </h1>

            <span>
              View and manage student
              profiles.
            </span>
          </div>

          <div
            style={{
              marginBottom:
                "18px"
            }}
          >
            <input
              type="text"
              placeholder="Search by name, enrollment, email or department..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              style={{
                width: "100%",
                padding:
                  "13px 16px",
                borderRadius:
                  "10px",
                border:
                  "1px solid rgba(255,255,255,0.08)",
                background:
                  "#0e1320",
                color:
                  "#ffffff",
                outline:
                  "none",
                fontSize:
                  "13px"
              }}
            />
          </div>

          {loading ? (
            <div className="faculty-loading">
              Loading students...
            </div>
          ) : error ? (
            <div className="faculty-error">
              {error}
            </div>
          ) : filteredStudents.length ===
            0 ? (
            <div className="faculty-empty">
              No students found.
            </div>
          ) : (
            <div className="student-table-wrapper">
              <table className="student-table">
                <thead>
                  <tr>
                    <th>
                      Student
                    </th>

                    <th>
                      Enrollment
                    </th>

                    <th>
                      Department
                    </th>

                    <th>
                      Semester
                    </th>

                    <th>
                      Email
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.map(
                    (student) => (
                      <tr
                        key={
                          student.student_id
                        }
                        onClick={() =>
                          handleStudentSelect(
                            student
                          )
                        }
                        style={{
                          cursor:
                            "pointer"
                        }}
                      >
                        <td>
                          <strong>
                            {
                              student.full_name
                            }
                          </strong>
                        </td>

                        <td>
                          {
                            student.enrollment_no
                          }
                        </td>

                        <td>
                          {
                            student.department
                          }
                        </td>

                        <td>
                          {
                            student.semester
                          }
                        </td>

                        <td>
                          {
                            student.email
                          }
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          {renderStudentDetails()}

        </div>
      );
    }

    // ===================================================
    // ACADEMICS
    // ===================================================

    if (activePage === "Academics") {
      return (
        <div>

          <div className="page-heading">
            <p>
              ACADEMIC MANAGEMENT
            </p>

            <h1>
              Academic Performance
            </h1>

            <span>
              Select a student to manage
              semester-wise CGPA.
            </span>
          </div>

          <div className="coming-card">
            <div className="coming-icon">
              AC
            </div>

            <h2>
              Manage Academic Records
            </h2>

            <p>
              Select a student from the
              Students section to add,
              edit or delete academic
              records.
            </p>

            <button
              onClick={() =>
                setActivePage(
                  "Students"
                )
              }
              style={{
                marginTop:
                  "20px"
              }}
            >
              Select Student
            </button>
          </div>

        </div>
      );
    }

    // ===================================================
    // ATTENDANCE
    // ===================================================

    if (activePage === "Attendance") {
      return (
        <div>

          <div className="page-heading">
            <p>
              ATTENDANCE MANAGEMENT
            </p>

            <h1>
              Attendance
            </h1>

            <span>
              Manage student attendance
              records.
            </span>
          </div>

          <div className="coming-card">
            <div className="coming-icon">
              AT
            </div>

            <h2>
              Manage Attendance
            </h2>

            <p>
              Select a student from the
              Students section to add,
              edit or delete attendance
              records.
            </p>

            <button
              onClick={() =>
                setActivePage(
                  "Students"
                )
              }
              style={{
                marginTop:
                  "20px"
              }}
            >
              Select Student
            </button>
          </div>

        </div>
      );
    }

    // ===================================================
    // ASSESSMENTS
    // ===================================================

    if (activePage === "Assessments") {
      return (
        <div>

          <div className="page-heading">
            <p>
              ASSESSMENT MANAGEMENT
            </p>

            <h1>
              Assessments
            </h1>

            <span>
              Add, edit and delete
              student assessments.
            </span>
          </div>

          <div className="coming-card">
            <div className="coming-icon">
              AS
            </div>

            <h2>
              Manage Assessments
            </h2>

            <p>
              Select a student from the
              Students section to manage
              their assessments.
            </p>

            <button
              onClick={() =>
                setActivePage(
                  "Students"
                )
              }
              style={{
                marginTop:
                  "20px"
              }}
            >
              Select Student
            </button>
          </div>

        </div>
      );
    }

    return null;
  };

  // =====================================================
  // MAIN UI
  // =====================================================

  return (
    <div className="faculty-dashboard">

      {/* SIDEBAR */}

      <aside className="faculty-sidebar">

        <div className="faculty-brand">

          <div className="faculty-logo">
            SC
          </div>

          <div>
            <strong>
              STUDENT CAREER AI
            </strong>

            <span>
              Faculty Portal
            </span>
          </div>

        </div>

        <div className="faculty-role">
          FACULTY ACCESS
        </div>

        <nav className="faculty-nav">

          {menuItems.map(
            (item) => (
              <button
                key={item}
                className={
                  activePage ===
                  item
                    ? "faculty-nav-item active"
                    : "faculty-nav-item"
                }
                onClick={() =>
                  setActivePage(
                    item
                  )
                }
              >
                <span className="nav-icon">
                  {item ===
                  "Overview"
                    ? "OV"
                    : item ===
                      "Students"
                    ? "ST"
                    : item ===
                      "Academics"
                    ? "AC"
                    : item ===
                      "Attendance"
                    ? "AT"
                    : "AS"}
                </span>

                {item}
              </button>
            )
          )}

        </nav>

        <div className="faculty-sidebar-bottom">

          <div className="faculty-user">

            <div className="faculty-avatar">
              {(faculty?.full_name ||
                faculty?.username ||
                "F")
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>
              <strong>
                {faculty?.full_name ||
                  faculty?.username ||
                  "Faculty"}
              </strong>

              <span>
                Faculty
              </span>
            </div>

          </div>

          <button
            className="faculty-logout"
            onClick={onLogout}
          >
            Logout
          </button>

        </div>

      </aside>

      {/* MAIN */}

      <main className="faculty-main">

        <header className="faculty-topbar">

          <div>
            <span>
              {activePage.toUpperCase()}
            </span>

            <h2>
              Faculty Dashboard
            </h2>
          </div>

          <div className="faculty-top-user">

            <div className="faculty-top-avatar">
              {(faculty?.full_name ||
                faculty?.username ||
                "F")
                .charAt(0)
                .toUpperCase()}
            </div>

          </div>

        </header>

        <div className="faculty-content">
          {renderContent()}
        </div>

      </main>

    </div>
  );
}

export default FacultyDashboard;