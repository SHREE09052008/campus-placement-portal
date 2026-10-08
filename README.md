# Campus Placement & Internship Portal

A beginner-friendly three-tier, role-based campus recruitment portal built for the AWS Student Builder Group Web Development project.

## Features

### Student Applicant
- Register as a student or sign in
- Manage profile on a dedicated page with selectable branch, CGPA, graduation year and resume link
- Browse approved job openings
- Server-side eligibility checking
- Apply to eligible jobs
- Track application status in a dedicated application pipeline

### Company Recruiter
- Register as a recruiter and manage a separate company profile
- Create job postings with minimum CGPA and allowed departments
- Filter applicants by opening and branch
- Update individual or selected applicants in batches through screening, interview, offer and rejection stages

### Placement Cell Admin
- Approve/reject companies
- Approve/reject job postings
- View administrative audit logs with timestamps and reviewer IDs
- Admin accounts are not available through public registration

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

The SQLite database is created and seeded automatically on first run. New students provide their branch, CGPA and graduation year during registration; recruiters can complete their company profile after signing up.

## Important Notes

- This is a demonstration/recruitment project, not a production deployment.
- The database is intentionally local and is ignored by Git.
- Eligibility is checked on the server, not only in the browser.
- Admin approval is required before companies/jobs become visible to students.

