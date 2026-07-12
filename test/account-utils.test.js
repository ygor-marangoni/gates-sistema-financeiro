"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const accounts = require("../src/scripts/account-utils.js");

test("migra contas de JSON antigo e remove duplicatas equivalentes", () => {
  const result = accounts.normalizeAccounts(
    ["Conta principal", "  conta   PRINCIPAL  "],
    [{ account: "Cartão" }, { account: "cartao" }, { account: "" }]
  );
  assert.deepEqual(result, ["Cartão", "Conta principal"]);
});

test("registra uma conta sem duplicar nomes equivalentes", () => {
  const first = accounts.registerAccount([], "Conta digital");
  const second = accounts.registerAccount(first, " conta   digital ");
  assert.deepEqual(second, ["Conta digital"]);
});

test("excluir conta limpa os vínculos sem apagar lançamentos", () => {
  const transactions = [
    { id: "1", description: "Compra", account: "Cartão" },
    { id: "2", description: "Salário", account: "Conta principal" },
    { id: "3", description: "Assinatura", account: "cartao" }
  ];
  const result = accounts.removeAccount(["Cartão", "Conta principal"], transactions, "CARTÃO");
  assert.equal(result.removed, true);
  assert.equal(result.affected, 2);
  assert.deepEqual(result.accounts, ["Conta principal"]);
  assert.equal(result.transactions.length, 3);
  assert.deepEqual(result.transactions.map((item) => item.account), ["", "Conta principal", ""]);
});
