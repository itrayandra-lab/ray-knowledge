const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const baseUrl = process.env.RAY_AUDIT_URL || "http://localhost:8766";
const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);
const chromePath = chromeCandidates.find((candidate) => fs.existsSync(candidate));
if (!chromePath) throw new Error("Google Chrome tidak ditemukan untuk audit render.");

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

class CdpClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`CDP connection timeout: ${this.url}`)), 10000);
      this.socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      this.socket.addEventListener("error", (event) => {
        clearTimeout(timer);
        reject(event.error || new Error(`CDP connection failed: ${this.url}`));
      }, { once: true });
    });
    this.socket.addEventListener("message", async (event) => {
      const raw = typeof event.data === "string" ? event.data : await event.data.text();
      const message = JSON.parse(raw);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject, timer } = this.pending.get(message.id);
      clearTimeout(timer);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(`${message.error.message}: ${JSON.stringify(message.error.data || {})}`));
      else resolve(message.result || {});
    });
  }

  send(method, params = {}, timeout = 10000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timeout: ${method}`));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || "Browser evaluation failed");
    return response.result?.value;
  }

  close() {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.close();
  }
}

function loadCatalog() {
  const context = { window: {} };
  vm.createContext(context);
  for (const filename of ["public/assets/data.js", "public/assets/inovasi-data.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, filename), "utf8"), context, { filename });
  }
  return context.window.RAY_KNOWLEDGE;
}

async function waitForDevTools(profileDirectory) {
  const activePortFile = path.join(profileDirectory, "DevToolsActivePort");
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (fs.existsSync(activePortFile)) {
      const [port, socketPath] = fs.readFileSync(activePortFile, "utf8").trim().split(/\r?\n/);
      if (port && socketPath) return { port, browserUrl: `ws://127.0.0.1:${port}${socketPath}` };
    }
    await delay(100);
  }
  throw new Error("Chrome DevTools endpoint tidak aktif.");
}

async function findPageSocket(port, targetId) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
    const target = targets.find((item) => item.id === targetId);
    if (target?.webSocketDebuggerUrl) return target.webSocketDebuggerUrl;
    await delay(100);
  }
  throw new Error(`Target browser tidak ditemukan: ${targetId}`);
}

async function waitForRendered(page, kind, expectedName) {
  const selector = kind === "product" ? ".product-info-copy" : ".brand-overview";
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const state = await page.evaluate(`(() => {
      const root = document.querySelector(${JSON.stringify(selector)});
      return {
        ready: document.readyState,
        found: Boolean(root),
        heading: root?.querySelector("h1")?.textContent?.trim() || "",
      };
    })()`);
    if (state?.ready === "complete" && state.found) return state;
    await delay(50);
  }
  throw new Error(`${kind} tidak selesai dirender: ${expectedName}`);
}

async function audit() {
  const catalog = loadCatalog();
  const products = catalog.brands.flatMap((brand) =>
    (brand.products || []).map((product) => ({ ...product, expectedBrand: brand.title })),
  );
  const profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ray-route-audit-"));
  const browserProcess = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-component-update",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDirectory}`,
    "about:blank",
  ], { stdio: "ignore", windowsHide: true });

  let browser;
  let page;
  try {
    const { port, browserUrl } = await waitForDevTools(profileDirectory);
    browser = new CdpClient(browserUrl);
    await browser.connect();
    const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
    page = new CdpClient(await findPageSocket(port, targetId));
    await page.connect();
    await page.send("Page.enable");
    await page.send("Runtime.enable");

    const bannedPattern = "belum dicantumkan|unique value belum|dokumen sumber|materi sumber|penjelasan lengkap untuk sales|pembeda yang perlu ditekankan oleh sales|masih dalam proses revisi";
    const errors = [];

    for (const product of products) {
      const url = `${baseUrl}/#/product/${encodeURIComponent(product.id)}`;
      await page.send("Page.navigate", { url });
      await waitForRendered(page, "product", product.name);
      const result = await page.evaluate(`(() => {
        const info = document.querySelector(".product-info-copy");
        const text = document.body.innerText;
        const tabs = [...document.querySelectorAll("[data-product-tab]")].map((item) => item.textContent.trim());
        return {
          name: info?.querySelector("h1")?.textContent?.trim() || "",
          hasInfo: Boolean(info),
          hasEditorialCopy: new RegExp(${JSON.stringify(bannedPattern)}, "i").test(text),
          hasLegacyLabel: tabs.includes("Pendamping"),
          hasProductOther: tabs.includes("Produk Lain"),
          hasUsage: tabs.includes("Cara Pakai"),
          hasFaq: tabs.includes("FAQ"),
          hasEmptyCore: /Info produk belum|Panduan penggunaan belum|FAQ produk belum/i.test(text),
        };
      })()`);
      if (!result?.hasInfo || result.name !== product.name || result.hasEditorialCopy || result.hasLegacyLabel || !result.hasProductOther || !result.hasUsage || !result.hasFaq || result.hasEmptyCore) {
        errors.push(`${product.expectedBrand} / ${product.name}: ${JSON.stringify(result)}`);
      }
    }

    for (const brand of catalog.brands) {
      const url = `${baseUrl}/#/brand/${encodeURIComponent(brand.slug)}`;
      await page.send("Page.navigate", { url });
      await waitForRendered(page, "brand", brand.title);
      const result = await page.evaluate(`(() => {
        const text = document.body.innerText;
        return {
          hasOverview: Boolean(document.querySelector(".brand-overview")),
          hasFactStack: Boolean(document.querySelector(".fact-stack")),
          hasSignature: Boolean(document.querySelector(".brand-signature, .signature-fact")),
          hasEditorialCopy: new RegExp(${JSON.stringify(bannedPattern)}, "i").test(text),
        };
      })()`);
      if (!result?.hasOverview || result.hasFactStack || result.hasSignature || result.hasEditorialCopy) {
        errors.push(`${brand.title}: ${JSON.stringify(result)}`);
      }
    }

    if (errors.length) throw new Error(`Render audit failed:\n${errors.join("\n")}`);
    console.log(`Rendered and audited ${products.length} product routes and ${catalog.brands.length} brand routes.`);
    await browser.send("Browser.close");
  } finally {
    page?.close();
    browser?.close();
    await Promise.race([
      new Promise((resolve) => browserProcess.once("exit", resolve)),
      delay(5000),
    ]);
    if (browserProcess.exitCode === null) browserProcess.kill();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        fs.rmSync(profileDirectory, { recursive: true, force: true });
        break;
      } catch (error) {
        if (attempt === 9) throw error;
        await delay(250);
      }
    }
  }
}

audit().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
