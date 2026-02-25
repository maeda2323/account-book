const state = {
  rows: [],
};

const aliases = {
  age: ["年齢", "age", "年代", "年令"],
  department: ["部署", "department", "所属部署", "部門"],
  gender: ["性別", "gender", "sex"],
  hireDate: ["入社日", "hire_date", "hired_at", "join_date", "入社年月日"],
  leaveDate: ["退職日", "leave_date", "resigned_at", "退社日"],
  tenure: ["勤続年数", "tenure", "service_years"],
};

const fileInput = document.getElementById("fileInput");
const useSampleBtn = document.getElementById("useSampleBtn");
const menuItems = Array.from(document.querySelectorAll(".menu-item"));
const viewTitle = document.getElementById("viewTitle");

menuItems.forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  loadCsv(text, file.name);
});

useSampleBtn.addEventListener("click", async () => {
  const text = await fetch("sample-data.csv").then((res) => res.text());
  loadCsv(text, "sample-data.csv");
});

function switchView(viewId) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });
  menuItems.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewId);
  });
  viewTitle.textContent = viewId === "uploadView" ? "データアップロード" : "ダッシュボード";
}

function loadCsv(text, sourceName) {
  const rows = parseCsv(text);
  if (!rows.length) {
    setStatus("CSVを解析できませんでした。ヘッダー付きCSVをご確認ください。", true);
    return;
  }
  state.rows = rows;
  setStatus(`${sourceName} を読み込みました（${rows.length}件）`);
  renderAll();
  switchView("dashboardView");
}

function parseCsv(csvText) {
  const lines = splitCsvLines(csvText.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const obj = {};
    headers.forEach((key, i) => {
      obj[key] = (values[i] || "").trim();
    });
    return obj;
  });
}

function splitCsvLines(text) {
  const lines = [];
  let buf = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        buf += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (c === "\n" && !inQuotes) {
      lines.push(buf.replace(/\r$/, ""));
      buf = "";
      continue;
    }
    buf += c;
  }
  if (buf) lines.push(buf.replace(/\r$/, ""));
  return lines.filter(Boolean);
}

function parseCsvLine(line) {
  const out = [];
  let inQuotes = false;
  let buf = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        buf += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (c === "," && !inQuotes) {
      out.push(buf);
      buf = "";
      continue;
    }
    buf += c;
  }
  out.push(buf);
  return out;
}

function keyOf(row, fieldName) {
  const keys = Object.keys(row);
  const list = aliases[fieldName] || [];
  return keys.find((k) => list.includes(k.toLowerCase()) || list.includes(k));
}

function field(row, fieldName) {
  const k = keyOf(row, fieldName);
  return k ? row[k] : "";
}

function renderAll() {
  const rows = state.rows;
  const activeCount = rows.filter((r) => !parseDate(field(r, "leaveDate"))).length;

  const ageGroups = { "20代": 0, "30代": 0, "40代": 0, "50代": 0, "60代": 0 };
  const deptCount = {};
  const genderCount = { 男性: 0, 女性: 0, その他: 0 };
  const tenureBuckets = { "0-3年": 0, "4-9年": 0, "10-19年": 0, "20年以上": 0 };
  let tenureSum = 0;
  let tenureN = 0;
  const joinByYear = {};
  const leaveByYear = {};

  rows.forEach((row) => {
    const age = Number(field(row, "age"));
    if (Number.isFinite(age)) {
      if (age >= 20 && age < 30) ageGroups["20代"] += 1;
      else if (age >= 30 && age < 40) ageGroups["30代"] += 1;
      else if (age >= 40 && age < 50) ageGroups["40代"] += 1;
      else if (age >= 50 && age < 60) ageGroups["50代"] += 1;
      else if (age >= 60) ageGroups["60代"] += 1;
    }

    const dept = field(row, "department") || "未設定";
    deptCount[dept] = (deptCount[dept] || 0) + 1;

    const genderRaw = (field(row, "gender") || "").toLowerCase();
    let gender = "その他";
    if (["男", "男性", "male", "m"].includes(genderRaw)) gender = "男性";
    if (["女", "女性", "female", "f"].includes(genderRaw)) gender = "女性";
    genderCount[gender] += 1;

    let tenure = Number(field(row, "tenure"));
    if (!Number.isFinite(tenure)) {
      const hired = parseDate(field(row, "hireDate"));
      if (hired) {
        tenure = (Date.now() - hired.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      }
    }

    if (Number.isFinite(tenure)) {
      tenureSum += tenure;
      tenureN += 1;
      if (tenure < 4) tenureBuckets["0-3年"] += 1;
      else if (tenure < 10) tenureBuckets["4-9年"] += 1;
      else if (tenure < 20) tenureBuckets["10-19年"] += 1;
      else tenureBuckets["20年以上"] += 1;
    }

    const hireDate = parseDate(field(row, "hireDate"));
    if (hireDate) {
      const y = hireDate.getFullYear();
      joinByYear[y] = (joinByYear[y] || 0) + 1;
    }

    const leaveDate = parseDate(field(row, "leaveDate"));
    if (leaveDate) {
      const y = leaveDate.getFullYear();
      leaveByYear[y] = (leaveByYear[y] || 0) + 1;
    }
  });

  renderCards([
    ["社員データ件数", rows.length],
    ["在籍中", activeCount],
    ["入社人数（累計）", Object.values(joinByYear).reduce((a, b) => a + b, 0)],
    ["退職人数（累計）", Object.values(leaveByYear).reduce((a, b) => a + b, 0)],
  ]);

  renderTable("ageTable", ["年代", "人数"], Object.entries(ageGroups));
  renderTable("departmentTable", ["部署", "人数"], sortedEntries(deptCount));
  renderTable("genderTable", ["区分", "人数"], Object.entries(genderCount));
  renderTable("tenureTable", ["勤続年数帯", "人数"], Object.entries(tenureBuckets));

  const avgTenure = tenureN ? (tenureSum / tenureN).toFixed(1) : "-";
  document.getElementById("tenureSummary").innerHTML = `
    <p class="metric">平均勤続年数: <strong>${avgTenure}</strong> 年</p>
    <p class="metric">勤続年数データ件数: <strong>${tenureN}</strong> 件</p>
  `;

  const years = Array.from(
    new Set([...Object.keys(joinByYear), ...Object.keys(leaveByYear)].map(Number))
  ).sort((a, b) => a - b);
  const joinLeaveRows = years.map((y) => [String(y), joinByYear[y] || 0, leaveByYear[y] || 0]);
  renderTable("joinLeaveTable", ["年", "入社人数", "退職人数"], joinLeaveRows);
}

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function renderCards(items) {
  const html = items
    .map(
      ([label, value]) => `
      <div class="card">
        <div class="label">${escapeHtml(label)}</div>
        <div class="value">${escapeHtml(String(value))}</div>
      </div>`
    )
    .join("");
  document.getElementById("summaryCards").innerHTML = html;
}

function renderTable(targetId, headers, rows) {
  if (!rows.length) {
    document.getElementById(targetId).innerHTML = '<p class="metric">表示できるデータがありません。</p>';
    return;
  }
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${r.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join("")}</tr>`
    )
    .join("");
  document.getElementById(targetId).innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function sortedEntries(record) {
  return Object.entries(record).sort((a, b) => b[1] - a[1]);
}

function setStatus(message, isError = false) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.style.background = isError ? "#fee2e2" : "#eef2ff";
  status.style.color = isError ? "#991b1b" : "#1e3a8a";
}

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
