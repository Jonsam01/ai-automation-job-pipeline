
import nodemailer from "nodemailer";
import fs from "node:fs";
import path from "node:path";

import {
  shouldDispatchApplicationEmails,
} from "./pipelineRules.js";

const RESUMES_DIR = path.join(process.cwd(), "resumes");

const ALLOWED_RESUME_FILES = new Set([
  "ai_automation_engineer.pdf",
]);

const MAX_RESUME_BYTES = 10 * 1024 * 1024;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanSingleLine(value, fallback = "") {
  const cleaned = String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim();

  return cleaned || fallback;
}

// --------------------------------------------------
// EMAIL CONFIGURATION
// --------------------------------------------------

function isEmailConfigured() {
  return Boolean(
    process.env.SMTP_EMAIL &&
    process.env.SMTP_APP_PASSWORD &&
    EMAIL_RE.test(process.env.SMTP_EMAIL.trim()),
  );
}

function getTransport() {
  const configuredPort = Number(
    process.env.SMTP_PORT || 587,
  );

  const port =
    Number.isInteger(configuredPort) &&
      configuredPort > 0 &&
      configuredPort <= 65535
      ? configuredPort
      : 587;

  return nodemailer.createTransport({
    host: process.env.SMTP_SERVER || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_APP_PASSWORD,
    },
  });
}

// --------------------------------------------------
// RESUME VALIDATION
// --------------------------------------------------

function readValidatedResume(resumeFile) {
  if (
    typeof resumeFile !== "string" ||
    !ALLOWED_RESUME_FILES.has(resumeFile)
  ) {
    console.warn(
      "[autoApply] Missing or unapproved resume filename.",
    );

    return null;
  }

  try {
    // Do not allow a symbolic link in the resume directory.
    const resumeDirectory = fs.realpathSync(RESUMES_DIR);
    const resumePath = path.join(
      resumeDirectory,
      resumeFile,
    );

    const stat = fs.lstatSync(resumePath);

    if (!stat.isFile() || stat.isSymbolicLink()) {
      console.warn(
        "[autoApply] Resume must be a regular file.",
      );

      return null;
    }

    if (
      stat.size <= 5 ||
      stat.size > MAX_RESUME_BYTES
    ) {
      console.warn(
        "[autoApply] Resume has an invalid or excessive file size.",
      );

      return null;
    }

    const resolvedPath = fs.realpathSync(resumePath);

    if (path.dirname(resolvedPath) !== resumeDirectory) {
      console.warn(
        "[autoApply] Resume path is outside the approved directory.",
      );

      return null;
    }

    // Read once and attach the validated buffer to avoid a later
    // file replacement between validation and sending.
    const content = fs.readFileSync(resolvedPath);

    if (content.subarray(0, 5).toString("ascii") !== "%PDF-") {
      console.warn(
        "[autoApply] Resume does not have a valid PDF signature.",
      );

      return null;
    }

    return content;
  } catch {
    console.warn(
      "[autoApply] Resume file is missing or cannot be accessed.",
    );

    return null;
  }
}

// --------------------------------------------------
// APPLICATION EMAIL CONTENT
// --------------------------------------------------

function createApplicationNote({
  roleTitle,
  company,
  name,
  linkedin,
  github,
  portfolio,
}) {
  const contactDetails = [
    linkedin ? `LinkedIn: ${linkedin}` : "",
    github ? `GitHub: ${github}` : "",
    portfolio ? `Portfolio: ${portfolio}` : "",
  ].filter(Boolean);

  return [
    "Hi,",
    "",
    `I'm applying for the ${roleTitle} role at ${company}. I've attached my resume for your consideration.`,
    "",
    "I'd welcome the opportunity to discuss how my experience and projects may fit your team's needs.",
    "",
    "Best,",
    name,
    ...contactDetails,
    "",
  ].join("\n");
}

// --------------------------------------------------
// APPLICATION SENDER
// --------------------------------------------------

export async function sendApplication(job, recipientEmail) {
  // Independent safety check at the actual sending function.
  if (
    !shouldDispatchApplicationEmails({
      enableOutboundEmails:
        process.env.ENABLE_OUTBOUND_EMAILS === "true",
      autoSendEmails:
        process.env.AUTO_SEND_EMAILS === "true",
    })
  ) {
    console.warn(
      "[autoApply] Application sending is disabled. No email sent.",
    );

    return false;
  }

  const roleTitle = cleanSingleLine(
    job?.title,
    "the role",
  );

  const company = cleanSingleLine(
    job?.company,
    "the hiring team",
  );

  const recipient = cleanSingleLine(recipientEmail);

  if (!EMAIL_RE.test(recipient)) {
    console.warn(
      `[autoApply] Invalid application email address; skipping ${company}.`,
    );

    return false;
  }

  // Validate the CV filename and actual PDF content.
  const resumeContent = readValidatedResume(
    job?.resumeFile,
  );

  if (!resumeContent) {
    console.warn(
      `[autoApply] No valid approved resume available; skipping ${company}.`,
    );

    return false;
  }

  // Reject missing or placeholder names.
  const name = cleanSingleLine(
    process.env.YOUR_NAME,
  );

  if (!name || /^EDIT ME\b/i.test(name)) {
    console.warn(
      "[autoApply] YOUR_NAME is not configured. No application was sent.",
    );

    return false;
  }

  // Validate SMTP credentials.
  if (!isEmailConfigured()) {
    console.warn(
      "[autoApply] SMTP credentials are missing or invalid. No application was sent.",
    );

    return false;
  }

  if (!process.env.SMTP_APP_PASSWORD) {
    return false;
  }

  const linkedin = cleanSingleLine(
    process.env.YOUR_LINKEDIN,
  );

  const github = cleanSingleLine(
    process.env.YOUR_GITHUB,
  );

  const portfolio = cleanSingleLine(
    process.env.YOUR_PORTFOLIO,
  );

  const text = createApplicationNote({
    roleTitle,
    company,
    name,
    linkedin,
    github,
    portfolio,
  });

  let transport;

  try {
    transport = getTransport();

    await transport.sendMail({
      from: process.env.SMTP_EMAIL,
      to: recipient,
      subject: `Application: ${roleTitle} - ${name}`,
      text,
      attachments: [
        {
          filename: job.resumeFile,
          content: resumeContent,
          contentType: "application/pdf",
        },
      ],
    });

    console.log(
      `[autoApply] Application email sent for ${company}.`,
    );

    return true;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.warn(
      `[autoApply] Failed to send application for ${company}: ${message}`,
    );

    return false;
  } finally {
    if (transport) {
      transport.close();
    }
  }
}
