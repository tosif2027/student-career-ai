from flask import Flask, request, jsonify, g
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from functools import wraps
import os
import secrets
from dotenv import load_dotenv

load_dotenv()


# ============================================================
# FLASK APP CONFIGURATION
# ============================================================

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("APP_SECRET_KEY") or secrets.token_urlsafe(32)
TOKEN_MAX_AGE = int(os.getenv("TOKEN_MAX_AGE", str(60 * 60 * 8)))
token_serializer = URLSafeTimedSerializer(app.config["SECRET_KEY"], salt="student-career-ai-auth")
CORS(app, resources={r"/api/*": {"origins": os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")}})


# ============================================================
# DATABASE CONFIGURATION
# ============================================================

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", "@Memna09"),
    "database": os.getenv("DB_NAME", "student_career_ai"),
}


def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def error_response(message, status_code=500):
    return jsonify({
        "status": "error",
        "message": message
    }), status_code


def create_access_token(user_id, role):
    return token_serializer.dumps({"user_id": int(user_id), "role": str(role).lower()})


def auth_required(roles=None):
    allowed = {str(r).lower() for r in (roles or [])}

    def decorator(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            header = request.headers.get("Authorization", "")
            if not header.startswith("Bearer "):
                return error_response("Authentication required.", 401)

            token = header[7:].strip()
            if not token:
                return error_response("Authentication required.", 401)

            try:
                payload = token_serializer.loads(token, max_age=TOKEN_MAX_AGE)
            except SignatureExpired:
                return error_response("Session expired. Please login again.", 401)
            except BadSignature:
                return error_response("Invalid authentication token.", 401)

            role = str(payload.get("role", "")).lower()
            user_id = payload.get("user_id")
            if role not in {"admin", "faculty", "student"} or not isinstance(user_id, int):
                return error_response("Invalid authentication token.", 401)

            # Never trust a stale role embedded in the token after an admin changes it.
            connection = None
            cursor = None
            try:
                connection = get_db_connection()
                cursor = connection.cursor(dictionary=True)
                cursor.execute("SELECT role FROM users WHERE user_id = %s", (user_id,))
                current = cursor.fetchone()
            except Error:
                return error_response("Unable to verify session.", 500)
            finally:
                if cursor:
                    cursor.close()
                if connection and connection.is_connected():
                    connection.close()

            if not current or str(current["role"]).lower() != role:
                return error_response("Session is no longer valid. Please login again.", 401)
            if allowed and role not in allowed:
                return error_response("You do not have permission to perform this action.", 403)

            g.auth_user_id = user_id
            g.auth_role = role
            if role == "student":
                g.auth_student_id = load_authenticated_student_id()
                if not g.auth_student_id:
                    return error_response("Student profile is missing.", 403)
            else:
                g.auth_student_id = None
            return fn(*args, **kwargs)
        return wrapped
    return decorator


def student_access_allowed(student_id, write=False, staff_write=False):
    if g.auth_role == "admin":
        return True
    if g.auth_role == "faculty":
        return (not write) or staff_write
    if g.auth_role == "student":
        if write:
            return False
        return int(student_id) == int(g.auth_student_id)
    return False


def load_authenticated_student_id():
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT student_id FROM students WHERE user_id = %s", (g.auth_user_id,))
        row = cursor.fetchone()
        return row["student_id"] if row else None
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


def require_record_owner(table, id_column, record_id):
    if g.auth_role in {"admin", "faculty"}:
        return None
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        # table/id_column are internal constants only; never user supplied.
        cursor.execute(f"SELECT student_id FROM {table} WHERE {id_column} = %s", (record_id,))
        row = cursor.fetchone()
        if not row:
            return error_response("Record not found.", 404)
        if int(row["student_id"]) != int(g.auth_student_id):
            return error_response("You do not have permission to modify this record.", 403)
        return None
    except Error:
        return error_response("Unable to verify record ownership.", 500)
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


def require_student_access(student_id, write=False, staff_write=False):
    try:
        sid = int(student_id)
    except (TypeError, ValueError):
        return error_response("Invalid student ID.", 400)
    if g.auth_role == "student":
        if write or sid != int(g.auth_student_id):
            return error_response("You do not have permission to access this student.", 403)
    elif g.auth_role == "faculty":
        if write and not staff_write:
            return error_response("Faculty cannot modify this resource.", 403)
    elif g.auth_role != "admin":
        return error_response("You do not have permission to access this resource.", 403)
    return None


def success_response(data=None, message=None, status_code=200):
    response = {
        "status": "success"
    }

    if message:
        response["message"] = message

    if data:
        response.update(data)

    return jsonify(response), status_code


# ============================================================
# HOME
# ============================================================

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "success",
        "message": "Student Career AI Backend is Running!",
        "version": "1.0"
    })


# ============================================================
# CURRENT USER
# ============================================================

@app.route("/api/me", methods=["GET"])
@auth_required(["admin", "faculty", "student"])
def current_user():
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT u.user_id, u.username, u.email, u.role,
                   s.student_id, s.full_name, s.enrollment_no,
                   s.department, s.semester
            FROM users u
            LEFT JOIN students s ON s.user_id = u.user_id
            WHERE u.user_id = %s
        """, (g.auth_user_id,))
        user = cursor.fetchone()
        if not user:
            return error_response("User not found.", 404)
        user.pop("password_hash", None)
        return success_response({"user": user})
    except Error as e:
        return error_response("Unable to load current user.")
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# ============================================================
# TEST DATABASE
# ============================================================

@app.route("/test-db", methods=["GET"])
@auth_required(["admin"])
def test_db():

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("SELECT DATABASE()")
        database = cursor.fetchone()[0]

        return success_response({
            "database": database
        }, "Database connection successful.")

    except Error as e:
        return error_response("A database error occurred. Please try again later.")

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# REGISTER STUDENT
# ============================================================

@app.route("/api/students", methods=["POST"])
def add_student():

    connection = None
    cursor = None

    try:
        data = request.get_json(silent=True)

        if not data:
            return error_response(
                "Request body is required.",
                400
            )

        username = data.get("username")
        email = data.get("email")
        password = data.get("password")

        full_name = data.get("full_name")
        enrollment_no = data.get("enrollment_no")
        department = data.get("department")
        semester = data.get("semester")

        # Required fields
        if not all([
            username,
            email,
            password,
            full_name,
            enrollment_no,
            department,
            semester
        ]):
            return error_response(
                "All student fields are required.",
                400
            )

        if len(str(password)) < 8:
            return error_response("Password must be at least 8 characters.", 400)

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # Check duplicate username/email
        cursor.execute("""
            SELECT user_id
            FROM users
            WHERE username = %s OR email = %s
        """, (username, email))

        existing_user = cursor.fetchone()

        if existing_user:
            return error_response(
                "Username or email already exists.",
                409
            )

        # Check duplicate enrollment number
        cursor.execute("""
            SELECT student_id
            FROM students
            WHERE enrollment_no = %s
        """, (enrollment_no,))

        existing_student = cursor.fetchone()

        if existing_student:
            return error_response(
                "Enrollment number already exists.",
                409
            )

        # Hash password
        password_hash = generate_password_hash(password)

        # Create user
        cursor.execute("""
            INSERT INTO users
            (
                username,
                email,
                password_hash,
                role
            )
            VALUES (%s, %s, %s, %s)
        """, (
            username,
            email,
            password_hash,
            "student"
        ))

        user_id = cursor.lastrowid

        # Create student profile
        cursor.execute("""
            INSERT INTO students
            (
                user_id,
                full_name,
                enrollment_no,
                department,
                semester
            )
            VALUES (%s, %s, %s, %s, %s)
        """, (
            user_id,
            full_name,
            enrollment_no,
            department,
            semester
        ))

        student_id = cursor.lastrowid

        connection.commit()

        return success_response({
            "user_id": user_id,
            "student_id": student_id
        }, "Student registered successfully.", 201)

    except Error as e:

        if connection:
            connection.rollback()

        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# LOGIN
# ============================================================

@app.route("/api/login", methods=["POST"])
def login():

    connection = None
    cursor = None

    try:
        data = request.get_json(silent=True)

        if not data:
            return error_response(
                "Request body is required.",
                400
            )

        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return error_response(
                "Email and password are required.",
                400
            )

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT
                u.user_id,
                u.username,
                u.email,
                u.password_hash,
                u.role,

                s.student_id,
                s.full_name,
                s.enrollment_no,
                s.department,
                s.semester

            FROM users u

            LEFT JOIN students s
                ON u.user_id = s.user_id

            WHERE u.email = %s
        """

        cursor.execute(query, (email,))
        user = cursor.fetchone()

        if not user:
            return error_response(
                "Invalid email or password.",
                401
            )

        if not check_password_hash(
            user["password_hash"],
            password
        ):
            return error_response(
                "Invalid email or password.",
                401
            )

        token = create_access_token(user["user_id"], user["role"])
        if user["role"] == "student" and not user["student_id"]:
            return error_response("Student profile is missing.", 500)

        return success_response({
            "token": token,
            "expires_in": TOKEN_MAX_AGE,
            "user": {
                "user_id": user["user_id"],
                "student_id": user["student_id"],
                "username": user["username"],
                "email": user["email"],
                "full_name": user["full_name"],
                "enrollment_no": user["enrollment_no"],
                "department": user["department"],
                "semester": user["semester"],
                "role": user["role"]
            }
        }, "Login successful.")

    except Error as e:
        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# GET ALL STUDENTS
# ============================================================

@app.route("/api/students", methods=["GET"])
@auth_required(["admin", "faculty"])
def get_students():

    connection = None
    cursor = None

    try:

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                s.student_id,
                s.user_id,
                s.full_name,
                s.enrollment_no,
                s.department,
                s.semester,
                u.username,
                u.email

            FROM students s

            JOIN users u
                ON s.user_id = u.user_id

            ORDER BY s.student_id DESC
        """)

        students = cursor.fetchall()

        return success_response({
            "students": students
        })

    except Error as e:
        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# GET ACADEMICS
# ============================================================

@app.route("/api/academics/<int:student_id>", methods=["GET"])
@auth_required(["admin", "faculty", "student"])
def get_academics(student_id):
    denied = require_student_access(student_id, write=False)
    if denied:
        return denied


    connection = None
    cursor = None

    try:

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                academic_id,
                student_id,
                semester,
                cgpa

            FROM academic_performance

            WHERE student_id = %s

            ORDER BY semester ASC
        """, (student_id,))

        academics = cursor.fetchall()

        return success_response({
            "student_id": student_id,
            "academics": academics
        })

    except Error as e:
        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# ADD ACADEMIC RECORD
