# Persistência dos dados

O Gates é uma aplicação estática, sem login, autenticação, conta de usuário ou banco de dados remoto.

## Como funciona

- O estado financeiro completo é salvo no `localStorage` do navegador.
- Cada navegador e domínio possui seu próprio armazenamento; visitantes diferentes não compartilham dados.
- Uma instalação nova começa vazia.
- O arquivo opcional `data/financeiro.json` só é lido como carga inicial quando ainda não existe estado local.
- `data/financeiro.json` fica ignorado pelo Git para impedir a publicação acidental de informações pessoais.

## Importação e exportação

O botão **Exportar** gera um backup JSON com lançamentos, categorias, contas, orçamentos e metas. Para transferir os dados a outra guia anônima, navegador ou domínio:

1. Exporte o JSON no navegador de origem.
2. Abra o Gates no navegador de destino.
3. Use **Importar > Backup JSON**.
4. Revise e confirme a substituição do estado local.

Extratos e faturas em PDF também são processados localmente no navegador. O documento não é enviado a uma API externa.

## Desenvolvimento local

Execute:

```bash
node server.js
```

Abra `http://127.0.0.1:4173`. O servidor apenas entrega os arquivos estáticos e não possui `/api/data`.

Também é possível abrir `index.html` diretamente, embora um servidor local ofereça melhor compatibilidade com bibliotecas carregadas pelo navegador.

## Cloudflare Pages

Use o projeto como site estático:

```text
Framework preset: None
Build command: vazio
Build output directory: .
Root directory: vazio
```

Não configure KV, D1, variáveis de autenticação ou Pages Functions. A privacidade vem do armazenamento local isolado de cada navegador e da portabilidade explícita pelo backup JSON.
