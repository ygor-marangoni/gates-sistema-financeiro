"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const parser = require("../src/scripts/pdf-parser.js");

const statementContext = {
  documentType: "bank_statement",
  referenceYear: 2026,
  referenceMonth: 6,
  today: "2026-06-30"
};

function parse(line, context = statementContext) {
  return parser.parseStatementLine(line, "teste.pdf", context);
}

test("caso 1 - data numerica", () => {
  const item = parse("10/06 MERCADO CENTRAL 186,42");
  assert.equal(item.date, "2026-06-10");
  assert.equal(item.amount, 186.42);
  assert.equal(item.description, "MERCADO CENTRAL");
});

test("caso 2 - mes abreviado", () => {
  const item = parse("10 JUN MERCADO CENTRAL 186,42");
  assert.equal(item.date, "2026-06-10");
});

test("caso 3 - credito", () => {
  const item = parse("10/06 PIX RECEBIDO JOAO 1.250,00 C");
  assert.equal(item.type, "income");
  assert.equal(item.amount, 1250);
});

test("caso 4 - debito", () => {
  const item = parse("10/06 PIX ENVIADO MARIA 200,00 D");
  assert.equal(item.type, "expense");
});

test("caso 5 - parcela preservada", () => {
  const item = parse("10/06 LOJA DE ELETRONICOS 02/10 249,90");
  assert.equal(item.description, "LOJA DE ELETRONICOS 02/10");
  assert.equal(item.amount, 249.9);
});

test("caso 6 - valor negativo", () => {
  const item = parse("10/06 PAGAMENTO DE BOLETO -350,00");
  assert.equal(item.type, "expense");
  assert.equal(item.amount, 350);
});

test("caso 7 - sinal posterior", () => {
  const item = parse("10/06 COMPRA MERCADO 150,00-");
  assert.equal(item.type, "expense");
  assert.equal(item.amount, 150);
});

test("caso 8 - resumo ignorado", () => {
  assert.equal(parse("10/06 TOTAL DA FATURA 1.847,90"), null);
});

test("caso 9 - virada de ano", () => {
  const context = parser.detectDocumentContext("FATURA JANEIRO 2026\n28 DEZ LOJA A 100,00\n02 JAN LOJA B 50,00");
  assert.equal(context.documentType, "credit_card_invoice");
  assert.equal(parse("28 DEZ LOJA A 100,00", context).date, "2025-12-28");
  assert.equal(parse("02 JAN LOJA B 50,00", context).date, "2026-01-02");
});

test("caso 10 - descricao quebrada", () => {
  const rows = [
    { page: 1, y: 500, text: "10/06 SUPERMERCADO", items: [] },
    { page: 1, y: 488, text: "CENTRAL LTDA 186,42", items: [] }
  ];
  const result = parser.parseDocumentRows(rows, "teste.pdf", [], { fallbackYear: 2026, today: "2026-06-30" });
  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].description, "SUPERMERCADO CENTRAL LTDA");
});

test("caso 11 - PDF repetido marca duplicata", () => {
  const first = parse("10/06 MERCADO CENTRAL 186,42");
  const second = parser.markDuplicates([{ ...first }], [first]);
  assert.equal(second.length, 1);
  assert.equal(second[0].duplicate, true);
});

test("caso 12 - estado sem categorias cria apenas fallbacks necessarios", () => {
  const categories = { income: [], expense: [] };
  const expenseId = parser.resolveCategory(categories, "expense", "MERCADO CENTRAL", true);
  const sameExpenseId = parser.resolveCategory(categories, "expense", "OUTRA COMPRA", true);
  const incomeId = parser.resolveCategory(categories, "income", "PIX RECEBIDO", true);
  assert.equal(expenseId, "outras-saidas");
  assert.equal(sameExpenseId, expenseId);
  assert.equal(incomeId, "outras-entradas");
  assert.equal(categories.expense.length, 1);
  assert.equal(categories.income.length, 1);
});

test("caso 13 - documento sem movimentacoes", () => {
  const rows = [{ page: 1, y: 500, text: "RESUMO DA FATURA VALOR TOTAL 1.847,90", items: [] }];
  const result = parser.parseDocumentRows(rows, "teste.pdf", [], { fallbackYear: 2026 });
  assert.equal(result.transactions.length, 0);
});

test("formatos adicionais de data e valor", () => {
  assert.equal(parse("10/06/26 MERCADO 1234,56").date, "2026-06-10");
  assert.equal(parse("10-06-2026 MERCADO R$ 1.234,56").amount, 1234.56);
  assert.equal(parse("10.06.2026 MERCADO 1 234,56").amount, 1234.56);
  assert.equal(parse("10 DE JUNHO MERCADO +1.234,56").date, "2026-06-10");
});

