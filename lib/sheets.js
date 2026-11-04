
// sheets.js
// All reads/writes to the "Job Applications Tracker" Google Sheet.
// Every other part of the pipeline imports this rather than calling the
// Sheets API directly.
//
// Requires in .env.local (or the host's environment variables):
//   GOOGLE_SPREADSHEET_ID=the-id-from-your-sheet-url
//   GOOGLE_SHEET_TAB=Sheet1   (optional, defaults to Sheet1)
// and ONE of these for the service account key:
//   GOOGLE_SERVICE_ACCOUNT_KEY_PATH=/path/to/key.json
//   GOOGLE_SERVICE_ACCOUNT_JSON={...the key as one line...}

import { google } from "googleapis";

const COLUMNS = [
  // Original columns: retain their existing order.
  "Date Found",
  "Company",
  "Role Title",
  "Employment Type",
  "Country/Remote",
  "Est. Salary",
  "Match Score",
  "CV Version Used",
  "Link",
  "Submission Method",
  "Status",
  "Follow-up Date",
  "Notes",

  // Eligibility and review columns.
  "Candidate Country",
  "Location Eligibility Status",
  "Eligibility Reason",
  "Location Restricted",
  "Location Review Required",
  "Work Authorisation Review Required",
  "CV Selection Review Required",
];

export const STATUS = {
  NEW: "New",
  AWAITING_APPROVAL: "Awaiting Your Approval",
  APPROVED: "Approved",
  APPLIED: "Applied",
  APPLIED_AUTO: "Applied (Auto)",
  NEEDS_MANUAL: "Needs Manual Apply",
  FOLLOWUP_SENT: "Follow-up Sent",
  INTERVIEW: "Interview",
  REJECTED: "Rejected",
  NO_RESPONSE: "No Response",
};

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

const SHEET_READ_RANGE = "A:ZZ";

let cachedClient = null;

function getConfig() {
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const tab = process.env.GOOGLE_SHEET_TAB || "Sheet1";

  if ((!keyFile && !keyJson) || !spreadsheetId) {
    throw new Error(
      "Set GOOGLE_SPREADSHEET_ID and either " +
      "GOOGLE_SERVICE_ACCOUNT_KEY_PATH or GOOGLE_SERVICE_ACCOUNT_JSON",
    );
  }

  return { keyFile, keyJson, spreadsheetId, tab };
}

async function getClient() {
  if (cachedClient) return cachedClient;

  const { keyFile, keyJson } = getConfig();

  const auth = new google.auth.GoogleAuth(
    keyJson
      ? { credentials: JSON.parse(keyJson), scopes: SCOPES }
      : { keyFile, scopes: SCOPES },
  );

  const authClient = await auth.getClient();

  cachedClient = google.sheets({
    version: "v4",
    auth: authClient,
  });

  return cachedClient;
}

function columnNumberToLetter(columnNumber) {
  let result = "";
  let number = columnNumber;

  while (number > 0) {
    const remainder = (number - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    number = Math.floor((number - 1) / 26);
  }

  return result;
}

function rowsToObjects(rows) {
  if (!rows || rows.length === 0) return [];

  const [header, ...dataRows] = rows;

  return dataRows.map((row, index) => {
    const obj = { _row: index + 2 };

    header.forEach((columnName, columnIndex) => {
      if (!columnName) return;

      obj[columnName] = row[columnIndex] ?? "";
    });

    return obj;
  });
}

function normalizeBooleanCell(value) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  const normalized = String(value).trim().toLowerCase();

  if (["true", "yes", "1"].includes(normalized)) {
    return true;
  }

  if (["false", "no", "0"].includes(normalized)) {
    return false;
  }

  return "";
}