# ============================================================

@app.route("/api/academics", methods=["POST"])
@auth_required(["admin", "faculty"])
def add_academic():
    if g.auth_role not in {"admin", "faculty"}:
        return error_response("Only admin or faculty can modify this resource.", 403)


    connection = None
    cursor = None

    try:

        data = request.get_json(silent=True)

        if not data:
            return error_response(
                "Request body is required.",
                400
            )

        student_id = data.get("student_id")
        semester = data.get("semester")
        cgpa = data.get("cgpa")

        if student_id is None or semester is None or cgpa is None:
            return error_response(
                "Student ID, semester and CGPA are required.",
                400
            )

        try:
            cgpa = float(cgpa)

        except ValueError:
            return error_response(
                "CGPA must be a number.",
                400
            )

        if cgpa < 0 or cgpa > 10:
            return error_response(
                "CGPA must be between 0 and 10.",
                400
            )

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            INSERT INTO academic_performance
            (
                student_id,
                semester,
                cgpa
            )
            VALUES (%s, %s, %s)
        """, (
            student_id,
            semester,
            cgpa
        ))

        academic_id = cursor.lastrowid

        connection.commit()

        return success_response({
            "academic_id": academic_id
        }, "Academic record added successfully.", 201)

    except Error as e:

        if connection:
            connection.rollback()

        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# UPDATE ACADEMIC RECORD
# ============================================================

@app.route("/api/academics/<int:academic_id>", methods=["PUT"])
@auth_required(["admin", "faculty"])
def update_academic(academic_id):

    connection = None
    cursor = None

    try:

        data = request.get_json(silent=True)

        if not data:
            return error_response(
                "Request body is required.",
                400
            )

        semester = data.get("semester")
        cgpa = data.get("cgpa")

        if semester is None or cgpa is None:
            return error_response(
                "Semester and CGPA are required.",
                400
            )

        try:
            cgpa = float(cgpa)

        except ValueError:
            return error_response(
                "CGPA must be a number.",
                400
            )

        if cgpa < 0 or cgpa > 10:
            return error_response(
                "CGPA must be between 0 and 10.",
                400
            )

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            UPDATE academic_performance

            SET
                semester = %s,
                cgpa = %s

            WHERE academic_id = %s
        """, (
            semester,
            cgpa,
            academic_id
        ))

        if cursor.rowcount == 0:
            return error_response(
                "Academic record not found.",
                404
            )

        connection.commit()

        return success_response(
            message="Academic record updated successfully."
        )

    except Error as e:

        if connection:
            connection.rollback()

        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# DELETE ACADEMIC RECORD
# ============================================================

@app.route("/api/academics/<int:academic_id>", methods=["DELETE"])
@auth_required(["admin", "faculty"])
def delete_academic(academic_id):

    connection = None
    cursor = None

    try:

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            DELETE FROM academic_performance
            WHERE academic_id = %s
        """, (academic_id,))

        if cursor.rowcount == 0:
            return error_response(
                "Academic record not found.",
                404
            )

        connection.commit()

        return success_response(
            message="Academic record deleted successfully."
        )

    except Error as e:

        if connection:
            connection.rollback()

        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# GET ATTENDANCE
# ============================================================

@app.route("/api/attendance/<int:student_id>", methods=["GET"])
@auth_required(["admin", "faculty", "student"])
def get_attendance(student_id):
    denied = require_student_access(student_id, write=False)
    if denied:
        return denied


    connection = None
    cursor = None

    try:

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                attendance_id,
                student_id,
                semester,
                total_classes,
                attended_classes,
                attendance_percentage

            FROM attendance

            WHERE student_id = %s

            ORDER BY semester ASC
        """, (student_id,))

        attendance = cursor.fetchall()

        return success_response({
            "student_id": student_id,
            "attendance": attendance
        })

    except Error as e:
        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# ADD ATTENDANCE
