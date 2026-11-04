
# AI Automation Job Pipeline

A personal job discovery, matching, and application-tracking platform focused on AI automation, workflow engineering, n8n development, API integrations, AI agents, and related engineering roles.

The application collects listings from configured job sources, filters and scores opportunities, records matching jobs in Google Sheets, and provides a dashboard for reviewing and tracking applications.

## Features

- **Job discovery:** Collects listings from configured company career pages, supported applicant-tracking systems, and job feeds.
- **Broad role coverage:** Targets AI automation, workflow engineering, n8n, API integration, LLM applications, AI agents, and relevant entry-level and internship opportunities.
- **Eligibility filtering:** Applies configured country and remote-work rules.
- **Duplicate prevention:** Removes duplicate job links and previously known listings.
- **Keyword-based matching:** Scores job titles and descriptions against configured role and skill keywords.
- **Google Sheets integration:** Stores job records and application statuses.
- **Dashboard:** Reviews job matches, filters by status, opens application links, and tracks progress.
- **Application kit:** Provides configured personal details and saved answers for copying into application forms.
- **CV selection:** Associates relevant roles with the configured AI automation CV.
- **Application tracking:** Tracks approvals, manual applications, submitted applications, interviews, and follow-up activity.
- **Email application support:** Can send an application email with a CV attached when the relevant feature is configured and approved.
- **Error visibility:** Uses application logs and error handling to help identify failed operations.

## Target job categories

The initial configuration focuses on roles such as:

- AI Automation Engineer
- AI Automation Specialist
- Workflow Automation Engineer
- Workflow Engineer
- n8n Developer
- n8n Automation Engineer
- Automation & Integrations Engineer
- API Integration Engineer
- Business Process Automation Engineer
- AI Agent Engineer
- LLM Application Engineer
- AI Solutions Engineer
- AI Implementation Engineer
- AI Specialist
- AI Engineer
- AI Automation Intern
- AI Intern
- Workflow Automation Intern
- Automation Intern
- AI Agent Intern
- Graduate AI Engineer
- Junior Automation Engineer

The matching system also recognizes relevant skills such as REST APIs, webhooks, OpenAI APIs, structured outputs, tool calling, LangChain, CRM integrations, retries, error handling, and audit trails.

This title list helps identify relevant roles, but it does not guarantee that every job is discovered. Job discovery depends on the configured sources and their available listings.

## How it works

The application follows this general workflow:

1. Fetch jobs from configured sources.
2. Filter jobs according to eligibility and location rules.
3. Remove duplicates.
4. Score job titles and descriptions against relevant skills.
5. Select the configured CV category.
6. Write qualifying new jobs to Google Sheets.
7. Review and manage opportunities through the dashboard.
8. Record application outcomes and follow-up activity.

The matching engine uses keyword-based rules. Scores are an initial relevance estimate, not a guarantee that a candidate meets every job requirement. Review each job description before applying.

## Technology stack

- Node.js
- Next.js
- React
- JavaScript
- Google Sheets API
- Google Drive API
- Nodemailer
- RSS Parser
- Git and GitHub
- pnpm

## Project structure

```text
My-job-pipeline/
├── app/
│   ├── api/
│   │   ├── approve/
│   │   ├── clear/
│   │   ├── format/
│   │   ├── jobs/
│   │   ├── kit/
│   │   ├── resume/
│   │   └── run/
│   ├── globals.css
│   ├── layout.js
│   └── page.js
├── config/
│   ├── applyKit.json
│   ├── companies.json
│   ├── countries.json
│   └── cvMapping.json
├── lib/
│   ├── fetchers/
│   ├── autoApply.js
│   ├── emailApply.js
│   ├── filters.js
│   ├── linkedin.js
│   ├── mailer.js
│   ├── pipeline.js
│   ├── scorer.js
│   └── sheets.js
├── credentials/          # Local secrets; never commit
├── resumes/              # Private CV files; never commit
├── scripts/
├── tests/
├── .env.local.example
├── .gitignore
├── package.json
└── README.md
```

## Requirements

- Node.js compatible with the project's Next.js version.
- pnpm.
- A Google account and Google Cloud project.
- A Google spreadsheet.
- A Google service account with access to that spreadsheet.
- SMTP credentials if email functionality is required.

## Local setup

### 1. Install dependencies

Clone your private repository and open a terminal in the project directory.

Install the dependencies using the existing lockfile:

```powershell
pnpm install --frozen-lockfile
```

### 2. Create the environment file

Copy the example configuration:

```powershell
Copy-Item .env.local.example .env.local
```

Open `.env.local` and configure the values required by your environment.

Never commit this file.

### 3. Configure Google Sheets

Create a Google Cloud project and enable the Google Sheets API. Enable the Google Drive API if required by the configured operations.

