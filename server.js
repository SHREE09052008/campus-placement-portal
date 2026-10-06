const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database("placement.db");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-this-demo-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax" }
  })
);
app.use(express.static(path.join(__dirname, "public")));

db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student','recruiter','admin'))
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  branch TEXT NOT NULL,
  cgpa REAL NOT NULL,
  graduation_year INTEGER NOT NULL,
  resume_link TEXT DEFAULT '',
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recruiter_user_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  website TEXT DEFAULT '',
  approved INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(recruiter_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  min_cgpa REAL NOT NULL,
  allowed_departments TEXT NOT NULL,
  graduation_year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'Applied',
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(job_id, student_id),
  FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(admin_user_id) REFERENCES users(id)
);
`);

function seed() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (count > 0) return;

  const insertUser = db.prepare(
    "INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)"
  );
  const student = insertUser.run(
    "Demo Student",
    "student@example.com",
    bcrypt.hashSync("student123", 10),
    "student"
  );
  const recruiter = insertUser.run(
    "Demo Recruiter",
    "recruiter@example.com",
    bcrypt.hashSync("recruiter123", 10),
    "recruiter"
  );
  const admin = insertUser.run(
    "Placement Admin",
    "admin@example.com",
    bcrypt.hashSync("admin123", 10),
    "admin"
  );

  db.prepare(
    "INSERT INTO students (user_id,branch,cgpa,graduation_year,resume_link) VALUES (?,?,?,?,?)"
  ).run(student.lastInsertRowid, "Computer Science", 8.2, 2027, "https://example.com/resume");

  const company = db.prepare(
    "INSERT INTO companies (recruiter_user_id,name,description,website,approved) VALUES (?,?,?,?,1)"
  ).run(
    recruiter.lastInsertRowid,
    "CloudNova Technologies",
    "A sample cloud and software company for the placement portal demo.",
    "https://example.com",
  );

  db.prepare(
    "INSERT INTO jobs (company_id,title,description,min_cgpa,allowed_departments,graduation_year,status) VALUES (?,?,?,?,?,?,?)"
  ).run(
    company.lastInsertRowid,
    "Junior Cloud Developer Intern",
    "Work with a software team on cloud-enabled web applications.",
    7.5,
    "Computer Science,Information Technology,Electronics",
    2027,
    "approved"
  );

  db.prepare(
    "INSERT INTO jobs (company_id,title,description,min_cgpa,allowed_departments,graduation_year,status) VALUES (?,?,?,?,?,?,?)"
  ).run(
    company.lastInsertRowid,
    "Data Analyst Intern",
    "Analyze business data and build simple dashboards.",
    8.0,
    "Computer Science,Information Technology,Data Science",
    2027,
    "approved"
  );

  db.prepare(
    "INSERT INTO admin_actions (admin_user_id,action,target_type,target_id) VALUES (?,?,?,?)"
  ).run(
    admin.lastInsertRowid,
    "Approved demo company",
    "company",
    company.lastInsertRowid
  );
}
seed();

function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Login required." });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user || !roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: "You do not have permission for this action." });
    }
    next();
  };
}

function currentStudent(userId) {
  return db.prepare(`
    SELECT s.*, u.name, u.email
    FROM students s JOIN users u ON u.id=s.user_id
    WHERE s.user_id=?
  `).get(userId);
}

function currentCompany(userId) {
  return db.prepare(`
    SELECT c.*, u.name AS recruiter_name, u.email
    FROM companies c JOIN users u ON u.id=c.recruiter_user_id
    WHERE c.recruiter_user_id=?
  `).get(userId);
}

app.get("/api/me", (req, res) => {
  if (!req.session.user) return res.json({ user: null });
  const user = req.session.user;
  let profile = null;
  if (user.role === "student") profile = currentStudent(user.id);
  if (user.role === "recruiter") profile = currentCompany(user.id);
  res.json({ user, profile });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email=?").get(email?.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ message: "Logged in.", user: req.session.user });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ message: "Logged out." }));
});

app.get("/api/jobs", requireRole("student"), (req, res) => {
  const jobs = db.prepare(`
    SELECT j.*, c.name AS company_name
    FROM jobs j JOIN companies c ON c.id=j.company_id
    WHERE j.status='approved' AND c.approved=1
    ORDER BY j.created_at DESC
  `).all();
  const student = currentStudent(req.session.user.id);
  const applications = db.prepare(
    "SELECT job_id,status FROM applications WHERE student_id=?"
  ).all(student.id);
  const appMap = Object.fromEntries(applications.map(a => [a.job_id, a]));

  const result = jobs.map(job => {
    const departments = job.allowed_departments.split(",").map(x => x.trim());
    const eligible =
      student.cgpa >= job.min_cgpa &&
      departments.includes(student.branch) &&
      student.graduation_year === job.graduation_year;
    return {
      ...job,
      eligible,
      eligibilityReason: eligible
        ? "You meet all eligibility criteria."
        : `Requires CGPA ${job.min_cgpa}+, department: ${departments.join(", ")}, graduation year: ${job.graduation_year}.`,
      application: appMap[job.id] || null
    };
  });
  res.json(result);
});

app.put("/api/student/profile", requireRole("student"), (req, res) => {
  const { branch, cgpa, graduation_year, resume_link } = req.body;
  const numericCgpa = Number(cgpa);
  const year = Number(graduation_year);
  if (!branch || !Number.isFinite(numericCgpa) || numericCgpa < 0 || numericCgpa > 10 || !Number.isInteger(year)) {
    return res.status(400).json({ error: "Please provide valid profile details." });
  }
  db.prepare(`
    UPDATE students SET branch=?,cgpa=?,graduation_year=?,resume_link=?
    WHERE user_id=?
  `).run(branch.trim(), numericCgpa, year, resume_link?.trim() || "", req.session.user.id);
  res.json({ message: "Profile updated." });
});

app.post("/api/jobs/:jobId/apply", requireRole("student"), (req, res) => {
  const job = db.prepare(`
    SELECT j.*, c.name AS company_name
    FROM jobs j JOIN companies c ON c.id=j.company_id
    WHERE j.id=? AND j.status='approved' AND c.approved=1
  `).get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found or not approved." });

  const student = currentStudent(req.session.user.id);
  const departments = job.allowed_departments.split(",").map(x => x.trim());
  const eligible =
    student.cgpa >= job.min_cgpa &&
    departments.includes(student.branch) &&
    student.graduation_year === job.graduation_year;

  if (!eligible) {
    return res.status(400).json({
      error: `You are not eligible. This job requires CGPA ${job.min_cgpa}+, an allowed department, and graduation year ${job.graduation_year}.`
    });
  }

  try {
    db.prepare("INSERT INTO applications (job_id,student_id) VALUES (?,?)")
      .run(job.id, student.id);
    res.json({ message: "Application submitted successfully." });
  } catch {
    res.status(409).json({ error: "You have already applied for this job." });
  }
});

app.get("/api/student/applications", requireRole("student"), (req, res) => {
  const student = currentStudent(req.session.user.id);
  const rows = db.prepare(`
    SELECT a.*, j.title, c.name AS company_name
    FROM applications a
    JOIN jobs j ON j.id=a.job_id
    JOIN companies c ON c.id=j.company_id
    WHERE a.student_id=?
    ORDER BY a.applied_at DESC
  `).all(student.id);
  res.json(rows);
});

app.put("/api/company/profile", requireRole("recruiter"), (req, res) => {
  const { name, description, website } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Company name is required." });
  const company = currentCompany(req.session.user.id);
  if (!company) {
    db.prepare(
      "INSERT INTO companies (recruiter_user_id,name,description,website) VALUES (?,?,?,?)"
    ).run(req.session.user.id, name.trim(), description?.trim() || "", website?.trim() || "");
  } else {
    db.prepare(
      "UPDATE companies SET name=?,description=?,website=? WHERE recruiter_user_id=?"
    ).run(name.trim(), description?.trim() || "", website?.trim() || "", req.session.user.id);
  }
  res.json({ message: "Company profile saved. Admin approval may be required." });
});

app.post("/api/company/jobs", requireRole("recruiter"), (req, res) => {
  const company = currentCompany(req.session.user.id);
  if (!company) return res.status(400).json({ error: "Create your company profile first." });
  const { title, description, min_cgpa, allowed_departments, graduation_year } = req.body;
  const cgpa = Number(min_cgpa);
  const year = Number(graduation_year);
  if (!title?.trim() || !description?.trim() || !Number.isFinite(cgpa) || !allowed_departments?.trim() || !Number.isInteger(year)) {
    return res.status(400).json({ error: "Please complete all job fields." });
  }
  db.prepare(`
    INSERT INTO jobs (company_id,title,description,min_cgpa,allowed_departments,graduation_year)
    VALUES (?,?,?,?,?,?)
  `).run(company.id, title.trim(), description.trim(), cgpa, allowed_departments.trim(), year);
  res.json({ message: "Job submitted for admin approval." });
});

app.get("/api/company/jobs", requireRole("recruiter"), (req, res) => {
  const company = currentCompany(req.session.user.id);
  if (!company) return res.json([]);
  const jobs = db.prepare("SELECT * FROM jobs WHERE company_id=? ORDER BY created_at DESC").all(company.id);
  res.json(jobs);
});

app.get("/api/company/applications", requireRole("recruiter"), (req, res) => {
  const company = currentCompany(req.session.user.id);
  if (!company) return res.json([]);
  const rows = db.prepare(`
    SELECT a.id,a.status,a.applied_at,j.title,
           u.name AS student_name,u.email,
           s.branch,s.cgpa,s.graduation_year,s.resume_link
    FROM applications a
    JOIN jobs j ON j.id=a.job_id
    JOIN students s ON s.id=a.student_id
    JOIN users u ON u.id=s.user_id
    WHERE j.company_id=?
    ORDER BY a.applied_at DESC
  `).all(company.id);
  res.json(rows);
});

app.put("/api/company/applications/:id/status", requireRole("recruiter"), (req, res) => {
  const company = currentCompany(req.session.user.id);
  const allowed = ["Applied", "Shortlisted", "Rejected", "Selected"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: "Invalid status." });
  const result = db.prepare(`
    UPDATE applications SET status=?
    WHERE id=? AND job_id IN (SELECT id FROM jobs WHERE company_id=?)
  `).run(req.body.status, req.params.id, company.id);
  if (!result.changes) return res.status(404).json({ error: "Application not found." });
  res.json({ message: "Application status updated." });
});

app.get("/api/admin/companies", requireRole("admin"), (req, res) => {
  res.json(db.prepare(`
    SELECT c.*,u.email FROM companies c JOIN users u ON u.id=c.recruiter_user_id
    ORDER BY c.id DESC
  `).all());
});

app.get("/api/admin/jobs", requireRole("admin"), (req, res) => {
  res.json(db.prepare(`
    SELECT j.*,c.name AS company_name
    FROM jobs j JOIN companies c ON c.id=j.company_id
    ORDER BY j.id DESC
  `).all());
});

app.post("/api/admin/companies/:id/decision", requireRole("admin"), (req, res) => {
  const decision = req.body.decision;
  if (!["approved", "rejected"].includes(decision)) return res.status(400).json({ error: "Invalid decision." });
  db.prepare("UPDATE companies SET approved=? WHERE id=?").run(decision === "approved" ? 1 : 0, req.params.id);
  db.prepare(
    "INSERT INTO admin_actions (admin_user_id,action,target_type,target_id) VALUES (?,?,?,?)"
  ).run(req.session.user.id, `${decision === "approved" ? "Approved" : "Rejected"} company`, "company", req.params.id);
  res.json({ message: `Company ${decision}.` });
});

app.post("/api/admin/jobs/:id/decision", requireRole("admin"), (req, res) => {
  const decision = req.body.decision;
  if (!["approved", "rejected"].includes(decision)) return res.status(400).json({ error: "Invalid decision." });
  db.prepare("UPDATE jobs SET status=? WHERE id=?").run(decision, req.params.id);
  db.prepare(
    "INSERT INTO admin_actions (admin_user_id,action,target_type,target_id) VALUES (?,?,?,?)"
  ).run(req.session.user.id, `${decision === "approved" ? "Approved" : "Rejected"} job`, "job", req.params.id);
  res.json({ message: `Job ${decision}.` });
});

app.get("/api/admin/logs", requireRole("admin"), (req, res) => {
  res.json(db.prepare(`
    SELECT l.*,u.name AS admin_name,u.email
    FROM admin_actions l JOIN users u ON u.id=l.admin_user_id
    ORDER BY l.created_at DESC
  `).all());
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Campus Placement Portal running at http://localhost:${PORT}`);
});
