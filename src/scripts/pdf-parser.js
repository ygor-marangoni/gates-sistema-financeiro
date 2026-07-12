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
    "VALOR TOTAL", "MELHOR DIA DE COMPRA", "ENCARGOS PREVISTOS", "RESUMO DA FATURA",
    "TOTAL FATURA", "TOTAL GERAL", "SUBTOTAL", "VALOR DA FATURA", "VALOR A PAGAR",
    "TOTAL DE ENTRADAS", "TOTAL DE SAIDAS", "SALDO DO DIA", "SALDO FINAL DO PERIODO",
    "SALDO TOTAL", "SALDO INICIAL", "VALOR SALDO POR TRANSACAO",
    "NEW BALANCE", "PREVIOUS BALANCE", "STATEMENT BALANCE", "AVAILABLE BALANCE",
    "CREDIT LIMIT", "AVAILABLE CREDIT", "MINIMUM PAYMENT", "AMOUNT DUE", "TOTAL PURCHASES"
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

  function datePartsFromMatch(match, numeric) {
    if (!match) return null;
    const monthToken = numeric ? Number(match[2]) : MONTHS[match[2]];
    if (!monthToken) return null;
    return {
      day: Number(match[1]),
      month: monthToken,
      year: match[3] ? Number(match[3]) : null,
      numeric,
      index: Number(match.index || 0),
      length: match[0].length,
      raw: match[0]
    };
  }

  function datePartsAtStart(line) {
    const normalized = comparable(line);
    const weekday = "(?:(?:SEG|TER|QUA|QUI|SEX|SAB|DOM)\\.?[,]?\\s+)?";
    const numeric = normalized.match(new RegExp(`^\\s*${weekday}(\\d{1,2})\\s*[\\/.\\-]\\s*(\\d{1,2})(?:\\s*[\\/.\\-]\\s*(\\d{2,4}))?\\b`));
    if (numeric) return datePartsFromMatch(numeric, true);

    const textual = normalized.match(new RegExp(`^\\s*${weekday}(\\d{1,2})\\s+(?:DE\\s+)?([A-Z]{3,10})\\.?(?:\\s+(?:DE\\s+)?(\\d{4}))?\\b`));
    return datePartsFromMatch(textual, false);
  }

  function datePartsInTransaction(line) {
    const atStart = datePartsAtStart(line);
    if (atStart) return atStart;

    const normalized = comparable(line);
    const numericPattern = /(\d{1,2})\s*[\/.\-]\s*(\d{1,2})(?:\s*[\/.\-]\s*(\d{2}|\d{4}))\b/g;
    const textualPattern = /(\d{1,2})\s+(?:DE\s+)?([A-Z]{3,10})\.?(?:\s+(?:DE\s+)?(\d{4}))\b/g;
    const candidates = [
      ...[...normalized.matchAll(numericPattern)].map((match) => datePartsFromMatch(match, true)),
      ...[...normalized.matchAll(textualPattern)].map((match) => datePartsFromMatch(match, false))
    ].filter(Boolean).sort((a, b) => a.index - b.index);
    if (candidates.length) return candidates[0];

    const prefixed = normalized.match(/^(?:CARTAO|CARD|FINAL|FIM|TERMINAL)?\s*[*X#-]*\d{2,8}\s+(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\b/);
    if (!prefixed) return null;
    const dateStart = prefixed[0].lastIndexOf(prefixed[1]);
    prefixed.index = dateStart;
    prefixed[0] = prefixed[0].slice(dateStart);
    return datePartsFromMatch(prefixed, true);
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
    const month = parts.numeric && context.dateOrder === "mdy" ? parts.day : parts.month;
    const day = parts.numeric && context.dateOrder === "mdy" ? parts.month : parts.day;
    let year = parts.year;
    if (year !== null && year < 100) year += 2000;
    if (year === null) year = inferYear(month, day, context);
    return isoDate(year, month, day);
  }

  function explicitDateFromText(value, context = {}) {
    const normalized = comparable(value).trim();
    const parts = datePartsAtStart(normalized);
    if (!parts || parts.year === null) return "";
    return parseStatementDate(parts, context);
  }

  function detectDocumentContext(allText, options = {}) {
    const text = comparable(allText);
    const invoiceScore = [
      "PAGAMENTO MINIMO", "MELHOR DIA DE COMPRA", "CARTAO DE CREDITO",
      "VALOR DA FATURA", "DATA DE FECHAMENTO", "STATEMENT BALANCE", "MINIMUM PAYMENT",
      "CREDIT CARD", "CARD STATEMENT", "PAYMENT DUE"
    ]
      .filter((term) => text.includes(term)).length;
    const statementScore = [
      "EXTRATO", "CONTA CORRENTE", "AGENCIA", "PIX", "TED", "TRANSFERENCIA",
      "STATEMENT OF ACCOUNT", "ACCOUNT TRANSACTIONS", "DEPOSITS AND OTHER CREDITS",
      "WITHDRAWALS AND OTHER DEBITS"
    ]
      .filter((term) => text.includes(term)).length;
    const explicitInvoice = /\b(?:FATURA (?:DO )?CARTAO|RESUMO DA FATURA)\b/.test(text);
    const genericInvoice = /\bFATURA\b/.test(text) && statementScore < 2;
    const dailyStatement = text.includes("SALDO DO DIA") && /\b(?:PIX|TRANSFERENCIA|TED|DEPOSITO)\b/.test(text);
    const documentType = statementScore >= 2 || dailyStatement || text.includes("EXTRATO BANCARIO") || text.includes("STATEMENT OF ACCOUNT")
      ? "bank_statement"
      : invoiceScore >= 1 || explicitInvoice || genericInvoice
        ? "credit_card_invoice"
        : "unknown";
    const dateOrder = /\b(?:STATEMENT OF ACCOUNT|ACCOUNT TRANSACTIONS|DEPOSITS AND OTHER CREDITS|CARD STATEMENT|PAYMENT DUE|DUE DATE)\b/.test(text)
      ? "mdy"
      : "dmy";

    let periodStart = "";
    let periodEnd = "";
    const rangePattern = /(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})\s*(?:A|ATE|TO|THROUGH|-)\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/g;
    const range = rangePattern.exec(text);
    if (range) {
      periodStart = explicitDateFromText(range[1], { dateOrder });
      periodEnd = explicitDateFromText(range[2], { dateOrder });
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

    const genericMonthReference = text.match(new RegExp(`\\b(${Object.keys(MONTHS).join("|")})\\b\\s*(?:DE\\s+)?[\\/\\-]?\\s*(20\\d{2})\\b`));
    if (!referenceYear && genericMonthReference && MONTHS[genericMonthReference[1]]) {
      referenceMonth = MONTHS[genericMonthReference[1]];
      referenceYear = Number(genericMonthReference[2]);
    }

    const dateLabel = "(?:VENCIMENTO|FECHAMENTO|EMISSAO|DATA DA FATURA|DATA DE CORTE|DUE DATE|CLOSING DATE|STATEMENT DATE|ISSUE DATE)";
    const labeledDatePattern = new RegExp(`${dateLabel}\\D{0,20}(\\d{1,2}[\\/.\\-]\\d{1,2}[\\/.\\-]\\d{2,4})`, "g");
    const labeledTextDatePattern = new RegExp(`${dateLabel}\\D{0,20}(\\d{1,2}\\s+(?:DE\\s+)?[A-Z]{3,10}(?:\\s+(?:DE\\s+)?20\\d{2}))`, "g");
    const labeledDates = [
      ...[...text.matchAll(labeledDatePattern)].map((match) => match[1]),
      ...[...text.matchAll(labeledTextDatePattern)].map((match) => match[1])
    ]
      .map((value) => explicitDateFromText(value, { dateOrder }))
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
      dateOrder,
      fallbackYear: options.fallbackYear || new Date().getFullYear(),
      today: options.today || ""
    };
  }

  function parseMoneyNumber(value) {
    const compact = String(value || "").replace(/\s/g, "").replace(/^[+-]/, "");
    const lastComma = compact.lastIndexOf(",");
    const lastDot = compact.lastIndexOf(".");
    if (lastComma < 0 && lastDot < 0) return Number(compact);
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? /\./g : /,/g;
    return Number(compact.replace(thousandsSeparator, "").replace(decimalSeparator, "."));
  }

  function parseMoneyAtEnd(line, context = {}) {
    const pattern = /(?<![\/\d])(\()?\s*([+-])?\s*(?:(?:R\$|US\$|BRL|USD|EUR|€|\$)\s*)?([+-])?\s*((?:(?:\d{1,3}(?:\.\d{3})+|\d{1,3}(?:\s\d{3})+|\d+),\d{2}|(?:\d{1,3}(?:,\d{3})+|\d{1,3}(?:\s\d{3})+|\d+)\.\d{2}|[.,]\d{2}))\s*([+-])?\s*(CR|DR|C|D)?\s*(\))?(?![\d./-])/gi;
    const source = String(line || "");
    const matches = [...source.matchAll(pattern)].filter((candidate) => {
      const prefix = comparable(source.slice(Math.max(0, candidate.index - 24), candidate.index));
      return !/(?:^|\s)(?:DOC|DOCTO|DOCUMENTO|NSU|IDENTIFICADOR|ID)\s*[:#-]?\s*$/.test(prefix);
    });
    if (!matches.length) return null;
    const match = context.documentType === "bank_statement" && matches.length > 1
      ? matches[0]
      : matches[matches.length - 1];
    const amount = parseMoneyNumber(match[4]);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const indicator = String(match[6] || "").toUpperCase();
    return {
      amount,
      indicator: indicator === "CR" ? "C" : indicator === "DR" ? "D" : indicator,
      sign: match[5] || match[3] || match[2] || (match[1] && match[7] ? "-" : ""),
      index: match.index,
      raw: match[0]
    };
  }

  function isSummaryLine(line, context = {}) {
    const normalized = comparable(line);
    const compact = normalized.replace(/[^A-Z0-9]/g, "");
    const moneyCount = (String(line || "").match(/(?:R\$\s*)?[-+]?\(?\d[\d.\s]*[,.]\d{2}\)?(?:[-+])?/g) || []).length;
    if (SUMMARY_PHRASES.some((phrase) => normalized.includes(phrase))) return true;
    if (/(?:TOTALDEENTRADAS|TOTALDESAIDAS|TOTALDAFATURA|TOTALDECOMPRAS|SALDODODIA|SALDOINICIAL|SALDOFINALDOPERIODO)/.test(compact)) return true;
    if (compact.includes("TOTAL") && /(?:ENTRADAS|SAIDAS|TRANSFERENCIA|RDB|SALDO)/.test(compact)) return true;
    if (normalized.includes("SALDO") && normalized.includes("DIA") && moneyCount > 1) return true;
    if (/^(?:TOTAL|SUBTOTAL)(?:\s|$)/.test(normalized)) return true;
    if (normalized.includes("VALORES EM R$")) return true;
    if (/^\d{1,2}\s+(?:DE\s+)?[A-Z]{3,10}(?:\s+DE)?\s+20\d{2}\s+A\s+\d{1,2}\s+(?:DE\s+)?[A-Z]{3,10}/.test(normalized)) return true;
    if (context.documentType === "credit_card_invoice" && /\bPAGAMENTO (?:DA )?FATURA\b/.test(normalized)) return true;
    if (context.documentType === "credit_card_invoice" && /\b(?:PAYMENT RECEIVED|PAYMENT THANK YOU|AUTOMATIC PAYMENT)\b/.test(normalized)) return true;
    if (/\bVENCIMENTO\b/.test(normalized) && !/\b(?:TARIFA|JUROS|MULTA)\b/.test(normalized)) return true;
    return false;
  }

  function isPeriodHeaderLine(line) {
    const normalized = comparable(line);
    return normalized.includes("VALORES EM R$")
      || /^\d{1,2}\s+(?:DE\s+)?[A-Z]{3,10}(?:\s+DE)?\s+20\d{2}\s+A\s+\d{1,2}\s+(?:DE\s+)?[A-Z]{3,10}/.test(normalized);
  }

  function inferTransactionType(description, money, context = {}) {
    const normalized = comparable(description);
    const creditWords = [
      "PIX RECEBIDO", "TRANSFERENCIA RECEBIDA", "TED RECEBIDA", "DEPOSITO", "SALARIO",
      "RENDIMENTO", "REEMBOLSO", "ESTORNO", "CREDITO", "RECEBIMENTO", "RESGATE",
      "VALOR ADICIONADO", "CASHBACK", "REFUND", "PAYROLL", "DIRECT DEPOSIT", "PREAUTHORIZED CREDIT",
      "INTEREST CREDIT", "CREDIT ADJUSTMENT", "PAYMENT RECEIVED"
    ];
    const debitWords = [
      "PIX ENVIADO", "PAGAMENTO", "DEBITO", "BOLETO", "SAQUE", "TARIFA", "COMPRA",
      "TRANSFERENCIA ENVIADA", "APLICACAO", "PAGTO", "PURCHASE", "WITHDRAWAL", "ATM ", "CHECK ",
      "SERVICE CHARGE", "FEE", "DIRECT DEBIT", "AUTOMATIC PAYMENT", "TAX"
    ];
    if (money.indicator === "C") return "income";
    if (money.indicator === "D") return "expense";
    if (creditWords.some((word) => normalized.includes(word))) return "income";
    if (debitWords.some((word) => normalized.includes(word))) return "expense";
    if (money.sign === "-") return "expense";
    if (money.sign === "+") return "income";
    return "expense";
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
    const dateParts = datePartsInTransaction(text);
    const money = parseMoneyAtEnd(text, context);
    if (!dateParts || !money || isSummaryLine(text, context)) return null;
    const date = parseStatementDate(dateParts, context);
    if (!date) return null;
    const beforeDateRaw = text.slice(0, dateParts.index || 0);
    const beforeDate = /^(?:(?:CARTAO|CARD|FINAL|FIM|TERMINAL)\s*)?[*X#-]*\d{2,8}$/
      .test(comparable(beforeDateRaw)) ? "" : beforeDateRaw;
    const afterDate = text.slice((dateParts.index || 0) + dateParts.length, money.index);
    const description = cleanDescription(`${beforeDate} ${afterDate}`) || "Movimentacao importada";
    const type = inferTransactionType(description, money, context);
    return {
      id: "",
      type,
      description,
      amount: money.amount,
      date,
      category: "",
      categoryLabel: typeof line === "object" ? String(line.categoryLabel || "") : "",
      account: typeof line === "object" && line.account
        ? String(line.account)
        : context.documentType === "credit_card_invoice" ? "Cartão importado" : "Extrato importado",
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

  function rowItemText(item) {
    return String(item?.text ?? item?.str ?? "").trim();
  }

  function rowItemX(item) {
    return Number(item?.x ?? item?.transform?.[4] ?? 0);
  }

  function headerX(row, label) {
    const item = (row.items || []).find((candidate) => comparable(rowItemText(candidate)) === label);
    return item ? rowItemX(item) : null;
  }

  function headerXAny(row, labels) {
    for (const label of labels) {
      const value = headerX(row, label);
      if (Number.isFinite(value)) return value;
    }
    return null;
  }

  function textInColumn(row, start, end = Infinity) {
    return (row.items || [])
      .filter((item) => rowItemX(item) >= start - 2 && rowItemX(item) < end - 2)
      .sort((a, b) => rowItemX(a) - rowItemX(b))
      .map(rowItemText)
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  function structuredHeader(row) {
    const date = headerXAny(row, ["DATA", "DATE", "DT", "DATA DA COMPRA", "TRANSACTION DATE"]);
    const description = headerXAny(row, ["DESCRICAO", "DESCRIPTION", "LANCAMENTO", "ESTABELECIMENTO", "HISTORICO", "MERCHANT"]);
    const amount = headerXAny(row, ["VALOR", "AMOUNT", "VALOR R$", "VALOR (R$)", "TRANSACTION AMOUNT"]);
    const category = headerXAny(row, ["CATEGORIA", "CATEGORY"]);
    const account = headerXAny(row, ["CONTA", "ACCOUNT"]);
    const debit = headerXAny(row, ["DEBITO", "DEBIT"]);
    const credit = headerXAny(row, ["CREDITO", "CREDIT"]);
    const balance = headerXAny(row, ["SALDO", "BALANCE"]);

    if ([date, description, debit, credit, balance].every(Number.isFinite)) {
      return {
        type: "bank",
        starts: [date, description, debit, credit, balance].sort((a, b) => a - b),
        columns: { date, description, debit, credit, balance }
      };
    }
    if ([date, description, category, account, amount].every(Number.isFinite)) {
      return { type: "gates", starts: [date, description, category, account, amount] };
    }
    if ([date, description, amount].every(Number.isFinite) && date < description && description < amount) {
      return { type: "simple", starts: [date, description, amount] };
    }
    return null;
  }

  function normalizeStructuredTableRows(rows) {
    const ordered = [...(rows || [])].sort((a, b) => a.page - b.page || b.y - a.y);
    const normalized = [];
    let page = null;
    let table = null;
    let foundTable = false;
    let bankDate = "";
    let bankDescription = "";

    function bankColumn(row, name) {
      const orderedColumns = Object.entries(table.columns).sort((a, b) => a[1] - b[1]);
      const columnIndex = orderedColumns.findIndex(([key]) => key === name);
      const previous = orderedColumns[columnIndex - 1]?.[1];
      const current = orderedColumns[columnIndex][1];
      const next = orderedColumns[columnIndex + 1]?.[1];
      const monetary = ["debit", "credit", "balance"].includes(name);
      const start = monetary ? current - 14 : Number.isFinite(previous) ? (previous + current) / 2 : -Infinity;
      const end = Number.isFinite(next) ? (current + next) / 2 : Infinity;
      return textInColumn(row, start, end);
    }

    for (const row of ordered) {
      if (row.page !== page) {
        page = row.page;
      }
      const header = structuredHeader(row);
      if (header) {
        const boundaries = header.type === "simple"
          ? [
              -Infinity,
              (header.starts[0] + header.starts[1]) / 2,
              (header.starts[1] + header.starts[2]) / 2,
              Infinity
            ]
          : [
              -Infinity,
              (header.starts[0] + header.starts[1]) / 2,
              (header.starts[1] + header.starts[2]) / 2,
              (header.starts[2] + header.starts[3]) / 2,
              (header.starts[3] + header.starts[4]) / 2,
              Infinity
            ];
        table = {
          ...header,
          boundaries
        };
        foundTable = true;
        continue;
      }
      if (/\b(?:DATE|DATA)\s+DESCRIPTION|\bDATA\s+DESCRICAO/.test(comparable(row.text))) {
        table = null;
        continue;
      }
      if (!table) continue;

      if (table.type === "bank") {
        if (isSummaryLine(row.text, { documentType: "bank_statement" })) {
          bankDescription = "";
          continue;
        }
        const date = bankColumn(row, "date");
        const description = bankColumn(row, "description");
        const debit = bankColumn(row, "debit");
        const credit = bankColumn(row, "credit");
        if (datePartsInTransaction(date)) bankDate = date;
        const usefulDescription = description && !/^\d{4,}$/.test(description) ? description : "";
        if (usefulDescription) bankDescription = usefulDescription;
        const amount = debit || credit;
        const parsedAmount = parseMoneyAtEnd(amount, { documentType: "bank_statement" });
        if (!bankDate || !parsedAmount) continue;
        normalized.push({
          ...row,
          text: cleanDescription(`${bankDate} ${bankDescription || usefulDescription || "Movimentacao"} ${parsedAmount.amount.toFixed(2)} ${debit ? "D" : "C"}`)
        });
        bankDescription = "";
        continue;
      }

      if (!datePartsInTransaction(row.text)) continue;

      if (table.type === "simple") {
        const [dateStart, descriptionStart, amountStart, tableEnd] = table.boundaries;
        const date = textInColumn(row, dateStart, descriptionStart);
        const description = textInColumn(row, descriptionStart, amountStart);
        const amount = textInColumn(row, amountStart, tableEnd);
        if (!date || !description || !parseMoneyAtEnd(amount)) continue;
        normalized.push({
          ...row,
          text: cleanDescription(`${date} ${description} ${amount}`)
        });
        continue;
      }

      const [dateStart, descriptionStart, thirdStart, fourthStart, fifthStart, tableEnd] = table.boundaries;
      const date = textInColumn(row, dateStart, descriptionStart);
      const description = textInColumn(row, descriptionStart, thirdStart);
      if (!date || !description) continue;

      if (table.type === "gates") {
        const categoryLabel = textInColumn(row, thirdStart, fourthStart);
        const account = textInColumn(row, fourthStart, fifthStart);
        const amount = textInColumn(row, fifthStart, tableEnd);
        if (!parseMoneyAtEnd(amount)) continue;
        normalized.push({
          ...row,
          text: cleanDescription(`${date} ${description} ${amount}`),
          categoryLabel,
          account
        });
        continue;
      }

    }

    return foundTable ? normalized : rows;
  }

  function combineContinuationLines(rows) {
    const ordered = [...(rows || [])].sort((a, b) => a.page - b.page || b.y - a.y);
    const repeated = new Map();
    ordered.forEach((row) => {
      const key = comparable(row.text);
      if (!datePartsInTransaction(row.text) && !parseMoneyAtEnd(row.text)) repeated.set(key, (repeated.get(key) || 0) + 1);
    });
    const filtered = ordered.filter((row) => (repeated.get(comparable(row.text)) || 0) < 2 || datePartsInTransaction(row.text));
    const combined = [];

    for (let index = 0; index < filtered.length; index += 1) {
      const row = filtered[index];
      if (!datePartsInTransaction(row.text)) continue;
      let text = row.text;
      let consumed = 0;
      while (!parseMoneyAtEnd(text) && consumed < 3) {
        const next = filtered[index + consumed + 1];
        if (!next || next.page !== row.page || datePartsInTransaction(next.text)) break;
        text = `${text} ${next.text}`;
        consumed += 1;
      }
      index += consumed;
      combined.push({ ...row, text: cleanDescription(text) });
    }
    return combined;
  }

  function looksLikeUndatedTransaction(line, context = {}) {
    const normalized = comparable(line);
    if (!parseMoneyAtEnd(line, context) || isSummaryLine(line, context)) return false;
    if (/\b(?:CPF|CNPJ|AGENCIA|OUVIDORIA|ATENDIMENTO|PAGINA|PAGE|PROTOCOLO)\b/.test(normalized)) return false;
    return /\b(?:PIX|TRANSFERENCIA|TED|DOC|DEPOSITO|SALARIO|RENDIMENTO|REEMBOLSO|ESTORNO|RESGATE|APLICACAO|PAGAMENTO|BOLETO|COMPRA|DEBITO|CREDITO|SAQUE|TARIFA|RECARGA|VALOR ADICIONADO|PURCHASE|PAYMENT|WITHDRAWAL|CHECK|FEE|CHARGE)\b/.test(normalized)
      || /(?:^|\s)[+-]\s*(?:R\$|US\$|BRL|USD|EUR|\d)/i.test(line)
      || /\s(?:CR|DR|C|D)\s*$/i.test(line);
  }

  function rowsWithInheritedDates(rows, context = {}) {
    const ordered = [...(rows || [])].sort((a, b) => a.page - b.page || b.y - a.y);
    const result = [];
    let currentDate = "";
    for (const row of ordered) {
      const date = datePartsAtStart(row.text);
      if (date && !isPeriodHeaderLine(row.text)) currentDate = date.raw;
      if (date || !currentDate || !looksLikeUndatedTransaction(row.text, context)) continue;
      result.push({ ...row, text: cleanDescription(`${currentDate} ${row.text}`) });
    }
    return result;
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
    const structuredRows = normalizeStructuredTableRows(rows);
    const directTransactions = combineContinuationLines(structuredRows)
      .map((row) => parseStatementLine(row, fileName, context))
      .filter(Boolean);
    const inheritedTransactions = rowsWithInheritedDates(rows, context)
      .map((row) => parseStatementLine(row, fileName, context))
      .filter(Boolean);
    const transactions = [...directTransactions, ...inheritedTransactions];
    return { context, transactions: markDuplicates(transactions, existingItems) };
  }

  return {
    combineContinuationLines,
    comparable,
    datePartsAtStart,
    datePartsInTransaction,
    detectDocumentContext,
    ensureFallbackCategory,
    groupPdfTextItems,
    inferTransactionType,
    isSummaryLine,
    markDuplicates,
    normalizeStructuredTableRows,
    parseDocumentRows,
    parseMoneyAtEnd,
    parseStatementDate,
    parseStatementLine,
    resolveCategory,
    rowsWithInheritedDates,
    transactionFingerprint
  };
});