Create a service account and a JSON key. Store the key locally inside the ignored `credentials/` directory.

Configure these values in `.env.local`:

```dotenv
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=C:/path/to/credentials/service-account.json
GOOGLE_SPREADSHEET_ID=YOUR_SPREADSHEET_ID
GOOGLE_SHEET_TAB=Sheet1
```

Replace the example path and spreadsheet ID with your actual values.

Share the spreadsheet with the service account's email address and grant it Editor access.

Do not publish the spreadsheet or expose the private key.

### 4. Configure email

Email functionality uses SMTP. If needed, configure these settings in `.env.local`:

```dotenv
SMTP_EMAIL=
SMTP_APP_PASSWORD=
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
DIGEST_RECIPIENT_EMAIL=
```

For Gmail, use an appropriately configured App Password rather than your ordinary Google account password.

Keep email sending disabled until the application has been tested with your own information and CV.

### 5. Configure your application profile

Edit `config/applyKit.json` to define your profile, saved application answers, and role-specific summary.

Replace every `EDIT ME` placeholder with accurate information before using the application kit.

Do not include unsupported claims about skills, experience, qualifications, or results.

### 6. Add your CV

The initial CV category is:

```text
ai_automation
```

The configured filename is:

```text
ai_automation_engineer.pdf
```

Place your own PDF at:

```text
resumes/ai_automation_engineer.pdf
```

The `resumes/` directory is excluded from Git. Do not commit your CV to the public repository or include it in a shared source-code archive.

### 7. Start the dashboard

Run:

```powershell
pnpm dev
```

Open:

http://localhost:3000

Keep the terminal running while using the local dashboard.

The dashboard requires a functioning Google Sheets configuration to load job records. An empty sheet may correctly return an empty job list.

## Useful commands

Run the test suite:

```powershell
pnpm test
```

Start the development server:

```powershell
pnpm dev
```

Create a production build:

```powershell
pnpm build
```

Run the configured job pipeline:

```powershell
pnpm run pipeline
```

**Only run the pipeline after reviewing the configuration and confirming that the intended external actions are safe.**

Check configured companies:

```powershell
pnpm run check-companies
```

The available commands are defined in `package.json`.

## Configuration reference

### `config/companies.json`

Defines the companies checked by the configured company-career-page fetchers.

### `config/countries.json`

Defines the countries and eligibility rules used by the location filter.

### `config/cvMapping.json`

Defines the CV category, its filename, and title and skill keywords used for CV selection.

### `config/applyKit.json`

Stores the profile fields, saved answers, and role-specific summary used by the application kit.

### `lib/scorer.js`

Scores discovered listings according to their titles, descriptions, and configured skill keywords. It also selects the CV category.

### `lib/filters.js`

Handles eligibility filtering, remote-work classification, and duplicate removal.

### `lib/fetchers/`

Contains the source-specific job collection implementations.

## Application workflow

The dashboard allows you to inspect jobs, review the match score, open the original listing, and manage application status.

For supported email-application listings, the application can attach the configured CV and send a short application message. Confirm the recipient address and review the application details before sending.

Web-form applications remain manual. The application kit is intended to make those forms easier to complete; it does not guarantee or automatically submit every application form.

## Safety and security

- Keep `.env.local` out of Git.
- Keep the `credentials/` and `resumes/` directories out of Git.
- Never commit service-account keys, SMTP passwords, or API tokens.
- Use a private repository for personal configuration and private project files.
- Do not share a real CV or personal application answers through public issues or pull requests.
- Keep automatic email sending disabled while testing.
- Verify an application recipient before sending a CV.
- Do not assume a detected email address is the correct recruitment address.
- Use appropriate dashboard authentication and HTTPS or a secure SSH tunnel when accessing a remote deployment.
- Keep destructive operations disabled unless explicitly required.
- Review the job description and required qualifications before applying.

## Known limitations

- Job coverage depends on the configured sources and the listings they expose.
- Keyword matching can produce false positives and false negatives.
- Country and remote-work classification is rule-based.
- The scorer does not independently verify job requirements or candidate qualifications.
- Salary information may not be available for every listing.
- Some application email addresses may be incorrectly detected and require manual verification.
- Most job application web forms cannot be submitted by this application and must be completed manually.
- A successful build or test run does not guarantee that every external integration is configured correctly.

## Development status

This repository is being adapted for a personal AI automation and engineering job search.

Before using it for real applications, verify:

1. Google Sheets connectivity.
2. Job-source coverage and eligibility filtering.
3. Match scoring for AI automation, integrations, and internship roles.
4. CV selection and download behavior.
5. Dashboard status updates.
6. Email configuration and recipient verification.
7. Application approval and failure handling.
8. Test suite and production build results.

The platform should only be used for applications that accurately represent the candidate's skills, qualifications, and experience.