function jobToRow(job, today, headers) {
  const values = {
    "Date Found": today,
    Company: job.company || "",
    "Role Title": job.roleTitle || "",
    "Employment Type": job.employmentType || "",
    "Country/Remote": job.countryRemote || "",
    "Est. Salary": job.estSalary || "",
    "Match Score": job.matchScore ?? "",
    "CV Version Used": job.cvVersion || "",
    Link: job.link || "",
    "Submission Method": job.submissionMethod || "",
    Status: job.status || STATUS.AWAITING_APPROVAL,
    "Follow-up Date": "",
    Notes: job.notes || "",

    "Candidate Country": job.candidateCountry || "",
    "Location Eligibility Status": job.locationEligibilityStatus || "",
    "Eligibility Reason": job.eligibilityReason || "",
    "Location Restricted": normalizeBooleanCell(job.locationRestricted),
    "Location Review Required": normalizeBooleanCell(
      job.locationReviewRequired,
    ),
    "Work Authorisation Review Required": normalizeBooleanCell(
      job.workAuthorizationReviewRequired,
    ),
    "CV Selection Review Required": normalizeBooleanCell(
      job.cvSelectionReviewRequired ?? job.needsManualReview,
    ),
  };

  // Build the row using the actual spreadsheet header order.
  // This preserves any additional columns already present in the sheet.
  return headers.map((header) => values[header] ?? "");
}

async function readHeader(sheets, spreadsheetId, tab) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A1:ZZ1`,
  });

  return response.data.values?.[0] || [];
}

// Ensures all required columns exist without deleting or reordering
// existing columns. New required columns are appended to the right.
export async function ensureHeader() {
  const sheets = await getClient();
  const { spreadsheetId, tab } = getConfig();

  const existingHeaders = await readHeader(
    sheets,
    spreadsheetId,
    tab,
  );

  if (existingHeaders.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [COLUMNS],
      },
    });

    return [...COLUMNS];
  }

  const headers = [...existingHeaders];
  const missingColumns = COLUMNS.filter(
    (column) => !headers.includes(column),
  );

  if (missingColumns.length > 0) {
    headers.push(...missingColumns);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [headers],
      },
    });
  }

  return headers;
}

async function getCurrentHeaders() {
  const sheets = await getClient();
  const { spreadsheetId, tab } = getConfig();

  const headers = await readHeader(sheets, spreadsheetId, tab);

  if (headers.length === 0) {
    throw new Error(
      `The "${tab}" sheet has no header row. Run ensureHeader() first.`,
    );
  }

  return headers;
}

function getRequiredColumnIndex(headers, columnName) {
  const index = headers.indexOf(columnName);

  if (index === -1) {
    throw new Error(
      `Required spreadsheet column "${columnName}" was not found.`,
    );
  }

  return index;
}

// Adds a single job row.
export async function addJob(job) {
  const sheets = await getClient();
  const { spreadsheetId, tab } = getConfig();
  const headers = await ensureHeader();

  const today = new Date().toISOString().slice(0, 10);

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [jobToRow(job, today, headers)],
    },
  });

  return response.data.updates?.updatedRange || null;
}

// Adds many jobs in ONE API call.
export async function addJobs(jobs) {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return;
  }

  const sheets = await getClient();
  const { spreadsheetId, tab } = getConfig();
  const headers = await ensureHeader();

  const today = new Date().toISOString().slice(0, 10);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: jobs.map((job) => jobToRow(job, today, headers)),
    },
  });
}

export async function getAllJobs() {
  const sheets = await getClient();
  const { spreadsheetId, tab } = getConfig();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!${SHEET_READ_RANGE}`,
  });

  return rowsToObjects(response.data.values || []);
}

export async function getJobsByStatus(status) {
  const all = await getAllJobs();

  return all.filter((job) => job.Status === status);
}

// Reads the sheet and returns every link already tracked.
export async function getExistingLinks() {
  const all = await getAllJobs();

  return new Set(
    all
      .map((job) => job.Link)
      .filter(Boolean),
  );
}

export async function updateStatus(rowNumber, newStatus) {
  const sheets = await getClient();
  const { spreadsheetId, tab } = getConfig();
  const headers = await getCurrentHeaders();

  const columnIndex = getRequiredColumnIndex(headers, "Status");
  const columnLetter = columnNumberToLetter(columnIndex + 1);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tab}!${columnLetter}${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[newStatus]],
    },
  });
}

export async function setFollowUpDate(rowNumber, daysFromNow = 7) {
  const sheets = await getClient();
  const { spreadsheetId, tab } = getConfig();
  const headers = await getCurrentHeaders();

  const columnIndex = getRequiredColumnIndex(
    headers,
    "Follow-up Date",
  );

  const columnLetter = columnNumberToLetter(columnIndex + 1);

  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);

  const dateString = date.toISOString().slice(0, 10);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tab}!${columnLetter}${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[dateString]],
    },
  });
}

