# Persistencia dos dados

O frontend usa `/api/data` para ler e salvar o estado completo da area financeira.

## Desenvolvimento local

Execute:

```bash
node server.js
```

Abra o endereco exibido pelo comando, normalmente `http://localhost:4173`. Nao use o Live Server na porta `8080`: ele serve apenas arquivos estaticos e, por isso, nao possui a rota `/api/data`.

O servidor grava cada alteracao em `data/financeiro.json`. Esse arquivo fica ignorado pelo Git para que os dados locais nunca sejam publicados por acidente.

## Cloudflare Pages

O deploy pelo Git nao utiliza um comando de deploy. A funcao em `functions/api/data.js` cria o endpoint `/api/data` e salva o mesmo payload JSON em KV.

No painel do projeto Pages, abra `Settings > Bindings`, adicione um binding do tipo `KV namespace` com o nome `FINANCE_DATA` e refaca o deploy. O namespace precisa ser criado no painel antes de ser associado.

Para este projeto sem framework, deixe o Build command vazio (ou use `exit 0`), o Root directory vazio e o Build output directory como `.`.

Como o modulo nao possui autenticacao, o dado remoto e compartilhado por todos os acessos da mesma implantacao. O export JSON continua disponivel para levar os dados a outra guia ou implantacao.
