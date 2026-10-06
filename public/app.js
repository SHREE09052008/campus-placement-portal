const $ = (id) => document.getElementById(id);

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}

function setVisible(id, visible) {
  $(id).classList.toggle("hidden", !visible);
}

async function init() {
  const data = await api("/api/me");
  if (!data.user) return showLogin();
  showApp(data.user, data.profile);
}

function showLogin() {
  setVisible("loginView", true);
  setVisible("appView", false);
  setVisible("logoutBtn", false);
}

function showApp(user, profile) {
  setVisible("loginView", false);
  setVisible("appView", true);
  setVisible("logoutBtn", true);
  $("roleBadge").textContent = user.role;
  $("welcomeTitle").textContent = `Welcome, ${user.name}`;
  $("welcomeText").textContent = user.email;

  ["studentPanel","recruiterPanel","adminPanel"].forEach(id => setVisible(id, false));
  if (user.role === "student") {
    setVisible("studentPanel", true);
    fillStudent(profile);
    loadStudent();
    startAutoRefresh(user);
  } else if (user.role === "recruiter") {
    setVisible("recruiterPanel", true);
    fillCompany(profile);
    loadRecruiter();
    startAutoRefresh(user);
  } else {
    setVisible("adminPanel", true);
    loadAdmin();
    startAutoRefresh(user);
  }
}

function fillStudent(p) {
  if (!p) return;
  $("sBranch").value = p.branch || "";
  $("sCgpa").value = p.cgpa ?? "";
  $("sYear").value = p.graduation_year ?? "";
  $("sResume").value = p.resume_link || "";
}

function fillCompany(p) {
  if (!p) return;
  $("cName").value = p.name || "";
  $("cDescription").value = p.description || "";
  $("cWebsite").value = p.website || "";
}

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("loginError").textContent = "";
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ email: $("email").value, password: $("password").value })
    });
    const me = await api("/api/me");
    showApp(data.user, me.profile);
  } catch (err) {
    $("loginError").textContent = err.message;
  }
});

document.querySelectorAll("[data-demo]").forEach(btn => {
  btn.addEventListener("click", () => {
    const [email, password] = btn.dataset.demo.split("|");
    $("email").value = email;
    $("password").value = password;
  });
});

$("logoutBtn").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  showLogin();
});

$("studentProfileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/student/profile", {
      method: "PUT",
      body: JSON.stringify({
        branch: $("sBranch").value,
        cgpa: $("sCgpa").value,
        graduation_year: $("sYear").value,
        resume_link: $("sResume").value
      })
    });
    $("studentMessage").textContent = "Profile updated. Eligibility has been recalculated.";
    toast("Profile saved");
    loadStudent();
  } catch (err) {
    $("studentMessage").textContent = err.message;
  }
});

async function loadStudent() {
  const jobs = await api("/api/jobs");
  $("jobsList").innerHTML = jobs.length ? jobs.map(job => `
    <article class="job-card">
      <div class="company">${escapeHtml(job.company_name)}</div>
      <h3>${escapeHtml(job.title)}</h3>
      <p class="muted">${escapeHtml(job.description)}</p>
      <div class="meta">
        <span class="pill">CGPA ${job.min_cgpa}+</span>
        <span class="pill">${job.graduation_year}</span>
        <span class="pill">${escapeHtml(job.allowed_departments)}</span>
      </div>
      <p class="${job.eligible ? "status green" : "status red"}">
        ${job.eligible ? "✓ Eligible" : "✕ Not eligible"}
      </p>
      ${job.application
        ? `<p class="status blue">Application: ${escapeHtml(job.application.status)}</p>`
        : `<button class="primary" ${job.eligible ? "" : "disabled"} onclick="applyJob(${job.id})">Apply now</button>`}
      ${!job.eligible && !job.application ? `<p class="muted">${escapeHtml(job.eligibilityReason)}</p>` : ""}
    </article>
  `).join("") : `<div class="empty">No approved job openings yet.</div>`;

  const apps = await api("/api/student/applications");
  $("studentApplications").innerHTML = apps.length ? apps.map(a => `
    <div class="job-card" style="margin-bottom:10px">
      <strong>${escapeHtml(a.title)}</strong>
      <div class="muted">${escapeHtml(a.company_name)}</div>
      <span class="status blue">${escapeHtml(a.status)}</span>
    </div>
  `).join("") : `<div class="empty">You have not applied to any jobs yet.</div>`;
}

async function applyJob(id) {
  try {
    await api(`/api/jobs/${id}/apply`, { method: "POST" });
    toast("Application submitted");
    loadStudent();
  } catch (err) {
    toast(err.message);
  }
}
window.applyJob = applyJob;

$("companyProfileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/company/profile", {
      method: "PUT",
      body: JSON.stringify({
        name: $("cName").value,
        description: $("cDescription").value,
        website: $("cWebsite").value
      })
    });
    $("companyMessage").textContent = "Company profile saved.";
    toast("Company profile saved");
  } catch (err) {
    $("companyMessage").textContent = err.message;
  }
});

$("jobForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/company/jobs", {
      method: "POST",
      body: JSON.stringify({
        title: $("jTitle").value,
        description: $("jDescription").value,
        min_cgpa: $("jCgpa").value,
        allowed_departments: $("jDepartments").value,
        graduation_year: $("jYear").value
      })
    });
    $("jobMessage").textContent = "Job submitted. A placement admin must approve it before students can see it.";
    e.target.reset();
    loadRecruiter();
  } catch (err) {
    $("jobMessage").textContent = err.message;
  }
});