test("valor pode vir antes de saldo ou texto final", () => {
  const withBalance = parse("10/06 PIX ENVIADO MARIA 200,00 D 1.000,00 C");
  const withStatus = parse("10/06 MERCADO CENTRAL 186,42 APROVADO");
  assert.equal(withBalance.amount, 200);
  assert.equal(withBalance.description, "PIX ENVIADO MARIA");
  assert.equal(withStatus.amount, 186.42);
});

test("duplicatas internas do PDF sao eliminadas", () => {
  const item = parse("10/06 MERCADO CENTRAL 186,42");
  const result = parser.markDuplicates([item, { ...item }], []);
  assert.equal(result.length, 1);
});

test("fatura Gates reconhece dia da semana e sinal antes do real", () => {
  const context = parser.detectDocumentContext("Fatura Gates\nGerado em 10/07/2026");
  const income = parser.parseStatementLine("sex., 10 de jul. de 2026 Apoio familiar + R$ 900,00", "fatura.pdf", context);
  const expense = parser.parseStatementLine("dom., 12 de jul. de 2026 Internet e apps - R$ 119,90", "fatura.pdf", context);
  assert.equal(income.date, "2026-07-10");
  assert.equal(income.type, "income");
  assert.equal(income.amount, 900);
  assert.equal(expense.date, "2026-07-12");
  assert.equal(expense.type, "expense");
});

test("extrato americano reconhece MM/DD e decimal com ponto", () => {
  const context = parser.detectDocumentContext("Statement of Account\nAccount Transactions by date");
  const debit = parser.parseStatementLine("10/02 POS PURCHASE 4.23 D", "statement.pdf", context);
  const credit = parser.parseStatementLine("10/03 PREAUTHORIZED CREDIT 763.01 C", "statement.pdf", context);
  const check = parser.parseStatementLine("10/14 CHECK 1237 180.63 D", "statement.pdf", context);
  assert.equal(debit.date.endsWith("-10-02"), true);
  assert.equal(debit.amount, 4.23);
  assert.equal(debit.type, "expense");
  assert.equal(credit.date.endsWith("-10-03"), true);
  assert.equal(credit.type, "income");
  assert.equal(check.description, "CHECK 1237");
  assert.equal(check.amount, 180.63);
});

test("tabela OCR Gates separa descrição, categoria, conta e valor", () => {
  const rows = [
    {
      page: 1,
      y: 900,
      text: "DATA DESCRIÇÃO CATEGORIA CONTA VALOR",
      items: [
        { text: "DATA", x: 100 },
        { text: "DESCRIÇÃO", x: 300 },
        { text: "CATEGORIA", x: 600 },
        { text: "CONTA", x: 760 },
        { text: "VALOR", x: 980 }
      ]
    },
    {
      page: 1,
      y: 800,
      text: "sex., 10 de jul. de 2026 Apoio familiar Família Conta principal + R$ 900,00",
      items: [
        { text: "sex.,", x: 100 }, { text: "10", x: 145 }, { text: "de", x: 165 },
        { text: "jul.", x: 190 }, { text: "de", x: 220 }, { text: "2026", x: 245 },
        { text: "Apoio", x: 300 }, { text: "familiar", x: 350 },
        { text: "Família", x: 600 }, { text: "Conta", x: 760 }, { text: "principal", x: 810 },
        { text: "+", x: 980 }, { text: "R$", x: 1000 }, { text: "900,00", x: 1030 }
      ]
    }
  ];
  const result = parser.parseDocumentRows(rows, "fatura.pdf", [], { fallbackYear: 2026 });
  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].description, "Apoio familiar");
  assert.equal(result.transactions[0].categoryLabel, "Família");
  assert.equal(result.transactions[0].account, "Conta principal");
  assert.equal(result.transactions[0].type, "income");
});

test("tabela OCR bancária usa débito/crédito e ignora saldo", () => {
  const rows = [
    {
      page: 1,
      y: 900,
      text: "Date Description Debit Credit Balance",
      items: [
        { text: "Date", x: 100 }, { text: "Description", x: 180 }, { text: "Debit", x: 600 },
        { text: "Credit", x: 720 }, { text: "Balance", x: 840 }
      ]
    },
    {
      page: 1,
      y: 800,
      text: "10/02 POS PURCHASE 4.23 65.73",
      items: [
        { text: "10/02", x: 100 }, { text: "POS", x: 180 }, { text: "PURCHASE", x: 220 },
        { text: "4.23", x: 600 }, { text: "65.73", x: 840 }
      ]
    },
    {
      page: 1,
      y: 760,
      text: "10/03 PREAUTHORIZED CREDIT 763.01 828.74",
      items: [
        { text: "10/03", x: 100 }, { text: "PREAUTHORIZED", x: 180 }, { text: "CREDIT", x: 300 },
        { text: "763.01", x: 720 }, { text: "828.74", x: 840 }
      ]
    }
  ];
  const result = parser.parseDocumentRows(rows, "statement.pdf", [], { fallbackYear: 2026, today: "2026-07-11" });
  assert.equal(result.transactions.length, 2);
  assert.deepEqual(result.transactions.map((item) => item.amount), [4.23, 763.01]);
  assert.deepEqual(result.transactions.map((item) => item.type), ["expense", "income"]);
});

