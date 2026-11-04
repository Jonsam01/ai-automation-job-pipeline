
import nodemailer from "nodemailer";

import { linkedinLinks } from "./linkedin.js";

import {
  shouldSendOutboundEmails,
} from "./pipelineRules.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --------------------------------------------------
// HTML AND URL SAFETY
// --------------------------------------------------

export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };

      return entities[character];
    },
  );
}

export function safeHttpUrl(value) {
  const input = String(value || "").trim();

  if (!input) return null;

  try {
    const url = new URL(input);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

// --------------------------------------------------
// SMTP CONFIGURATION
// --------------------------------------------------

function getEmailConfig() {
  const sender = String(
    process.env.SMTP_EMAIL || "",
  ).trim();

  const password = String(
    process.env.SMTP_APP_PASSWORD || "",
  );

  const recipient = String(
    process.env.DIGEST_RECIPIENT_EMAIL ||
    process.env.SMTP_EMAIL ||
    "",
  ).trim();

  if (
    !sender ||
    !password ||
    !EMAIL_RE.test(sender) ||
    !EMAIL_RE.test(recipient)
  ) {
    return null;
  }

  const configuredPort = Number(
    process.env.SMTP_PORT || 587,
  );

  const port =
    Number.isInteger(configuredPort) &&
      configuredPort > 0 &&
      configuredPort <= 65535
      ? configuredPort
      : 587;

  return {
    sender,
    password,
    recipient,
    host: process.env.SMTP_SERVER || "smtp.gmail.com",
    port,
  };
}

function getTransport(config) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.sender,
      pass: config.password,
    },
  });
}

// --------------------------------------------------
// GENERIC EMAIL SENDER
// --------------------------------------------------

async function send(subject, html) {
  // Independent master-switch check inside the actual mail sender.
  if (
    !shouldSendOutboundEmails({
      enableOutboundEmails:
        process.env.ENABLE_OUTBOUND_EMAILS === "true",
    })
  ) {
    console.warn(
      `[mailer] Email sending disabled. Skipped: ${subject}`,
    );

    return false;
  }

  const config = getEmailConfig();

  if (!config) {
    console.warn(
      `[mailer] SMTP or recipient configuration is missing or invalid. Skipped: ${subject}`,
    );

    return false;
  }

  let transport;

  try {
    transport = getTransport(config);

    await transport.sendMail({
      from: config.sender,
      to: config.recipient,
      subject: String(subject).replace(/[\r\n]+/g, " ").trim(),
      html,
    });

    console.log(
      `[mailer] Sent: ${subject}`,
    );

    return true;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.warn(
      `[mailer] FAILED to send '${subject}': ${message}`,
    );

    return false;
  } finally {
    if (transport) {
      transport.close();
    }
  }
}

// --------------------------------------------------
// JOB ROW HTML
// --------------------------------------------------

function jobRowHtml(job) {
  const company = String(
    job.Company || job.company || "",
  );

  const title = String(
    job["Role Title"] || job.title || "",
  );

  const location = String(
    job["Country/Remote"] || job.location || "",
  );

  const score =
    job["Match Score"] ??
    job.matchScore ??
    "?";

  const cv =
    job["CV Version Used"] ||
    job.cvVersion ||
    "";

  const employmentType =
    job["Employment Type"] ||
    job.employmentType ||
    "Unknown";

  const applicationLink = safeHttpUrl(
    job.Link || job.link,
  );

  const links = linkedinLinks(company);

  const safeCompanyLink = safeHttpUrl(links.company);
  const safeRecruiterLink = safeHttpUrl(links.recruiters);
  const safeEngineerLink = safeHttpUrl(links.engineers);

  const applicationLinkHtml = applicationLink
    ? `<a href="${escapeHtml(applicationLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(applicationLink)}</a>`
    : "No valid application link provided";

  const linkedinHtml = [
    safeCompanyLink
      ? `<a href="${escapeHtml(safeCompanyLink)}">Company</a>`
      : "",
    safeRecruiterLink
      ? `<a href="${escapeHtml(safeRecruiterLink)}">Recruiters</a>`
      : "",
    safeEngineerLink
      ? `<a href="${escapeHtml(safeEngineerLink)}">Engineers</a>`
      : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">
        <strong>${escapeHtml(title)}</strong><br>
        <span style="color:#555;">
          ${escapeHtml(company)}, ${escapeHtml(location)}
        </span><br>
        <span style="color:#777;font-size:13px;">
          Match: ${escapeHtml(score)}/100 |
          CV: ${escapeHtml(cv)} |
          Type: ${escapeHtml(employmentType)}
        </span><br>
        ${applicationLinkHtml}<br>
        <span style="font-size:13px;">
          LinkedIn: ${linkedinHtml}
        </span>
      </td>
    </tr>
  `;
}

// --------------------------------------------------
// DAILY DIGEST
// --------------------------------------------------

export async function sendDailyDigest({
  needsApproval = [],
  needsManualApply = [],
  autoAppliedToday = [],
} = {}) {
  const sections = [];

  if (autoAppliedToday.length) {
    sections.push(`
      <h2 style="color:#1f2a54;">
        Auto-Applied Today (${autoAppliedToday.length})
      </h2>
      <table style="width:100%;border-collapse:collapse;">
        ${autoAppliedToday.map(jobRowHtml).join("")}
      </table>
    `);
  }

  if (needsManualApply.length) {
    sections.push(`
      <h2 style="color:#1f2a54;">
        Needs Your Action: Manual Apply (${needsManualApply.length})
      </h2>
      <p style="color:#555;">
        These jobs require you to complete the application manually.
      </p>
      <table style="width:100%;border-collapse:collapse;">
        ${needsManualApply.map(jobRowHtml).join("")}
      </table>
    `);
  }

  if (needsApproval.length) {
    sections.push(`
      <h2 style="color:#1f2a54;">
        New Matches Awaiting Your Approval (${needsApproval.length})
      </h2>
      <p style="color:#555;">
        Review these opportunities in your job dashboard.
      </p>
      <table style="width:100%;border-collapse:collapse;">
        ${needsApproval.map(jobRowHtml).join("")}
      </table>
    `);
  }

  if (!sections.length) {
    sections.push(
      "<p>No new matches, manual-apply items, or auto-applications today.</p>",
    );
  }

  const total =
    needsApproval.length +
    needsManualApply.length +
    autoAppliedToday.length;

  const html = `
    <html>
      <body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
        <h1 style="color:#1f2a54;">
          Your Job Search Digest
        </h1>

        ${sections.join("")}

        <p style="color:#999;font-size:12px;margin-top:30px;">
          Generated automatically. Review and manage your opportunities
          in your job tracker.
        </p>
      </body>
    </html>
  `;

  return send(
    `Job Search Digest: ${total} items today`,
    html,
  );
}

// --------------------------------------------------
// FOLLOW-UP REMINDER
// --------------------------------------------------

export async function sendFollowUpReminder(dueJobs = []) {
  if (!Array.isArray(dueJobs) || dueJobs.length === 0) {
    return true;
  }

  const html = `
    <html>
      <body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
        <h1 style="color:#1f2a54;">
          Follow-Up Reminders (${dueJobs.length})
        </h1>

        <p>
          These applications are due for a follow-up based on their
          scheduled follow-up dates.
        </p>

        <table style="width:100%;border-collapse:collapse;">
          ${dueJobs.map(jobRowHtml).join("")}
        </table>
      </body>
    </html>
  `;

  return send(
    `Follow-Up Reminders: ${dueJobs.length} applications`,
    html,
  );
}
