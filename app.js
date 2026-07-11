"use strict";

const DATA_URL = "data/financeiro.json";
const DATA_API_URL = "/api/data";
const STORAGE_KEY = "gates_financeiro_state_v1";
const DATA_SNAPSHOT_KEY = "gates_financeiro_data_snapshot_v1";
const PDFJS_VERSION = "3.11.174";
const PDF_MAX_FILE_SIZE = 20 * 1024 * 1024;
const PDF_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;

let remoteSaveChain = Promise.resolve();
let remoteSyncWarned = false;

const DEFAULT_CATEGORIES = { income: [], expense: [] };

const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const ACCOUNT_NEW_VALUE = "__new_account__";
const DEFAULT_ACCOUNTS = [];
const CATEGORY_COLOR_PALETTE = [
  "#16a34a", "#22c55e", "#0f766e", "#14b8a6", "#3b82f6", "#2563eb",
  "#7c3aed", "#8b5cf6", "#be123c", "#dc2626", "#ef4444", "#f97316",
  "#d97706", "#f59e0b", "#64748b", "#475569", "#111827", "#f8fafc",
  "#06b6d4", "#a3e635"
];

const DEFAULT_CATEGORY_ICON = "tag";
const CATEGORY_ICON_NAMES = [
  "tag", "home", "utensils", "car", "graduation-cap", "heart-pulse", "ticket", "repeat-2", "user", "users",
  "wallet", "briefcase-business", "landmark", "hand-coins", "receipt", "shopping-cart", "credit-card", "banknote",
  "piggy-bank", "chart-column", "target", "book-open", "bus", "fuel", "plane", "train",
  "bike", "dumbbell", "music", "gamepad-2", "headphones", "camera", "gift", "shirt",
  "stethoscope", "pill", "baby", "paw-print", "wifi", "smartphone", "monitor", "cloud-sun",
  "sparkles", "star", "crown", "gem", "coffee", "beer", "pizza", "ice-cream",
  "map-pin", "calendar-days", "wrench", "hammer", "shield-check", "lock-keyhole", "leaf", "flame"
];
const LUCIDE_ICON_NAMES = new Set([
  ...CATEGORY_ICON_NAMES,
  "arrow-up", "check", "circle-plus", "file-json", "file-text", "flag", "history", "pencil", "plus", "rocket", "sparkles", "trash-2", "trending-up", "upload", "x"
]);
const DEFAULT_CATEGORY_ICON_BY_ID = {};

