#!/usr/bin/env node
/**
 * Descall — Render / Supabase ortam değişkeni kurulum sihirbazı
 * Kullanım: node scripts/setup-render-env.mjs
 */
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rl = readline.createInterface({ input, output });

function isValidSupabaseUrl(url) {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url.trim());
}

function isValidJwt(secret) {
  return secret.trim().length >= 32;
}

async function ask(question, { hidden = false, defaultValue = "" } = {}) {
  if (hidden && !input.isTTY) {
    hidden = false;
  }
  if (hidden && input.isTTY) {
    process.stdout.write(question);
    const chunks = [];
    input.setRawMode?.(true);
    return new Promise((resolve) => {
      const onData = (buf) => {
        const char = buf.toString();
        if (char === "\n" || char === "\r" || char === "\u0004") {
          input.setRawMode?.(false);
          input.removeListener("data", onData);
          process.stdout.write("\n");
          resolve(chunks.join("").trim() || defaultValue);
        } else if (char === "\u0003") {
          process.exit(1);
        } else if (char === "\u007f") {
          chunks.pop();
        } else {
          chunks.push(char);
        }
      };
      input.on("data", onData);
    });
  }
  const answer = await rl.question(defaultValue ? `${question} [${defaultValue}]: ` : question);
  return (answer.trim() || defaultValue).trim();
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║     Descall — Supabase & Render Kurulum          ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
  console.log("Supabase değerlerini buradan al:");
  console.log("  https://supabase.com/dashboard → Projen → Settings → API\n");
  console.log("  • Project URL        → SUPABASE_URL");
  console.log("  • service_role key   → SUPABASE_SERVICE_ROLE_KEY");
  console.log("    (anon public key KULLANMA — sadece service_role)\n");

  let supabaseUrl = "";
  while (!isValidSupabaseUrl(supabaseUrl)) {
    supabaseUrl = await ask("SUPABASE_URL (https://xxx.supabase.co): ");
    if (!isValidSupabaseUrl(supabaseUrl)) {
      console.log("  ⚠ Geçersiz URL. Örnek: https://abcdefgh.supabase.co\n");
    }
  }

  let serviceRoleKey = "";
  while (!serviceRoleKey || serviceRoleKey.length < 20) {
    serviceRoleKey = await ask("SUPABASE_SERVICE_ROLE_KEY: ", { hidden: true });
    if (!serviceRoleKey || serviceRoleKey.length < 20) {
      console.log("  ⚠ service_role key çok kısa veya boş.\n");
    }
  }

  const autoJwt = (await ask("JWT_SECRET otomatik üretilsin mi? [E/h]: ", { defaultValue: "E" }))
    .toLowerCase();
  let jwtSecret = autoJwt === "h" || autoJwt === "hayir" || autoJwt === "n"
    ? ""
    : crypto.randomBytes(32).toString("hex");

  if (!jwtSecret) {
    while (!isValidJwt(jwtSecret)) {
      jwtSecret = await ask("JWT_SECRET (min 32 karakter): ", { hidden: true });
      if (!isValidJwt(jwtSecret)) {
        console.log("  ⚠ JWT_SECRET en az 32 karakter olmalı.\n");
      }
    }
  }

  const envContent = [
    "# Descall — Render Environment",
    `SUPABASE_URL=${supabaseUrl}`,
    `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`,
    `JWT_SECRET=${jwtSecret}`,
    "JWT_EXPIRES_IN=7d",
    "VITE_API_BASE_URL=https://des-call.onrender.com",
    "PORT=3000",
    "NODE_VERSION=20",
    "ALLOW_ALL_ORIGINS=true",
    "",
  ].join("\n");

  const outPath = path.join(__dirname, "..", "render.env");
  fs.writeFileSync(outPath, envContent, { mode: 0o600 });

  console.log("\n✅ render.env dosyası oluşturuldu (gitignore'da — commit edilmez)\n");
  console.log("─── Render Dashboard'a yapıştır ───");
  console.log("  1. https://dashboard.render.com → des-call servisi");
  console.log("  2. Environment → Add from .env");
  console.log("  3. render.env içeriğini yapıştır → Save & Deploy\n");
  console.log(envContent.replace(serviceRoleKey, serviceRoleKey.slice(0, 12) + "...[GİZLİ]"));
  console.log("\n─── Yerel geliştirme için ───");
  console.log("  frontend/.env dosyasına aynı SUPABASE_* ve JWT_* değerlerini kopyala.\n");

  await rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
