# Relatorio de UX e evolucao do Gates Financas

## Resumo executivo

O sistema ja possui uma base consistente: navegacao simples, tema claro/escuro, cadastro de lancamentos, planejamento, metas, categorias e visualizacoes financeiras. O maior ganho de experiencia agora nao viria de adicionar mais paineis, textos motivacionais ou elementos decorativos. Viria de tornar os dados mais confiaveis, reduzir controles fora de contexto e conectar melhor as funcionalidades existentes.

As prioridades recomendadas sao:

1. Proteger os dados com backup, importacao revisavel e desfazer.
2. Transformar recorrencias, contas e aportes em fluxos financeiros reais.
3. Simplificar filtros e comandos conforme a pagina atual.
4. Adicionar importacao de extrato com previa e deteccao de duplicatas.
5. Melhorar mobile, acessibilidade e feedback de formularios.

## Pontos fortes atuais

- Hierarquia visual contida e apropriada para um sistema operacional.
- Navegacao lateral previsivel e com poucas secoes.
- Tema escuro coerente com a identidade visual.
- CRUD de lancamentos, categorias e metas ja funcional.
- Filtros por periodo, tipo, categoria, conta e busca.
- Planejamento mensal conectado aos gastos por categoria.
- Confirmacao antes de exclusoes destrutivas.
- Exportacao JSON e geracao de relatorio para PDF.
- Layout responsivo com drawer mobile para lancamentos.

## Melhorias de alta prioridade

### 1. Seguranca e confiabilidade dos dados

**Premissa do produto:** o sistema sera local e simplificado, sem login ou autenticacao. O JSON funciona como backup e carga de dados. No navegador, as alteracoes continuam no `localStorage`, pois uma pagina estatica nao pode sobrescrever diretamente o arquivo JSON do projeto.

**Melhorias:**

- Criar backup automatico local com versoes recentes.
- Exibir previa antes de importar JSON.
- Permitir escolher entre substituir ou mesclar dados.
- Detectar lancamentos duplicados durante importacoes.
- Oferecer `Desfazer` apos exclusao, importacao e edicao relevante.
- Exibir data e hora da ultima exportacao de backup.

### 2. Controles dependentes do contexto

**Problema:** busca e filtros globais permanecem disponiveis em telas nas quais nao afetam o conteudo. Isso faz o usuario testar controles sem entender por que nada mudou.

**Melhorias:**

- Mostrar busca de lancamentos apenas em Visao geral e Lancamentos.
- Adaptar filtros ao contexto: metas por categoria/status, categorias por tipo e planejamento por mes.
- Manter o periodo global apenas onde ele realmente altera os dados.
- Informar filtros ativos junto ao titulo da lista afetada.

### 3. Recorrencias reais

**Problema:** marcar um lancamento como recorrente apenas salva um booleano; nao existe frequencia, proxima ocorrencia, termino ou geracao automatica.

**Melhorias:**

- Frequencias semanal, mensal, anual e personalizada.
- Data da proxima ocorrencia e opcao de termino.
- Geracao automatica ou confirmacao antes de lancar.
- Edicao de apenas uma ocorrencia ou de toda a serie.
- Tela compacta para assinaturas e despesas fixas.

### 4. Gestao real de contas

**Problema:** contas sao inferidas de textos digitados nos lancamentos. Nao possuem saldo inicial, tipo, instituicao ou transferencia.

**Melhorias:**

- Cadastro de conta corrente, carteira, poupanca e cartao.
- Saldo inicial e saldo calculado.
- Transferencias entre contas sem contar como receita/despesa.
- Arquivamento de contas antigas sem perder historico.
- Visao de patrimonio por conta.

### 5. Feedback e validacao dos formularios

**Problema:** erros sao comunicados principalmente por toast e o formulario de lancamento usa `novalidate`. O usuario nao identifica rapidamente qual campo precisa de correcao.

**Melhorias:**

- Erro inline abaixo do campo correspondente.
- Preservar os valores preenchidos quando houver erro.
- Bloquear envio duplicado.
- Confirmacao visual curta dentro do drawer apos salvar.
- Cancelamento claro ao editar metas, categorias e lancamentos.

## Melhorias de design e UX

### Consistencia visual

- Usar verde apenas para acao primaria, progresso e resultado positivo.
- Reservar vermelho e amarelo para estados financeiros reais.
- Evitar icones decorativos; usar icones apenas em comandos ou categorias reconheciveis.
- Padronizar cabecalhos de painel, espacamentos e densidade entre todas as paginas.
- Evitar textos explicativos permanentes quando o estado ou o controle ja comunica a funcao.

### Navegacao e filtros

- Unificar a logica dos seletores de periodo para evitar periodos diferentes competindo na mesma tela.
- Exibir `Tudo` apenas no header, como implementado, e manter a lateral compacta.
- Desabilitar navegacao anterior/proxima quando `Tudo` estiver selecionado.
- Permitir limpar filtros individualmente, alem de limpar todos.
- Salvar filtros por pagina, sem transportar uma selecao irrelevante entre views.

### Lancamentos