const els = {
  sidebar: document.getElementById("sidebar"),
  sidebarOverlay: document.getElementById("sidebarOverlay"),
  hamburgerBtn: document.getElementById("hamburgerBtn"),
  sidebarCloseBtn: document.getElementById("sidebarCloseBtn"),
  btnNewTransactionSide: document.getElementById("btnNewTransactionSide"),
  btnNewTransactionTop: document.getElementById("btnNewTransactionTop"),
  btnGenerateInvoicePdf: document.getElementById("btnGenerateInvoicePdf"),
  fabBtn: document.getElementById("fabBtn"),
  btnPrev: document.getElementById("btnPrev"),
  btnToday: document.getElementById("btnToday"),
  btnNext: document.getElementById("btnNext"),
  topbarTitle: document.getElementById("topbarTitle"),
  titleEyebrow: document.getElementById("titleEyebrow"),
  searchInput: document.getElementById("searchInput"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  filterType: document.getElementById("filterType"),
  filterCategory: document.getElementById("filterCategory"),
  filterAccount: document.getElementById("filterAccount"),
  filterClearBtn: document.getElementById("filterClearBtn"),
  sideBalance: document.getElementById("sideBalance"),
  sideBalanceHint: document.getElementById("sideBalanceHint"),
  miniInsights: document.getElementById("miniInsights"),
  incomeTotal: document.getElementById("incomeTotal"),
  incomeMeta: document.getElementById("incomeMeta"),
  expenseTotal: document.getElementById("expenseTotal"),
  expenseMeta: document.getElementById("expenseMeta"),
  balanceTotal: document.getElementById("balanceTotal"),
  balanceMeta: document.getElementById("balanceMeta"),
  mainGoalTotal: document.getElementById("mainGoalTotal"),
  mainGoalMeta: document.getElementById("mainGoalMeta"),
  chartRangeToggle: document.getElementById("chartRangeToggle"),
  cashflowChart: document.getElementById("cashflowChart"),
  categoryChart: document.getElementById("categoryChart"),
  categoryChartType: document.getElementById("categoryChartType"),
  categoryChartTitle: document.getElementById("categoryChartTitle"),
  categoryLegend: document.getElementById("categoryLegend"),
  insightList: document.getElementById("insightList"),
  upcomingList: document.getElementById("upcomingList"),
  transactionSummary: document.getElementById("transactionSummary"),
  transactionTable: document.getElementById("transactionTable"),
  btnToggleBudgetForm: document.getElementById("btnToggleBudgetForm"),
  budgetForm: document.getElementById("budgetForm"),
  budgetCategoryInput: document.getElementById("budgetCategoryInput"),
  budgetAmountInput: document.getElementById("budgetAmountInput"),
  budgetList: document.getElementById("budgetList"),
  weekSummaryList: document.getElementById("weekSummaryList"),
  planningInsightList: document.getElementById("planningInsightList"),
  planningUpcomingList: document.getElementById("planningUpcomingList"),
  goalForm: document.getElementById("goalForm"),
  goalNameInput: document.getElementById("goalNameInput"),
  goalTargetInput: document.getElementById("goalTargetInput"),
  goalSavedInput: document.getElementById("goalSavedInput"),
  goalDueInput: document.getElementById("goalDueInput"),
  goalCategoryInput: document.getElementById("goalCategoryInput"),
  goalSubmitButton: document.getElementById("goalSubmitButton"),
  goalOverview: document.getElementById("goalOverview"),
  goalList: document.getElementById("goalList"),
  goalCountLabel: document.getElementById("goalCountLabel"),
  btnFocusGoalForm: document.getElementById("btnFocusGoalForm"),
  goalBuilder: document.getElementById("goalBuilder"),
  goalHistoryOverlay: document.getElementById("goalHistoryOverlay"),
  goalHistoryTitle: document.getElementById("goalHistoryTitle"),
  goalHistorySummary: document.getElementById("goalHistorySummary"),
  goalHistoryList: document.getElementById("goalHistoryList"),
  goalHistoryClose: document.getElementById("goalHistoryClose"),
  categoryBoard: document.getElementById("categoryBoard"),
  categoryForm: document.getElementById("categoryForm"),
  categoryIdInput: document.getElementById("categoryIdInput"),
  categoryNameInput: document.getElementById("categoryNameInput"),
  categoryIconInput: document.getElementById("categoryIconInput"),
  categoryIconPicker: document.getElementById("categoryIconPicker"),
  categoryIconButton: document.getElementById("categoryIconButton"),
  categoryIconButtonIcon: document.getElementById("categoryIconButtonIcon"),
  categoryIconModal: document.getElementById("categoryIconModal"),
  categoryIconModalClose: document.getElementById("categoryIconModalClose"),
  categoryIconModalPicker: document.getElementById("categoryIconModalPicker"),
  categoryTypeInput: document.getElementById("categoryTypeInput"),
  categoryColorInput: document.getElementById("categoryColorInput"),
  categoryColorButton: document.getElementById("categoryColorButton"),
  categoryColorPreview: document.getElementById("categoryColorPreview"),
  categoryColorPopover: document.getElementById("categoryColorPopover"),
  categoryColorPalette: document.getElementById("categoryColorPalette"),
  categoryColorHexInput: document.getElementById("categoryColorHexInput"),
  categorySubmitButton: document.getElementById("categorySubmitButton"),
  categoryCancelButton: document.getElementById("categoryCancelButton"),
  transactionForm: document.getElementById("transactionForm"),
  formTitle: document.getElementById("formTitle"),
  transactionIdInput: document.getElementById("transactionIdInput"),
  descriptionInput: document.getElementById("descriptionInput"),
  amountInput: document.getElementById("amountInput"),
  dateInput: document.getElementById("dateInput"),
  categoryInput: document.getElementById("categoryInput"),
  accountInput: document.getElementById("accountInput"),
  customAccountInput: document.getElementById("customAccountInput"),
  notesInput: document.getElementById("notesInput"),
  recurringInput: document.getElementById("recurringInput"),
  clearFormButton: document.getElementById("clearFormButton"),
  btnDeleteTransaction: document.getElementById("btnDeleteTransaction"),
  submitButton: document.getElementById("submitButton"),
  btnExportJson: document.getElementById("btnExportJson"),
  btnImportJson: document.getElementById("btnImportJson"),
  importJsonInput: document.getElementById("importJsonInput"),
  importPdfInput: document.getElementById("importPdfInput"),
  importOverlay: document.getElementById("importOverlay"),
  importTitle: document.getElementById("importTitle"),
  importBody: document.getElementById("importBody"),
  importActions: document.getElementById("importActions"),
  importBack: document.getElementById("importBack"),
  importConfirm: document.getElementById("importConfirm"),
  importClose: document.getElementById("importClose"),
  toastContainer: document.getElementById("toastContainer"),
  confirmOverlay: document.getElementById("confirmOverlay"),
  confirmTitle: document.getElementById("confirmTitle"),
  confirmText: document.getElementById("confirmText"),
  confirmCancel: document.getElementById("confirmCancel"),
  confirmDelete: document.getElementById("confirmDelete"),
  transactionDrawer: document.getElementById("transactionDrawer"),
  transactionDrawerOverlay: document.getElementById("transactionDrawerOverlay")
};

const app = {
  state: seedState(),
  currentView: "overview",
  currentType: "income",
  chartRange: "30d",
  categoryChartType: "expense",
  editingTransactionId: null,
  editingGoalId: null,
  editingCategoryId: null,
  pendingImport: null,
  pdfImportInProgress: false,
  importConfirming: false,
  pendingConfirmAction: null,
  charts: {
    cashflow: null,
    category: null
  },
  filters: {
    search: "",
    type: "all",
    category: "all",
    account: "all"
  }
};

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromISO(iso) {
  return new Date(`${iso}T12:00:00`);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return stripTime(next);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function weekStart(date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function monthKey(date) {
  return toISO(date).slice(0, 7);
}

function uid(prefix = "id") {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function brl(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(value) || 0);
}

function parseCurrencyValue(value) {
  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number(normalized);
}

function formatCurrencyInputValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  return number.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatFullDate(date) {
  return date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatMonth(date) {
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cloneCategories(source = DEFAULT_CATEGORIES) {
  return {
    income: (source.income || []).map((category) => ({ ...category, icon: normalizeIconName(category.icon || DEFAULT_CATEGORY_ICON_BY_ID[category.id]), type: "income" })),
    expense: (source.expense || []).map((category) => ({ ...category, icon: normalizeIconName(category.icon || DEFAULT_CATEGORY_ICON_BY_ID[category.id]), type: "expense" }))
  };
}

function categoryGroups() {
  return app?.state?.categories || DEFAULT_CATEGORIES;
}

function allCategories() {
  const groups = categoryGroups();
  return [...groups.income, ...groups.expense];
}

function registeredCategoryIds() {
  return new Set(allCategories().map((category) => category.id));
}

function categoriesForType(type) {
  return categoryGroups()[type] || [];
}

function categoryById(id) {
  return allCategories().find((category) => category.id === id)
    || { id: id || "categoria-removida", label: "Categoria removida", color: "#64748b", icon: DEFAULT_CATEGORY_ICON };
}

function categoryLabel(id) {
  return categoryById(id).label;
}

function categoryColor(id) {
  return categoryById(id).color;
}

function categoryIcon(id) {
  return categoryById(id).icon || DEFAULT_CATEGORY_ICON;
}

function normalizeIconName(icon) {
  return LUCIDE_ICON_NAMES.has(icon) ? icon : DEFAULT_CATEGORY_ICON;
}

function lucideIcon(icon, label = "") {
  const name = normalizeIconName(icon);
  const title = label ? ` aria-label="${escapeHTML(label)}"` : ' aria-hidden="true"';
  return `<i data-lucide="${name}"${title}></i>`;
}

function refreshLucideIcons() {
  if (!window.lucide?.createIcons) return;
  window.lucide.createIcons({
    attrs: {
      width: "1em",
      height: "1em",
      "stroke-width": "2"
    }
  });
}

function seedState() {
  const today = stripTime(new Date());

  return {
    selectedDate: toISO(today),
    currentView: "overview",
    period: "month",
    theme: "light",
    chartRange: "30d",
    categoryChartType: "expense",
    categories: cloneCategories(),
    budgets: {},
    goals: [],
    transactions: []
  };
}

function makeTransaction(type, description, amount, date, category, account, recurring, notes) {
  return {
    id: uid("transaction"),
    type,
    description,
    amount,
    date,
    category,
    account,
    recurring,
    notes
  };
}

function normalizeState(raw) {
  const fallback = seedState();
  const categories = normalizeCategories(raw?.categories);
  const selectedDate = raw?.selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(raw.selectedDate)
    ? raw.selectedDate
    : fallback.selectedDate;

  return {
    selectedDate,
    period: ["month", "week", "all"].includes(raw?.period) ? raw.period : "month",
    currentView: ["overview", "transactions", "planning", "goals", "categories"].includes(raw?.currentView) ? raw.currentView : "overview",
    theme: raw?.theme === "dark" ? "dark" : "light",
    chartRange: ["7d", "30d", "3m", "all"].includes(raw?.chartRange) ? raw.chartRange : fallback.chartRange,
    categoryChartType: ["expense", "income", "all"].includes(raw?.categoryChartType) ? raw.categoryChartType : fallback.categoryChartType,
    categories,
    budgets: raw?.budgets && typeof raw.budgets === "object" ? raw.budgets : fallback.budgets,
    goals: Array.isArray(raw?.goals) ? raw.goals.map(normalizeGoal).filter(Boolean) : fallback.goals,
    transactions: Array.isArray(raw?.transactions)
      ? raw.transactions.map((item) => normalizeTransaction(item, categories)).filter(Boolean)
      : fallback.transactions
  };
}

function normalizeCategories(source) {
  if (!source || typeof source !== "object") return cloneCategories();
  const normalizeGroup = (items, fallbackType) => {
    if (!Array.isArray(items)) return [];
    const seen = new Set();
    return items.map((item) => {
      const label = String(item?.label || "").trim();
      const id = String(item?.id || slugify(label) || uid("category")).trim();
      const color = /^#[0-9a-f]{6}$/i.test(item?.color || "") ? item.color : "#16a34a";
  const icon = normalizeIconName(item?.icon || DEFAULT_CATEGORY_ICON_BY_ID[id]);
      if (!label || seen.has(id)) return null;
      seen.add(id);
      return { id, label, color, icon, type: fallbackType };
    }).filter(Boolean);
  };

  const normalized = {
    income: normalizeGroup(source.income, "income"),
    expense: normalizeGroup(source.expense, "expense")
  };

  return normalized;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeTransaction(item, groups = app?.state?.categories || DEFAULT_CATEGORIES) {
  const type = item?.type === "expense" ? "expense" : "income";
  const sourceCategories = groups[type] || DEFAULT_CATEGORIES[type];
  const validCategoryIds = sourceCategories.map((category) => category.id);
  const rawCategory = String(item?.category || "").trim();
  const category = validCategoryIds.includes(rawCategory)
    ? rawCategory
    : rawCategory;
  const amount = Number(item?.amount);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(item?.date || "") ? item.date : toISO(new Date());
  const description = String(item?.description || "").trim();
  if (!description || !category || !Number.isFinite(amount) || amount <= 0) return null;

  return {
    id: String(item.id || uid("transaction")),
    type,
    description,
    amount,
    date,
    category,
    account: String(item.account || "").trim(),
    recurring: Boolean(item.recurring),
    notes: String(item.notes || "").trim()
  };
}

function normalizeGoal(item) {
  const name = String(item?.name || "").trim();
  const target = Number(item?.target);
  const saved = Number(item?.saved || 0);
  const category = ["reserve", "travel", "project"].includes(item?.category) ? item.category : "";
  const contributions = Array.isArray(item?.contributions)
    ? item.contributions.map((entry) => {
      const amount = Number(entry?.amount);
      if (!Number.isFinite(amount) || amount === 0) return null;
      return {
        id: String(entry.id || uid("contribution")),
        amount,
        date: /^\d{4}-\d{2}-\d{2}$/.test(entry?.date || "") ? entry.date : "",
        label: String(entry?.label || "Aporte").trim() || "Aporte"
      };
    }).filter(Boolean)
    : [];
  if (!name || !Number.isFinite(target) || target <= 0) return null;
  return {
    id: String(item.id || uid("goal")),
    name,
    category,
    target,
    saved: Math.max(0, saved),
    contributions,
    due: /^\d{4}-\d{2}-\d{2}$/.test(item?.due || "") ? item.due : ""
  };
}

async function loadData() {
  const persisted = loadPersistedState();

  try {
    const response = await fetch(DATA_API_URL, { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json();
      app.state = normalizeState(payload);
      saveState({ sync: false });
      saveDataSnapshot(dataSnapshot(payload));
      return;
    }
  } catch {
    // The API is optional during static development; continue with local data.
  }

  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const snapshot = dataSnapshot(payload);
    const previousSnapshot = loadDataSnapshot();

    if (!persisted || snapshot !== previousSnapshot) {
      app.state = normalizeState(payload);
      saveDataSnapshot(snapshot);
      saveState({ sync: false });
      return;
    }
  } catch {
    // The data file is optional in production; local state remains the fallback.
  }

  app.state = persisted || seedState();
  if (!persisted) saveState({ sync: false });
}

function dataSnapshot(payload) {
  const source = JSON.stringify(payload);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${source.length}-${(hash >>> 0).toString(16)}`;
}

function loadDataSnapshot() {
  try {
    return localStorage.getItem(DATA_SNAPSHOT_KEY) || "";
  } catch {
    return "";
  }
}

function saveDataSnapshot(snapshot) {
  try {
    localStorage.setItem(DATA_SNAPSHOT_KEY, snapshot);
  } catch {
    // Persistence can be unavailable in private browsing; loaded data still works.
  }
}

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function saveState({ sync = true } = {}) {
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    ...app.state
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  if (sync) queueRemoteSave(payload);
}

function queueRemoteSave(payload) {
  remoteSaveChain = remoteSaveChain
    .catch(() => undefined)
    .then(async () => {
      const response = await fetch(DATA_API_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    })
    .catch(() => {
      if (!remoteSyncWarned && window.location.protocol !== "file:") {
        remoteSyncWarned = true;
        showToast("Alteração salva neste dispositivo; API de dados indisponível.");
      }
    });
  return remoteSaveChain;
}

function exportPayload() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    selectedDate: app.state.selectedDate,
    period: app.state.period,
    theme: app.state.theme,
    currentView: app.state.currentView,
    chartRange: app.state.chartRange,
    categoryChartType: app.state.categoryChartType,
    categories: app.state.categories,
    budgets: app.state.budgets,
    goals: [...app.state.goals],
    transactions: [...app.state.transactions].sort(sortTransactions)
  };
}

function selectedDate() {
  return fromISO(app.state.selectedDate);
}

function periodRange() {
  const selected = selectedDate();
  if (app.state.period === "all") {
    const dates = app.state.transactions.map((item) => fromISO(item.date)).sort((a, b) => a - b);
    return {
      start: dates[0] || new Date(selected.getFullYear(), selected.getMonth(), 1),
      end: dates[dates.length - 1] || new Date(selected.getFullYear(), selected.getMonth() + 1, 0),
      label: "Todo o período"
    };
  }
  if (app.state.period === "week") {
    const start = weekStart(selected);
    return { start, end: addDays(start, 6), label: `${formatDate(start)} - ${formatDate(addDays(start, 6))}` };
  }

  const start = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const end = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
  return { start, end, label: formatMonth(selected) };
}

function isInRange(iso, range) {
  const date = fromISO(iso);
  return date >= range.start && date <= range.end;
}

function allPeriodTransactions() {
  const range = periodRange();
  return app.state.transactions
    .filter((item) => isInRange(item.date, range))
    .sort(sortTransactions);
}

function visibleTransactions() {
  const search = app.filters.search.toLowerCase();
  return allPeriodTransactions().filter((item) => {
    if (app.filters.type !== "all" && item.type !== app.filters.type) return false;
    if (app.filters.category !== "all" && item.category !== app.filters.category) return false;
    if (app.filters.account !== "all" && item.account !== app.filters.account) return false;
    if (!search) return true;
    const haystack = [
      item.description,
      item.account,
      item.notes,
      categoryLabel(item.category),
      item.type === "income" ? "entrada receita" : "saida despesa"
    ].join(" ").toLowerCase();
    return haystack.includes(search);
  });
}

function sortTransactions(a, b) {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  return a.description.localeCompare(b.description, "pt-BR");
}

function totalsFor(items) {
  return items.reduce((acc, item) => {
    acc[item.type] += Number(item.amount);
    acc.count[item.type] += 1;
    acc.balance = acc.income - acc.expense;
    return acc;
  }, { income: 0, expense: 0, balance: 0, count: { income: 0, expense: 0 } });
}

function expensesByCategory(items) {
  return items
    .filter((item) => item.type === "expense")
    .reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + Number(item.amount);
      return acc;
    }, {});
}

function planningMonthRange() {
  const selected = selectedDate();
  return {
    start: new Date(selected.getFullYear(), selected.getMonth(), 1),
    end: new Date(selected.getFullYear(), selected.getMonth() + 1, 0)
  };
}

function planningMonthTransactions() {
  const range = planningMonthRange();
  return app.state.transactions
    .filter((item) => isInRange(item.date, range))
    .sort(sortTransactions);
}

function totalsByCategory(items, type = "expense") {
  return items
    .filter((item) => type === "all" || item.type === type)
    .reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + Number(item.amount);
      return acc;
    }, {});
}

function uniqueAccounts() {
  return [...new Set([
    ...DEFAULT_ACCOUNTS,
    ...app.state.transactions.map((item) => item.account).filter(Boolean)
  ])]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function fillAccountInput(selectedAccount = els.accountInput?.value || "") {
  if (!els.accountInput) return;
  const accounts = uniqueAccounts();
  const cleanSelected = String(selectedAccount || "").trim();
  const isCreatingAccount = cleanSelected === ACCOUNT_NEW_VALUE;
  const optionAccounts = cleanSelected && cleanSelected !== ACCOUNT_NEW_VALUE && !accounts.includes(cleanSelected)
    ? [cleanSelected, ...accounts]
    : accounts;

  els.accountInput.innerHTML = [
    '<option value="">Selecionar conta</option>',
    ...optionAccounts.map((account) => `<option value="${escapeHTML(account)}">${escapeHTML(account)}</option>`),
    `<option value="${ACCOUNT_NEW_VALUE}">+ Nova conta</option>`
  ].join("");
  els.accountInput.value = isCreatingAccount
    ? ACCOUNT_NEW_VALUE
    : (cleanSelected && optionAccounts.includes(cleanSelected) ? cleanSelected : "");
  updateAccountInputState();
}

function updateAccountInputState() {
  if (!els.accountInput || !els.customAccountInput) return;
  const creating = els.accountInput.value === ACCOUNT_NEW_VALUE;
  els.customAccountInput.classList.toggle("hidden", !creating);
  els.customAccountInput.required = creating;
  if (!creating) els.customAccountInput.value = "";
}

function currentAccountValue() {
  if (els.accountInput.value === ACCOUNT_NEW_VALUE) return els.customAccountInput.value.trim();
  return els.accountInput.value.trim();
}

const customFormControls = [];

function emitNativeChange(field) {
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

function controlLabel(field) {
  return field.getAttribute("aria-label")
    || field.closest("label")?.querySelector("span")?.textContent?.trim()
    || "Selecionar";
}

function controlKind(field) {
  if (field.classList.contains("filter-select")) return "filter";
  if (field.classList.contains("chart-select")) return "chart";
  if (field.closest(".category-form")) return "category-form";
  if (field.closest(".budget-form")) return "budget";
  if (field.closest(".goal-form")) return "goal";
  if (field.closest(".form-group")) return "form";
  return "default";
}

function positionFloatingControl(trigger, popover, width = 220) {
  popover.hidden = false;
  const rect = trigger.getBoundingClientRect();
  const viewportGap = 10;
  const menuGap = 6;
  const popoverWidth = Math.min(Math.max(width, rect.width), window.innerWidth - viewportGap * 2);
  const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - viewportGap);
  const spaceAbove = Math.max(0, rect.top - viewportGap);
  const openAbove = spaceBelow < 190 && spaceAbove > spaceBelow;
  const available = openAbove ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(120, Math.min(320, available - menuGap));
  const naturalHeight = Math.min(Math.max(1, popover.scrollHeight), maxHeight);
  const left = Math.min(
    Math.max(viewportGap, rect.left),
    Math.max(viewportGap, window.innerWidth - popoverWidth - viewportGap)
  );
  const preferredTop = openAbove ? rect.top - naturalHeight - menuGap : rect.bottom + menuGap;
  const top = Math.min(
    Math.max(viewportGap, preferredTop),
    Math.max(viewportGap, window.innerHeight - naturalHeight - viewportGap)
  );

  popover.style.width = `${popoverWidth}px`;
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  popover.style.maxHeight = `${maxHeight}px`;
}

function closeCustomFormControls(except = null) {
  customFormControls.forEach((control) => {
    if (control !== except) control.close?.();
  });
}

function syncCustomFormControls() {
  customFormControls.forEach((control) => control.sync?.());
}

function repositionCustomFormControls() {
  customFormControls.forEach((control) => control.reposition?.());
}

function initCustomSelectControls() {
  document.querySelectorAll("select").forEach((select) => {
    if (select.dataset.customControl === "true") return;
    select.dataset.customControl = "true";
    select.classList.add("native-control-proxy");

    const kind = controlKind(select);
    const wrap = document.createElement("div");
    const trigger = document.createElement("button");
    const valueNode = document.createElement("span");
    const caret = document.createElement("span");
    const list = document.createElement("div");
    const control = {};
    let activeIndex = 0;

    wrap.className = `custom-select-control custom-control-${kind}`;
    trigger.type = "button";
    trigger.className = "custom-control-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", controlLabel(select));
    valueNode.className = "custom-control-value";
    caret.className = "custom-control-caret";
    list.className = "custom-select-menu";
    list.setAttribute("role", "listbox");
    list.hidden = true;

    trigger.append(valueNode, caret);
    wrap.appendChild(trigger);
    select.insertAdjacentElement("afterend", wrap);
    document.body.appendChild(list);

    function optionColor(value) {
      if (select.id === "categoryInput" || select.id === "budgetCategoryInput" || select.id === "filterCategory") {
        return value === "all" ? "" : categoryColor(value);
      }
      return "";
    }

    function buildOptions() {
      list.innerHTML = "";
      Array.from(select.options).forEach((option, index) => {
        const item = document.createElement("button");
        const color = optionColor(option.value);
        item.type = "button";
        item.className = "custom-select-option";
        item.dataset.value = option.value;
        item.dataset.index = String(index);
        item.setAttribute("role", "option");
        if (color) {
          const dot = document.createElement("span");
          dot.className = "custom-option-dot";
          dot.style.setProperty("--option-color", color);
          item.appendChild(dot);
        }
        item.appendChild(document.createTextNode(option.textContent));
        item.addEventListener("click", () => {
          select.value = option.value;
          emitNativeChange(select);
          close();
          sync();
          trigger.focus();
        });
        list.appendChild(item);
      });
    }

    function setActive(index) {
      const items = Array.from(list.querySelectorAll(".custom-select-option"));
      if (!items.length) return;
      activeIndex = Math.max(0, Math.min(index, items.length - 1));
      items.forEach((item, itemIndex) => item.classList.toggle("is-active", itemIndex === activeIndex));
      items[activeIndex]?.scrollIntoView({ block: "nearest" });
    }

    function chooseActive() {
      const items = Array.from(list.querySelectorAll(".custom-select-option"));
      const item = items[activeIndex] || items.find((option) => option.dataset.value === select.value);
      if (!item) return;
      select.value = item.dataset.value;
      emitNativeChange(select);
      close();
      sync();
      trigger.focus();
    }

    function sync() {
      const selected = select.selectedOptions[0] || select.options[0];
      valueNode.textContent = selected ? selected.textContent : controlLabel(select);
      valueNode.classList.toggle("is-placeholder", !select.value || select.value === "all");
      const selectedIndex = Array.from(select.options).findIndex((option) => option.value === select.value);
      activeIndex = selectedIndex >= 0 ? selectedIndex : 0;
      list.querySelectorAll(".custom-select-option").forEach((item) => {
        const selectedItem = item.dataset.value === select.value;
        item.classList.toggle("selected", selectedItem);
        item.setAttribute("aria-selected", String(selectedItem));
      });
    }

    function open() {
      closeCustomFormControls(control);
      buildOptions();
      sync();
      wrap.classList.add("open");
      trigger.setAttribute("aria-expanded", "true");
      const menuWidth = kind === "filter" ? 150 : 240;
      control.reposition = () => positionFloatingControl(trigger, list, menuWidth);
      control.reposition();
      requestAnimationFrame(() => setActive(activeIndex));
    }

    function close() {
      wrap.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      list.hidden = true;
      control.reposition = null;
    }

    trigger.addEventListener("click", () => {
      if (wrap.classList.contains("open")) close();
      else open();
    });

    trigger.addEventListener("keydown", (event) => {
      const isOpen = wrap.classList.contains("open");
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        if (!isOpen) open();
        if (event.key === "ArrowDown") setActive(activeIndex + 1);
        if (event.key === "ArrowUp") setActive(activeIndex - 1);
        if (event.key === "Home") setActive(0);
        if (event.key === "End") setActive(select.options.length - 1);
      }
      if ((event.key === "Enter" || event.key === " ") && isOpen) {
        event.preventDefault();
        chooseActive();
      } else if ((event.key === "Enter" || event.key === " ") && !isOpen) {
        event.preventDefault();
        open();
      }
      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        close();
      }
    });

    select.addEventListener("change", sync);
    control.close = close;
    control.sync = () => {
      buildOptions();
      sync();
    };
    customFormControls.push(control);
    buildOptions();
    sync();
  });
}

function formatDateControlValue(iso) {
  if (!iso) return "dd/mm/aaaa";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function initCustomDateControls() {
  document.querySelectorAll('input[type="date"]').forEach((input) => {
    if (input.dataset.customControl === "true") return;
    input.dataset.customControl = "true";
    input.classList.add("native-control-proxy");

    const wrap = document.createElement("div");
    const trigger = document.createElement("button");
    const icon = document.createElement("span");
    const valueNode = document.createElement("span");
    const caret = document.createElement("span");
    const popover = document.createElement("div");
    const control = {};
    let referenceDate = input.value ? fromISO(input.value) : selectedDate();

    wrap.className = `custom-date-control custom-control-${controlKind(input)}`;
    trigger.type = "button";
    trigger.className = "custom-control-trigger";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", controlLabel(input));
    icon.className = "custom-control-icon";
    icon.innerHTML = lucideIcon("calendar-days");
    valueNode.className = "custom-control-value";
    caret.className = "custom-control-caret";
    popover.className = "custom-date-popover";
    popover.hidden = true;

    trigger.append(icon, valueNode, caret);
    wrap.appendChild(trigger);
    input.insertAdjacentElement("afterend", wrap);
    document.body.appendChild(popover);

    function setInputDate(date) {
      input.value = toISO(date);
      emitNativeChange(input);
      close();
      sync();
    }

    function monthDaysForPicker(date) {
      const first = new Date(date.getFullYear(), date.getMonth(), 1);
      const startOffset = (first.getDay() + 6) % 7;
      const cells = [];
      for (let index = startOffset; index > 0; index -= 1) {
        cells.push(new Date(date.getFullYear(), date.getMonth(), 1 - index));
      }
      const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      for (let day = 1; day <= last.getDate(); day += 1) {
        cells.push(new Date(date.getFullYear(), date.getMonth(), day));
      }
      let nextDay = 1;
      while (cells.length % 7 !== 0) {
        cells.push(new Date(date.getFullYear(), date.getMonth() + 1, nextDay));
        nextDay += 1;
      }
      return cells;
    }

    function render() {
      const selected = input.value ? fromISO(input.value) : null;
      popover.innerHTML = `
        <div class="custom-date-head">
          <button type="button" class="custom-date-nav" data-month="-1" aria-label="Mês anterior"></button>
          <strong>${escapeHTML(formatMonth(referenceDate))}</strong>
          <button type="button" class="custom-date-nav next" data-month="1" aria-label="Próximo mês"></button>
        </div>
        <div class="custom-date-weekdays">${WEEK_DAYS.map((day) => `<span>${day[0]}</span>`).join("")}</div>
        <div class="custom-date-grid">
          ${monthDaysForPicker(referenceDate).map((date) => {
            const currentMonth = date.getMonth() === referenceDate.getMonth();
            const selectedClass = selected && toISO(date) === toISO(selected) ? " selected" : "";
            return `<button type="button" class="custom-date-day${currentMonth ? "" : " muted"}${selectedClass}" data-date="${toISO(date)}">${date.getDate()}</button>`;
          }).join("")}
        </div>
        <div class="custom-date-footer">
          <button type="button" data-date-action="clear">Limpar</button>
          <button type="button" data-date-action="today">Hoje</button>
        </div>
      `;
    }

    function sync() {
      if (input.value) referenceDate = fromISO(input.value);
      valueNode.textContent = formatDateControlValue(input.value);
      valueNode.classList.toggle("is-placeholder", !input.value);
      render();
    }

    function open() {
      closeCustomFormControls(control);
      sync();
      wrap.classList.add("open");
      trigger.setAttribute("aria-expanded", "true");
      control.reposition = () => positionFloatingControl(trigger, popover, 294);
      control.reposition();
      refreshLucideIcons();
    }

    function close() {
      wrap.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      popover.hidden = true;
      control.reposition = null;
    }

    trigger.addEventListener("click", () => {
      if (wrap.classList.contains("open")) close();
      else open();
    });

    popover.addEventListener("click", (event) => {
      const nav = event.target.closest("[data-month]");
      if (nav) {
        referenceDate = addMonths(referenceDate, Number(nav.dataset.month));
        render();
        return;
      }
      const day = event.target.closest("[data-date]");
      if (day) {
        setInputDate(fromISO(day.dataset.date));
        return;
      }
      const action = event.target.closest("[data-date-action]")?.dataset.dateAction;
      if (action === "today") {
        setInputDate(new Date());
        return;
      }
      if (action === "clear") {
        input.value = "";
        emitNativeChange(input);
        close();
        sync();
      }
    });

    input.addEventListener("change", sync);
    control.close = close;
    control.sync = sync;
    customFormControls.push(control);
    sync();
  });
}

function initCustomFormControls() {
  initCustomSelectControls();
  initCustomDateControls();
  document.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".custom-select-control, .custom-select-menu, .custom-date-control, .custom-date-popover")) return;
    closeCustomFormControls();
  });
  window.addEventListener("resize", () => closeCustomFormControls());
  els.transactionDrawer.addEventListener("scroll", repositionCustomFormControls, { passive: true });
  document.querySelector(".finance-workspace")?.addEventListener("scroll", repositionCustomFormControls, { passive: true });
  syncCustomFormControls();
  refreshLucideIcons();
}

function renderAll() {
  syncTheme();
  fillFilters();
  fillCategoryInputs();
  fillAccountInput();
  renderCategoryIconPicker();
  renderCategoryColorPicker();
  updateTitle();
  updatePeriodButtons();
  updateNavButtons();
  renderMetrics();
  renderSidebarSummary();
  renderCharts();
  renderInsights();
  renderUpcoming();
  renderTransactions();
  renderBudgets();
  renderWeekSummary();
  renderPlanningInsights();
  renderPlanningUpcoming();
  renderGoalOverview();
  renderGoals();
  renderCategories();
  syncCustomFormControls();
  refreshLucideIcons();
}

function syncTheme() {
  document.body.classList.toggle("dark-mode", app.state.theme === "dark");
}

function updateTitle() {
  const range = periodRange();
  const viewLabels = {
    overview: "Visão geral",
    transactions: "Entradas e saídas",
    planning: "Planejamento mensal",
    goals: "Metas financeiras",
    categories: "Categorias de gastos"
  };
  els.topbarTitle.textContent = viewLabels[app.currentView];
  els.titleEyebrow.textContent = range.label;
}

function updatePeriodButtons() {
  document.querySelectorAll(".period-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.period === app.state.period);
  });
  els.btnPrev.disabled = app.state.period === "all";
  els.btnNext.disabled = app.state.period === "all";
  document.querySelectorAll(".chart-range-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.chartRange === app.chartRange);
  });
}

function updateNavButtons() {
  document.body.dataset.view = app.currentView;
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === app.currentView);
  });
  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${app.currentView}View`);
  });
}

function fillFilters() {
  const activeIds = registeredCategoryIds();
  const categories = app.filters.type === "all"
    ? allCategories()
    : categoriesForType(app.filters.type).filter((category) => activeIds.has(category.id));

  const currentCategoryStillValid = app.filters.category === "all"
    || categories.some((category) => category.id === app.filters.category);
  if (!currentCategoryStillValid) app.filters.category = "all";

  els.filterCategory.innerHTML = [
    '<option value="all">Categorias</option>',
    ...categories.map((category) => `<option value="${category.id}">${escapeHTML(category.label)}</option>`)
  ].join("");
  els.filterCategory.value = app.filters.category;

  els.filterAccount.innerHTML = [
    '<option value="all">Contas</option>',
    ...uniqueAccounts().map((account) => `<option value="${escapeHTML(account)}">${escapeHTML(account)}</option>`)
  ].join("");
  els.filterAccount.value = app.filters.account;
  els.filterType.value = app.filters.type;
}

function fillCategoryInputs() {
  const activeIds = registeredCategoryIds();
  const transactionCategories = categoriesForType(app.currentType).filter((category) => activeIds.has(category.id));
  const budgetCategories = categoriesForType("expense").filter((category) => activeIds.has(category.id));

  els.categoryInput.innerHTML = transactionCategories
    .map((category) => `<option value="${category.id}">${escapeHTML(category.label)}</option>`)
    .join("");
  if (!transactionCategories.some((category) => category.id === els.categoryInput.value)) {
    els.categoryInput.value = transactionCategories[0]?.id || "";
  }

  els.budgetCategoryInput.innerHTML = budgetCategories
    .map((category) => `<option value="${category.id}">${escapeHTML(category.label)}</option>`)
    .join("");
  if (!budgetCategories.some((category) => category.id === els.budgetCategoryInput.value)) {
    els.budgetCategoryInput.value = budgetCategories[0]?.id || "";
  }
}

function renderCategoryIconPicker() {
  const selected = normalizeIconName(els.categoryIconInput.value);
  if (els.categoryIconButtonIcon) {
    els.categoryIconButtonIcon.innerHTML = lucideIcon(selected);
  }
  const pickerHTML = CATEGORY_ICON_NAMES.map((icon) => `
    <button
      class="category-icon-option ${icon === selected ? "active" : ""}"
      type="button"
      data-icon="${icon}"
      aria-label="Usar icone ${escapeHTML(icon)}"
      aria-pressed="${icon === selected ? "true" : "false"}"
    >
      ${lucideIcon(icon)}
    </button>
  `).join("");
  if (els.categoryIconPicker) els.categoryIconPicker.innerHTML = "";
  if (els.categoryIconModalPicker) els.categoryIconModalPicker.innerHTML = pickerHTML;
  refreshLucideIcons();
}

function openCategoryIconModal() {
  els.categoryIconModal.classList.remove("hidden");
  els.categoryIconModal.setAttribute("aria-hidden", "false");
  renderCategoryIconPicker();
}

function closeCategoryIconModal() {
  els.categoryIconModal.classList.add("hidden");
  els.categoryIconModal.setAttribute("aria-hidden", "true");
}

function normalizeHexColor(value, fallback = "#16a34a") {
  const clean = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(clean) ? clean.toLowerCase() : fallback;
}

function setCategoryColor(color) {
  const nextColor = normalizeHexColor(color, els.categoryColorInput.value || "#16a34a");
  els.categoryColorInput.value = nextColor;
  renderCategoryColorPicker();
}

function renderCategoryColorPicker() {
  const selected = normalizeHexColor(els.categoryColorInput.value);
  els.categoryColorInput.value = selected;
  if (els.categoryColorPreview) els.categoryColorPreview.style.setProperty("--selected-color", selected);
  if (els.categoryColorHexInput) els.categoryColorHexInput.value = selected;
  if (!els.categoryColorPalette) return;

  els.categoryColorPalette.innerHTML = CATEGORY_COLOR_PALETTE.map((color) => `
    <button
      class="color-swatch-option ${color.toLowerCase() === selected ? "active" : ""}"
      type="button"
      data-color="${color}"
      style="--swatch-color:${color}"
      aria-label="Usar cor ${color}"
      aria-pressed="${color.toLowerCase() === selected ? "true" : "false"}"
    ></button>
  `).join("");
}

function openCategoryColorPopover() {
  renderCategoryColorPicker();
  els.categoryColorPopover.classList.remove("hidden");
  els.categoryColorButton.setAttribute("aria-expanded", "true");
}

function closeCategoryColorPopover() {
  els.categoryColorPopover.classList.add("hidden");
  els.categoryColorButton.setAttribute("aria-expanded", "false");
}

function toggleCategoryColorPopover() {
  if (els.categoryColorPopover.classList.contains("hidden")) openCategoryColorPopover();
  else closeCategoryColorPopover();
}

function renderMetrics() {
  const items = visibleTransactions();
  const totals = totalsFor(items);
  const goal = primaryGoal();
  const goalPercent = goal ? goalPercentFor(goal) : 0;

  els.incomeTotal.textContent = brl(totals.income);
  els.incomeMeta.textContent = `${totals.count.income} ${totals.count.income === 1 ? "entrada" : "entradas"}`;
  els.expenseTotal.textContent = brl(totals.expense);
  els.expenseMeta.textContent = `${totals.count.expense} ${totals.count.expense === 1 ? "saída" : "saídas"}`;
  els.balanceTotal.textContent = brl(totals.balance);
  els.balanceTotal.style.color = totals.balance >= 0 ? "var(--income)" : "var(--expense)";
  els.balanceMeta.textContent = totals.balance >= 0 ? "Saldo positivo" : "Saldo negativo";
  els.mainGoalTotal.textContent = goal ? `${goalPercent}%` : "0%";
  els.mainGoalMeta.textContent = goal ? goal.name : "Sem meta ativa";
}

function renderSidebarSummary() {
  const items = visibleTransactions();
  const totals = totalsFor(items);
  const top = Object.entries(expensesByCategory(items)).sort((a, b) => b[1] - a[1])[0];
  const recurring = items.filter((item) => item.recurring && item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  els.sideBalance.textContent = brl(totals.balance);
  els.sideBalance.style.color = totals.balance >= 0 ? "var(--income)" : "var(--expense)";
  els.sideBalanceHint.textContent = `${items.length} ${items.length === 1 ? "lançamento" : "lançamentos"} no filtro`;
  els.miniInsights.innerHTML = [
    top ? `Maior gasto: ${categoryLabel(top[0])} · ${brl(top[1])}` : "Sem gastos no período.",
    recurring ? `Fixos recorrentes: ${brl(recurring)}` : ""
  ].filter(Boolean).slice(0, 1).map((text) => `<div class="mini-insight">${escapeHTML(text)}</div>`).join("");
}

function renderCharts() {
  if (!window.Chart) {
    renderChartFallback();
    return;
  }

  renderCashflowChart(cashflowTransactions());
  renderCategoryChart(visibleTransactions());
}

function cashflowRange() {
  const selected = selectedDate();
  if (app.chartRange === "7d") return { start: addDays(selected, -6), end: selected, label: "7 dias" };
  if (app.chartRange === "3m") return { start: addMonths(selected, -2), end: new Date(selected.getFullYear(), selected.getMonth() + 1, 0), label: "3 meses" };
  if (app.chartRange === "all") {
    const dates = app.state.transactions.map((item) => fromISO(item.date)).sort((a, b) => a - b);
    return {
      start: dates[0] || new Date(selected.getFullYear(), selected.getMonth(), 1),
      end: dates[dates.length - 1] || selected,
      label: "Tudo"
    };
  }
  return {
    start: addDays(selected, -29),
    end: selected,
    label: "30 dias"
  };
}

function cashflowTransactions() {
  const range = cashflowRange();
  const search = app.filters.search.toLowerCase();
  return app.state.transactions
    .filter((item) => isInRange(item.date, range))
    .filter((item) => {
      if (app.filters.type !== "all" && item.type !== app.filters.type) return false;
      if (app.filters.category !== "all" && item.category !== app.filters.category) return false;
      if (app.filters.account !== "all" && item.account !== app.filters.account) return false;
      if (!search) return true;
      const haystack = [
        item.description,
        item.account,
        item.notes,
        categoryLabel(item.category),
        item.type === "income" ? "entrada receita" : "saida despesa"
      ].join(" ").toLowerCase();
      return haystack.includes(search);
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function chartTextColor() {
  return getCssVar("--muted") || "#6b7280";
}

function chartGridColor() {
  return getCssVar("--line") || "#e9eaec";
}

function renderCashflowChart(items) {
  const range = cashflowRange();
  const days = Math.max(1, Math.round((range.end - range.start) / 86400000) + 1);
  const daily = Array.from({ length: days }, () => 0);

  items.forEach((item) => {
    const index = Math.max(0, Math.min(days - 1, Math.round((fromISO(item.date) - range.start) / 86400000)));
    daily[index] += item.type === "income" ? Number(item.amount) : -Number(item.amount);
  });

  const cumulative = [];
  daily.reduce((acc, value, index) => {
    cumulative[index] = acc + value;
    return cumulative[index];
  }, 0);

  const labels = Array.from({ length: days }, (_, index) => {
    const date = addDays(range.start, index);
    return String(date.getDate()).padStart(2, "0");
  });
  const positive = cumulative[cumulative.length - 1] >= 0;
  const lineColor = positive ? getCssVar("--primary") : getCssVar("--expense");
  const fillColor = positive ? "rgba(5, 150, 105, 0.16)" : "rgba(220, 38, 38, 0.14)";
  const fillColorEnd = positive ? "rgba(5, 150, 105, 0.02)" : "rgba(220, 38, 38, 0.02)";

  const data = {
    labels,
    datasets: [{
      label: "Saldo",
      data: cumulative,
      borderColor: lineColor,
      backgroundColor: (context) => {
        const { chart } = context;
        const { ctx, chartArea } = chart;
        if (!chartArea) return fillColor;
        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, fillColor);
        gradient.addColorStop(1, fillColorEnd);
        return gradient;
      },
      borderWidth: 2.5,
      pointRadius: days <= 10 ? 2.5 : 0,
      pointHoverRadius: 4,
      pointBackgroundColor: lineColor,
      pointBorderColor: getCssVar("--surface-soft"),
      pointBorderWidth: 1.5,
      tension: 0.35,
      fill: true
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 10, right: 12, bottom: 4, left: 6 } },
    interaction: { intersect: false, mode: "index" },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `Saldo: ${brl(context.parsed.y)}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: chartTextColor(), maxTicksLimit: 8, font: { family: "Figtree", size: 11 } }
      },
      y: {
        grace: "12%",
        grid: { color: chartGridColor() },
        ticks: {
          color: chartTextColor(),
          font: { family: "Figtree", size: 11 },
          callback: (value) => brl(value)
        }
      }
    }
  };

  if (app.charts.cashflow) {
    app.charts.cashflow.data = data;
    app.charts.cashflow.options = options;
    app.charts.cashflow.update();
    return;
  }

  app.charts.cashflow = new Chart(els.cashflowChart, {
    type: "line",
    data,
    options
  });
}

function renderCategoryChart(items) {
  const type = app.categoryChartType;
  const titleByType = {
    expense: "Gastos por categoria",
    income: "Entradas por categoria",
    all: "Movimenta\u00e7\u00f5es por categoria"
  };

  if (els.categoryChartTitle) els.categoryChartTitle.textContent = titleByType[type] || titleByType.expense;
  if (els.categoryChartType) els.categoryChartType.value = type;

  const entries = Object.entries(totalsByCategory(items, type)).sort((a, b) => b[1] - a[1]);
  const labels = entries.length ? entries.map(([category]) => categoryLabel(category)) : ["Sem saídas"];
  if (!entries.length) {
    labels[0] = type === "income"
      ? "Sem entradas"
      : type === "all"
        ? "Sem movimenta\u00e7\u00f5es"
        : "Sem sa\u00eddas";
  }
  const values = entries.length ? entries.map(([, value]) => value) : [1];
  const colors = entries.length ? entries.map(([category]) => categoryColor(category)) : [getCssVar("--line-strong")];
  const data = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: colors,
      borderColor: getCssVar("--surface"),
      borderWidth: 2,
      hoverOffset: 5
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "68%",
    layout: { padding: 8 },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: Boolean(entries.length),
        callbacks: {
          label: (context) => `${context.label}: ${brl(context.parsed)}`
        }
      }
    }
  };

  if (app.charts.category) {
    app.charts.category.data = data;
    app.charts.category.options = options;
    app.charts.category.update();
  } else {
    app.charts.category = new Chart(els.categoryChart, {
      type: "doughnut",
      data,
      options
    });
  }

  els.categoryLegend.innerHTML = entries.slice(0, 5).map(([category, value]) => `
    <div class="legend-item">
      <span class="legend-left">
        <i class="legend-dot" style="background:${categoryColor(category)}"></i>
        <span class="legend-name">${escapeHTML(categoryLabel(category))}</span>
      </span>
      <strong>${brl(value)}</strong>
    </div>
  `).join("");
}

function renderChartFallback() {
  els.categoryLegend.innerHTML = '<div class="empty-state">Não foi possível carregar a biblioteca Chart.js.</div>';
}

function getCssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim()
    || getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function renderInsights() {
  const items = visibleTransactions();
  const totals = totalsFor(items);
  const byCategory = expensesByCategory(items);
  const overBudget = Object.entries(app.state.budgets)
    .filter(([category, limit]) => Number(limit) > 0 && (byCategory[category] || 0) > Number(limit));
  const recurring = items.filter((item) => item.recurring && item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const savingsRate = totals.income > 0 ? Math.round((totals.balance / totals.income) * 100) : 0;
  const top = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

  const cards = [
    {
      tone: totals.balance >= 0 ? "success" : "danger",
      title: totals.balance >= 0 ? "Período no azul" : "Saldo em atenção",
      body: totals.balance >= 0
        ? `${brl(totals.balance)} sobrando no filtro atual.`
        : `${brl(Math.abs(totals.balance))} acima das entradas no filtro atual.`
    },
    {
      tone: savingsRate >= 20 ? "success" : savingsRate >= 0 ? "info" : "warning",
      title: "Taxa de economia",
      body: totals.income ? `${savingsRate}% da receita ficou disponível.` : "Registre entradas para medir economia."
    },
    {
      tone: overBudget.length ? "warning" : "success",
      title: overBudget.length ? "Orçamentos ultrapassados" : "Limites sob controle",
      body: overBudget.length
        ? overBudget.map(([category]) => categoryLabel(category)).join(", ")
        : "Nenhuma categoria passou do limite definido."
    },
    {
      tone: "info",
      title: "Compromissos fixos",
      body: recurring ? `${brl(recurring)} em despesas recorrentes.` : "Sem despesas recorrentes no período."
    },
    {
      tone: top ? "warning" : "info",
      title: top ? "Maior categoria" : "Distribuição",
      body: top ? `${categoryLabel(top[0])} concentra ${brl(top[1])}.` : "Ainda não há gastos para comparar."
    }
  ];

  els.insightList.innerHTML = cards.map((card) => `
    <article class="insight-card ${card.tone}">
      <span class="insight-tone" aria-hidden="true"></span>
      <div>
        <strong>${escapeHTML(card.title)}</strong>
        <span>${escapeHTML(card.body)}</span>
      </div>
    </article>
  `).join("");
}

function renderUpcoming() {
  const today = stripTime(new Date());
  const upcoming = app.state.transactions
    .filter((item) => item.type === "expense" && fromISO(item.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  if (!upcoming.length) {
    els.upcomingList.innerHTML = '<div class="empty-state">Nenhuma saída futura cadastrada.</div>';
    return;
  }

  els.upcomingList.innerHTML = upcoming.map((item) => `
    <article class="upcoming-item">
      <span class="upcoming-bar" style="background:${categoryColor(item.category)}"></span>
      <div>
        <strong>${escapeHTML(item.description)}</strong>
        <span>${escapeHTML(formatFullDate(fromISO(item.date)))} · ${escapeHTML(categoryLabel(item.category))}</span>
      </div>
      <strong class="upcoming-value">${brl(item.amount)}</strong>
    </article>
  `).join("");
}

function renderTransactions() {
  const items = visibleTransactions();
  const totals = totalsFor(items);
  if (els.transactionSummary) els.transactionSummary.textContent = `${items.length} ${items.length === 1 ? "lançamento" : "lançamentos"} · Entradas ${brl(totals.income)} · Saídas ${brl(totals.expense)}`;

  if (!items.length) {
    els.transactionTable.innerHTML = '<tr class="transaction-empty-row"><td colspan="6"><div class="empty-state">Nenhum lançamento encontrado para o filtro atual.</div></td></tr>';
    return;
  }

  els.transactionTable.innerHTML = items.map((item) => {
    const amountClass = item.type === "income" ? "amount-income" : "amount-expense";
    const sign = item.type === "income" ? "+" : "-";
    return `
      <tr>
        <td data-label="Data">${escapeHTML(formatFullDate(fromISO(item.date)))}</td>
        <td data-label="Descrição">
          <strong>${escapeHTML(item.description)}</strong>
          ${item.notes ? `<small>${escapeHTML(item.notes)}</small>` : ""}
          ${item.recurring ? "<small>Recorrente</small>" : ""}
        </td>
        <td data-label="Categoria">
          <span class="category-pill" style="background:${softColor(item.category)}; color:${categoryColor(item.category)}">
            ${escapeHTML(categoryLabel(item.category))}
          </span>
        </td>
        <td data-label="Conta">${escapeHTML(item.account || "-")}</td>
        <td data-label="Valor" class="${amountClass}">${sign} ${brl(item.amount)}</td>
        <td data-label="Ações">
          <div class="row-actions">
            <button type="button" data-action="edit" data-id="${escapeHTML(item.id)}" aria-label="Editar lançamento">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <path d="M8.7 3.1l3.2 3.2M2.5 12.5l2.9-.6 6.4-6.4a1.4 1.4 0 0 0-2-2L3.4 9.9l-.9 2.6Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"></path>
              </svg>
            </button>
            <button type="button" data-action="delete" data-id="${escapeHTML(item.id)}" aria-label="Excluir lançamento">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <path d="M3 4h9M6 4V2.8h3V4M4.2 4l.5 8.2h5.6L10.8 4M6.4 6.3v3.9M8.6 6.3v3.9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function softColor(category) {
  const color = categoryColor(category);
  return `${color}16`;
}

function renderBudgets() {
  const items = visibleTransactions();
  const spent = expensesByCategory(items);
  els.budgetList.innerHTML = categoriesForType("expense").map((category) => {
    const limit = Number(app.state.budgets[category.id] || 0);
    const used = Number(spent[category.id] || 0);
    const percent = limit > 0 ? Math.round((used / limit) * 100) : 0;
    const tone = percent >= 100 ? "danger" : percent >= 80 ? "warning" : "";
    const width = Math.min(percent, 100);
    const detail = limit > 0 ? `${brl(used)} de ${brl(limit)} · ${percent}%` : `${brl(used)} sem limite definido`;
    return `
      <article class="budget-item">
        <div class="budget-top">
          <strong>${escapeHTML(category.label)}</strong>
          <span>${escapeHTML(detail)}</span>
        </div>
        <div class="progress-track ${tone}">
          <span style="width:${width}%"></span>
        </div>
      </article>
    `;
  }).join("");
}

function renderWeekSummary() {
  const range = periodRange();
  const monthStart = new Date(selectedDate().getFullYear(), selectedDate().getMonth(), 1);
  const weeks = [];

  for (let start = weekStart(monthStart), index = 1; start.getMonth() <= selectedDate().getMonth() || addDays(start, 6).getMonth() === selectedDate().getMonth(); start = addDays(start, 7), index += 1) {
    const end = addDays(start, 6);
    const items = app.state.transactions.filter((item) => {
      const date = fromISO(item.date);
      return date >= start && date <= end && date.getMonth() === selectedDate().getMonth();
    });
    weeks.push({ index, start, end, items });
    if (start.getMonth() > selectedDate().getMonth() && end.getMonth() > selectedDate().getMonth()) break;
    if (weeks.length >= 6) break;
  }

  els.weekSummaryList.innerHTML = weeks.map((week) => {
    const totals = totalsFor(week.items);
    const daily = Array.from({ length: 7 }, (_, dayIndex) => {
      const date = addDays(week.start, dayIndex);
      return week.items
        .filter((item) => item.date === toISO(date) && item.type === "expense")
        .reduce((sum, item) => sum + Number(item.amount), 0);
    });
    const max = Math.max(...daily, 1);
    const bars = daily.map((value, index) => `
      <span class="week-bar">
        <span style="height:${Math.max(8, (value / max) * 76)}px; background:${value ? "var(--primary)" : "var(--line-strong)"}"></span>
        ${WEEK_DAYS[index][0]}
      </span>
    `).join("");

    return `
      <article class="week-summary-item">
        <div class="item-top">
          <strong>Semana ${week.index}</strong>
          <span>${escapeHTML(formatDate(week.start))} - ${escapeHTML(formatDate(week.end))}</span>
        </div>
        <span>Entradas ${brl(totals.income)} · Saídas ${brl(totals.expense)} · Saldo ${brl(totals.balance)}</span>
        <div class="week-bars">${bars}</div>
      </article>
    `;
  }).join("");

  if (app.state.period === "week") {
    els.weekSummaryList.insertAdjacentHTML("afterbegin", `
      <article class="week-summary-item">
        <div class="item-top">
          <strong>Semana selecionada</strong>
          <span>${escapeHTML(range.label)}</span>
        </div>
        <span>Use as setas no topo para comparar semanas rapidamente.</span>
      </article>
    `);
  }
}

function renderBudgets() {
  const items = planningMonthTransactions();
  const spent = expensesByCategory(items);
  const categories = categoriesForType("expense");
  const rows = categories.map((category) => {
    const limit = Number(app.state.budgets[category.id] || 0);
    const used = Number(spent[category.id] || 0);
    const percent = limit > 0 ? Math.round((used / limit) * 100) : 0;
    const remaining = limit - used;
    const tone = used <= 0 ? "muted" : percent >= 100 ? "danger" : percent >= 70 ? "warning" : "success";
    const width = Math.min(percent, 100);

    return `
      <article class="budget-row ${tone}">
        <div class="budget-row-main">
          <span class="budget-category-icon" style="--category-color:${category.color}">
            ${lucideIcon(category.icon)}
          </span>
          <div class="budget-row-copy">
            <strong>${escapeHTML(category.label)}</strong>
            <span>${brl(used)} de ${limit > 0 ? brl(limit) : "sem limite"}</span>
          </div>
        </div>
        <div class="budget-row-meta">
          <span>${limit > 0 ? `${percent}% usado` : "Sem limite"}</span>
          <strong>${limit > 0 ? `${brl(Math.max(remaining, 0))} restantes` : "Defina um limite"}</strong>
        </div>
        <div class="budget-progress" aria-hidden="true">
          <span style="width:${width}%"></span>
        </div>
      </article>
    `;
  }).join("");
  const totalBudget = categories.reduce((sum, category) => sum + Number(app.state.budgets[category.id] || 0), 0);
  const totalUsed = Object.values(spent).reduce((sum, value) => sum + Number(value), 0);
  const totalRemaining = Math.max(totalBudget - totalUsed, 0);

  els.budgetList.innerHTML = `
    ${rows}
    <footer class="budget-footer">
      <span>${categories.length} categorias</span>
      <span>Or\u00e7amento total: <strong>${brl(totalBudget)}</strong></span>
      <span>Utilizado: <strong>${brl(totalUsed)}</strong></span>
      <span>Restante: <strong>${brl(totalRemaining)}</strong></span>
    </footer>
  `;
}

function renderWeekSummary() {
  const monthStart = new Date(selectedDate().getFullYear(), selectedDate().getMonth(), 1);
  const weeks = [];

  for (let start = weekStart(monthStart), index = 1; start.getMonth() <= selectedDate().getMonth() || addDays(start, 6).getMonth() === selectedDate().getMonth(); start = addDays(start, 7), index += 1) {
    const end = addDays(start, 6);
    const items = app.state.transactions.filter((item) => {
      const date = fromISO(item.date);
      return date >= start && date <= end && date.getMonth() === selectedDate().getMonth();
    });
    weeks.push({ index, start, end, items });
    if (weeks.length >= 6) break;
  }

  els.weekSummaryList.innerHTML = weeks.map((week) => {
    const totals = totalsFor(week.items);
    const positive = totals.balance >= 0;
    const hasItems = week.items.length > 0;
    return `
      <article class="week-compact-row ${hasItems ? positive ? "positive" : "negative" : "empty"}">
        <span class="week-balance-bar" aria-hidden="true"></span>
        <div class="week-compact-main">
          <strong>Semana ${week.index}</strong>
          <span>${escapeHTML(formatDate(week.start))} - ${escapeHTML(formatDate(week.end))}</span>
        </div>
        <div class="week-compact-values">
          ${hasItems
            ? `<span>Entradas ${brl(totals.income)} · Sa\u00eddas ${brl(totals.expense)}</span><strong>Saldo ${positive ? "+" : ""}${brl(totals.balance)}</strong>`
            : "<span>Sem lan\u00e7amentos</span><strong>Sem dados</strong>"
          }
        </div>
      </article>
    `;
  }).join("");
}

function renderPlanningInsights() {
  if (!els.planningInsightList) return;
  const items = planningMonthTransactions();
  const spent = expensesByCategory(items);
  const totalExpense = Object.values(spent).reduce((sum, value) => sum + Number(value), 0);
  const totals = totalsFor(items);
  const top = Object.entries(spent).sort((a, b) => b[1] - a[1])[0];
  const over = categoriesForType("expense")
    .map((category) => {
      const limit = Number(app.state.budgets[category.id] || 0);
      const used = Number(spent[category.id] || 0);
      const percent = limit > 0 ? (used / limit) * 100 : 0;
      return { category, limit, used, percent };
    })
    .filter((item) => item.percent >= 70)
    .sort((a, b) => b.percent - a.percent)[0];
  const today = stripTime(new Date());
  const range = planningMonthRange();
  const remainingDays = Math.max(1, Math.ceil((range.end - today) / 86400000) + 1);
  const remainingBudget = Math.max(
    categoriesForType("expense").reduce((sum, category) => sum + Number(app.state.budgets[category.id] || 0), 0) - totalExpense,
    0
  );
  const dailyRoom = remainingBudget / remainingDays;
  const forecastTone = totals.balance >= 0 ? "success" : "danger";
  const insights = [
    top ? { tone: "info", icon: "↑", title: "Maior gasto", body: `${categoryLabel(top[0])} concentra ${brl(top[1])}.` } : null,
    top && totalExpense > 0 ? { tone: "info", icon: "%", title: "Concentra\u00e7\u00e3o", body: `${categoryLabel(top[0])} representa ${Math.round((top[1] / totalExpense) * 100)}% dos gastos.` } : null,
    over ? {
      tone: over.percent >= 100 ? "danger" : "warning",
      icon: "!",
      title: over.percent >= 100 ? "Categoria estourada" : "Categoria em aten\u00e7\u00e3o",
      body: over.percent >= 100
        ? `${over.category.label} passou ${brl(over.used - over.limit)} do limite.`
        : `${over.category.label} j\u00e1 usou ${Math.round(over.percent)}% do limite.`
    } : null,
    { tone: "success", icon: "÷", title: "Margem di\u00e1ria", body: `Voc\u00ea ainda pode gastar ${brl(dailyRoom)} por dia.` },
    { tone: forecastTone, icon: "=", title: "Previs\u00e3o", body: totals.balance >= 0 ? "Fechamento previsto positivo no ritmo atual." : "Fechamento previsto negativo no ritmo atual." }
  ].filter(Boolean).slice(0, 5);

  const visibleInsights = insights.filter((item) => item.title !== "Previs\u00e3o");

  els.planningInsightList.innerHTML = visibleInsights.map((item) => `
    <article class="planning-insight ${item.tone}">
      <span>${escapeHTML(item.icon)}</span>
      <div>
        <strong>${escapeHTML(item.title)}</strong>
        <small>${escapeHTML(item.body)}</small>
      </div>
    </article>
  `).join("");
}

function renderPlanningUpcoming() {
  if (!els.planningUpcomingList) return;
  const today = stripTime(new Date());
  const range = planningMonthRange();
  const items = app.state.transactions
    .filter((item) => item.type === "expense" && isInRange(item.date, range) && (fromISO(item.date) >= today || item.recurring))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  if (!items.length) {
    els.planningUpcomingList.innerHTML = `
      <div class="planning-empty-state">
        <strong>Nenhuma despesa prevista</strong>
        <span>Cadastre lan\u00e7amentos futuros para planejar melhor o m\u00eas.</span>
      </div>
    `;
    return;
  }

  els.planningUpcomingList.innerHTML = items.map((item) => `
    <article class="planning-upcoming-item">
      <div>
        <strong>${escapeHTML(item.description)}</strong>
        <span>${escapeHTML(formatDate(fromISO(item.date)))} · ${escapeHTML(categoryLabel(item.category))}</span>
      </div>
      <div>
        <strong class="amount-expense">- ${brl(item.amount)}</strong>
        <em>${item.recurring ? "Recorrente" : fromISO(item.date) > today ? "Prevista" : "Pendente"}</em>
      </div>
    </article>
  `).join("");
}

function renderGoals() {
  if (els.goalCountLabel) {
    const count = app.state.goals.length;
    els.goalCountLabel.textContent = `${count} ${count === 1 ? "meta" : "metas"}`;
  }

  if (!app.state.goals.length) {
    els.goalList.innerHTML = `
      <div class="empty-state">
        <div class="goals-empty-content">
          <strong>Sua primeira meta começa aqui</strong>
          <p>Escolha uma sugestão ao lado ou crie um objetivo do seu jeito.</p>
        </div>
      </div>
    `;
    return;
  }

  const goals = [...app.state.goals].sort((a, b) => {
    const aComplete = goalPercentFor(a) >= 100;
    const bComplete = goalPercentFor(b) >= 100;
    if (aComplete !== bComplete) return aComplete ? 1 : -1;
    return (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31");
  });

  els.goalList.innerHTML = goals.map((goal) => {
    const percent = goalPercentFor(goal);
    const remaining = Math.max(0, Number(goal.target) - Number(goal.saved));
    const status = goalStatus(goal);
    const daysLeft = goalDaysLeft(goal);
    const tone = status.tone === "danger" ? "danger" : status.tone === "warning" ? "warning" : "";
    const deadline = goal.due
      ? `${daysLeft < 0 ? "Venceu em" : "Prazo"} ${formatDate(fromISO(goal.due))}`
      : "Sem prazo definido";
    return `
      <article class="goal-item ${status.tone}">
        <div class="goal-card-header">
          <div class="goal-card-title">
            <strong>${escapeHTML(goal.name)}</strong>
          </div>
          <button class="goal-history-button" type="button" data-action="open-goal-history" data-id="${escapeHTML(goal.id)}">
            ${lucideIcon("history")} Histórico
          </button>
          <div class="goal-actions">
            <button type="button" data-action="edit-goal" data-id="${escapeHTML(goal.id)}" aria-label="Editar meta" title="Editar meta">
              ${lucideIcon("pencil")}
            </button>
            <button type="button" data-action="delete-goal" data-id="${escapeHTML(goal.id)}" aria-label="Excluir meta" title="Excluir meta">
              ${lucideIcon("trash-2")}
            </button>
          </div>
        </div>

        <div class="goal-progress-heading">
          <span>${brl(goal.saved)} de ${brl(goal.target)}</span>
          <strong>${percent}%</strong>
        </div>
        <div class="progress-track ${tone}" aria-label="${percent}% concluído">
          <span style="width:${Math.min(percent, 100)}%"></span>
        </div>

        <div class="goal-money-row">
          <div>
            <span>Guardado</span>
            <strong>${brl(goal.saved)}</strong>
          </div>
          <div>
            <span>Objetivo</span>
            <strong>${brl(goal.target)}</strong>
          </div>
          <div>
            <span>Falta</span>
            <strong>${brl(remaining)}</strong>
          </div>
        </div>

        <div class="goal-card-footer">
          <span class="goal-deadline">${lucideIcon("calendar-days")} ${escapeHTML(deadline)}</span>
          ${percent < 100 ? `
            <button class="goal-contribute-toggle" type="button" data-action="toggle-contribution" data-id="${escapeHTML(goal.id)}" aria-expanded="false">
              ${lucideIcon("circle-plus")} Adicionar valor
            </button>
          ` : ""}
        </div>
        ${percent < 100 ? `
          <form class="goal-contribution hidden" data-goal-contribution="${escapeHTML(goal.id)}">
            <button class="goal-contribution-preset" type="button" data-action="add-contribution" data-id="${escapeHTML(goal.id)}" data-amount="100">+ R$ 100</button>
            <button class="goal-contribution-preset" type="button" data-action="add-contribution" data-id="${escapeHTML(goal.id)}" data-amount="250">+ R$ 250</button>
            <input type="text" inputmode="decimal" name="amount" placeholder="Outro valor" aria-label="Valor do aporte" required />
            <button class="goal-contribution-submit" type="submit" aria-label="Confirmar aporte" title="Confirmar aporte">${lucideIcon("arrow-up")}</button>
          </form>
        ` : ""}
      </article>
    `;
  }).join("");
}

function renderGoalOverview() {
  if (!els.goalOverview) return;
  const goals = app.state.goals;
  const active = goals.filter((goal) => goalPercentFor(goal) < 100);
  const saved = goals.reduce((sum, goal) => sum + Number(goal.saved || 0), 0);
  const target = goals.reduce((sum, goal) => sum + Number(goal.target || 0), 0);
  const remaining = Math.max(0, target - saved);
  const nextGoal = active
    .filter((goal) => goal.due)
    .sort((a, b) => a.due.localeCompare(b.due))[0];
  const percent = target ? goalPercentFor({ saved, target }) : 0;

  if (!goals.length) {
    els.goalOverview.innerHTML = `
      <div class="goals-summary-empty">
        <div>
          <strong>Nenhuma meta cadastrada</strong>
          <span>Crie uma meta para iniciar o acompanhamento.</span>
        </div>
      </div>
    `;
    return;
  }

  els.goalOverview.innerHTML = `
    <div class="goals-summary-main">
      <span class="goals-summary-label">Progresso do seu plano</span>
      <div class="goals-summary-main-row">
        <strong>${brl(saved)} guardados</strong>
        <span>${percent}%</span>
      </div>
      <div class="goals-summary-track"><span style="width:${percent}%"></span></div>
    </div>
    <div class="goals-summary-stat">
      <span>Em andamento</span>
      <strong>${active.length} ${active.length === 1 ? "meta" : "metas"}</strong>
    </div>
    <div class="goals-summary-stat">
      <span>Falta guardar</span>
      <strong>${brl(remaining)}</strong>
    </div>
    <div class="goals-summary-stat">
      <span>Próximo prazo</span>
      <strong>${nextGoal ? formatDate(fromISO(nextGoal.due)) : "Sem prazo"}</strong>
    </div>
  `;
}

function primaryGoal() {
  return [...app.state.goals]
    .sort((a, b) => goalPercentFor(b) - goalPercentFor(a))[0];
}

function goalPercentFor(goal) {
  return Math.min(100, Math.round((Number(goal.saved || 0) / Number(goal.target || 1)) * 100));
}

function goalDaysLeft(goal) {
  if (!goal.due) return null;
  const today = stripTime(new Date());
  return Math.ceil((stripTime(fromISO(goal.due)) - today) / 86400000);
}

function goalStatus(goal) {
  const percent = goalPercentFor(goal);
  const days = goalDaysLeft(goal);
  if (percent >= 100) return { label: "Concluída", tone: "success" };
  if (days !== null && days < 0) return { label: "Atrasada", tone: "danger" };
  if (days !== null && days <= 15) return { label: "Prazo curto", tone: "warning" };
  if (percent >= 75) return { label: "Avançada", tone: "success" };
  return { label: "Em andamento", tone: "info" };
}

function renderCategories() {
  const items = visibleTransactions();
  const search = app.filters.search.toLowerCase();
  let categories = app.filters.type === "all"
    ? allCategories()
    : categoriesForType(app.filters.type);

  if (app.filters.category !== "all") {
    categories = categories.filter((category) => category.id === app.filters.category);
  }

  const entries = categories.map((category) => {
    const count = items.filter((item) => item.category === category.id).length;
    return { ...category, count };
  }).filter((category) => {
    if (search && !category.label.toLowerCase().includes(search) && category.count === 0) return false;
    if (app.filters.account !== "all" && category.count === 0) return false;
    return true;
  }).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

  if (!entries.length) {
    els.categoryBoard.innerHTML = '<div class="empty-state">Nenhuma categoria encontrada para o filtro atual.</div>';
    return;
  }

  els.categoryBoard.innerHTML = entries.map((category) => `
    <article class="category-item" style="--category-color:${category.color}">
      <div class="category-top">
        <span class="category-name">
          <span class="category-title-icon" style="--category-color:${category.color}">
            ${lucideIcon(category.icon)}
          </span>
          <strong>${escapeHTML(category.label)}</strong>
        </span>
        <span class="category-type">${category.type === "income" ? "Entrada" : "Saída"}</span>
      </div>
      <div class="category-card-footer">
        <span>${category.count} ${category.count === 1 ? "lançamento" : "lançamentos"} no filtro atual</span>
        <div class="category-actions">
          <button type="button" data-action="edit-category" data-id="${escapeHTML(category.id)}" aria-label="Editar categoria">
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <path d="M8.7 3.1l3.2 3.2M2.5 12.5l2.9-.6 6.4-6.4a1.4 1.4 0 0 0-2-2L3.4 9.9l-.9 2.6Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"></path>
            </svg>
          </button>
          <button type="button" data-action="delete-category" data-id="${escapeHTML(category.id)}" aria-label="Excluir categoria">
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <path d="M3 4h9M6 4V2.8h3V4M4.2 4l.5 8.2h5.6L10.8 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </button>
        </div>
      </div>
    </article>
  `).join("");
}

function resetCategoryForm() {
  app.editingCategoryId = null;
  els.categoryForm.reset();
  els.categoryIdInput.value = "";
  els.categoryTypeInput.disabled = false;
  els.categoryColorInput.value = "#16a34a";
  els.categoryIconInput.value = DEFAULT_CATEGORY_ICON;
  els.categorySubmitButton.textContent = "Salvar categoria";
  els.categoryCancelButton.classList.add("hidden");
  renderCategoryIconPicker();
  renderCategoryColorPicker();
  closeCategoryColorPopover();
}

function submitCategory(event) {
  event.preventDefault();
  const label = els.categoryNameInput.value.trim();
  const type = els.categoryTypeInput.value === "income" ? "income" : "expense";
  const color = normalizeHexColor(els.categoryColorInput.value);
  const icon = normalizeIconName(els.categoryIconInput.value);
  if (!label) {
    showToast("Informe o nome da categoria.");
    return;
  }

  const duplicate = allCategories().find((category) => (
    category.label.toLowerCase() === label.toLowerCase()
    && category.id !== app.editingCategoryId
  ));
  if (duplicate) {
    showToast("Já existe uma categoria com esse nome.");
    return;
  }

  if (app.editingCategoryId) {
    const current = categoryById(app.editingCategoryId);
    const currentType = current.type || findCategoryType(current.id);
    app.state.categories[currentType] = app.state.categories[currentType].map((category) => (
      category.id === app.editingCategoryId
        ? { ...category, label, color, icon, type: currentType }
        : category
    ));
    showToast("Categoria atualizada.");
  } else {
    const idBase = slugify(label) || "categoria";
    const id = uniqueCategoryId(idBase);
    app.state.categories[type].push({ id, label, color, icon, type });
    showToast("Categoria criada.");
  }

  saveState();
  resetCategoryForm();
  renderAll();
}

function editCategory(id) {
  const category = categoryById(id);
  const type = findCategoryType(id);
  if (!category || !type) return;
  app.editingCategoryId = id;
  els.categoryIdInput.value = id;
  els.categoryNameInput.value = category.label;
  els.categoryTypeInput.value = type;
  els.categoryTypeInput.disabled = true;
  els.categoryColorInput.value = category.color;
  els.categoryIconInput.value = normalizeIconName(category.icon);
  els.categorySubmitButton.textContent = "Salvar alteração";
  els.categoryCancelButton.classList.remove("hidden");
  renderCategoryIconPicker();
  renderCategoryColorPicker();
  els.categoryNameInput.focus();
}

function openConfirmDialog({ title = "Confirmar exclusão?", message = "Essa ação não pode ser desfeita.", action }) {
  app.pendingConfirmAction = typeof action === "function" ? action : null;
  els.confirmTitle.textContent = title;
  els.confirmText.textContent = message;
  els.confirmOverlay.classList.remove("hidden");
  els.confirmOverlay.setAttribute("aria-hidden", "false");
  closeCustomFormControls();
  closeCategoryColorPopover();
  requestAnimationFrame(() => els.confirmCancel.focus());
}

function closeConfirmDialog() {
  els.confirmOverlay.classList.add("hidden");
  els.confirmOverlay.setAttribute("aria-hidden", "true");
  app.pendingConfirmAction = null;
}

function confirmPendingAction() {
  const action = app.pendingConfirmAction;
  closeConfirmDialog();
  if (action) action();
}

function confirmDeleteCategory(id) {
  const category = allCategories().find((item) => item.id === id);
  if (!category) return;
  const usageCount = app.state.transactions.filter((item) => item.category === id).length;
  const suffix = usageCount
    ? ` ${usageCount} ${usageCount === 1 ? "lançamento antigo ficará" : "lançamentos antigos ficarão"} como Categoria removida.`
    : "";
  openConfirmDialog({
    title: "Excluir categoria?",
    message: `Excluir "${category.label}"?${suffix}`,
    action: () => deleteCategory(id)
  });
}

function deleteCategory(id) {
  const type = findCategoryType(id);
  if (!type) return;

  delete app.state.budgets[id];
  app.state.categories.income = app.state.categories.income.filter((category) => category.id !== id);
  app.state.categories.expense = app.state.categories.expense.filter((category) => category.id !== id);
  if (app.filters.category === id) app.filters.category = "all";
  if (els.categoryInput.value === id) fillCategoryInputs();
  saveState();
  if (app.editingCategoryId === id) resetCategoryForm();
  closeCustomFormControls();
  renderAll();
  showToast("Categoria excluída.");
}

function findCategoryType(id) {
  if (app.state.categories.income.some((category) => category.id === id)) return "income";
  if (app.state.categories.expense.some((category) => category.id === id)) return "expense";
  return "";
}

function uniqueCategoryId(base) {
  let id = base;
  let index = 2;
  const ids = new Set(allCategories().map((category) => category.id));
  while (ids.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  return id;
}

function setCurrentType(type) {
  app.currentType = type === "expense" ? "expense" : "income";
  document.querySelectorAll(".segment").forEach((button) => {
    button.classList.toggle("active", button.dataset.type === app.currentType);
  });
  fillCategoryInputs();
}

function resetTransactionForm() {
  app.editingTransactionId = null;
  els.transactionForm.reset();
  els.transactionIdInput.value = "";
  els.dateInput.value = toISO(new Date());
  fillAccountInput(uniqueAccounts()[0] || "");
  els.formTitle.textContent = "Nova movimentação";
  els.submitButton.textContent = "Salvar";
  els.btnDeleteTransaction.classList.add("hidden");
  setCurrentType("income");
}

function submitTransaction(event) {
  event.preventDefault();
  const accountValue = currentAccountValue();
  if (els.accountInput.value === ACCOUNT_NEW_VALUE && !accountValue) {
    showToast("Informe o nome da nova conta.");
    els.customAccountInput.focus();
    return;
  }

  const payload = normalizeTransaction({
    id: app.editingTransactionId || uid("transaction"),
    type: app.currentType,
    description: els.descriptionInput.value,
    amount: parseCurrencyValue(els.amountInput.value),
    date: els.dateInput.value,
    category: els.categoryInput.value,
    account: accountValue,
    recurring: els.recurringInput.checked,
    notes: els.notesInput.value
  });

  if (!payload) {
    showToast("Preencha descrição, valor, data e categoria.");
    return;
  }

  if (app.editingTransactionId) {
    app.state.transactions = app.state.transactions.map((item) => item.id === payload.id ? payload : item);
    showToast("Lançamento atualizado.");
  } else {
    app.state.transactions.push(payload);
    showToast("Lançamento adicionado.");
  }

  app.state.selectedDate = payload.date;
  saveState();
  resetTransactionForm();
  renderAll();
  closeTransactionDrawer();
}

function editTransaction(id) {
  const item = app.state.transactions.find((entry) => entry.id === id);
  if (!item) return;

  app.editingTransactionId = id;
  setCurrentType(item.type);
  els.transactionIdInput.value = item.id;
  els.descriptionInput.value = item.description;
  els.amountInput.value = formatCurrencyInputValue(item.amount);
  els.dateInput.value = item.date;
  els.categoryInput.value = item.category;
  fillAccountInput(item.account || "");
  els.notesInput.value = item.notes || "";
  els.recurringInput.checked = item.recurring;
  els.formTitle.textContent = "Editar movimentação";
  els.submitButton.textContent = "Salvar";
  els.btnDeleteTransaction.classList.remove("hidden");
  openTransactionDrawer();
  els.descriptionInput.focus();
}

function deleteTransaction(id) {
  app.state.transactions = app.state.transactions.filter((item) => item.id !== id);
  saveState();
  if (app.editingTransactionId === id) resetTransactionForm();
  renderAll();
  closeTransactionDrawer();
  showToast("Lançamento excluído.");
}

function confirmDeleteTransaction(id) {
  const transaction = app.state.transactions.find((item) => item.id === id);
  if (!transaction) return;
  openConfirmDialog({
    title: "Excluir lançamento?",
    message: `Excluir "${transaction.description}" de ${brl(transaction.amount)}? Essa ação não pode ser desfeita.`,
    action: () => deleteTransaction(id)
  });
}

function submitBudget(event) {
  event.preventDefault();
  app.state.budgets[els.budgetCategoryInput.value] = Number(els.budgetAmountInput.value);
  els.budgetAmountInput.value = "";
  els.budgetForm.classList.add("hidden");
  saveState();
  renderAll();
  showToast("Limite mensal salvo.");
}

function resetGoalForm() {
  app.editingGoalId = null;
  els.goalForm.reset();
  els.goalSubmitButton.textContent = "Criar meta";
  syncGoalCategoryButtons();
}

function syncGoalCategoryButtons() {
  document.querySelectorAll("[data-goal-category]").forEach((button) => {
    const active = button.dataset.goalCategory === els.goalCategoryInput.value;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function focusGoalForm() {
  els.goalBuilder?.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => els.goalNameInput.focus(), 220);
}

function goalContributionHistory(goal) {
  if (goal.contributions?.length) return [...goal.contributions];
  if (Number(goal.saved) > 0) {
    return [{ id: `legacy-${goal.id}`, amount: Number(goal.saved), date: "", label: "Saldo anterior" }];
  }
  return [];
}

function openGoalHistory(id) {
  const goal = app.state.goals.find((item) => item.id === id);
  if (!goal) return;
  const history = goalContributionHistory(goal).reverse();
  els.goalHistoryTitle.textContent = goal.name;
  els.goalHistorySummary.innerHTML = `
    <div>
      <span>Total guardado</span>
      <strong>${brl(goal.saved)}</strong>
    </div>
    <div>
      <span>Objetivo</span>
      <strong>${brl(goal.target)}</strong>
    </div>
    <div>
      <span>Registros</span>
      <strong>${history.length}</strong>
    </div>
  `;
  els.goalHistoryList.innerHTML = history.length
    ? history.map((entry) => `
      <article class="goal-history-item">
        <div>
          <strong>${escapeHTML(entry.label)}</strong>
          <span>${entry.date ? escapeHTML(formatFullDate(fromISO(entry.date))) : "Registro anterior ao histórico"}</span>
        </div>
        <strong class="${entry.amount < 0 ? "amount-expense" : "amount-income"}">
          ${entry.amount < 0 ? "-" : "+"} ${brl(Math.abs(entry.amount))}
        </strong>
      </article>
    `).join("")
    : '<div class="goal-history-empty">Nenhum aporte registrado.</div>';
  els.goalHistoryOverlay.classList.remove("hidden");
  els.goalHistoryOverlay.setAttribute("aria-hidden", "false");
  els.goalHistoryOverlay.inert = false;
  refreshLucideIcons();
  els.goalHistoryClose.focus();
}

function closeGoalHistory() {
  els.goalHistoryOverlay.classList.add("hidden");
  els.goalHistoryOverlay.setAttribute("aria-hidden", "true");
  els.goalHistoryOverlay.inert = true;
}

function addGoalContribution(id, amount) {
  const value = Number(amount);
  const goal = app.state.goals.find((item) => item.id === id);
  if (!goal || !Number.isFinite(value) || value <= 0) {
    showToast("Informe um valor válido para o aporte.");
    return;
  }

  const remaining = Math.max(0, Number(goal.target) - Number(goal.saved));
  const applied = Math.min(value, remaining);
  if (!goal.contributions?.length && Number(goal.saved) > 0) {
    goal.contributions = goalContributionHistory(goal);
  }
  goal.contributions = goal.contributions || [];
  goal.contributions.push({
    id: uid("contribution"),
    amount: applied,
    date: toISO(new Date()),
    label: "Aporte"
  });
  goal.saved = Number(goal.saved) + applied;
  saveState();
  renderAll();
  showToast(applied >= remaining ? "Meta concluída. Excelente avanço!" : `${brl(applied)} adicionados à meta.`);
}

function submitGoal(event) {
  event.preventDefault();
  if (!els.goalCategoryInput.value) {
    showToast("Selecione uma categoria para a meta.");
    return;
  }
  const previousGoal = app.editingGoalId
    ? app.state.goals.find((item) => item.id === app.editingGoalId)
    : null;
  const nextSaved = parseCurrencyValue(els.goalSavedInput.value);
  let contributions = previousGoal ? goalContributionHistory(previousGoal) : [];
  if (!previousGoal && nextSaved > 0) {
    contributions.push({ id: uid("contribution"), amount: nextSaved, date: toISO(new Date()), label: "Valor inicial" });
  }
  if (previousGoal && nextSaved !== Number(previousGoal.saved)) {
    contributions.push({
      id: uid("contribution"),
      amount: nextSaved - Number(previousGoal.saved),
      date: toISO(new Date()),
      label: "Ajuste manual"
    });
  }
  const goal = normalizeGoal({
    id: app.editingGoalId || uid("goal"),
    name: els.goalNameInput.value,
    category: els.goalCategoryInput.value,
    target: parseCurrencyValue(els.goalTargetInput.value),
    saved: nextSaved,
    contributions,
    due: els.goalDueInput.value
  });

  if (!goal) {
    showToast("Preencha uma meta válida.");
    return;
  }

  if (app.editingGoalId) {
    app.state.goals = app.state.goals.map((item) => item.id === goal.id ? goal : item);
    showToast("Meta atualizada.");
  } else {
    app.state.goals.push(goal);
    showToast("Meta adicionada.");
  }

  saveState();
  resetGoalForm();
  renderAll();
}

function editGoal(id) {
  const goal = app.state.goals.find((item) => item.id === id);
  if (!goal) return;
  app.editingGoalId = id;
  els.goalNameInput.value = goal.name;
  els.goalTargetInput.value = formatCurrencyInputValue(goal.target);
  els.goalSavedInput.value = formatCurrencyInputValue(goal.saved);
  els.goalDueInput.value = goal.due || "";
  els.goalCategoryInput.value = goal.category || "";
  els.goalSubmitButton.textContent = "Salvar meta";
  syncGoalCategoryButtons();
  setView("goals");
  focusGoalForm();
}

function deleteGoal(id) {
  app.state.goals = app.state.goals.filter((item) => item.id !== id);
  saveState();
  renderAll();
  showToast("Meta removida.");
}

function confirmDeleteGoal(id) {
  const goal = app.state.goals.find((item) => item.id === id);
  if (!goal) return;
  openConfirmDialog({
    title: "Excluir meta?",
    message: `Excluir "${goal.name}"? O progresso registrado nessa meta será removido.`,
    action: () => deleteGoal(id)
  });
}

function setView(view) {
  app.currentView = view;
  app.state.currentView = view;
  saveState();
  updateTitle();
  updateNavButtons();
  closeSidebar();
  if (view === "overview") renderCharts();
}

function setPeriod(period) {
  app.state.period = period;
  saveState();
  renderAll();
}

function changePeriod(amount) {
  if (app.state.period === "all") return;
  const current = selectedDate();
  if (app.state.period === "week") app.state.selectedDate = toISO(addDays(current, amount * 7));
  else app.state.selectedDate = toISO(addMonths(current, amount));
  saveState();
  renderAll();
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  els.toastContainer.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2800);
}

function openSidebar() {
  els.sidebar.classList.add("open");
  els.sidebarOverlay.classList.add("visible");
  els.hamburgerBtn.setAttribute("aria-expanded", "true");
}

function closeSidebar() {
  els.sidebar.classList.remove("open");
  els.sidebarOverlay.classList.remove("visible");
  els.hamburgerBtn.setAttribute("aria-expanded", "false");
}

function openTransactionDrawer() {
  els.transactionDrawerOverlay.classList.remove("hidden");
  requestAnimationFrame(() => {
    els.transactionDrawer.classList.add("open");
    els.transactionDrawerOverlay.classList.add("visible");
    document.body.classList.add("drawer-open");
  });
}

function closeTransactionDrawer() {
  els.transactionDrawer.classList.remove("open");
  els.transactionDrawerOverlay.classList.remove("visible");
  document.body.classList.remove("drawer-open");
  window.setTimeout(() => {
    if (!els.transactionDrawer.classList.contains("open")) {
      els.transactionDrawerOverlay.classList.add("hidden");
    }
  }, 220);
}

function generateInvoicePDF() {
  const items = visibleTransactions();
  if (!items.length) {
    showToast("Nenhum lan\u00e7amento para gerar fatura.");
    return;
  }

  const totals = totalsFor(items);
  const range = periodRange();
  const rows = items.map((item) => `
    <tr>
      <td>${escapeHTML(formatFullDate(fromISO(item.date)))}</td>
      <td>
        <strong>${escapeHTML(item.description)}</strong>
        ${item.notes ? `<small>${escapeHTML(item.notes)}</small>` : ""}
      </td>
      <td>${escapeHTML(categoryLabel(item.category))}</td>
      <td>${escapeHTML(item.account || "-")}</td>
      <td class="${item.type === "income" ? "income" : "expense"}">
        ${item.type === "income" ? "+" : "-"} ${brl(item.amount)}
      </td>
    </tr>
  `).join("");

  const invoiceWindow = window.open("", "_blank", "width=960,height=720");
  if (!invoiceWindow) {
    showToast("Permita pop-ups para gerar a fatura.");
    return;
  }

  invoiceWindow.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Fatura Gates - ${escapeHTML(range.label)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 32px;
            color: #111827;
            font: 13px/1.45 Arial, sans-serif;
          }
          header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 24px;
            padding-bottom: 18px;
            border-bottom: 1px solid #d1d5db;
            margin-bottom: 20px;
          }
          h1 { margin: 0 0 6px; font-size: 24px; }
          p { margin: 0; color: #4b5563; }
          .totals {
            display: grid;
            gap: 6px;
            min-width: 220px;
            text-align: right;
          }
          .totals strong { color: #111827; }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            padding: 10px 8px;
            border-bottom: 1px solid #e5e7eb;
            text-align: left;
            vertical-align: top;
          }
          th {
            color: #6b7280;
            font-size: 11px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }
          td strong { display: block; }
          td small { color: #6b7280; }
          .income { color: #15803d; font-weight: 700; }
          .expense { color: #dc2626; font-weight: 700; }
          @page { margin: 18mm; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>Fatura Gates</h1>
            <p>${escapeHTML(range.label)} · ${items.length} ${items.length === 1 ? "lan\u00e7amento" : "lan\u00e7amentos"}</p>
            <p>Gerado em ${escapeHTML(new Date().toLocaleString("pt-BR"))}</p>
          </div>
          <div class="totals">
            <span>Entradas: <strong>${brl(totals.income)}</strong></span>
            <span>Sa\u00eddas: <strong>${brl(totals.expense)}</strong></span>
            <span>Saldo: <strong>${brl(totals.balance)}</strong></span>
          </div>
        </header>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Descri\u00e7\u00e3o</th>
              <th>Categoria</th>
              <th>Conta</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <script>
          window.addEventListener("load", () => {
            window.focus();
            window.print();
          });
        <\/script>
      </body>
    </html>
  `);
  invoiceWindow.document.close();
  showToast("Fatura pronta para salvar em PDF.");
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(exportPayload(), null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `financas-${monthKey(selectedDate())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Arquivo financeiro exportado.");
}

function renderImportChoices() {
  app.pendingImport = null;
  els.importTitle.textContent = "Importar dados";
  els.importActions.classList.add("hidden");
  els.importConfirm.disabled = false;
  els.importBody.innerHTML = `
    <p class="import-intro">Escolha o tipo de arquivo que deseja adicionar.</p>
    <div class="import-type-grid">
      <button type="button" data-import-type="pdf">
        <span>${lucideIcon("file-text")}</span>
        <strong>Extrato PDF</strong>
        <small>Revisar movimentações antes de adicionar</small>
      </button>
      <button type="button" data-import-type="json">
        <span>${lucideIcon("file-json")}</span>
        <strong>Backup JSON</strong>
        <small>Restaurar os dados completos do Gates</small>
      </button>
    </div>
  `;
  refreshLucideIcons();
}

function openImportModal() {
  renderImportChoices();
  els.importOverlay.classList.remove("hidden");
  els.importOverlay.setAttribute("aria-hidden", "false");
  els.importOverlay.inert = false;
  closeSidebar();
  els.importClose.focus();
}

function closeImportModal() {
  els.importOverlay.classList.add("hidden");
  els.importOverlay.setAttribute("aria-hidden", "true");
  els.importOverlay.inert = true;
  els.importJsonInput.value = "";
  els.importPdfInput.value = "";
  app.pendingImport = null;
}

async function prepareJsonImport(file) {
  const payload = JSON.parse(await file.text());
  const state = normalizeState(payload);
  app.pendingImport = { type: "json", state };
  els.importTitle.textContent = "Revisar backup JSON";
  els.importBody.innerHTML = `
    <div class="import-review-note">
      <strong>Este backup substituirá os dados atuais.</strong>
      <span>Revise o conteúdo identificado antes de continuar.</span>
    </div>
    <div class="import-review-summary">
      <div><span>Lançamentos</span><strong>${state.transactions.length}</strong></div>
      <div><span>Metas</span><strong>${state.goals.length}</strong></div>
      <div><span>Categorias</span><strong>${[...state.categories.income, ...state.categories.expense].length}</strong></div>
    </div>
    <p class="import-file-name">${escapeHTML(file.name)}</p>
  `;
  els.importConfirm.textContent = "Restaurar backup";
  els.importActions.classList.remove("hidden");
}

function groupPdfTextItems(items, pageNumber = 1) {
  return window.GatesPdfParser.groupPdfTextItems(items, pageNumber);
}

function parseStatementDate(value, context = {}) {
  return window.GatesPdfParser.parseStatementDate(value, context);
}

function parseStatementLine(line, fileName, context = {}) {
  return window.GatesPdfParser.parseStatementLine(line, fileName, context);
}

function transactionFingerprint(item) {
  return window.GatesPdfParser.transactionFingerprint(item);
}

async function extractPdfTransactions(file) {
  if (!window.GatesPdfParser) throw new Error("PDF_PROCESSING_FAILED");
  if (!window.pdfjsLib?.getDocument) throw new Error("PDF_LIBRARY_UNAVAILABLE");
  if (file.size > PDF_MAX_FILE_SIZE) throw new Error("PDF_TOO_LARGE");
  if (file.type && file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) throw new Error("PDF_INVALID");

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
  let loadingTask = null;
  let pdf = null;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    loadingTask = window.pdfjsLib.getDocument({ data });
    pdf = await loadingTask.promise;
    const rows = [];
    let textItemCount = 0;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const text = await page.getTextContent();
      textItemCount += text.items.filter((item) => String(item.str || "").trim()).length;
      rows.push(...groupPdfTextItems(text.items, pageNumber));
      page.cleanup();
    }

    if (!textItemCount) throw new Error("PDF_EMPTY_TEXT");
    const parsed = window.GatesPdfParser.parseDocumentRows(
      rows,
      file.name,
      app.state.transactions,
      { fallbackYear: new Date().getFullYear(), today: toISO(new Date()) }
    );
    if (!parsed.transactions.length) throw new Error("PDF_NO_TRANSACTIONS");
    return parsed.transactions.map((item) => ({ ...item, id: item.id || uid("transaction") }));
  } catch (error) {
    if ([
      "PDF_LIBRARY_UNAVAILABLE", "PDF_INVALID", "PDF_PASSWORD_PROTECTED", "PDF_TOO_LARGE",
      "PDF_EMPTY_TEXT", "PDF_NO_TRANSACTIONS", "PDF_PROCESSING_FAILED"
    ].includes(error?.message)) throw error;
    if (error?.name === "PasswordException" || error?.code === 1 || error?.code === 2) {
      throw new Error("PDF_PASSWORD_PROTECTED");
    }
    if (["InvalidPDFException", "MissingPDFException", "UnexpectedResponseException"].includes(error?.name)) {
      throw new Error("PDF_INVALID");
    }
    throw new Error("PDF_PROCESSING_FAILED");
  } finally {
    try {
      if (pdf) await pdf.destroy();
      else if (loadingTask?.destroy) await loadingTask.destroy();
    } catch {
      // PDF.js cleanup failures do not change the import result.
    }
  }
}

function pdfImportErrorMessage(code) {
  return {
    PDF_LIBRARY_UNAVAILABLE: "O leitor de PDF não foi carregado.",
    PDF_INVALID: "Este arquivo não é um PDF válido.",
    PDF_PASSWORD_PROTECTED: "Este PDF está protegido por senha.",
    PDF_TOO_LARGE: "O arquivo excede o tamanho permitido.",
    PDF_EMPTY_TEXT: "Este PDF não possui texto selecionável.",
    PDF_NO_TRANSACTIONS: "Nenhuma movimentação foi identificada neste documento.",
    PDF_PROCESSING_FAILED: "Não foi possível processar o PDF."
  }[code] || "Não foi possível processar o PDF.";
}

function renderPdfImportPreview(file, transactions, errorCode = "") {
  app.pendingImport = { type: "pdf", transactions };
  const selectable = transactions.filter((item) => !item.duplicate).length;
  const emptyMessage = errorCode ? pdfImportErrorMessage(errorCode) : "Nenhuma movimentação identificada.";
  els.importTitle.textContent = "Revisar extrato PDF";
  els.importBody.innerHTML = `
    <div class="import-review-note">
      <strong>${transactions.length ? `${transactions.length} movimentações encontradas` : "Nenhuma movimentação identificada"}</strong>
      <span>${transactions.length ? `${selectable} disponíveis para importar. Revise o tipo de cada item.` : escapeHTML(emptyMessage)}</span>
    </div>
    ${transactions.length ? `
      <div class="import-preview-list">
        ${transactions.map((item, index) => `
          <label class="import-preview-row ${item.duplicate ? "duplicate" : ""}" data-import-index="${index}">
            <input type="checkbox" ${item.duplicate ? "disabled" : "checked"}>
            <div class="import-preview-copy">
              <input type="text" value="${escapeHTML(item.description)}" aria-label="Descrição importada">
              <span>${escapeHTML(formatFullDate(fromISO(item.date)))}${item.duplicate ? " · Possível duplicata" : ""}</span>
            </div>
            <select aria-label="Tipo do lançamento importado">
              <option value="expense" ${item.type === "expense" ? "selected" : ""}>Saída</option>
              <option value="income" ${item.type === "income" ? "selected" : ""}>Entrada</option>
            </select>
            <strong>${brl(item.amount)}</strong>
          </label>
        `).join("")}
      </div>
    ` : ""}
    <p class="import-file-name">${escapeHTML(file.name)}</p>
  `;
  els.importConfirm.textContent = "Importar lançamentos";
  els.importConfirm.disabled = selectable === 0;
  els.importActions.classList.remove("hidden");
}

async function preparePdfImport(file) {
  if (app.pdfImportInProgress) return;
  app.pdfImportInProgress = true;
  els.importTitle.textContent = "Lendo extrato";
  els.importBody.innerHTML = '<div class="import-loading">Analisando as movimentações do PDF...</div>';
  els.importActions.classList.add("hidden");
  try {
    const transactions = await extractPdfTransactions(file);
    renderPdfImportPreview(file, transactions);
  } finally {
    app.pdfImportInProgress = false;
  }
}

function confirmPreparedImport() {
  if (!app.pendingImport || app.importConfirming) return;
  if (app.pendingImport.type === "json") {
    app.importConfirming = true;
    app.state = app.pendingImport.state;
    app.currentView = app.state.currentView;
    app.chartRange = app.state.chartRange;
    app.categoryChartType = app.state.categoryChartType;
    saveState();
    resetTransactionForm();
    resetGoalForm();
    renderAll();
    closeImportModal();
    showToast("Backup JSON restaurado.");
    app.importConfirming = false;
    return;
  }

  const selectedRows = [...els.importBody.querySelectorAll("[data-import-index]")]
    .filter((row) => row.querySelector('input[type="checkbox"]').checked)
    .map((row) => ({
      row,
      source: app.pendingImport.transactions[Number(row.dataset.importIndex)]
    }));
  if (!selectedRows.length) {
    showToast("Selecione ao menos um lançamento.");
    return;
  }

  app.importConfirming = true;
  els.importConfirm.disabled = true;
  try {
    const stagedCategories = cloneCategories(app.state.categories);
    const selectedItems = selectedRows.map(({ row, source }) => {
      const type = row.querySelector("select").value;
      const description = row.querySelector('.import-preview-copy input').value.trim();
      if (!description) return null;
      const category = window.GatesPdfParser.resolveCategory(
        stagedCategories,
        type,
        description,
        true
      );
      return normalizeTransaction({
        ...source,
        type,
        description,
        category
      }, stagedCategories);
    })
    .filter(Boolean);
    if (!selectedItems.length) {
      showToast("Nenhum lançamento válido foi selecionado.");
      els.importConfirm.disabled = false;
      return;
    }
    app.state.categories = stagedCategories;
    app.state.transactions.push(...selectedItems);
    saveState();
    renderAll();
    closeImportModal();
    showToast(`${selectedItems.length} ${selectedItems.length === 1 ? "lançamento importado" : "lançamentos importados"}.`);
  } catch {
    showToast("Não foi possível concluir a importação.");
    els.importConfirm.disabled = false;
  } finally {
    app.importConfirming = false;
  }
}

function bindEvents() {
  els.hamburgerBtn.addEventListener("click", openSidebar);
  els.sidebarCloseBtn.addEventListener("click", closeSidebar);
  els.sidebarOverlay.addEventListener("click", closeSidebar);

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  document.querySelectorAll(".period-btn").forEach((button) => {
    button.addEventListener("click", () => setPeriod(button.dataset.period));
  });

  els.chartRangeToggle.addEventListener("click", (event) => {
    const button = event.target.closest(".chart-range-btn");
    if (!button) return;
    app.chartRange = button.dataset.chartRange;
    app.state.chartRange = app.chartRange;
    saveState();
    updatePeriodButtons();
    renderCharts();
  });

  els.categoryChartType.addEventListener("change", () => {
    app.categoryChartType = els.categoryChartType.value;
    app.state.categoryChartType = app.categoryChartType;
    saveState();
    renderCharts();
  });

  [els.btnNewTransactionSide, els.btnNewTransactionTop, els.fabBtn].forEach((button) => {
    button.addEventListener("click", () => {
      resetTransactionForm();
      openTransactionDrawer();
      window.setTimeout(() => els.descriptionInput.focus(), 180);
      closeSidebar();
    });
  });

  els.btnGenerateInvoicePdf.addEventListener("click", generateInvoicePDF);

  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => setCurrentType(button.dataset.type));
  });

  els.btnPrev.addEventListener("click", () => changePeriod(-1));
  els.btnNext.addEventListener("click", () => changePeriod(1));
  els.btnToday.addEventListener("click", () => {
    app.state.selectedDate = toISO(new Date());
    saveState();
    renderAll();
  });

  els.themeToggleBtn.addEventListener("click", () => {
    app.state.theme = app.state.theme === "dark" ? "light" : "dark";
    saveState();
    renderAll();
  });

  els.searchInput.addEventListener("input", () => {
    app.filters.search = els.searchInput.value.trim();
    renderAll();
  });

  els.filterType.addEventListener("change", () => {
    app.filters.type = els.filterType.value;
    fillFilters();
    renderAll();
  });

  els.filterCategory.addEventListener("change", () => {
    app.filters.category = els.filterCategory.value;
    renderAll();
  });

  els.filterAccount.addEventListener("change", () => {
    app.filters.account = els.filterAccount.value;
    renderAll();
  });

  els.filterClearBtn.addEventListener("click", () => {
    app.filters = { search: "", type: "all", category: "all", account: "all" };
    els.searchInput.value = "";
    renderAll();
  });

  els.transactionForm.addEventListener("submit", submitTransaction);
  els.amountInput.addEventListener("blur", () => {
    els.amountInput.value = formatCurrencyInputValue(parseCurrencyValue(els.amountInput.value));
  });
  [els.goalTargetInput, els.goalSavedInput].forEach((input) => {
    input.addEventListener("blur", () => {
      input.value = formatCurrencyInputValue(parseCurrencyValue(input.value));
    });
  });
  els.accountInput.addEventListener("change", () => {
    updateAccountInputState();
    if (els.accountInput.value === ACCOUNT_NEW_VALUE) els.customAccountInput.focus();
  });
  els.clearFormButton.addEventListener("click", closeTransactionDrawer);
  els.transactionDrawerOverlay.addEventListener("click", closeTransactionDrawer);
  els.btnDeleteTransaction.addEventListener("click", () => {
    if (app.editingTransactionId) confirmDeleteTransaction(app.editingTransactionId);
  });

  els.transactionTable.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "edit") editTransaction(button.dataset.id);
    if (button.dataset.action === "delete") confirmDeleteTransaction(button.dataset.id);
  });

  els.btnToggleBudgetForm.addEventListener("click", () => {
    els.budgetForm.classList.toggle("hidden");
    if (!els.budgetForm.classList.contains("hidden")) els.budgetAmountInput.focus();
  });
  els.budgetForm.addEventListener("submit", submitBudget);
  els.goalForm.addEventListener("submit", submitGoal);
  els.btnFocusGoalForm?.addEventListener("click", focusGoalForm);
  document.querySelectorAll("[data-goal-category]").forEach((button) => {
    button.addEventListener("click", () => {
      els.goalCategoryInput.value = button.dataset.goalCategory;
      syncGoalCategoryButtons();
      els.goalNameInput.focus();
    });
  });
  els.goalList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "edit-goal") editGoal(button.dataset.id);
    if (button.dataset.action === "delete-goal") confirmDeleteGoal(button.dataset.id);
    if (button.dataset.action === "open-goal-history") openGoalHistory(button.dataset.id);
    if (button.dataset.action === "add-contribution") {
      addGoalContribution(button.dataset.id, Number(button.dataset.amount));
    }
    if (button.dataset.action === "toggle-contribution") {
      const form = els.goalList.querySelector(`[data-goal-contribution="${CSS.escape(button.dataset.id)}"]`);
      if (!form) return;
      const willOpen = form.classList.contains("hidden");
      els.goalList.querySelectorAll(".goal-contribution").forEach((item) => item.classList.add("hidden"));
      els.goalList.querySelectorAll("[data-action='toggle-contribution']").forEach((item) => item.setAttribute("aria-expanded", "false"));
      form.classList.toggle("hidden", !willOpen);
      button.setAttribute("aria-expanded", String(willOpen));
      if (willOpen) form.elements.amount.focus();
    }
  });
  els.goalList.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-goal-contribution]");
    if (!form) return;
    event.preventDefault();
    addGoalContribution(form.dataset.goalContribution, parseCurrencyValue(form.elements.amount.value));
  });

  els.categoryForm.addEventListener("submit", submitCategory);
  els.categoryCancelButton.addEventListener("click", resetCategoryForm);
  els.categoryIconButton.addEventListener("click", openCategoryIconModal);
  els.categoryColorButton.addEventListener("click", toggleCategoryColorPopover);
  els.categoryColorPalette.addEventListener("click", (event) => {
    const button = event.target.closest("[data-color]");
    if (!button) return;
    setCategoryColor(button.dataset.color);
    closeCategoryColorPopover();
  });
  els.categoryColorHexInput.addEventListener("input", () => {
    const value = els.categoryColorHexInput.value.trim();
    if (/^#[0-9a-f]{6}$/i.test(value)) setCategoryColor(value);
  });
  els.categoryIconModalClose.addEventListener("click", closeCategoryIconModal);
  els.categoryIconModal.addEventListener("click", (event) => {
    if (event.target === els.categoryIconModal) closeCategoryIconModal();
  });
  els.categoryIconModalPicker.addEventListener("click", (event) => {
    const button = event.target.closest("[data-icon]");
    if (!button) return;
    els.categoryIconInput.value = normalizeIconName(button.dataset.icon);
    renderCategoryIconPicker();
    closeCategoryIconModal();
  });
  els.categoryBoard.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "edit-category") editCategory(button.dataset.id);
    if (button.dataset.action === "delete-category") confirmDeleteCategory(button.dataset.id);
  });

  els.confirmCancel.addEventListener("click", closeConfirmDialog);
  els.confirmDelete.addEventListener("click", confirmPendingAction);
  els.confirmOverlay.addEventListener("click", (event) => {
    if (event.target === els.confirmOverlay) closeConfirmDialog();
  });
  els.goalHistoryClose.addEventListener("click", closeGoalHistory);
  els.goalHistoryOverlay.addEventListener("click", (event) => {
    if (event.target === els.goalHistoryOverlay) closeGoalHistory();
  });

  els.btnExportJson.addEventListener("click", exportJSON);
  els.btnImportJson.addEventListener("click", openImportModal);
  els.importClose.addEventListener("click", closeImportModal);
  els.importBack.addEventListener("click", renderImportChoices);
  els.importConfirm.addEventListener("click", confirmPreparedImport);
  els.importOverlay.addEventListener("click", (event) => {
    if (event.target === els.importOverlay) closeImportModal();
  });
  els.importBody.addEventListener("click", (event) => {
    const option = event.target.closest("[data-import-type]");
    if (!option) return;
    if (option.dataset.importType === "json") els.importJsonInput.click();
    if (option.dataset.importType === "pdf") els.importPdfInput.click();
  });
  els.importJsonInput.addEventListener("change", async () => {
    const [file] = els.importJsonInput.files;
    els.importJsonInput.value = "";
    if (!file) return;
    try {
      await prepareJsonImport(file);
    } catch {
      showToast("Arquivo JSON inválido.");
      renderImportChoices();
    }
  });
  els.importPdfInput.addEventListener("change", async () => {
    const [file] = els.importPdfInput.files;
    els.importPdfInput.value = "";
    if (!file || app.pdfImportInProgress) return;
    try {
      await preparePdfImport(file);
    } catch (error) {
      const code = error?.message || "PDF_PROCESSING_FAILED";
      showToast(pdfImportErrorMessage(code));
      if (["PDF_EMPTY_TEXT", "PDF_NO_TRANSACTIONS"].includes(code)) {
        renderPdfImportPreview(file, [], code);
      } else {
        renderImportChoices();
      }
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".color-picker-field")) return;
    closeCategoryColorPopover();
  });

  window.addEventListener("resize", () => {
    if (app.currentView === "overview") renderCharts();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.importOverlay.classList.contains("hidden")) {
      closeImportModal();
      return;
    }
    if (event.key === "Escape" && !els.goalHistoryOverlay.classList.contains("hidden")) {
      closeGoalHistory();
      return;
    }
    if (event.key === "Escape" && !els.confirmOverlay.classList.contains("hidden")) {
      closeConfirmDialog();
      return;
    }
    if (event.key === "Escape" && els.transactionDrawer.classList.contains("open")) {
      closeTransactionDrawer();
    }
    if (event.key === "Escape" && !els.categoryIconModal.classList.contains("hidden")) {
      closeCategoryIconModal();
    }
    if (event.key === "Escape" && !els.categoryColorPopover.classList.contains("hidden")) {
      closeCategoryColorPopover();
    }
  });
}

async function init() {
  bindEvents();
  await loadData();
  app.currentView = app.state.currentView || "overview";
  app.chartRange = app.state.chartRange || "30d";
  app.categoryChartType = app.state.categoryChartType || "expense";
  resetTransactionForm();
  resetCategoryForm();
  renderAll();
  initCustomFormControls();
}

init();
