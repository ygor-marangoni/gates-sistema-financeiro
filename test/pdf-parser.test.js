"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const parser = require("../pdf-parser.js");

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
