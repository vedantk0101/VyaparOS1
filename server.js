
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const PORT = 3001;
const HOST = "127.0.0.1";

const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const MODEL = "llama3.2:1b";

const ROOT = path.resolve("workspace-data");
const FILES_DIR = path.join(ROOT, "files");
const MEMORY_FILE = path.join(ROOT, "memory.json");
const APPROVALS_FILE = path.join(ROOT, "approvals.json");

const MAX_BODY_SIZE = 1_000_000;
const MAX_FILE_SIZE = 500_000;
const MAX_BROWSER_TEXT = 30_000;

const SYSTEM_PROMPT = `
You are Vyapar AI, an intelligent and professional assistant inside VyaparOS.

ANSWER QUALITY:
- Answer the complete question accurately.
- Give complete explanations in clear, simple English.
- Include important steps, requirements and precautions.
- For procedures, use numbered steps in the correct order.
- Explain technical terms briefly when needed.
- Be concise for simple questions and detailed for complex questions.
- Never invent facts, official rules, fees, deadlines or business records.
- If uncertain about a current government rule, say it should be verified on the official portal.

GOVERNMENT SERVICE GUIDANCE:
- Explain GST, ITR, passport and Aadhaar processes before asking whether the user wants the official portal opened.
- Never claim to have submitted an application, return or payment.
- Never claim to have opened a website unless the application actually does so.
- The frontend handles permission before opening official portals.

BUSINESS DATA:
- Do not pretend to have access to real invoices, customers, bank transactions or employee records.
- Workspace files and memory are available only when the backend tools are explicitly used.
- Never invent business information.
`;

