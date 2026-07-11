# Gates - Finanças

Área financeira pessoal do sistema Gates, criada como módulo estático independente da agenda.

## Como usar

Abra `index.html` no navegador ou acesse a pasta pelo mesmo servidor estático usado pelo projeto principal.

Quando `data/financeiro.json` existe, ele é usado como carga inicial e reaplicado sempre que seu conteúdo muda. Depois da carga, as alterações feitas pela interface permanecem no `localStorage`. Se o arquivo não existir no deploy, o módulo usa o estado local ou inicia vazio. A interface também permite exportar e importar um JSON com lançamentos, orçamentos e metas.

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
- Gráficos renderizados com Chart.js.

## Escopo

Este módulo não altera os arquivos da agenda na raiz do projeto. A agenda e a área financeira possuem estados locais separados.