test("tabela OCR continua na página seguinte mesmo sem repetir o cabeçalho", () => {
  const rows = [
    {
      page: 1,
      y: 900,
      text: "Date Description Debit Credit Balance",
      items: [
        { text: "Date", x: 100 }, { text: "Description", x: 180 }, { text: "Debit", x: 600 },
        { text: "Credit", x: 720 }, { text: "Balance", x: 840 }
      ]
    },
    {
      page: 1,
      y: 800,
      text: "10/02 POS PURCHASE 4.23 65.73",
      items: [
        { text: "10/02", x: 100 }, { text: "POS", x: 180 }, { text: "PURCHASE", x: 220 },
        { text: "4.23", x: 600 }, { text: "65.73", x: 840 }
      ]
    },
    {
      page: 2,
      y: 800,
      text: "10/03 SERVICE CHARGE 12.00 53.73",
      items: [
        { text: "10/03", x: 100 }, { text: "SERVICE", x: 180 }, { text: "CHARGE", x: 250 },
        { text: "12.00", x: 600 }, { text: "53.73", x: 840 }
      ]
    }
  ];
  const result = parser.parseDocumentRows(rows, "statement.pdf", [], { fallbackYear: 2026, today: "2026-07-11" });
  assert.equal(result.transactions.length, 2);
  assert.equal(result.transactions[1].description, "SERVICE CHARGE");
});

test("faturas genéricas aceitam data após identificação do cartão ou estabelecimento", () => {
  const prefixed = parse("FINAL 1234 10/06 MERCADO CENTRAL R$ 186,42");
  const dateInMiddle = parse("LOJA CENTRAL 10/06/2026 R$ 99,90");
  assert.equal(prefixed.date, "2026-06-10");
  assert.equal(prefixed.description, "MERCADO CENTRAL");
  assert.equal(dateInMiddle.date, "2026-06-10");
  assert.equal(dateInMiddle.description, "LOJA CENTRAL");
});

test("valores genéricos reconhecem CR, DR, parênteses e moedas internacionais", () => {
  const credit = parse("10/06 AJUSTE DE CREDITO EUR 45,90 CR");
  const debit = parse("10/06 COMPRA INTERNACIONAL US$ 12.50 DR");
  const parenthesized = parse("10/06 TARIFA (R$ 8,75)");
  assert.equal(credit.type, "income");
  assert.equal(credit.amount, 45.9);
  assert.equal(debit.type, "expense");
  assert.equal(debit.amount, 12.5);
  assert.equal(parenthesized.type, "expense");
  assert.equal(parenthesized.amount, 8.75);
});

test("contexto de fatura em inglês usa mês/dia e ignora linhas de resumo", () => {
  const context = parser.detectDocumentContext("CARD STATEMENT\nDUE DATE 07/15/2026\nMINIMUM PAYMENT US$ 25.00");
  const purchase = parser.parseStatementLine("07/01 COFFEE SHOP US$ 20.50", "card.pdf", context);
  assert.equal(context.documentType, "credit_card_invoice");
  assert.equal(context.dateOrder, "mdy");
  assert.equal(purchase.date, "2026-07-01");
  assert.equal(purchase.account, "Cartão importado");
  assert.equal(parser.parseStatementLine("07/15 AMOUNT DUE US$ 500.00", "card.pdf", context), null);
});

test("tabela simples de fatura aceita Data, Estabelecimento e Valor", () => {
  const rows = [
    {
      page: 1,
      y: 900,
      text: "Data Estabelecimento Valor",
      items: [
        { text: "Data", x: 100 },
        { text: "Estabelecimento", x: 280 },
        { text: "Valor", x: 720 }
      ]
    },
    {
      page: 1,
      y: 820,
      text: "10/06 Mercado Central R$ 186,42",
      items: [
        { text: "10/06", x: 100 },
        { text: "Mercado", x: 280 },
        { text: "Central", x: 350 },
        { text: "R$", x: 720 },
        { text: "186,42", x: 750 }
      ]
    }
  ];
  const result = parser.parseDocumentRows(rows, "fatura.pdf", [], {
    fallbackYear: 2026,
    today: "2026-06-30"
  });
  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].description, "Mercado Central");
  assert.equal(result.transactions[0].amount, 186.42);
});

