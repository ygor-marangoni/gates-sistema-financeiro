(function attachAccountUtils(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.GatesAccountUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createAccountUtils() {
  "use strict";

  function cleanLabel(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function identity(value) {
    return cleanLabel(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleUpperCase("pt-BR");
  }

  function normalizeAccounts(source = [], transactions = []) {
    const result = [];
    const seen = new Set();
    const candidates = [
      ...(Array.isArray(source) ? source : []),
      ...(Array.isArray(transactions) ? transactions.map((item) => item?.account) : [])
    ];

    candidates.forEach((candidate) => {
      const label = cleanLabel(candidate);
      const key = identity(label);
      if (!label || seen.has(key)) return;
      seen.add(key);
      result.push(label);
    });

    return result.sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  function registerAccount(accounts, label) {
    return normalizeAccounts([...(Array.isArray(accounts) ? accounts : []), label]);
  }

  function removeAccount(accounts, transactions, label) {
    const target = identity(label);
    if (!target) return {
      accounts: normalizeAccounts(accounts),
      transactions: Array.isArray(transactions) ? [...transactions] : [],
      affected: 0,
      removed: false
    };

    let affected = 0;
    const nextTransactions = (Array.isArray(transactions) ? transactions : []).map((item) => {
      if (identity(item?.account) !== target) return item;
      affected += 1;
      return { ...item, account: "" };
    });
    const nextAccounts = normalizeAccounts(accounts)
      .filter((account) => identity(account) !== target);

    return {
      accounts: nextAccounts,
      transactions: nextTransactions,
      affected,
      removed: nextAccounts.length !== normalizeAccounts(accounts).length || affected > 0
    };
  }

  return {
    cleanLabel,
    identity,
    normalizeAccounts,
    registerAccount,
    removeAccount
  };
});
