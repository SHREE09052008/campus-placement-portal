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

["sYear", "jYear"].forEach(id => {
  $(id).max = String(new Date().getFullYear() + 10);
});
$("signupYear").max = String(new Date().getFullYear() + 10);

let activeUser = null;
let recruiterJobs = [];
let recruiterApplications = [];
const selectedApplicantIds = new Set();
const applicationStatuses = [
  "Applied", "Under Review", "Shortlisted", "Aptitude Test",
  "Technical Interview", "HR Interview", "Selected", "Offer Accepted",
  "Offer Declined", "Rejected", "Withdrawn"
];
const branches = [
  "Computer Science", "Information Technology", "Electronics",
  "Electrical Engineering", "Mechanical Engineering", "Civil Engineering",
  "Data Science", "Artificial Intelligence", "Chemical Engineering"
];

["sBranch", "signupBranch"].forEach(id => {
  const select = $(id);
  branches.forEach(branch => {
    const option = document.createElement("option");
    option.value = branch;
    option.textContent = branch;
    select.append(option);
  });
});

async function init() {
  const data = await api("/api/me");
  if (!data.user) {
    if (!activeUser) showLogin();
    return;
  }
  showApp(data.user, data.profile);
}

function showLogin() {
  activeUser = null;
  setVisible("loginView", true);
  setVisible("signInPanel", true);
  setVisible("signUpPanel", false);
  setVisible("appView", false);
  setVisible("logoutBtn", false);
  setVisible("studentNav", false);
  setVisible("recruiterNav", false);
}

function showApp(user, profile) {
  activeUser = user;
  setVisible("loginView", false);
  setVisible("appView", true);
  setVisible("logoutBtn", true);
  $("roleBadge").textContent = user.role;
  $("welcomeTitle").textContent = `Welcome, ${user.name}`;
  $("welcomeText").textContent = user.email;

  ["studentPanel","studentPipelinePage","studentProfilePage","recruiterPanel","recruiterApplicantsPage","recruiterCompanyPage","adminPanel"].forEach(id => setVisible(id, false));
  setVisible("studentNav", user.role === "student");
  setVisible("recruiterNav", user.role === "recruiter");
  if (user.role === "student") {
    showStudentPage(location.hash === "#pipeline" ? "pipeline" : location.hash === "#profile" ? "profile" : "dashboard");
    fillStudent(profile);
    loadStudent();
    startAutoRefresh(user);
  } else if (user.role === "recruiter") {
    showRecruiterPage(location.hash === "#applicants" ? "applicants" : location.hash === "#company" ? "company" : "dashboard");
    fillCompany(profile);
    loadRecruiter();
    startAutoRefresh(user);
  } else {
    setVisible("adminPanel", true);
    loadAdmin();
    startAutoRefresh(user);
  }
}