# ============================================================

@app.route("/api/attendance", methods=["POST"])
@auth_required(["admin", "faculty"])
def add_attendance():
    if g.auth_role not in {"admin", "faculty"}:
        return error_response("Only admin or faculty can modify this resource.", 403)


    connection = None
    cursor = None

    try:

        data = request.get_json(silent=True)

        if not data:
            return error_response(
                "Request body is required.",
                400
            )

        student_id = data.get("student_id")
        semester = data.get("semester")
        total_classes = data.get("total_classes")
        attended_classes = data.get("attended_classes")

        if (
            student_id is None
            or semester is None
            or total_classes is None
            or attended_classes is None
        ):
            return error_response(
                "Student ID, semester, total classes and attended classes are required.",
                400
            )

        try:

            total_classes = int(total_classes)
            attended_classes = int(attended_classes)

        except ValueError:

            return error_response(
                "Class values must be integers.",
                400
            )

        if total_classes <= 0:
            return error_response(
                "Total classes must be greater than 0.",
                400
            )

        if attended_classes < 0:
            return error_response(
                "Attended classes cannot be negative.",
                400
            )

        if attended_classes > total_classes:
            return error_response(
                "Attended classes cannot exceed total classes.",
                400
            )

        percentage = (
            attended_classes / total_classes
        ) * 100

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            INSERT INTO attendance
            (
                student_id,
                semester,
                total_classes,
                attended_classes,
                attendance_percentage
            )
            VALUES (%s, %s, %s, %s, %s)
        """, (
            student_id,
            semester,
            total_classes,
            attended_classes,
            round(percentage, 2)
        ))

        attendance_id = cursor.lastrowid

        connection.commit()

        return success_response({
            "attendance_id": attendance_id,
            "attendance_percentage": round(percentage, 2)
        }, "Attendance added successfully.", 201)

    except Error as e:

        if connection:
            connection.rollback()

        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# UPDATE ATTENDANCE
# ============================================================

@app.route("/api/attendance/<int:attendance_id>", methods=["PUT"])
@auth_required(["admin", "faculty"])
def update_attendance(attendance_id):

    connection = None
    cursor = None

    try:

        data = request.get_json(silent=True)

        if not data:
            return error_response(
                "Request body is required.",
                400
            )

        semester = data.get("semester")
        total_classes = data.get("total_classes")
        attended_classes = data.get("attended_classes")

        if (
            semester is None
            or total_classes is None
            or attended_classes is None
        ):
            return error_response(
                "Semester, total classes and attended classes are required.",
                400
            )

        try:

            total_classes = int(total_classes)
            attended_classes = int(attended_classes)

        except ValueError:

            return error_response(
                "Class values must be integers.",
                400
            )

        if total_classes <= 0:
            return error_response(
                "Total classes must be greater than 0.",
                400
            )

        if attended_classes < 0 or attended_classes > total_classes:
            return error_response(
                "Attended classes must be between 0 and total classes.",
                400
            )

        percentage = (
            attended_classes / total_classes
        ) * 100

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            UPDATE attendance

            SET
                semester = %s,
                total_classes = %s,
                attended_classes = %s,
                attendance_percentage = %s

            WHERE attendance_id = %s
        """, (
            semester,
            total_classes,
            attended_classes,
            round(percentage, 2),
            attendance_id
        ))

        if cursor.rowcount == 0:
            return error_response(
                "Attendance record not found.",
                404
            )

        connection.commit()

        return success_response({
            "attendance_percentage": round(percentage, 2)
        }, "Attendance updated successfully.")

    except Error as e:

        if connection:
            connection.rollback()

        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# DELETE ATTENDANCE
# ============================================================

@app.route("/api/attendance/<int:attendance_id>", methods=["DELETE"])
@auth_required(["admin", "faculty"])
def delete_attendance(attendance_id):

    connection = None
    cursor = None

    try:

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            DELETE FROM attendance
            WHERE attendance_id = %s
        """, (attendance_id,))

        if cursor.rowcount == 0:
            return error_response(
                "Attendance record not found.",
                404
            )

        connection.commit()

        return success_response(
            message="Attendance deleted successfully."
        )

    except Error as e:

        if connection:
            connection.rollback()

        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# GET SKILLS
# ============================================================

@app.route("/api/skills/<int:student_id>", methods=["GET"])
@auth_required(["admin", "faculty", "student"])
def get_skills(student_id):
    denied = require_student_access(student_id, write=False)
    if denied:
        return denied


    connection = None
    cursor = None

    try:

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                skill_id,
                student_id,
                skill_name,
                skill_level

            FROM skills

            WHERE student_id = %s

            ORDER BY skill_level DESC
        """, (student_id,))

        skills = cursor.fetchall()

        return success_response({
            "student_id": student_id,
            "skills": skills
        })

    except Error as e:
        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# GET PROJECTS
# ============================================================

@app.route("/api/projects/<int:student_id>", methods=["GET"])
@auth_required(["admin", "faculty", "student"])
def get_projects(student_id):
    denied = require_student_access(student_id, write=False)
    if denied:
        return denied


    connection = None
    cursor = None

    try:

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                project_id,
                student_id,
                project_name,
                description,
                technology_used,
                project_type

            FROM projects

            WHERE student_id = %s

            ORDER BY project_id DESC
        """, (student_id,))

        projects = cursor.fetchall()

        return success_response({
            "student_id": student_id,
            "projects": projects
        })

    except Error as e:
        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()

# ============================================================
# PROJECTS APIs
# ============================================================

# ============================================================
# PROJECTS APIs
# ============================================================

# ------------------------------------------------------------
# ADD PROJECT
# ------------------------------------------------------------

@app.route("/api/projects", methods=["POST"])
@auth_required(["admin", "faculty", "student"])
def add_project():

    connection = None
    cursor = None

    try:

        data = request.get_json(silent=True)

        if not data:
            return error_response(
                "Request body is required.",
                400
            )

        student_id = data.get("student_id")
        if g.auth_role == "student" and int(student_id or 0) != int(g.auth_student_id):
            return error_response("You can only add projects to your own profile.", 403)
        project_name = data.get("project_name")
        description = data.get("description")
        technology_used = data.get("technology_used")
        project_type = data.get("project_type")

        if student_id is None or not project_name:
            return error_response(
                "Student ID and project name are required.",
                400
            )

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # Check student exists
        cursor.execute("""
            SELECT student_id
            FROM students
            WHERE student_id = %s
        """, (student_id,))

        student = cursor.fetchone()

        if not student:
            return error_response(
                "Student not found.",
                404
            )

        # Insert project
        cursor.execute("""
            INSERT INTO projects
            (
                student_id,
                project_name,
                description,
                technology_used,
                project_type
            )
            VALUES (%s, %s, %s, %s, %s)
        """, (
            student_id,
            project_name.strip(),
            description,
            technology_used,
            project_type
        ))

        project_id = cursor.lastrowid

        connection.commit()

        return success_response({
            "project_id": project_id,
            "student_id": student_id,
            "project_name": project_name.strip(),
            "description": description,
            "technology_used": technology_used,
            "project_type": project_type
        }, "Project added successfully.", 201)

    except Error as e:

        if connection:
            connection.rollback()

        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ------------------------------------------------------------
# UPDATE PROJECT
# ------------------------------------------------------------

@app.route("/api/projects/<int:project_id>", methods=["PUT"])
@auth_required(["admin", "faculty", "student"])
def update_project(project_id):
    denied = require_record_owner("projects", "project_id", project_id)
    if denied:
        return denied


    connection = None
    cursor = None

    try:

        data = request.get_json(silent=True)

        if not data:
            return error_response(
                "Request body is required.",
                400
            )

        project_name = data.get("project_name")
        description = data.get("description")
        technology_used = data.get("technology_used")
        project_type = data.get("project_type")

        if not project_name:
            return error_response(
                "Project name is required.",
                400
            )

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            UPDATE projects
            SET
                project_name = %s,
                description = %s,
                technology_used = %s,
                project_type = %s
            WHERE project_id = %s
        """, (
            project_name.strip(),
            description,
            technology_used,
            project_type,
            project_id
        ))

        if cursor.rowcount == 0:
            return error_response(
                "Project not found.",
                404
            )

        connection.commit()

        return success_response({
            "project_id": project_id
        }, "Project updated successfully.")

    except Error as e:

        if connection:
            connection.rollback()

        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ------------------------------------------------------------
