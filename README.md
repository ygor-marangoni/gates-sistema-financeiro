# Gates - Finanças

Área financeira pessoal do sistema Gates, com autenticação Google e dados isolados por conta.

## Como usar

Execute `node server.js` para desenvolvimento local ou use a implantação no Cloudflare Pages.

Na web, cada conta Google possui seu próprio JSON no KV e um cache local separado no navegador. Uma conta nova começa vazia. O usuário pode importar um backup JSON próprio ou exportado por outra conta; após a confirmação, esse estado passa a pertencer somente à conta conectada. Exportar continua gerando um backup portátil com lançamentos, categorias, contas, orçamentos e metas.

## Recursos

- Visão geral financeira com entradas, saídas, saldo e meta principal.
- Cadastro, edição e exclusão de lançamentos.
- Filtros por período, tipo, categoria, conta e busca textual.
- Organização por mês, semana e categoria.
- Gráfico de saldo acumulado e composição de gastos.
- Planejamento mensal com orçamento por categoria.
- Metas financeiras com prazo, progresso e histórico de aportes.
- Importação guiada de backup JSON ou extrato bancário em PDF, com revisão antes de salvar.
- Histórico de transações, alertas, insights e compromissos futuros.
- Tema claro/escuro e layout responsivo.
- Login Google, sessão persistente e isolamento de dados entre usuários.
- Gráficos renderizados com Chart.js.

## Escopo

O JSON compartilhado legado nunca é atribuído automaticamente a um usuário. Qualquer migração deve ocorrer por exportação e importação explícitas enquanto a conta correta estiver conectada.
