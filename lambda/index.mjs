// APAH 250 — upload handler
// Node.js 20.x Lambda. Zero npm dependencies (uses built-in crypto + fetch).
//
// Required environment variables:
//   UPLOAD_PASSWORD              — password the frontend must send
//   GOOGLE_SERVICE_ACCOUNT_JSON  — full service-account JSON (one line, escaped)
//
// AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN are
// injected automatically by the Lambda runtime from the execution role.
// The role needs s3:PutObject on the target bucket.

import { createSign, createHash, createHmac } from "node:crypto";
import { Buffer } from "node:buffer";

// ----- Config -----
const BUCKET = "image-gosting";
const REGION = "us-east-1";
const PREFIX = "web_apah-250/";
const SPREADSHEET_ID = "1Cuc04IRdPS_3ULZJD_IH1cNcGVEbdwFYLfA4vzpvCnY";
const SHEET_NAME = "database";
// Numeric sheet id for the "database" tab. The default first tab is 0.
// If you renamed/moved the tab, override via SHEET_GID env var.
const SHEET_GID = parseInt(process.env.SHEET_GID || "0", 10);
const SRC_COLUMN_INDEX = 4; // E (0-indexed: the=0, name=1, details=2, blurb=3, src=4)
const NUMBER_COLUMN = "A";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// ----- Lambda entrypoint -----
export const handler = async (event) => {
  const method =
    event.requestContext?.http?.method || event.httpMethod || "POST";
  // The AWS Function URL handles OPTIONS preflight automatically when CORS
  // is configured, so the Lambda is not normally invoked for OPTIONS. This
  // branch is just a safety fallback if CORS is ever turned off.
  if (method === "OPTIONS") {
    return { statusCode: 204, body: "" };
  }
  if (method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    let body = event.body;
    if (event.isBase64Encoded) body = Buffer.from(body, "base64").toString();
    const { password, number, image, contentType } = JSON.parse(body || "{}");

    if (!process.env.UPLOAD_PASSWORD) {
      return json(500, { error: "Server missing UPLOAD_PASSWORD env var" });
    }
    if (password !== process.env.UPLOAD_PASSWORD) {
      return json(401, { error: "Wrong password" });
    }

    const num = parseInt(number, 10);
    if (Number.isNaN(num) || num < 1 || num > 250) {
      return json(400, { error: "Invalid artwork number" });
    }
    if (!image || typeof image !== "string") {
      return json(400, { error: "Missing image data" });
    }

    const bytes = Buffer.from(image, "base64");
    if (bytes.length === 0) return json(400, { error: "Empty image" });
    if (bytes.length > MAX_BYTES) {
      return json(413, { error: "Image too large (max 10MB)" });
    }

    const safeContentType = sanitizeContentType(contentType);
    const ext = extFromContentType(safeContentType);
    const key = `${PREFIX}${String(num).padStart(3, "0")}.${ext}`;

    const url = await putToS3({
      key,
      body: bytes,
      contentType: safeContentType,
    });

    const accessToken = await getGoogleAccessToken();
    const sheetRow = await findRowForNumber(accessToken, num);
    if (sheetRow === -1) {
      return json(404, { error: `Artwork ${num} not found in sheet` });
    }
    // Write the URL as plain text but color the cell's text #1155cc.
    await writeStyledSrcCell(accessToken, sheetRow, url);

    return json(200, { success: true, url });
  } catch (err) {
    console.error("Upload failed:", err);
    return json(500, { error: err.message || "Internal error" });
  }
};

// ----- Helpers -----
// NOTE: CORS headers are added automatically by the AWS Function URL when
// CORS is configured in the console. We do NOT add them here — doing so
// produces duplicate Access-Control-Allow-Origin headers, which browsers
// reject (the request appears as "Failed to fetch" in DevTools).
function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function sanitizeContentType(ct) {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"];
  if (typeof ct === "string" && allowed.includes(ct.toLowerCase())) {
    return ct.toLowerCase() === "image/jpg" ? "image/jpeg" : ct.toLowerCase();
  }
  return "image/jpeg";
}

function extFromContentType(ct) {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" }[ct] || "jpg";
}

// ----- S3 PUT with AWS Signature V4 -----
async function putToS3({ key, body, contentType }) {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Missing AWS credentials in Lambda environment");
  }

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const datestamp = amzDate.slice(0, 8);
  const host = `${BUCKET}.s3.${REGION}.amazonaws.com`;
  const canonicalUri =
    "/" + key.split("/").map(encodeURIComponent).join("/");
  const payloadHash = sha256Hex(body);

  // No x-amz-acl header — modern buckets block public ACLs. Public read
  // comes from the bucket policy, not per-object ACL.
  const headers = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    "content-type": contentType,
  };
  if (sessionToken) headers["x-amz-security-token"] = sessionToken;

  const sortedKeys = Object.keys(headers).sort();
  const canonicalHeaders =
    sortedKeys.map((h) => `${h}:${headers[h]}\n`).join("");
  const signedHeaders = sortedKeys.join(";");

  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${datestamp}/${REGION}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${secretAccessKey}`, datestamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`https://${host}${canonicalUri}`, {
    method: "PUT",
    headers: { ...headers, authorization },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`S3 PUT ${res.status}: ${text.slice(0, 500)}`);
  }
  return `https://${host}${canonicalUri}`;
}

function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key, msg) {
  return createHmac("sha256", key).update(msg).digest();
}

// ----- Google Sheets (service-account JWT auth) -----
async function getGoogleAccessToken() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON env var");
  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(sa.private_key, "base64url");
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Google token exchange failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

function b64url(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function findRowForNumber(accessToken, num) {
  const range = `${SHEET_NAME}!${NUMBER_COLUMN}:${NUMBER_COLUMN}`;
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}` +
    `/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Sheets read ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const values = data.values || [];
  const target = String(num);
  for (let i = 1; i < values.length; i++) {
    if (values[i] && values[i][0] === target) {
      return i + 1; // 1-indexed sheet row
    }
  }
  return -1;
}

// Writes the URL into the src cell as plain text AND sets the cell's text
// color to #1155cc, all in one batchUpdate call. Uses GridRange (numeric
// sheetId + row/column indices) which is required by updateCells.
async function writeStyledSrcCell(accessToken, sheetRow, url) {
  const apiUrl =
    `https://sheets.googleapis.com/v4/spreadsheets/` +
    `${SPREADSHEET_ID}:batchUpdate`;
  const body = {
    requests: [
      {
        updateCells: {
          range: {
            sheetId: SHEET_GID,
            startRowIndex: sheetRow - 1,
            endRowIndex: sheetRow,
            startColumnIndex: SRC_COLUMN_INDEX,
            endColumnIndex: SRC_COLUMN_INDEX + 1,
          },
          rows: [
            {
              values: [
                {
                  userEnteredValue: { stringValue: url },
                  userEnteredFormat: {
                    textFormat: {
                      foregroundColor: {
                        red: 0x11 / 255,
                        green: 0x55 / 255,
                        blue: 0xcc / 255,
                      },
                    },
                  },
                },
              ],
            },
          ],
          fields:
            "userEnteredValue,userEnteredFormat.textFormat.foregroundColor",
        },
      },
    ],
  };
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Sheets batchUpdate ${res.status}: ${await res.text()}`);
  }
}