# DELETE PROJECT
# ------------------------------------------------------------

@app.route("/api/projects/<int:project_id>", methods=["DELETE"])
@auth_required(["admin", "faculty", "student"])
def delete_project(project_id):
    denied = require_record_owner("projects", "project_id", project_id)
    if denied:
        return denied


    connection = None
    cursor = None

    try:

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            DELETE FROM projects
            WHERE project_id = %s
        """, (project_id,))

        if cursor.rowcount == 0:
            return error_response(
                "Project not found.",
                404
            )

        connection.commit()

        return success_response({
            "project_id": project_id
        }, "Project deleted successfully.")

    except Error as e:

        if connection:
            connection.rollback()

        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()

# ============================================================
# GET ASSESSMENTS
# ============================================================

@app.route("/api/assessments/<int:student_id>", methods=["GET"])
@auth_required(["admin", "faculty", "student"])
def get_assessments(student_id):
    denied = require_student_access(student_id, write=False)
    if denied:
        return denied


    connection = None
    cursor = None

    try:

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                assessment_id,
                student_id,
                assessment_name,
                subject,
                score,
                max_score,
                assessment_date

            FROM assessments

            WHERE student_id = %s

            ORDER BY
                assessment_date DESC,
                assessment_id DESC
        """, (student_id,))

        assessments = cursor.fetchall()

        return success_response({
            "student_id": student_id,
            "assessments": assessments
        })

    except Error as e:
        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# ADD ASSESSMENT
# ============================================================

@app.route("/api/assessments", methods=["POST"])
@auth_required(["admin", "faculty"])
def add_assessment():
    if g.auth_role not in {"admin", "faculty"}:
        return error_response("Only admin or faculty can modify this resource.", 403)


    connection = None
    cursor = None

    try:

        data = request.get_json(silent=True)

        if not data:
            return error_response(
                "Request body is required.",
                400
            )

        student_id = data.get("student_id")
        assessment_name = data.get("assessment_name")
        subject = data.get("subject")
        score = data.get("score")
        max_score = data.get("max_score")
        assessment_date = data.get("assessment_date")

        if student_id is None or not assessment_name:
            return error_response(
                "Student ID and assessment name are required.",
                400
            )

        if score is not None and max_score is not None:

            try:

                score = float(score)
                max_score = float(max_score)

            except ValueError:

                return error_response(
                    "Score and max score must be numbers.",
                    400
                )

            if max_score <= 0:
                return error_response(
                    "Max score must be greater than 0.",
                    400
                )

            if score < 0 or score > max_score:
                return error_response(
                    "Score must be between 0 and max score.",
                    400
                )

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            INSERT INTO assessments
            (
                student_id,
                assessment_name,
                subject,
                score,
                max_score,
                assessment_date
            )

            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            student_id,
            assessment_name,
            subject,
            score,
            max_score,
            assessment_date
        ))

        assessment_id = cursor.lastrowid

        connection.commit()

        return success_response({
            "assessment_id": assessment_id
        }, "Assessment added successfully.", 201)

    except Error as e:

        if connection:
            connection.rollback()

        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# UPDATE ASSESSMENT
# ============================================================

@app.route("/api/assessments/<int:assessment_id>", methods=["PUT"])
@auth_required(["admin", "faculty"])
def update_assessment(assessment_id):

    connection = None
    cursor = None

    try:

        data = request.get_json(silent=True)

        if not data:
            return error_response(
                "Request body is required.",
                400
            )

        assessment_name = data.get("assessment_name")
        subject = data.get("subject")
        score = data.get("score")
        max_score = data.get("max_score")
        assessment_date = data.get("assessment_date")

        if not assessment_name:
            return error_response(
                "Assessment name is required.",
                400
            )

        if score is not None and max_score is not None:

            try:

                score = float(score)
                max_score = float(max_score)

            except ValueError:

                return error_response(
                    "Score and max score must be numbers.",
                    400
                )

            if max_score <= 0:
                return error_response(
                    "Max score must be greater than 0.",
                    400
                )

            if score < 0 or score > max_score:
                return error_response(
                    "Score must be between 0 and max score.",
                    400
                )

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            UPDATE assessments

            SET
                assessment_name = %s,
                subject = %s,
                score = %s,
                max_score = %s,
                assessment_date = %s

            WHERE assessment_id = %s
        """, (
            assessment_name,
            subject,
            score,
            max_score,
            assessment_date,
            assessment_id
        ))

        if cursor.rowcount == 0:
            return error_response(
                "Assessment not found.",
                404
            )

        connection.commit()

        return success_response(
            message="Assessment updated successfully."
        )

    except Error as e:

        if connection:
            connection.rollback()

        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# DELETE ASSESSMENT
# ============================================================

@app.route("/api/assessments/<int:assessment_id>", methods=["DELETE"])
@auth_required(["admin", "faculty"])
def delete_assessment(assessment_id):

    connection = None
    cursor = None

    try:

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            DELETE FROM assessments

            WHERE assessment_id = %s
        """, (assessment_id,))

        if cursor.rowcount == 0:
            return error_response(
                "Assessment not found.",
                404
            )

        connection.commit()

        return success_response(
            message="Assessment deleted successfully."
        )

    except Error as e:

        if connection:
            connection.rollback()

        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# CAREER AI - RECOMMENDATION ENGINE
# ============================================================

