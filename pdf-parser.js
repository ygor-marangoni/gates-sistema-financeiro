(function attachPdfParser(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.GatesPdfParser = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPdfParser() {
  "use strict";

  const MONTHS = {
    JAN: 1, JANEIRO: 1, JANUARY: 1,
    FEV: 2, FEVEREIRO: 2, FEB: 2, FEBRUARY: 2,
    MAR: 3, MARCO: 3, MARCH: 3,
    ABR: 4, ABRIL: 4, APR: 4, APRIL: 4,
    MAI: 5, MAIO: 5, MAY: 5,
    JUN: 6, JUNHO: 6, JUNE: 6,
    JUL: 7, JULHO: 7, JULY: 7,
    AGO: 8, AGOSTO: 8, AUG: 8, AUGUST: 8,
    SET: 9, SETEMBRO: 9, SEP: 9, SEPT: 9, SEPTEMBER: 9,
    OUT: 10, OUTUBRO: 10, OCT: 10, OCTOBER: 10,
    NOV: 11, NOVEMBRO: 11, NOVEMBER: 11,
    DEZ: 12, DEZEMBRO: 12, DEC: 12, DECEMBER: 12
  };

  const SUMMARY_PHRASES = [
    "TOTAL DA FATURA", "TOTAL DE COMPRAS", "SALDO ANTERIOR", "SALDO ATUAL",
    "SALDO DISPONIVEL", "LIMITE TOTAL", "LIMITE DISPONIVEL", "PAGAMENTO MINIMO",
    "VALOR TOTAL", "MELHOR DIA DE COMPRA", "ENCARGOS PREVISTOS", "RESUMO DA FATURA"
  ];

  const CATEGORY_RULES = [
    { targets: ["TRANSPORTE"], words: ["UBER", "99 ", "99APP", "POSTO", "COMBUSTIVEL", "GASOLINA", "PEDAGIO"] },
    { targets: ["ALIMENTACAO", "ALIMENTOS"], words: ["IFOOD", "RESTAURANTE", "MERCADO", "SUPERMERCADO", "PADARIA", "LANCHONETE"] },
    { targets: ["ASSINATURA", "ASSINATURAS"], words: ["NETFLIX", "SPOTIFY", "PRIME", "DISNEY", "HBO", "DEEZER"] },
    { targets: ["SAUDE"], words: ["FARMACIA", "DROGARIA", "CLINICA", "HOSPITAL", "LABORATORIO"] },
    { targets: ["EDUCACAO"], words: ["FACULDADE", "CURSO", "LIVRARIA", "ESCOLA", "UNIVERSIDADE"] },
    { targets: ["MORADIA", "CASA"], words: ["ALUGUEL", "ENERGIA", "AGUA", "INTERNET", "CONDOMINIO"] },
    { targets: ["LAZER"], words: ["CINEMA", "EVENTO", "STEAM", "INGRESSO", "TEATRO"] },
    { targets: ["SALARIO"], words: ["SALARIO", "PAGAMENTO SALARIAL"] },
    { targets: ["REEMBOLSO"], words: ["REEMBOLSO", "ESTORNO"] }
  ];

  function comparable(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function isoDate(year, month, day) {
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "";
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function datePartsAtStart(line) {
    const normalized = comparable(line);
    const numeric = normalized.match(/^\s*(\d{1,2})\s*[\/.\-]\s*(\d{1,2})(?:\s*[\/.\-]\s*(\d{2,4}))?\b/);
    if (numeric) {
      return {
        day: Number(numeric[1]),
        month: Number(numeric[2]),
        year: numeric[3] ? Number(numeric[3]) : null,
        length: numeric[0].length,
        raw: numeric[0]
      };
    }

    const textual = normalized.match(/^\s*(\d{1,2})\s+(?:DE\s+)?([A-Z]{3,10})(?:\s+(?:DE\s+)?(\d{4}))?\b/);
    if (!textual || !MONTHS[textual[2]]) return null;
    return {
      day: Number(textual[1]),
      month: MONTHS[textual[2]],
      year: textual[3] ? Number(textual[3]) : null,
      length: textual[0].length,
      raw: textual[0]
    };
  }

  function parseIso(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
  }

  function inferYear(month, day, context = {}) {
    const start = parseIso(context.periodStart);
    const end = parseIso(context.periodEnd);
    if (start && end) {
      for (let year = start.year - 1; year <= end.year + 1; year += 1) {
        const candidate = isoDate(year, month, day);
        if (candidate && candidate >= context.periodStart && candidate <= context.periodEnd) return year;
      }
    }

    if (context.referenceYear) {
      let year = Number(context.referenceYear);
      if (context.referenceMonth) {
        const delta = month - Number(context.referenceMonth);
        if (delta > 6) year -= 1;
        if (delta < -6) year += 1;
      }
      return year;
    }

    const today = context.today ? new Date(`${context.today}T12:00:00`) : new Date();
    let year = Number(context.fallbackYear || today.getFullYear());
    const candidate = new Date(year, month - 1, day);
    const futureLimit = new Date(today);
    futureLimit.setDate(futureLimit.getDate() + 45);
    if (candidate > futureLimit) year -= 1;
    return year;
  }

  function parseStatementDate(value, context = {}) {
    const parts = typeof value === "string" ? datePartsAtStart(value) : value;
    if (!parts) return "";
    let year = parts.year;
    if (year !== null && year < 100) year += 2000;
    if (year === null) year = inferYear(parts.month, parts.day, context);
    return isoDate(year, parts.month, parts.day);
  }

  function explicitDateFromText(value) {
    const normalized = comparable(value).trim();
    const parts = datePartsAtStart(normalized);
    if (!parts || parts.year === null) return "";
    return parseStatementDate(parts);
  }

  function detectDocumentContext(allText, options = {}) {
    const text = comparable(allText);
    const invoiceScore = ["FATURA", "PAGAMENTO MINIMO", "LIMITE", "MELHOR DIA DE COMPRA"]
      .filter((term) => text.includes(term)).length;
    const statementScore = ["EXTRATO", "CONTA CORRENTE", "AGENCIA", "PIX", "TED", "TRANSFERENCIA"]
      .filter((term) => text.includes(term)).length;
    const documentType = invoiceScore >= 1 || text.includes("FATURA DO CARTAO")
      ? "credit_card_invoice"
      : statementScore >= 2 || text.includes("EXTRATO BANCARIO")
        ? "bank_statement"
        : "unknown";

    let periodStart = "";
    let periodEnd = "";
    const rangePattern = /(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})\s*(?:A|ATE|-)\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/g;
    const range = rangePattern.exec(text);
    if (range) {
      periodStart = explicitDateFromText(range[1]);
      periodEnd = explicitDateFromText(range[2]);
    }

    let referenceYear = null;
    let referenceMonth = null;
    const monthReference = text.match(/(?:FATURA|REFERENCIA|COMPETENCIA|MES)\s*(?:DE\s*)?([A-Z]{3,10})[\s\/\-]+(20\d{2})/);
    if (monthReference && MONTHS[monthReference[1]]) {
      referenceMonth = MONTHS[monthReference[1]];
      referenceYear = Number(monthReference[2]);
    }

    const numericReference = text.match(/(?:REFERENCIA|COMPETENCIA|FATURA)\D{0,15}(0?[1-9]|1[0-2])[\/\-](20\d{2})/);
    if (!referenceYear && numericReference) {
      referenceMonth = Number(numericReference[1]);
      referenceYear = Number(numericReference[2]);
    }

    const labeledDatePattern = /(?:VENCIMENTO|FECHAMENTO|EMISSAO|DATA DA FATURA)\D{0,20}(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/g;
    const labeledTextDatePattern = /(?:VENCIMENTO|FECHAMENTO|EMISSAO|DATA DA FATURA)\D{0,20}(\d{1,2}\s+(?:DE\s+)?[A-Z]{3,10}(?:\s+(?:DE\s+)?20\d{2}))/g;
    const labeledDates = [
      ...[...text.matchAll(labeledDatePattern)].map((match) => match[1]),
      ...[...text.matchAll(labeledTextDatePattern)].map((match) => match[1])
    ]
      .map((value) => explicitDateFromText(value))
      .filter(Boolean);
    if (labeledDates.length) {
      const parts = parseIso(labeledDates[0]);
      referenceYear = referenceYear || parts.year;
      referenceMonth = referenceMonth || parts.month;
    }

    if ((!referenceYear || !referenceMonth) && periodEnd) {
      const parts = parseIso(periodEnd);
      referenceYear = referenceYear || parts.year;
      referenceMonth = referenceMonth || parts.month;
    }

    if (!referenceYear) {
      const years = [...text.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
      if (years.length) referenceYear = Math.max(...years);
    }

    return {
      documentType,
      referenceYear,
      referenceMonth,
      periodStart,
      periodEnd,
      fallbackYear: options.fallbackYear || new Date().getFullYear(),
      today: options.today || ""
    };
  }

  function parseMoneyAtEnd(line, context = {}) {
    const pattern = /(?<![\/\d])(?:R\$\s*)?([+-]?\s*(?:(?:\d{1,3}(?:[.\s]\d{3})+)|\d+),\d{2})\s*([+-])?\s*([DC])?/gi;
    const matches = [...String(line || "").matchAll(pattern)];
    if (!matches.length) return null;
    const match = context.documentType === "bank_statement" && matches.length > 1
      ? matches[0]
      : matches[matches.length - 1];
    const numeric = match[1].replace(/\s/g, "").replace(/^[+-]/, "").replace(/\./g, "").replace(",", ".");
    const amount = Number(numeric);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const prefixSign = match[1].trim().startsWith("-") ? "-" : match[1].trim().startsWith("+") ? "+" : "";
    return {
      amount,
      indicator: String(match[3] || "").toUpperCase(),
      sign: match[2] || prefixSign,
      index: match.index,
      raw: match[0]
    };
  }

  function isSummaryLine(line, context = {}) {
    const normalized = comparable(line);
    if (SUMMARY_PHRASES.some((phrase) => normalized.includes(phrase))) return true;
    if (context.documentType === "credit_card_invoice" && /\bPAGAMENTO (?:DA )?FATURA\b/.test(normalized)) return true;
    if (/\bVENCIMENTO\b/.test(normalized) && !/\b(?:TARIFA|JUROS|MULTA)\b/.test(normalized)) return true;
    return false;
  }

  function inferTransactionType(description, money, context = {}) {
    const normalized = comparable(description);
    const creditWords = [
      "PIX RECEBIDO", "TRANSFERENCIA RECEBIDA", "TED RECEBIDA", "DEPOSITO", "SALARIO",
      "RENDIMENTO", "REEMBOLSO", "ESTORNO", "CREDITO"
    ];
    const debitWords = [
      "PIX ENVIADO", "PAGAMENTO", "DEBITO", "BOLETO", "SAQUE", "TARIFA", "COMPRA",
      "TRANSFERENCIA ENVIADA"
    ];
    if (money.indicator === "C") return "income";
    if (money.indicator === "D") return "expense";
    if (creditWords.some((word) => normalized.includes(word))) return "income";
    if (debitWords.some((word) => normalized.includes(word))) return "expense";
    if (money.sign === "-") return "expense";
    if (money.sign === "+" && context.documentType === "bank_statement") return "income";
    return context.documentType === "bank_statement" && money.sign === "+" ? "income" : "expense";
  }

  function cleanDescription(value) {
    return String(value || "")
      .replace(/[|]/g, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s\-:]+|[\s\-:]+$/g, "")
      .trim();
  }

  function parseStatementLine(line, fileName = "extrato.pdf", context = {}) {
    const text = typeof line === "string" ? line : line?.text;
    if (!text) return null;
    const dateParts = datePartsAtStart(text);
    const money = parseMoneyAtEnd(text, context);
    if (!dateParts || !money || isSummaryLine(text, context)) return null;
    const date = parseStatementDate(dateParts, context);
    if (!date) return null;
    const description = cleanDescription(text.slice(dateParts.length, money.index)) || "Movimentacao importada";
    const type = inferTransactionType(description, money, context);
    return {
      id: "",
      type,
      description,
      amount: money.amount,
      date,
      category: "",
      account: "Extrato importado",
      recurring: false,
      notes: `Importado de ${fileName}`
    };
  }

  function itemFontSize(item) {
    const transform = Array.isArray(item.transform) ? item.transform : [];
    return Math.max(1, Number(item.height) || Math.hypot(Number(transform[2]) || 0, Number(transform[3]) || 0) || 10);
  }

  function groupPdfTextItems(items, page = 1) {
    const fragments = (items || [])
      .filter((item) => String(item?.str || "").trim())
      .map((item) => ({
        text: String(item.str).trim(),
        x: Number(item.transform?.[4] || 0),
        y: Number(item.transform?.[5] || 0),
        width: Math.max(0, Number(item.width || 0)),
        fontSize: itemFontSize(item),
        page
      }))
      .sort((a, b) => Math.abs(b.y - a.y) > Math.max(a.fontSize, b.fontSize) * 0.35 ? b.y - a.y : a.x - b.x);

    const rows = [];
    for (const fragment of fragments) {
      const tolerance = Math.max(2, Math.min(5, fragment.fontSize * 0.4));
      let row = rows.find((candidate) => Math.abs(candidate.y - fragment.y) <= tolerance);
      if (!row) {
        row = { page, y: fragment.y, items: [] };
        rows.push(row);
      }
      row.items.push(fragment);
      row.y = row.items.reduce((sum, item) => sum + item.y, 0) / row.items.length;
    }

    return rows
      .sort((a, b) => b.y - a.y)
      .map((row) => {
        const ordered = row.items.sort((a, b) => a.x - b.x);
        let text = "";
        ordered.forEach((item, index) => {
          if (!index) {
            text = item.text;
            return;
          }
          const previous = ordered[index - 1];
          const gap = item.x - (previous.x + previous.width);
          text += gap > Math.max(previous.fontSize, item.fontSize) * 10 ? "   " : gap > 0.5 ? " " : "";
          text += item.text;
        });
        return { page, text: cleanDescription(text), items: ordered, y: row.y };
      });
  }

  function combineContinuationLines(rows) {
    const ordered = [...(rows || [])].sort((a, b) => a.page - b.page || b.y - a.y);
    const repeated = new Map();
    ordered.forEach((row) => {
      const key = comparable(row.text);
      if (!datePartsAtStart(row.text) && !parseMoneyAtEnd(row.text)) repeated.set(key, (repeated.get(key) || 0) + 1);
    });
    const filtered = ordered.filter((row) => (repeated.get(comparable(row.text)) || 0) < 2 || datePartsAtStart(row.text));
    const combined = [];

    for (let index = 0; index < filtered.length; index += 1) {
      const row = filtered[index];
      if (!datePartsAtStart(row.text)) continue;
      let text = row.text;
      let consumed = 0;
      while (!parseMoneyAtEnd(text) && consumed < 3) {
        const next = filtered[index + consumed + 1];
        if (!next || next.page !== row.page || datePartsAtStart(next.text)) break;
        text = `${text} ${next.text}`;
        consumed += 1;
      }
      index += consumed;
      combined.push({ ...row, text: cleanDescription(text) });
    }
    return combined;
  }

  function fingerprintDescription(description) {
    return comparable(description)
      .replace(/^(?:LANCAMENTO|TRANSACAO|COMPRA (?:NO )?CARTAO|DEBITO|CREDITO)\s+/, "")
      .replace(/\b(?:AUT|NSU|DOC|ID)\s*[A-Z0-9-]+\b/g, "")
      .replace(/[^A-Z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function transactionFingerprint(item) {
    return `${String(item?.date || "")}|${Number(item?.amount || 0).toFixed(2)}|${fingerprintDescription(item?.description)}`;
  }

  function markDuplicates(items, existingItems = []) {
    const existing = new Set(existingItems.map(transactionFingerprint));
    const withinDocument = new Set();
    const result = [];
    for (const item of items || []) {
      const fingerprint = transactionFingerprint(item);
      if (withinDocument.has(fingerprint)) continue;
      withinDocument.add(fingerprint);
      result.push({ ...item, duplicate: existing.has(fingerprint) });
    }
    return result;
  }

  function fallbackCategory(type) {
    return type === "income"
      ? { id: "outras-entradas", label: "Outras entradas", type: "income", color: "#64748b", icon: "wallet" }
      : { id: "outras-saidas", label: "Outras sa\u00eddas", type: "expense", color: "#64748b", icon: "receipt" };
  }

  function ensureFallbackCategory(categories, type) {
    const group = categories[type] || (categories[type] = []);
    const generic = group.find((category) => /\bOUTR(?:A|O)S?\b/.test(comparable(category.label)));
    if (generic) return generic.id;
    if (group.length) return group[0].id;
    const fallback = fallbackCategory(type);
    group.push(fallback);
    return fallback.id;
  }

  function resolveCategory(categories, type, description, createFallback = false) {
    const group = categories[type] || [];
    const normalizedDescription = comparable(description);
    const rule = CATEGORY_RULES.find((candidate) => candidate.words.some((word) => normalizedDescription.includes(word)));
    if (rule) {
      const match = group.find((category) => {
        const identity = `${comparable(category.id)} ${comparable(category.label)}`;
        return rule.targets.some((target) => identity.includes(target));
      });
      if (match) return match.id;
    }
    const generic = group.find((category) => /\bOUTR(?:A|O)S?\b/.test(comparable(category.label)));
    if (generic) return generic.id;
    if (group.length) return group[0].id;
    return createFallback ? ensureFallbackCategory(categories, type) : "";
  }

  function parseDocumentRows(rows, fileName, existingItems = [], options = {}) {
    const allText = (rows || []).map((row) => row.text).join("\n");
    const context = detectDocumentContext(allText, options);
    const transactions = combineContinuationLines(rows)
      .map((row) => parseStatementLine(row, fileName, context))
      .filter(Boolean);
    return { context, transactions: markDuplicates(transactions, existingItems) };
  }

  return {
    combineContinuationLines,
    comparable,
    datePartsAtStart,
    detectDocumentContext,
    ensureFallbackCategory,
    groupPdfTextItems,
    inferTransactionType,
    isSummaryLine,
    markDuplicates,
    parseDocumentRows,
    parseMoneyAtEnd,
    parseStatementDate,
    parseStatementLine,
    resolveCategory,
    transactionFingerprint
  };
});