test("Nubank herda a data do bloco e ignora totais diarios", () => {
  const rows = [
    { page: 1, y: 800, text: "03 JUN 2026 Total de entradas + 1.409,54", items: [] },
    { page: 1, y: 780, text: "Transferência recebida pelo Pix JULIANNE 1.178,20", items: [] },
    { page: 1, y: 760, text: "Resgate RDB 231,34", items: [] },
    { page: 1, y: 740, text: "Total de saídas - 251,29", items: [] },
    { page: 1, y: 720, text: "Pagamento de fatura 231,29", items: [] },
    { page: 1, y: 700, text: "Transferência enviada pelo Pix BRUNA 20,00", items: [] }
  ];
  const result = parser.parseDocumentRows(rows, "nubank.pdf", [], { fallbackYear: 2026 });
  assert.equal(result.context.documentType, "bank_statement");
  assert.equal(result.transactions.length, 4);
  assert.deepEqual(result.transactions.map((item) => item.amount), [1178.2, 231.34, 231.29, 20]);
  assert.deepEqual(result.transactions.map((item) => item.type), ["income", "income", "expense", "expense"]);
  assert.ok(result.transactions.every((item) => item.date === "2026-06-03"));
});

test("Inter usa o valor da movimentação antes do saldo", () => {
  const rows = [
    { page: 1, y: 800, text: "11 de Junho de 2026 Saldo do dia: R$ 4.590,19", items: [] },
    { page: 1, y: 780, text: 'Pix enviado: "CEMIG DISTRIBUICAO SA" -R$ 124,74 R$ 4.590,19', items: [] },
    { page: 1, y: 760, text: 'Pix recebido: "CLIENTE" R$ 950,00 R$ 5.540,19', items: [] }
  ];
  const result = parser.parseDocumentRows(rows, "inter.pdf", [], { fallbackYear: 2026 });
  assert.equal(result.context.documentType, "bank_statement");
  assert.deepEqual(result.transactions.map((item) => item.amount), [124.74, 950]);
  assert.deepEqual(result.transactions.map((item) => item.type), ["expense", "income"]);
});

test("Bradesco associa histórico anterior às colunas de crédito e débito", () => {
  const rows = [
    {
      page: 1, y: 900, text: "Data Histórico Docto. Crédito (R$) Débito (R$) Saldo (R$)",
      items: [
        { text: "Data", x: 46 }, { text: "Histórico", x: 110 }, { text: "Crédito", x: 385 },
        { text: "Débito", x: 452 }, { text: "Saldo", x: 520 }
      ]
    },
    { page: 1, y: 880, text: "PIX RECEBIDO", items: [{ text: "PIX", x: 110 }, { text: "RECEBIDO", x: 125 }] },
    {
      page: 1, y: 870, text: "01/06/2026 2007377 16,00 16,00",
      items: [{ text: "01/06/2026", x: 46 }, { text: "2007377", x: 303 }, { text: "16,00", x: 409 }, { text: "16,00", x: 533 }]
    },
    { page: 1, y: 850, text: "PIX ENVIADO", items: [{ text: "PIX", x: 110 }, { text: "ENVIADO", x: 125 }] },
    {
      page: 1, y: 840, text: "2008079 16,00 0,00",
      items: [{ text: "2008079", x: 303 }, { text: "16,00", x: 473 }, { text: "0,00", x: 537 }]
    },
    {
      page: 1, y: 820, text: "Total 16,00 16,00 0,00",
      items: [{ text: "Total", x: 110 }, { text: "16,00", x: 409 }, { text: "16,00", x: 473 }, { text: "0,00", x: 537 }]
    }
  ];
  const result = parser.parseDocumentRows(rows, "bradesco.pdf", [], { fallbackYear: 2026 });
  assert.equal(result.transactions.length, 2);
  assert.deepEqual(result.transactions.map((item) => item.description), ["PIX RECEBIDO", "PIX ENVIADO"]);
  assert.deepEqual(result.transactions.map((item) => item.type), ["income", "expense"]);
  assert.deepEqual(result.transactions.map((item) => item.amount), [16, 16]);
});

test("número de documento monetário não substitui o valor da movimentação", () => {
  const item = parse("10/06 DOC: 300.000,00 COMPRA MERCADO 100,00 SALDO 500,00");
  assert.equal(item.amount, 100);
  assert.equal(item.description, "DOC: 300.000,00 COMPRA MERCADO");
});
test("resumos colados de extrato nao viram movimentacao", () => {
  assert.equal(parse("10/06 TotalTransferenciaDe entradasrecebida pelo Pix JOAO + 300,00"), null);
  assert.equal(parse("10/06 Pix enviado: Maria 100,00 Saldo do dia: 900,00"), null);
});