@app.route("/api/career-ai/<int:student_id>", methods=["GET"])
@auth_required(["admin", "faculty", "student"])
def career_ai(student_id):
    denied = require_student_access(student_id, write=False)
    if denied:
        return denied


    connection = None
    cursor = None

    try:

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # ====================================================
        # STUDENT
        # ====================================================

        cursor.execute("""
            SELECT
                student_id,
                full_name,
                enrollment_no,
                department,
                semester
            FROM students
            WHERE student_id = %s
        """, (student_id,))

        student = cursor.fetchone()

        if not student:
            return error_response(
                "Student not found.",
                404
            )

        # ====================================================
        # ACADEMICS
        # ====================================================

        cursor.execute("""
            SELECT
                academic_id,
                semester,
                cgpa
            FROM academic_performance
            WHERE student_id = %s
            ORDER BY semester ASC
        """, (student_id,))

        academics = cursor.fetchall()

        # ====================================================
        # ATTENDANCE
        # ====================================================

        cursor.execute("""
            SELECT
                attendance_id,
                semester,
                total_classes,
                attended_classes,
                attendance_percentage
            FROM attendance
            WHERE student_id = %s
            ORDER BY semester ASC
        """, (student_id,))

        attendance = cursor.fetchall()

        # ====================================================
        # SKILLS
        # ====================================================

        cursor.execute("""
            SELECT
                skill_id,
                skill_name,
                skill_level
            FROM skills
            WHERE student_id = %s
            ORDER BY skill_level DESC
        """, (student_id,))

        skills = cursor.fetchall()

        # ====================================================
        # PROJECTS
        # ====================================================

        cursor.execute("""
            SELECT
                project_id,
                project_name,
                description,
                technology_used,
                project_type
            FROM projects
            WHERE student_id = %s
            ORDER BY project_id DESC
        """, (student_id,))

        projects = cursor.fetchall()

        # ====================================================
        # ASSESSMENTS
        # ====================================================

        cursor.execute("""
            SELECT
                assessment_id,
                assessment_name,
                subject,
                score,
                max_score,
                assessment_date
            FROM assessments
            WHERE student_id = %s
            ORDER BY
                assessment_date DESC,
                assessment_id DESC
        """, (student_id,))

        assessments = cursor.fetchall()

        # ====================================================
        # CALCULATE ACADEMIC SCORE
        # ====================================================

        academic_score = 0

        if academics:

            cgpa_values = []

            for record in academics:

                try:
                    cgpa_values.append(float(record["cgpa"]))
                except (TypeError, ValueError):
                    pass

            if cgpa_values:

                average_cgpa = sum(cgpa_values) / len(cgpa_values)

                academic_score = (
                    average_cgpa / 10
                ) * 100

        # ====================================================
        # CALCULATE ATTENDANCE SCORE
        # ====================================================

        attendance_score = 0

        if attendance:

            attendance_values = []

            for record in attendance:

                try:
                    attendance_values.append(
                        float(record["attendance_percentage"])
                    )
                except (TypeError, ValueError):
                    pass

            if attendance_values:

                attendance_score = (
                    sum(attendance_values)
                    / len(attendance_values)
                )

        # ====================================================
        # SKILL SCORE
        # ====================================================

        skill_score = 0

        if skills:

            skill_levels = []

            for skill in skills:

                try:
                    skill_levels.append(
                        int(skill["skill_level"])
                    )
                except (TypeError, ValueError):
                    pass

            if skill_levels:

                average_skill = (
                    sum(skill_levels)
                    / len(skill_levels)
                )

                skill_score = (
                    average_skill / 5
                ) * 100

        # ====================================================
        # PROJECT SCORE
        # ====================================================

        project_score = 0

        project_count = len(projects)

        if project_count >= 3:

            project_score = 100

        elif project_count == 2:

            project_score = 80

        elif project_count == 1:

            project_score = 60

        else:

            project_score = 0

        # ====================================================
        # ASSESSMENT SCORE
        # ====================================================

        assessment_score = 0

        assessment_percentages = []

        for assessment in assessments:

            try:

                score = float(assessment["score"])
                max_score = float(assessment["max_score"])

                if max_score > 0:

                    percentage = (
                        score / max_score
                    ) * 100

                    assessment_percentages.append(
                        percentage
                    )

            except (TypeError, ValueError):

                pass

        if assessment_percentages:

            assessment_score = (
                sum(assessment_percentages)
                / len(assessment_percentages)
            )

        # ====================================================
        # OVERALL SCORE
        # ====================================================

        overall_score = (
            academic_score * 0.30
            + attendance_score * 0.15
            + skill_score * 0.25
            + project_score * 0.20
            + assessment_score * 0.10
        )

        overall_score = round(
            overall_score,
            2
        )

        # ====================================================
        # DETERMINE CAREER
        # ====================================================

        skill_names = [
            skill["skill_name"].lower()
            for skill in skills
        ]

        career = "Software Developer"

        if any(
            word in skill_names
            for word in [
                "python",
                "machine learning",
                "ml",
                "data science",
                "data analysis"
            ]
        ):

            career = "Data Scientist / AI Engineer"

        elif any(
            word in skill_names
            for word in [
                "java",
                "spring",
                "spring boot"
            ]
        ):

            career = "Java Backend Developer"

        elif any(
            word in skill_names
            for word in [
                "react",
                "javascript",
                "html",
                "css"
            ]
        ):

            career = "Full Stack / Web Developer"

        elif any(
            word in skill_names
            for word in [
                "sql",
                "power bi",
                "tableau",
                "excel"
            ]
        ):

            career = "Data Analyst"

        # ====================================================
        # STRENGTHS
        # ====================================================

        strengths = []

        if academic_score >= 75:

            strengths.append(
                "Good academic performance"
            )

        if attendance_score >= 75:

            strengths.append(
                "Good attendance"
            )

        if skill_score >= 70:

            strengths.append(
                "Strong technical skills"
            )

        if project_count >= 2:

            strengths.append(
                "Good project experience"
            )

        if assessment_score >= 75:

            strengths.append(
                "Good assessment performance"
            )

        if not strengths:

            strengths.append(
                "Student has started building their career profile"
            )

        # ====================================================
        # WEAKNESSES
        # ====================================================

        weaknesses = []

        if academic_score < 70:

            weaknesses.append(
                "Academic performance can be improved"
            )

        if attendance_score < 75:

            weaknesses.append(
                "Attendance needs improvement"
            )

        if skill_score < 70:

            weaknesses.append(
                "Technical skills need improvement"
            )

        if project_count == 0:

            weaknesses.append(
                "No projects added yet"
            )

        elif project_count == 1:

            weaknesses.append(
                "More projects are recommended"
            )

        if not assessments:

            weaknesses.append(
                "No assessment records available"
            )

        if not weaknesses:

            weaknesses.append(
                "No major weakness detected"
            )

        # ====================================================
        # RECOMMENDED SKILLS
        # ====================================================

        recommended_skills = []

        if "python" not in skill_names:

            recommended_skills.append("Python")

        if not any(
            word in skill_names
            for word in [
                "dsa",
                "data structures",
                "algorithms"
            ]
        ):

            recommended_skills.append(
                "Data Structures & Algorithms"
            )

        if "sql" not in skill_names:

            recommended_skills.append("SQL")

        if not any(
            word in skill_names
            for word in [
                "git",
                "github"
            ]
        ):

            recommended_skills.append(
                "Git & GitHub"
            )

        if career == "Data Scientist / AI Engineer":

            if "machine learning" not in skill_names:

                recommended_skills.append(
                    "Machine Learning"
                )

            if "pandas" not in skill_names:

                recommended_skills.append(
                    "Pandas & NumPy"
                )

        elif career == "Full Stack / Web Developer":

            if "javascript" not in skill_names:

                recommended_skills.append(
                    "JavaScript"
                )

            if "react" not in skill_names:

                recommended_skills.append(
                    "React"
                )

        elif career == "Data Analyst":

            if "power bi" not in skill_names:

                recommended_skills.append(
                    "Power BI"
                )

            if "excel" not in skill_names:

                recommended_skills.append(
                    "Advanced Excel"
                )

        # Remove duplicates

        recommended_skills = list(
            dict.fromkeys(
                recommended_skills
            )
        )

        # ====================================================
        # ROADMAP
        # ====================================================

        roadmap = []

        if skill_score < 70:

            roadmap.append(
                "Improve core technical skills"
            )

        roadmap.append(
            "Learn Data Structures & Algorithms"
        )

        if project_count < 2:

            roadmap.append(
                "Build 2-3 practical projects"
            )

        roadmap.append(
            "Learn Git & GitHub"
        )

        if career == "Data Scientist / AI Engineer":

            roadmap.append(
                "Learn Machine Learning and build AI projects"
            )

        elif career == "Data Analyst":

            roadmap.append(
                "Learn SQL, Excel, Power BI and data visualization"
            )

        elif career == "Full Stack / Web Developer":

            roadmap.append(
                "Learn JavaScript, React and backend development"
            )

        elif career == "Java Backend Developer":

            roadmap.append(
                "Learn Java, Spring Boot and REST APIs"
            )

        else:

            roadmap.append(
                "Build a strong full-stack/software development project"
            )

        roadmap.append(
            "Prepare for technical interviews"
        )

        # ====================================================
        # FINAL RESPONSE
        # ====================================================

        return success_response({

            "student": student,

            "career_recommendation": {

                "career": career,

                "match_percentage": overall_score,

                "scores": {
                    "academic_score": round(
                        academic_score, 2
                    ),
                    "attendance_score": round(
                        attendance_score, 2
                    ),
                    "skill_score": round(
                        skill_score, 2
                    ),
                    "project_score": round(
                        project_score, 2
                    ),
                    "assessment_score": round(
                        assessment_score, 2
                    )
                },

                "strengths": strengths,

                "weaknesses": weaknesses,

                "recommended_skills": recommended_skills,

                "roadmap": roadmap
            },

            "data": {

                "academics": academics,

                "attendance": attendance,

                "skills": skills,

                "projects": projects,

                "assessments": assessments
            }

        })

    except Error as e:

        return error_response(
            str(e)
        )

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()