export async function getDueFollowUps() {
  const today = new Date().toISOString().slice(0, 10);

  const closed = new Set([
    STATUS.REJECTED,
    STATUS.FOLLOWUP_SENT,
  ]);

  const all = await getAllJobs();

  return all.filter((job) => {
    const followUpDate = job["Follow-up Date"];

    return (
      followUpDate &&
      followUpDate <= today &&
      !closed.has(job.Status)
    );
  });
}

// Deletes every job row but keeps the header row.
export async function clearAllJobs() {
  const sheets = await getClient();
  const { spreadsheetId, tab } = getConfig();

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${tab}!A2:ZZ`,
  });
}

// One-time styling. Existing conditional-format rules are not removed.
export async function formatSheet() {
  const sheets = await getClient();
  const { spreadsheetId, tab } = getConfig();

  const headers = await ensureHeader();

  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
  });

  const sheet = metadata.data.sheets.find(
    (item) => item.properties.title === tab,
  );

  if (!sheet) {
    throw new Error(`Tab "${tab}" not found`);
  }

  const sheetId = sheet.properties.sheetId;

  const widthsByHeader = {
    "Date Found": 100,
    Company: 160,
    "Role Title": 300,
    "Employment Type": 130,
    "Country/Remote": 180,
    "Est. Salary": 110,
    "Match Score": 100,
    "CV Version Used": 150,
    Link: 280,
    "Submission Method": 150,
    Status: 180,
    "Follow-up Date": 120,
    Notes: 300,
    "Candidate Country": 130,
    "Location Eligibility Status": 200,
    "Eligibility Reason": 400,
    "Location Restricted": 140,
    "Location Review Required": 170,
    "Work Authorisation Review Required": 220,
    "CV Selection Review Required": 190,
  };

  const statusColumnIndex = getRequiredColumnIndex(
    headers,
    "Status",
  );

  const statusRule = (text, color) => ({
    addConditionalFormatRule: {
      index: 0,
      rule: {
        ranges: [
          {
            sheetId,
            startRowIndex: 1,
            startColumnIndex: statusColumnIndex,
            endColumnIndex: statusColumnIndex + 1,
          },
        ],
        booleanRule: {
          condition: {
            type: "TEXT_EQ",
            values: [{ userEnteredValue: text }],
          },
          format: {
            backgroundColor: color,
          },
        },
      },
    },
  });

  const requests = [
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: {
            frozenRowCount: 1,
          },
        },
        fields: "gridProperties.frozenRowCount",
      },
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: {
              red: 0.12,
              green: 0.16,
              blue: 0.33,
            },
            textFormat: {
              bold: true,
              foregroundColor: {
                red: 1,
                green: 1,
                blue: 1,
              },
            },
            verticalAlignment: "MIDDLE",
          },
        },
        fields:
          "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)",
      },
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            wrapStrategy: "CLIP",
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(wrapStrategy,verticalAlignment)",
      },
    },
    ...headers.map((header, index) => {
      const width = widthsByHeader[header];

      if (!width) return null;

      return {
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: "COLUMNS",
            startIndex: index,
            endIndex: index + 1,
          },
          properties: {
            pixelSize: width,
          },
          fields: "pixelSize",
        },
      };
    }).filter(Boolean),
    statusRule("Awaiting Your Approval", {
      red: 1,
      green: 0.95,
      blue: 0.8,
    }),
    statusRule("Approved", {
      red: 0.85,
      green: 0.91,
      blue: 1,
    }),
    statusRule("Applied", {
      red: 0.85,
      green: 0.95,
      blue: 0.87,
    }),
    statusRule("Applied (Auto)", {
      red: 0.85,
      green: 0.95,
      blue: 0.87,
    }),
    statusRule("Needs Manual Apply", {
      red: 1,
      green: 0.9,
      blue: 0.8,
    }),
    statusRule("Interview", {
      red: 0.93,
      green: 0.88,
      blue: 1,
    }),
    statusRule("Rejected", {
      red: 0.98,
      green: 0.85,
      blue: 0.85,
    }),
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests,
    },
  });
}
