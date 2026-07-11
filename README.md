# Gates - Finanças

Área financeira pessoal do sistema Gates, criada como módulo estático independente da agenda.

## Como usar

Abra `index.html` no navegador ou acesse a pasta pelo mesmo servidor estático usado pelo projeto principal.

Os dados ficam no `localStorage` do próprio navegador, sem conta, login ou backend. Se `data/financeiro.json` existir, ele serve apenas como carga inicial quando ainda não houver dados locais. Uma instalação nova começa vazia. Para levar lançamentos, categorias, contas, orçamentos e metas a outro navegador, use **Exportar** e depois **Importar > Backup JSON**.

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

Cada navegador mantém seu próprio estado. Publicar o projeto não publica os dados financeiros locais e pessoas diferentes não compartilham informações entre si.