# ============================================================
# FACULTY - GET STUDENT DETAILS
# ============================================================

@app.route("/api/faculty/student/<int:student_id>", methods=["GET"])
@auth_required(["admin", "faculty"])
def get_faculty_student(student_id):
    denied = require_student_access(student_id, write=False)
    if denied:
        return denied


    connection = None
    cursor = None

    try:

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # ----------------------------------------------------
        # STUDENT
        # ----------------------------------------------------

        cursor.execute("""
            SELECT
                s.student_id,
                s.user_id,
                s.full_name,
                s.enrollment_no,
                s.department,
                s.semester,
                u.username,
                u.email

            FROM students s

            JOIN users u
                ON s.user_id = u.user_id

            WHERE s.student_id = %s
        """, (student_id,))

        student = cursor.fetchone()

        if not student:
            return error_response(
                "Student not found.",
                404
            )

        # ----------------------------------------------------
        # ACADEMICS
        # ----------------------------------------------------

        cursor.execute("""
            SELECT
                academic_id,
                semester,
                cgpa

            FROM academic_performance

            WHERE student_id = %s

            ORDER BY semester ASC
        """, (student_id,))

        academics = cursor.fetchall()

        # ----------------------------------------------------
        # ATTENDANCE
        # ----------------------------------------------------

        cursor.execute("""
            SELECT
                attendance_id,
                semester,
                total_classes,
                attended_classes,
                attendance_percentage

            FROM attendance

            WHERE student_id = %s

            ORDER BY semester ASC
        """, (student_id,))

        attendance = cursor.fetchall()

        # ----------------------------------------------------
        # SKILLS
        # ----------------------------------------------------

        cursor.execute("""
            SELECT
                skill_id,
                skill_name,
                skill_level

            FROM skills

            WHERE student_id = %s

            ORDER BY skill_level DESC
        """, (student_id,))

        skills = cursor.fetchall()

        # ----------------------------------------------------
        # PROJECTS
        # ----------------------------------------------------

        cursor.execute("""
            SELECT
                project_id,
                project_name,
                description,
                technology_used,
                project_type

            FROM projects

            WHERE student_id = %s

            ORDER BY project_id DESC
        """, (student_id,))

        projects = cursor.fetchall()

        # ----------------------------------------------------
        # ASSESSMENTS
        # ----------------------------------------------------

        cursor.execute("""
            SELECT
                assessment_id,
                assessment_name,
                subject,
                score,
                max_score,
                assessment_date

            FROM assessments

            WHERE student_id = %s

            ORDER BY
                assessment_date DESC,
                assessment_id DESC
        """, (student_id,))

        assessments = cursor.fetchall()

        return success_response({
            "student": student,
            "academics": academics,
            "attendance": attendance,
            "skills": skills,
            "projects": projects,
            "assessments": assessments
        })

    except Error as e:
        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()

# ============================================================
# SKILLS APIs
# ============================================================

# ------------------------------------------------------------
# ADD SKILL
# ------------------------------------------------------------

@app.route("/api/skills", methods=["POST"])
@auth_required(["admin", "faculty", "student"])
def add_skill():

    connection = None
    cursor = None

    try:
        data = request.get_json()

        if not data:
            return {
                "status": "error",
                "message": "Request body is required."
            }, 400

        student_id = data.get("student_id")
        if g.auth_role == "student" and int(student_id or 0) != int(g.auth_student_id):
            return error_response("You can only add skills to your own profile.", 403)
        skill_name = data.get("skill_name")
        skill_level = data.get("skill_level", 0)

        # Required fields
        if student_id is None or not skill_name:
            return {
                "status": "error",
                "message": "Student ID and skill name are required."
            }, 400

        # Validate skill level
        try:
            skill_level = int(skill_level)
        except (TypeError, ValueError):
            return {
                "status": "error",
                "message": "Skill level must be a number."
            }, 400

        if skill_level < 0 or skill_level > 5:
            return {
                "status": "error",
                "message": "Skill level must be between 0 and 5."
            }, 400

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # Check student exists
        cursor.execute("""
            SELECT student_id
            FROM students
            WHERE student_id = %s
        """, (student_id,))

        student = cursor.fetchone()

        if not student:
            return {
                "status": "error",
                "message": "Student not found."
            }, 404

        # Check duplicate skill for same student
        cursor.execute("""
            SELECT skill_id
            FROM skills
            WHERE student_id = %s
            AND LOWER(skill_name) = LOWER(%s)
        """, (student_id, skill_name.strip()))

        existing_skill = cursor.fetchone()

        if existing_skill:
            return {
                "status": "error",
                "message": "This skill already exists for the student."
            }, 409

        # Insert skill
        cursor.execute("""
            INSERT INTO skills
            (
                student_id,
                skill_name,
                skill_level
            )
            VALUES (%s, %s, %s)
        """, (
            student_id,
            skill_name.strip(),
            skill_level
        ))

        skill_id = cursor.lastrowid

        connection.commit()

        return {
            "status": "success",
            "message": "Skill added successfully.",
            "skill_id": skill_id,
            "student_id": student_id,
            "skill_name": skill_name.strip(),
            "skill_level": skill_level
        }, 201

    except Exception as e:

        if connection:
            connection.rollback()

        return {
            "status": "error",
            "message": str(e)
        }, 500

    finally:

        if cursor:
            cursor.close()

        if connection:
            connection.close()


