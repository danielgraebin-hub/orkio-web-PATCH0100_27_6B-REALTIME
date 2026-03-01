const express = require("express");
const path = require("path");

const app = express();
const distDir = path.join(__dirname, "dist");


function cleanEnv(v) {
  if (v === undefined || v === null) return "";
  let s = String(v).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}


// Single /env.js handler — injects runtime env into the browser
app.get("/health", (_req, res) => res.status(200).send("ok"));

app.get("/env.js", (_req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  const env = {
    // API base URL: try all known variable names
    VITE_API_BASE_URL: (cleanEnv(process.env.VITE_API_BASE_URL) || cleanEnv(process.env.API_BASE_URL) || cleanEnv(process.env.VITE_API_URL) || "").replace(/\/$/, ""),
    DEFAULT_TENANT: cleanEnv(process.env.VITE_DEFAULT_TENANT) || cleanEnv(process.env.DEFAULT_TENANT) || "public",
    APP_ENV: cleanEnv(process.env.VITE_APP_ENV) || cleanEnv(process.env.APP_ENV) || "production",
    ENABLE_COSTS: String(cleanEnv(process.env.VITE_ENABLE_COSTS) || "true"),
    ENABLE_APPROVALS: String(cleanEnv(process.env.VITE_ENABLE_APPROVALS) || "true"),
    ENABLE_UPLOADS: String(cleanEnv(process.env.VITE_ENABLE_UPLOADS) || "true"),
    APP_NAME: cleanEnv(process.env.VITE_APP_NAME) || "Orkio",
    SUPPORT_EMAIL: cleanEnv(process.env.VITE_SUPPORT_EMAIL) || "",
    WHATSAPP_PHONE_E164: (cleanEnv(process.env.VITE_WHATSAPP_PHONE_E164) || cleanEnv(process.env.WHATSAPP_PHONE_E164) || "").replace(/\D/g,""),
  };

  res.send(`window.__ORKIO_ENV__=${JSON.stringify(env)};`);
});

app.use(express.static(distDir, { index: false }));

app.get("*", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`[orkio-web] listening on ${port}`);
});