const ALLOWED_BROWSER_HOSTS = [
  "gst.gov.in",
  "www.gst.gov.in",
  "incometax.gov.in",
  "www.incometax.gov.in",
  "passportindia.gov.in",
  "www.passportindia.gov.in",
  "uidai.gov.in",
  "www.uidai.gov.in",
  "mca.gov.in",
  "www.mca.gov.in",
  "rbi.org.in",
  "www.rbi.org.in"
];

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || "";

  const allowedOrigin =
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (origin && !allowedOrigin) {
    return send(res, 403, { error: "Origin not allowed." });
  }

  try {
    await initializeWorkspace();

    const requestUrl = new URL(req.url, `http://${HOST}:${PORT}`);
    const route = requestUrl.pathname;

    if (req.method === "GET" && route === "/api/health") {
      return send(res, 200, {
        status: "online",
        model: MODEL,
        workspace: "ready"
      });
    }

    // EXISTING AI CHAT API

    if (req.method === "POST" && route === "/api/chat") {
      const data = await readBody(req);

      if (!Array.isArray(data.messages) || !data.messages.length) {
        return send(res, 400, { error: "Please enter a message." });
      }

      const messages = data.messages
        .filter(message =>
          ["user", "assistant"].includes(message.role) &&
          typeof message.content === "string"
        )
        .slice(-10)
        .map(message => ({
          role: message.role,
          content: message.content.slice(0, 5000)
        }));

      if (
        !messages.length ||
        messages[messages.length - 1].role !== "user"
      ) {
        return send(res, 400, { error: "Invalid conversation." });
      }

      const ollamaResponse = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(120000),
        body: JSON.stringify({
          model: MODEL,
          stream: false,
          keep_alive: "15m",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages
          ],
          options: {
            temperature: 0.35,
            num_predict: 700,
            num_ctx: 4096,
            top_k: 30,
            repeat_penalty: 1.1
          }
        })
      });

      if (!ollamaResponse.ok) {
        throw new Error("Ollama could not generate a response.");
      }

      const result = await ollamaResponse.json();
      const reply = result.message?.content?.trim();

      if (!reply) {
        throw new Error("Ollama returned an empty response.");
      }

      return send(res, 200, { reply, model: MODEL });
    }

    // WORKSPACE STATUS

    if (req.method === "GET" && route === "/api/workspace/status") {
      const files = await listWorkspaceFiles();

      const memory = await readJsonFile(MEMORY_FILE, []);
      const approvals = await readJsonFile(APPROVALS_FILE, []);

      return send(res, 200, {
        status: "ready",
        name: "VyaparOS AI Employee Workspace",
        directories: {
          root: ROOT,
          files: FILES_DIR
        },
        fileCount: files.length,
        memoryCount: memory.length,
        pendingApprovals: approvals.filter(
          item => item.status === "pending"
        ).length,
        tools: {
          files: true,
          memory: true,
          browser: true,
          restrictedTerminal: true,
          approvals: true
        }
      });
    }

    // WORKSPACE FILES: LIST

    if (req.method === "GET" && route === "/api/workspace/files") {
      return send(res, 200, {
        files: await listWorkspaceFiles()
      });
    }

    // WORKSPACE FILES: READ

    if (req.method === "GET" && route === "/api/workspace/files/read") {
      const relativePath = requestUrl.searchParams.get("path");

      if (!relativePath) {
        return send(res, 400, { error: "File path is required." });
      }

      const filePath = safeWorkspacePath(relativePath);
      const stat = await fs.stat(filePath);

      if (!stat.isFile()) {
        return send(res, 400, { error: "That path is not a file." });
      }

      if (stat.size > MAX_FILE_SIZE) {
        return send(res, 413, { error: "File is too large to read." });
      }

      const content = await fs.readFile(filePath, "utf8");

      return send(res, 200, {
        path: relativePath,
        content
      });
    }

    // WORKSPACE FILES: CREATE OR UPDATE

    if (req.method === "POST" && route === "/api/workspace/files") {
      const data = await readBody(req);

      if (
        typeof data.path !== "string" ||
        typeof data.content !== "string"
      ) {
        return send(res, 400, {
          error: "A file path and text content are required."
        });
      }

      if (Buffer.byteLength(data.content, "utf8") > MAX_FILE_SIZE) {
        return send(res, 413, { error: "File content is too large." });
      }

      const filePath = safeWorkspacePath(data.path);

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, data.content, "utf8");

      return send(res, 201, {
        success: true,
        path: path.relative(FILES_DIR, filePath).replaceAll("\\", "/")
      });
    }

    // BUSINESS MEMORY: READ

    if (req.method === "GET" && route === "/api/workspace/memory") {
      return send(res, 200, {
        memory: await readJsonFile(MEMORY_FILE, [])
      });
    }

    // BUSINESS MEMORY: SAVE

    if (req.method === "POST" && route === "/api/workspace/memory") {
      const data = await readBody(req);

      if (
        typeof data.text !== "string" ||
        !data.text.trim()
      ) {
        return send(res, 400, { error: "Memory text is required." });
      }

      if (data.text.length > 5000) {
        return send(res, 400, { error: "Memory entry is too long." });
      }

      const memory = await readJsonFile(MEMORY_FILE, []);

      const entry = {
        id: crypto.randomUUID(),
        text: data.text.trim(),
        createdAt: new Date().toISOString()
      };

      memory.push(entry);

      await writeJsonFile(MEMORY_FILE, memory);

      return send(res, 201, {
        success: true,
        entry
      });
    }

    // RESTRICTED TERMINAL
    // This is NOT a Windows shell or PowerShell.

    if (req.method === "POST" && route === "/api/workspace/terminal") {
      const data = await readBody(req);
      const command = String(data.command || "").trim();

      let output = "";

      switch (command.toLowerCase()) {
        case "help":
          output = [
            "VyaparOS Restricted Terminal",
            "",
            "Available commands:",
            "help  - Show available commands",
            "date  - Show current date and time",
            "pwd   - Show workspace directory",
            "ls    - List workspace files",
            "clear - Clear terminal output"
          ].join("\n");
          break;

        case "date":
          output = new Date().toString();
          break;

        case "pwd":
          output = ROOT;
          break;

        case "ls":
          output = (await listWorkspaceFiles()).join("\n") || "No files found.";
          break;

        case "clear":
          output = "";
          break;

        default:
          return send(res, 400, {
            error: "Command not allowed. Type help to see available commands."
          });
      }

      return send(res, 200, {
        success: true,
        command,
        output
      });
    }

    // CONTROLLED PUBLIC WEB RESEARCH

    if (req.method === "POST" && route === "/api/workspace/browser") {
      const data = await readBody(req);

      let target;

      try {
        target = new URL(data.url);
      } catch {
        return send(res, 400, { error: "Please provide a valid URL." });
      }

      if (
        target.protocol !== "https:" ||
        target.username ||
        target.password ||
        !isAllowedBrowserHost(target.hostname)
      ) {
        return send(res, 403, {
          error: "This website is not in the approved browsing list."
        });
      }

      const page = await fetchApprovedPage(target);

      return send(res, 200, {
        success: true,
        url: page.url,
        contentType: page.contentType,
        title: page.title,
        text: page.text
      });
    }

    // APPROVALS: LIST

    if (req.method === "GET" && route === "/api/workspace/approvals") {
      return send(res, 200, {
        approvals: await readJsonFile(APPROVALS_FILE, [])
      });
    }

    // APPROVALS: CREATE REQUEST

    if (req.method === "POST" && route === "/api/workspace/approvals") {
      const data = await readBody(req);

      if (
        typeof data.action !== "string" ||
        !data.action.trim()
      ) {
        return send(res, 400, { error: "Approval action is required." });
      }

      const approvals = await readJsonFile(APPROVALS_FILE, []);

      const approval = {
        id: crypto.randomUUID(),
        action: data.action.trim().slice(0, 500),
        details: String(data.details || "").slice(0, 3000),
        status: "pending",
        createdAt: new Date().toISOString(),
        reviewedAt: null
      };

      approvals.push(approval);
      await writeJsonFile(APPROVALS_FILE, approvals);

      return send(res, 201, {
        success: true,
        approval
      });
    }

    // APPROVALS: REVIEW
    // Reviewing a request does not execute the requested action.

    if (
      req.method === "PATCH" &&
      route.startsWith("/api/workspace/approvals/")
    ) {
      const id = route.split("/").pop();
      const data = await readBody(req);

      if (!["approved", "rejected"].includes(data.status)) {
        return send(res, 400, {
          error: "Status must be approved or rejected."
        });
      }

      const approvals = await readJsonFile(APPROVALS_FILE, []);
      const approval = approvals.find(item => item.id === id);

      if (!approval) {
        return send(res, 404, { error: "Approval request not found." });
      }

      if (approval.status !== "pending") {
        return send(res, 409, {
          error: "This approval has already been reviewed."
        });
      }

      approval.status = data.status;
      approval.reviewedAt = new Date().toISOString();

      await writeJsonFile(APPROVALS_FILE, approvals);

      return send(res, 200, {
        success: true,
        approval,
        executed: false
      });
    }

    return send(res, 404, { error: "Endpoint not found." });

  } catch (error) {
    console.error("VyaparOS backend error:", error);

    const status =
      error.code === "ENOENT" ? 404 :
      error.code === "ENOTFOUND" ? 502 :
      error.name === "AbortError" || error.name === "TimeoutError" ? 504 :
      500;

    return send(res, status, {
      error: error.message || "Backend service unavailable."
    });
  }
});