# ------------------------------------------------------------
# UPDATE SKILL
# ------------------------------------------------------------

@app.route("/api/skills/<int:skill_id>", methods=["PUT"])
@auth_required(["admin", "faculty", "student"])
def update_skill(skill_id):
    denied = require_record_owner("skills", "skill_id", skill_id)
    if denied:
        return denied


    connection = None
    cursor = None

    try:
        data = request.get_json()

        if not data:
            return {
                "status": "error",
                "message": "Request body is required."
            }, 400

        skill_name = data.get("skill_name")
        skill_level = data.get("skill_level")

        if not skill_name:
            return {
                "status": "error",
                "message": "Skill name is required."
            }, 400

        if skill_level is None:
            return {
                "status": "error",
                "message": "Skill level is required."
            }, 400

        try:
            skill_level = int(skill_level)
        except (TypeError, ValueError):
            return {
                "status": "error",
                "message": "Skill level must be a number."
            }, 400

        if skill_level < 0 or skill_level > 5:
            return {
                "status": "error",
                "message": "Skill level must be between 0 and 5."
            }, 400

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # Check skill exists
        cursor.execute("""
            SELECT
                skill_id,
                student_id
            FROM skills
            WHERE skill_id = %s
        """, (skill_id,))

        skill = cursor.fetchone()

        if not skill:
            return {
                "status": "error",
                "message": "Skill not found."
            }, 404

        # Check duplicate skill name for same student
        cursor.execute("""
            SELECT skill_id
            FROM skills
            WHERE student_id = %s
            AND LOWER(skill_name) = LOWER(%s)
            AND skill_id != %s
        """, (
            skill["student_id"],
            skill_name.strip(),
            skill_id
        ))

        existing_skill = cursor.fetchone()

        if existing_skill:
            return {
                "status": "error",
                "message": "This skill already exists for the student."
            }, 409

        # Update
        cursor.execute("""
            UPDATE skills
            SET
                skill_name = %s,
                skill_level = %s
            WHERE skill_id = %s
        """, (
            skill_name.strip(),
            skill_level,
            skill_id
        ))

        connection.commit()

        return {
            "status": "success",
            "message": "Skill updated successfully.",
            "skill_id": skill_id
        }, 200

    except Exception as e:

        if connection:
            connection.rollback()

        return {
            "status": "error",
            "message": str(e)
        }, 500

    finally:

        if cursor:
            cursor.close()

        if connection:
            connection.close()


# ------------------------------------------------------------
# DELETE SKILL
# ------------------------------------------------------------

@app.route("/api/skills/<int:skill_id>", methods=["DELETE"])
@auth_required(["admin", "faculty", "student"])
def delete_skill(skill_id):
    denied = require_record_owner("skills", "skill_id", skill_id)
    if denied:
        return denied


    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            DELETE FROM skills
            WHERE skill_id = %s
        """, (skill_id,))

        if cursor.rowcount == 0:
            return {
                "status": "error",
                "message": "Skill not found."
            }, 404

        connection.commit()

        return {
            "status": "success",
            "message": "Skill deleted successfully.",
            "skill_id": skill_id
        }, 200

    except Exception as e:

        if connection:
            connection.rollback()

        return {
            "status": "error",
            "message": str(e)
        }, 500

    finally:

        if cursor:
            cursor.close()

        if connection:
            connection.close()


# ============================================================
# ADMIN - CREATE STUDENT
# ============================================================

@app.route("/api/admin/students", methods=["POST"])
@auth_required(["admin"])
def admin_create_student():

    connection = None
    cursor = None

    try:

        data = request.get_json(silent=True)

        if not data:
            return error_response(
                "Request body is required.",
                400
            )

        username = data.get("username")
        email = data.get("email")
        password = data.get("password")

        full_name = data.get("full_name")
        enrollment_no = data.get("enrollment_no")
        department = data.get("department")
        semester = data.get("semester")

        if not all([
            username,
            email,
            password,
            full_name,
            enrollment_no,
            department,
            semester
        ]):
            return error_response(
                "All student fields are required.",
                400
            )

        if len(str(password)) < 8:
            return error_response("Password must be at least 8 characters.", 400)

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # Duplicate user
        cursor.execute("""
            SELECT user_id
            FROM users

            WHERE username = %s
               OR email = %s
        """, (username, email))

        if cursor.fetchone():
            return error_response(
                "Username or email already exists.",
                409
            )

        # Duplicate enrollment
        cursor.execute("""
            SELECT student_id
            FROM students

            WHERE enrollment_no = %s
        """, (enrollment_no,))

        if cursor.fetchone():
            return error_response(
                "Enrollment number already exists.",
                409
            )

        password_hash = generate_password_hash(password)

        # User
        cursor.execute("""
            INSERT INTO users
            (
                username,
                email,
                password_hash,
                role
            )

            VALUES (%s, %s, %s, %s)
        """, (
            username,
            email,
            password_hash,
            "student"
        ))

        user_id = cursor.lastrowid

        # Student
        cursor.execute("""
            INSERT INTO students
            (
                user_id,
                full_name,
                enrollment_no,
                department,
                semester
            )

            VALUES (%s, %s, %s, %s, %s)
        """, (
            user_id,
            full_name,
            enrollment_no,
            department,
            semester
        ))

        student_id = cursor.lastrowid

        connection.commit()

        return success_response({
            "user_id": user_id,
            "student_id": student_id
        }, "Student created successfully.", 201)

    except Error as e:

        if connection:
            connection.rollback()

        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# ADMIN - CREATE FACULTY
# ============================================================

@app.route("/api/admin/faculty", methods=["POST"])
@auth_required(["admin"])
def admin_create_faculty():

    connection = None
    cursor = None

    try:

        data = request.get_json(silent=True)

        if not data:
            return error_response(
                "Request body is required.",
                400
            )

        username = data.get("username")
        email = data.get("email")
        password = data.get("password")

        if not all([
            username,
            email,
            password
        ]):
            return error_response(
                "Username, email and password are required.",
                400
            )

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT user_id

            FROM users

            WHERE username = %s
               OR email = %s
        """, (
            username,
            email
        ))

        if cursor.fetchone():
            return error_response(
                "Username or email already exists.",
                409
            )

        password_hash = generate_password_hash(password)

        cursor.execute("""
            INSERT INTO users
            (
                username,
                email,
                password_hash,
                role
            )

            VALUES (%s, %s, %s, %s)
        """, (
            username,
            email,
            password_hash,
            "faculty"
        ))

        user_id = cursor.lastrowid

        connection.commit()

        return success_response({
            "user_id": user_id
        }, "Faculty created successfully.", 201)

    except Error as e:

        if connection:
            connection.rollback()

        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# ADMIN - GET ALL USERS
# ============================================================