- Tornar os filtros internos atualmente ocultos acessiveis por um botao de filtro.
- No mobile, trocar a tabela por linhas responsivas ou lista estruturada, evitando depender apenas de rolagem horizontal.
- Permitir duplicar um lancamento.
- Adicionar selecao multipla para categorizar, mover ou excluir em lote.
- Mostrar origem do lancamento: manual, importado ou recorrente.

### Planejamento

- Permitir copiar orcamentos do mes anterior.
- Mostrar comparacao com o mes anterior, nao apenas valores absolutos.
- Separar claramente gasto realizado, previsto e recorrente.
- Permitir editar limites diretamente na linha da categoria.
- Trocar insights genericos por alertas acionaveis com link para os lancamentos relacionados.

### Metas

- Registrar historico de aportes, em vez de manter apenas o total acumulado.
- Vincular um aporte a uma conta ou lancamento real.
- Permitir pausar, concluir ou arquivar uma meta.
- Usar a categoria da meta em filtros e agrupamentos.
- Exibir prazo e progresso sem projecoes diarias automaticas quando nao forem solicitadas.

### Categorias

- Impedir exclusao de categoria em uso sem oferecer substituicao.
- Permitir reordenacao e arquivamento.
- Criar regras de categorizacao por estabelecimento ou descricao.
- Exibir quantidade de lancamentos e total movimentado antes de editar/excluir.

### Responsividade e acessibilidade

- Manter busca acessivel no mobile por uma acao propria, em vez de simplesmente oculta-la.
- Garantir foco visivel em todos os botoes, inclusive icones.
- Implementar navegacao de teclado e foco preso nos modais/drawers.
- Adicionar tooltips aos comandos apenas com icone.
- Revisar contraste de textos secundarios e placeholders no tema escuro.
- Testar valores monetarios longos e nomes extensos em 320 px, 768 px e desktop amplo.

## Novas funcionalidades recomendadas

### Fase 1: alto impacto e menor complexidade

1. **Importacao OFX e CSV bancario**
   - Upload do arquivo.
   - Mapeamento de colunas quando necessario.
   - Previa dos lancamentos.
   - Deteccao de duplicatas.
   - Sugestao de categoria baseada em regras locais.
   - Confirmacao antes de gravar e opcao de desfazer.

2. **Revisao de importacao**
   - Comparar itens importados com lancamentos existentes.
   - Sinalizar possiveis duplicatas.
   - Permitir ignorar ou criar cada item.

3. **Importacao e exportacao CSV**
   - Formato simples para planilhas.
   - Exportacao do resultado filtrado, nao apenas de todo o estado.

4. **Acoes em lote**
   - Selecionar varios lancamentos.
   - Alterar categoria, conta ou excluir.

5. **Historico e desfazer**
   - Restaurar exclusoes recentes.
   - Visualizar operacoes importantes.

### Fase 2: organizacao financeira completa

6. **Modulo de cartao de credito**
   - Fechamento e vencimento.
   - Compras parceladas.
   - Fatura atual, futura e paga.
   - Pagamento da fatura sem duplicar despesa.

7. **Parcelamento**
   - Quantidade de parcelas e intervalo.
   - Edicao de uma parcela ou da serie.
   - Identificacao `3/10` nas listas.

8. **Transferencias entre contas**
   - Saida e entrada vinculadas.
   - Neutralidade no total de receitas/despesas.

9. **Motor de recorrencias**
   - Agenda, previsao e confirmacao de ocorrencias.

10. **Aportes vinculados a metas**
    - Historico, origem do dinheiro e reversao.

11. **Divisao de lancamento**
    - Uma compra distribuida entre varias categorias.

12. **Regras automaticas locais**
    - Exemplo: descricoes contendo `UBER` recebem Transporte.
    - Regras transparentes, editaveis e sem linguagem de IA.

### Fase 3: automacao local

13. **Leitura de fatura em PDF**
    - Extrair compras e apresentar previa.
    - Nunca inserir automaticamente sem revisao.

14. **Comprovantes e anexos**
    - Imagem ou PDF associado ao lancamento.

15. **Lembretes**
    - Vencimentos, orcamentos proximos do limite e metas com prazo.

16. **PWA e funcionamento offline**
    - Instalacao no celular mantendo o modelo local, sem login.

## Como aumentar a interatividade sem parecer IA

- Priorizar manipulacao direta: editar na linha, arrastar, selecionar e confirmar.
- Mostrar feedback imediato e reversivel apos cada acao.
- Usar sugestoes deterministicas e explicaveis, como regras por descricao.
- Levar alertas ao dado que os originou com `Ver lancamentos`.
- Evitar textos motivacionais genericos, icones decorativos e paineis criados apenas para preencher espaco.
- Manter o usuario no controle: importacoes, regras e automacoes sempre devem ter previa.

## Sequencia recomendada de execucao

1. Backup, importacao segura e desfazer.
2. Filtros por contexto e validacao inline.
3. Contas e transferencias.
4. Importacao OFX/CSV com regras de categoria.
5. Recorrencias e parcelamentos.
6. Cartao de credito e faturas.
7. Historico de aportes e metas vinculadas.
8. Automacoes locais e PWA, mantendo o sistema sem autenticacao.