// ------------------------------
// HELPER FUNCTIONS
// ------------------------------

function send(res, status, data) {
  if (res.writableEnded) return;

  res.writeHead(status);
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let body = "";

  for await (const chunk of req) {
    body += chunk;

    if (Buffer.byteLength(body, "utf8") > MAX_BODY_SIZE) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
  }

  try {
    return JSON.parse(body || "{}");
  } catch {
    const error = new Error("Invalid JSON request.");
    error.statusCode = 400;
    throw error;
  }
}

async function initializeWorkspace() {
  await fs.mkdir(FILES_DIR, { recursive: true });

  try {
    await fs.access(MEMORY_FILE);
  } catch {
    await writeJsonFile(MEMORY_FILE, []);
  }

  try {
    await fs.access(APPROVALS_FILE);
  } catch {
    await writeJsonFile(APPROVALS_FILE, []);
  }
}

async function readJsonFile(filePath, fallback) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(content);

    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath, data) {
  await fs.writeFile(
    filePath,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

function safeWorkspacePath(relativePath) {
  if (
    typeof relativePath !== "string" ||
    !relativePath.trim() ||
    relativePath.includes("\0") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error("Invalid workspace file path.");
  }

  const normalized = relativePath.replaceAll("\\", "/");
  const destination = path.resolve(FILES_DIR, normalized);

  if (
    destination !== FILES_DIR &&
    !destination.startsWith(FILES_DIR + path.sep)
  ) {
    throw new Error("Access outside the workspace is not allowed.");
  }

  return destination;
}

async function listWorkspaceFiles(directory = FILES_DIR, prefix = "") {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;

    const relative = prefix
      ? `${prefix}/${entry.name}`
      : entry.name;

    if (entry.isDirectory()) {
      results.push(
        ...(await listWorkspaceFiles(
          path.join(directory, entry.name),
          relative
        ))
      );
    } else if (entry.isFile()) {
      results.push(relative);
    }
  }

  return results;
}

function isAllowedBrowserHost(hostname) {
  return ALLOWED_BROWSER_HOSTS.some(
    host => hostname === host || hostname.endsWith("." + host)
  );
}

async function fetchApprovedPage(initialUrl) {
  let currentUrl = initialUrl;

  for (let attempt = 0; attempt < 4; attempt++) {
    if (
      currentUrl.protocol !== "https:" ||
      !isAllowedBrowserHost(currentUrl.hostname) ||
      currentUrl.username ||
      currentUrl.password
    ) {
      throw new Error("Redirect to an unapproved website blocked.");
    }

    const response = await fetch(currentUrl, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent": "VyaparOS-Workspace/1.0",
        "Accept": "text/html,text/plain,application/xhtml+xml"
      }
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");

      if (!location) {
        throw new Error("Website returned an invalid redirect.");
      }

      currentUrl = new URL(location, currentUrl);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Website returned HTTP ${response.status}.`);
    }

    const contentType = response.headers.get("content-type") || "";

    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      throw new Error("Only HTML and plain-text pages are supported.");
    }

    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      total += value.length;

      if (total > 500_000) {
        await reader.cancel();
        throw new Error("Web page is too large to process.");
      }

      chunks.push(value);
    }

    const html = Buffer.concat(chunks).toString("utf8");

    const title =
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
        ?.replace(/<[^>]*>/g, "")
        ?.trim() || "Untitled page";

    const text = html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_BROWSER_TEXT);

    return {
      url: currentUrl.toString(),
      contentType,
      title,
      text
    };
  }

  throw new Error("Too many website redirects.");
}

server.listen(PORT, HOST, () => {
  console.log("======================================");
  console.log("          VYAPAROS BACKEND");
  console.log("======================================");
  console.log(`Backend: http://${HOST}:${PORT}`);
  console.log(`Model: ${MODEL}`);
  console.log("Workspace: Ready");
  console.log("Chat API: Ready");
  console.log("Workspace APIs: Ready");
  console.log("Restricted terminal: Enabled");
  console.log("======================================");
});