@app.route("/api/admin/users", methods=["GET"])
@auth_required(["admin"])
def admin_get_users():

    connection = None
    cursor = None

    try:

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                user_id,
                username,
                email,
                role,
                created_at

            FROM users

            ORDER BY user_id DESC
        """)

        users = cursor.fetchall()

        return success_response({
            "users": users
        })

    except Error as e:
        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# ADMIN - GET ALL STUDENTS
# ============================================================

@app.route("/api/admin/students", methods=["GET"])
@auth_required(["admin"])
def admin_get_students():

    connection = None
    cursor = None

    try:

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                s.student_id,
                s.user_id,
                s.full_name,
                s.enrollment_no,
                s.department,
                s.semester,
                u.username,
                u.email

            FROM students s

            JOIN users u
                ON s.user_id = u.user_id

            ORDER BY s.student_id DESC
        """)

        students = cursor.fetchall()

        return success_response({
            "students": students
        })

    except Error as e:
        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# ADMIN - GET ALL FACULTY
# ============================================================

@app.route("/api/admin/faculty", methods=["GET"])
@auth_required(["admin"])
def admin_get_faculty():

    connection = None
    cursor = None

    try:

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                user_id,
                username,
                email,
                role,
                created_at

            FROM users

            WHERE role = 'faculty'

            ORDER BY user_id DESC
        """)

        faculty = cursor.fetchall()

        return success_response({
            "faculty": faculty
        })

    except Error as e:
        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# ADMIN OVERVIEW
# ============================================================

@app.route("/api/admin/overview", methods=["GET"])
@auth_required(["admin"])
def admin_overview():

    connection = None
    cursor = None

    try:

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # Total users
        cursor.execute("""
            SELECT COUNT(*) AS total_users
            FROM users
        """)

        total_users = cursor.fetchone()["total_users"]

        # Students
        cursor.execute("""
            SELECT COUNT(*) AS total_students
            FROM users

            WHERE role = 'student'
        """)

        total_students = cursor.fetchone()["total_students"]

        # Faculty
        cursor.execute("""
            SELECT COUNT(*) AS total_faculty
            FROM users

            WHERE role = 'faculty'
        """)

        total_faculty = cursor.fetchone()["total_faculty"]

        # Admins
        cursor.execute("""
            SELECT COUNT(*) AS total_admins
            FROM users

            WHERE role = 'admin'
        """)

        total_admins = cursor.fetchone()["total_admins"]

        return success_response({
            "total_users": total_users,
            "total_students": total_students,
            "total_faculty": total_faculty,
            "total_admins": total_admins
        })

    except Error as e:
        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# ADMIN - UPDATE USER ROLE
# ============================================================

@app.route("/api/admin/users/<int:user_id>/role", methods=["PUT"])
@auth_required(["admin"])
def admin_update_role(user_id):

    connection = None
    cursor = None

    try:

        data = request.get_json(silent=True)

        if not data:
            return error_response(
                "Request body is required.",
                400
            )

        new_role = data.get("role")

        allowed_roles = [
            "student",
            "faculty",
            "admin"
        ]

        if new_role not in allowed_roles:
            return error_response(
                "Invalid role. Allowed roles: student, faculty, admin.",
                400
            )

        if int(user_id) == int(g.auth_user_id):
            return error_response("You cannot change your own role.", 403)

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            UPDATE users

            SET role = %s

            WHERE user_id = %s
        """, (
            new_role,
            user_id
        ))

        if cursor.rowcount == 0:
            return error_response(
                "User not found.",
                404
            )

        connection.commit()

        return success_response(
            message="User role updated successfully."
        )

    except Error as e:

        if connection:
            connection.rollback()

        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# ADMIN - DELETE USER
# ============================================================

@app.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
@auth_required(["admin"])
def admin_delete_user(user_id):

    connection = None
    cursor = None

    try:

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # Check user
        cursor.execute("""
            SELECT
                user_id,
                role

            FROM users

            WHERE user_id = %s
        """, (user_id,))

        user = cursor.fetchone()

        if not user:
            return error_response(
                "User not found.",
                404
            )

        if int(user_id) == int(g.auth_user_id):
            return error_response("You cannot delete your own account.", 403)

        # Prevent admin deletion
        if user["role"] == "admin":
            return error_response(
                "Admin users cannot be deleted.",
                403
            )

        # Delete user
        cursor.execute("""
            DELETE FROM users

            WHERE user_id = %s
        """, (user_id,))

        connection.commit()

        return success_response(
            message="User deleted successfully."
        )

    except Error as e:

        if connection:
            connection.rollback()

        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# STAFF - CREATE STUDENT
# ============================================================

@app.route("/api/manage/students", methods=["POST"])
@auth_required(["admin", "faculty"])
def create_student_by_staff():

    connection = None
    cursor = None

    try:

        data = request.get_json(silent=True)

        if not data:
            return error_response(
                "Request body is required.",
                400
            )

        username = data.get("username")
        email = data.get("email")
        password = data.get("password")

        full_name = data.get("full_name")
        enrollment_no = data.get("enrollment_no")
        department = data.get("department")
        semester = data.get("semester")

        if not all([
            username,
            email,
            password,
            full_name,
            enrollment_no,
            department,
            semester
        ]):
            return error_response(
                "All student fields are required.",
                400
            )

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # Email
        cursor.execute("""
            SELECT user_id

            FROM users

            WHERE email = %s
        """, (email,))

        if cursor.fetchone():
            return error_response(
                "Email already exists.",
                409
            )

        # Username
        cursor.execute("""
            SELECT user_id

            FROM users

            WHERE username = %s
        """, (username,))

        if cursor.fetchone():
            return error_response(
                "Username already exists.",
                409
            )

        # Enrollment
        cursor.execute("""
            SELECT student_id

            FROM students

            WHERE enrollment_no = %s
        """, (enrollment_no,))

        if cursor.fetchone():
            return error_response(
                "Enrollment number already exists.",
                409
            )

        password_hash = generate_password_hash(password)

        # Create user
        cursor.execute("""
            INSERT INTO users
            (
                username,
                email,
                password_hash,
                role
            )

            VALUES (%s, %s, %s, 'student')
        """, (
            username,
            email,
            password_hash
        ))

        user_id = cursor.lastrowid

        # Create student
        cursor.execute("""
            INSERT INTO students
            (
                user_id,
                full_name,
                enrollment_no,
                department,
                semester
            )

            VALUES (%s, %s, %s, %s, %s)
        """, (
            user_id,
            full_name,
            enrollment_no,
            department,
            semester
        ))

        student_id = cursor.lastrowid

        connection.commit()

        return success_response({
            "user_id": user_id,
            "student_id": student_id
        }, "Student created successfully.", 201)

    except Error as e:

        if connection:
            connection.rollback()

        return error_response("A database error occurred. Please try again later.")

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# ERROR HANDLERS
# ============================================================

@app.errorhandler(404)
def not_found(error):

    return error_response(
        "API endpoint not found.",
        404
    )


@app.errorhandler(405)
def method_not_allowed(error):

    return error_response(
        "HTTP method not allowed.",
        405
    )


@app.errorhandler(500)
def internal_server_error(error):

    return error_response(
        "Internal server error.",
        500
    )


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", 5000)),
        debug=False
    )