function showRecruiterPage(page) {
  if (activeUser?.role !== "recruiter") return;
  const showApplicants = page === "applicants";
  const showCompany = page === "company";
  setVisible("recruiterPanel", !showApplicants && !showCompany);
  setVisible("recruiterApplicantsPage", showApplicants);
  setVisible("recruiterCompanyPage", showCompany);
  document.querySelectorAll("#recruiterNav [data-recruiter-page]").forEach(link => {
    const selected = link.dataset.recruiterPage === page;
    link.classList.toggle("active", selected);
    if (selected) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  window.scrollTo(0, 0);
}

function showStudentPage(page) {
  if (activeUser?.role !== "student") return;
  const showPipeline = page === "pipeline";
  const showProfile = page === "profile";
  setVisible("studentPanel", !showPipeline && !showProfile);
  setVisible("studentPipelinePage", showPipeline);
  setVisible("studentProfilePage", showProfile);
  document.querySelectorAll("#studentNav [data-student-page]").forEach(link => {
    const selected = link.dataset.studentPage === page;
    link.classList.toggle("active", selected);
    if (selected) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  window.scrollTo(0, 0);
}

document.addEventListener("click", event => {
  if (!(event.target instanceof Element)) return;
  const studentLink = event.target.closest("[data-student-page]");
  if (studentLink) {
    event.preventDefault();
    const page = studentLink.dataset.studentPage;
    const hash = page === "pipeline" ? "#pipeline" : page === "profile" ? "#profile" : "#dashboard";
    if (location.hash !== hash) history.pushState(null, "", hash);
    showStudentPage(page);
    return;
  }
  const recruiterLink = event.target.closest("[data-recruiter-page]");
  if (recruiterLink) {
    event.preventDefault();
    const page = recruiterLink.dataset.recruiterPage;
    const hash = page === "applicants" ? "#applicants" : page === "company" ? "#company" : "#dashboard";
    if (location.hash !== hash) history.pushState(null, "", hash);
    showRecruiterPage(page);
  }
});

function syncStudentPage() {
  if (activeUser?.role === "student") {
    showStudentPage(location.hash === "#pipeline" ? "pipeline" : location.hash === "#profile" ? "profile" : "dashboard");
  } else if (activeUser?.role === "recruiter") {
    showRecruiterPage(location.hash === "#applicants" ? "applicants" : location.hash === "#company" ? "company" : "dashboard");
  }
}

window.addEventListener("hashchange", syncStudentPage);
window.addEventListener("popstate", syncStudentPage);

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

function setSignUpRole(role) {
  const isStudent = role === "student";
  setVisible("signupStudentFields", isStudent);
  ["signupBranch", "signupCgpa", "signupYear"].forEach(id => {
    $(id).required = isStudent;
  });
}

$("signupRole").addEventListener("change", () => setSignUpRole($("signupRole").value));
$("showSignUp").addEventListener("click", () => {
  $("loginError").textContent = "";
  $("signUpError").textContent = "";
  setVisible("signInPanel", false);
  setVisible("signUpPanel", true);
  $("signupName").focus();
});
$("showSignIn").addEventListener("click", () => {
  $("signUpError").textContent = "";
  setVisible("signUpPanel", false);
  setVisible("signInPanel", true);
  $("email").focus();
});

$("signUpForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("signUpError").textContent = "";
  if (!$("signUpForm").reportValidity()) return;
  try {
    const role = $("signupRole").value;
    const data = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({
        name: $("signupName").value,
        email: $("signupEmail").value,
        password: $("signupPassword").value,
        role,
        branch: role === "student" ? $("signupBranch").value : undefined,
        cgpa: role === "student" ? $("signupCgpa").value : undefined,
        graduation_year: role === "student" ? $("signupYear").value : undefined
      })
    });
    const me = await api("/api/me");
    e.target.reset();
    setSignUpRole("student");
    showApp(data.user, me.profile);
    toast("Account created");
  } catch (err) {
    $("signUpError").textContent = err.message;
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
  const button = $("logoutBtn");
  button.disabled = true;
  try {
    await api("/api/logout", { method: "POST" });
    clearInterval(refreshTimer);
    history.replaceState(null, "", location.pathname + location.search);
    showLogin();
  } catch (err) {
    toast(err.message);
  } finally {
    button.disabled = false;
  }
});

$("studentProfileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!$("studentProfileForm").reportValidity()) return;
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
  const closedStatuses = ["Selected", "Offer Accepted", "Offer Declined", "Rejected", "Withdrawn"];
  const activeCount = apps.filter(a => !closedStatuses.includes(a.status)).length;
  const selectedCount = apps.filter(a => ["Selected", "Offer Accepted"].includes(a.status)).length;
  $("pipelineSummary").innerHTML = `
    <div class="pipeline-stat"><strong>${apps.length}</strong><span>Total applications</span></div>
    <div class="pipeline-stat"><strong>${activeCount}</strong><span>In progress</span></div>
    <div class="pipeline-stat"><strong>${selectedCount}</strong><span>Offers</span></div>
  `;
  $("studentApplications").innerHTML = apps.length ? apps.map(a => {
    const stages = ["Applied", "Screening", "Assessment", "Interviews", "Decision"];
    const status = a.status;
    const rejected = ["Rejected", "Withdrawn", "Offer Declined"].includes(status);
    const selected = ["Selected", "Offer Accepted"].includes(status);
    const stageIndex = status === "Applied" ? 0
      : ["Under Review", "Shortlisted"].includes(status) ? 1
      : status === "Aptitude Test" ? 2
      : ["Technical Interview", "HR Interview"].includes(status) ? 3
      : selected ? 4 : 1;
    const completedStages = rejected ? 1 : stageIndex;
    const appliedDate = new Date(`${a.applied_at.replace(" ", "T")}Z`);
    const formattedDate = Number.isNaN(appliedDate.getTime())
      ? escapeHtml(a.applied_at)
      : escapeHtml(appliedDate.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }));
    return `
      <article class="pipeline-card">
        <div class="pipeline-card-heading">
          <div>
            <span class="company">${escapeHtml(a.company_name)}</span>
            <h3>${escapeHtml(a.title)}</h3>
          </div>
          <span class="pipeline-status ${rejected ? "rejected" : selected ? "selected" : ""}">${escapeHtml(status)}</span>
        </div>
        <p class="muted pipeline-date">Applied ${formattedDate}</p>
        ${rejected
          ? `<div class="pipeline-rejected">This application has been closed.</div>`
          : `<ol class="pipeline-stages">${stages.map((stage, index) => `
            <li class="${index < completedStages ? "complete" : ""} ${index === completedStages ? "current" : ""}">
              <span class="stage-marker">${index < completedStages ? "✓" : index + 1}</span>
              <span>${stage}</span>
            </li>
          `).join("")}</ol>`}
      </article>
    `;
  }).join("") : `
    <div class="empty pipeline-empty">
      You have not applied to any jobs yet. <a href="#dashboard" data-student-page="dashboard">Browse approved openings</a> to get started.
    </div>
  `;
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
  const selectedDepartments = [...document.querySelectorAll('input[name="jDepartment"]:checked')].map(input => input.value);
  $("departmentError").textContent = selectedDepartments.length ? "" : "Select at least one eligible branch.";
  if (!$("jobForm").reportValidity() || !selectedDepartments.length) return;
  try {
    await api("/api/company/jobs", {
      method: "POST",
      body: JSON.stringify({
        title: $("jTitle").value,
        description: $("jDescription").value,
        min_cgpa: $("jCgpa").value,
        allowed_departments: selectedDepartments.join(","),
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
  recruiterJobs = await api("/api/company/jobs");
  $("recruiterJobs").innerHTML = recruiterJobs.length ? recruiterJobs.map(j => `
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

  recruiterApplications = await api("/api/company/applications");
  for (const id of selectedApplicantIds) {
    if (!recruiterApplications.some(app => app.id === id)) selectedApplicantIds.delete(id);
  }
  renderApplicantFilters();
  renderApplicants();
}

function renderApplicantFilters() {
  const jobFilter = $("applicantJobFilter");
  const selectedJob = jobFilter.value;
  jobFilter.innerHTML = `<option value="">All openings</option>${recruiterJobs.map(job =>
    `<option value="${job.id}">${escapeHtml(job.title)}</option>`
  ).join("")}`;
  if (recruiterJobs.some(job => String(job.id) === selectedJob)) jobFilter.value = selectedJob;

  const branchFilter = $("applicantBranchFilter");
  const selectedBranch = branchFilter.value;
  const availableBranches = [...new Set(recruiterApplications.map(app => app.branch))].sort();
  branchFilter.innerHTML = `<option value="">All branches</option>${availableBranches.map(branch =>
    `<option value="${escapeAttr(branch)}">${escapeHtml(branch)}</option>`
  ).join("")}`;
  if (availableBranches.includes(selectedBranch)) branchFilter.value = selectedBranch;
}

function renderApplicants() {
  const jobId = $("applicantJobFilter").value;
  const branch = $("applicantBranchFilter").value;
  const filtered = recruiterApplications.filter(app =>
    (!jobId || String(app.job_id) === jobId) && (!branch || app.branch === branch)
  );
  const visibleIds = filtered.map(app => app.id);
  $("applicants").innerHTML = filtered.length ? filtered.map(app => `
    <article class="applicant-card">
      <div class="applicant-card-heading">
        <label class="applicant-select-label"><input class="applicant-select" type="checkbox" value="${app.id}" ${selectedApplicantIds.has(app.id) ? "checked" : ""}> Select applicant</label>
        <div><h3>${escapeHtml(app.student_name)}</h3><span class="muted">${escapeHtml(app.email)}</span></div>
        <span class="pill">${escapeHtml(app.title)}</span>
      </div>
      <div class="applicant-profile">
        <div><span class="muted">Branch</span><strong>${escapeHtml(app.branch)}</strong></div>
        <div><span class="muted">CGPA</span><strong>${escapeHtml(app.cgpa)}</strong></div>
        <div><span class="muted">Graduation</span><strong>${escapeHtml(app.graduation_year)}</strong></div>
        <div><span class="muted">Resume</span>${app.resume_link
          ? `<a href="${escapeAttr(app.resume_link)}" target="_blank" rel="noreferrer">View profile</a>`
          : `<strong>Not provided</strong>`}</div>
      </div>
      <label class="applicant-status">Application status
        <select onchange="updateApplication(${app.id}, this.value)">
          ${applicationStatuses.map(status =>
            `<option ${status === app.status ? "selected" : ""}>${status}</option>`
          ).join("")}
        </select>
      </label>
    </article>
  `).join("") : `<div class="empty">${recruiterApplications.length ? "No applicants match these filters." : "No applications yet."}</div>`;
  document.querySelectorAll(".applicant-select").forEach(input => {
    input.addEventListener("change", () => {
      const id = Number(input.value);
      if (input.checked) selectedApplicantIds.add(id);
      else selectedApplicantIds.delete(id);
      updateBulkToolbar(visibleIds);
    });
  });
  updateBulkToolbar(visibleIds);
}

["applicantJobFilter", "applicantBranchFilter"].forEach(id => {
  $(id).addEventListener("change", renderApplicants);
});

function updateBulkToolbar(visibleIds) {
  const selectAll = $("selectAllApplicants");
  const visibleSelected = visibleIds.filter(id => selectedApplicantIds.has(id)).length;
  selectAll.checked = visibleIds.length > 0 && visibleSelected === visibleIds.length;
  selectAll.indeterminate = visibleSelected > 0 && visibleSelected < visibleIds.length;
  $("selectedApplicantCount").textContent = `${selectedApplicantIds.size} selected`;
  $("applyBulkStatus").disabled = selectedApplicantIds.size === 0 || !$("bulkApplicantStatus").value;
}

$("selectAllApplicants").addEventListener("change", () => {
  const jobId = $("applicantJobFilter").value;
  const branch = $("applicantBranchFilter").value;
  const visible = recruiterApplications.filter(app =>
    (!jobId || String(app.job_id) === jobId) && (!branch || app.branch === branch)
  );
  visible.forEach(app => {
    if ($("selectAllApplicants").checked) selectedApplicantIds.add(app.id);
    else selectedApplicantIds.delete(app.id);
  });
  renderApplicants();
});

$("bulkApplicantStatus").addEventListener("change", () => {
  const visibleIds = [...document.querySelectorAll(".applicant-select")].map(input => Number(input.value));
  updateBulkToolbar(visibleIds);
});

$("applyBulkStatus").addEventListener("click", async () => {
  const ids = [...selectedApplicantIds];
  const status = $("bulkApplicantStatus").value;
  if (!ids.length || !status) return;
  $("applyBulkStatus").disabled = true;
  try {
    const result = await api("/api/company/applications/bulk-status", {
      method: "PUT",
      body: JSON.stringify({ ids, status })
    });
    selectedApplicantIds.clear();
    $("bulkApplicantStatus").value = "";
    toast(`${result.updated} applicant statuses updated`);
    await loadRecruiter();
  } catch (err) {
    toast(err.message);
    updateBulkToolbar([...document.querySelectorAll(".applicant-select")].map(input => Number(input.value)));
  }
});

async function updateApplication(id, status) {
  try {
    await api(`/api/company/applications/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status })
    });
    toast("Candidate status updated");
    await loadRecruiter();
  } catch (err) {
    toast(err.message);
    await loadRecruiter();
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