async function loadRecruiter() {
  const jobs = await api("/api/company/jobs");
  $("recruiterJobs").innerHTML = jobs.length ? jobs.map(j => `
    <article class="job-card">
      <h3>${escapeHtml(j.title)}</h3>
      <p class="muted">${escapeHtml(j.description)}</p>
      <div class="meta">
        <span class="pill">Min CGPA ${j.min_cgpa}</span>
        <span class="pill">${j.graduation_year}</span>
        <span class="pill">${escapeHtml(j.allowed_departments)}</span>
      </div>
      <span class="status ${j.status === "approved" ? "green" : j.status === "rejected" ? "red" : "blue"}">${escapeHtml(j.status)}</span>
    </article>
  `).join("") : `<div class="empty">Create your first job posting above.</div>`;

  const apps = await api("/api/company/applications");
  $("applicants").innerHTML = apps.length ? `
    <table><thead><tr>
      <th>Candidate</th><th>Job</th><th>CGPA</th><th>Branch</th><th>Resume</th><th>Status</th>
    </tr></thead><tbody>
    ${apps.map(a => `<tr>
      <td><strong>${escapeHtml(a.student_name)}</strong><br><span class="muted">${escapeHtml(a.email)}</span></td>
      <td>${escapeHtml(a.title)}</td>
      <td>${a.cgpa}</td>
      <td>${escapeHtml(a.branch)}</td>
      <td>${a.resume_link ? `<a href="${escapeAttr(a.resume_link)}" target="_blank" rel="noreferrer">Open</a>` : "—"}</td>
      <td><select onchange="updateApplication(${a.id}, this.value)">
        ${["Applied","Shortlisted","Rejected","Selected"].map(s => `<option ${s === a.status ? "selected" : ""}>${s}</option>`).join("")}
      </select></td>
    </tr>`).join("")}
    </tbody></table>
  ` : `<div class="empty">No applications yet.</div>`;
}

async function updateApplication(id, status) {
  try {
    await api(`/api/company/applications/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status })
    });
    toast("Candidate status updated");
  } catch (err) {
    toast(err.message);
  }
}
window.updateApplication = updateApplication;

async function loadAdmin() {
  const companies = await api("/api/admin/companies");
  $("companyApprovals").innerHTML = companies.map(c => `
    <div class="job-card" style="margin-bottom:10px">
      <strong>${escapeHtml(c.name)}</strong>
      <p class="muted">${escapeHtml(c.description || "No description")}</p>
      <span class="status ${c.approved ? "green" : "red"}">${c.approved ? "Approved" : "Not approved"}</span>
      <div style="margin-top:10px">
        <button class="small-btn approve" onclick="companyDecision(${c.id}, 'approved')">Approve</button>
        <button class="small-btn reject" onclick="companyDecision(${c.id}, 'rejected')">Reject</button>
      </div>
    </div>
  `).join("") || `<div class="empty">No companies.</div>`;

  const jobs = await api("/api/admin/jobs");
  $("jobApprovals").innerHTML = jobs.map(j => `
    <div class="job-card" style="margin-bottom:10px">
      <strong>${escapeHtml(j.title)}</strong>
      <div class="muted">${escapeHtml(j.company_name)}</div>
      <span class="status ${j.status === "approved" ? "green" : j.status === "rejected" ? "red" : "blue"}">${escapeHtml(j.status)}</span>
      <div style="margin-top:10px">
        <button class="small-btn approve" onclick="jobDecision(${j.id}, 'approved')">Approve</button>
        <button class="small-btn reject" onclick="jobDecision(${j.id}, 'rejected')">Reject</button>
      </div>
    </div>
  `).join("") || `<div class="empty">No jobs.</div>`;

  const logs = await api("/api/admin/logs");
  $("adminLogs").innerHTML = logs.length ? `
    <table><thead><tr><th>Action</th><th>Target</th><th>Reviewer</th><th>Timestamp</th></tr></thead>
    <tbody>${logs.map(l => `<tr>
      <td>${escapeHtml(l.action)}</td><td>${escapeHtml(l.target_type)} #${l.target_id}</td>
      <td>${escapeHtml(l.admin_name)}<br><span class="muted">${escapeHtml(l.email)}</span></td>
      <td>${escapeHtml(l.created_at)}</td>
    </tr>`).join("")}</tbody></table>
  ` : `<div class="empty">No administrative actions yet.</div>`;
}

async function companyDecision(id, decision) {
  try {
    await api(`/api/admin/companies/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision })
    });
    toast("Company decision saved");
    loadAdmin();
  } catch (err) { toast(err.message); }
}
window.companyDecision = companyDecision;

async function jobDecision(id, decision) {
  try {
    await api(`/api/admin/jobs/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision })
    });
    toast("Job decision saved");
    loadAdmin();
  } catch (err) { toast(err.message); }
}
window.jobDecision = jobDecision;
let refreshTimer;

function startAutoRefresh(user) {
  clearInterval(refreshTimer);

  refreshTimer = setInterval(() => {
    if (user.role === "student") {
      loadStudent();
    } else if (user.role === "recruiter") {
      loadRecruiter();
    } else if (user.role === "admin") {
      loadAdmin();
    }
  }, 5000);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}
function escapeAttr(value) {
  return escapeHtml(value);
}

init();
