# Campus Placement & Internship Portal

A beginner-friendly three-tier, role-based campus recruitment portal built for the AWS Student Builder Group Web Development project.

## Features

### Student Applicant
- Login with a demo account
- Manage profile: branch, CGPA, graduation year and resume link
- Browse approved job openings
- Server-side eligibility checking
- Apply to eligible jobs
- Track application status

### Company Recruiter
- Create/update company profile
- Create job postings with minimum CGPA and allowed departments
- View applicants
- Update application status

### Placement Cell Admin
- Approve/reject companies
- Approve/reject job postings
- View administrative audit logs with timestamps and reviewer IDs

## Tech Stack

- Node.js + Express
- SQLite using better-sqlite3
- HTML, CSS and vanilla JavaScript
- Express sessions
- bcryptjs password hashing

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Student | student@example.com | student123 |
| Recruiter | recruiter@example.com | recruiter123 |
| Admin | admin@example.com | admin123 |

## Local Setup

1. Install Node.js 18 or newer.
2. Open this project folder in VS Code.
3. Run:

```bash
npm install
npm start
```

4. Open http://localhost:3000

The SQLite database is created and seeded automatically on first run.

## Important Notes

- This is a demonstration/recruitment project, not a production deployment.
- The database is intentionally local and is ignored by Git.
- Eligibility is checked on the server, not only in the browser.
- Admin approval is required before companies/jobs become visible to students.

## Suggested GitHub Submission

Create a public repository named `campus-placement-portal`, upload all project files except `node_modules`, and submit the repository URL.

Example:

```text
https://github.com/YOUR-USERNAME/campus-placement-portal
```
