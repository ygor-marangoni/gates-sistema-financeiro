# Persistência dos dados

O frontend usa `/api/data` para ler e salvar o estado completo da área financeira. Na web, todas as rotas de dados exigem uma sessão Google válida.

## Isolamento por usuário

- O backend verifica o ID token emitido pelo Google e usa somente o claim estável `sub` como identidade.
- A chave persistida é derivada de um hash de `google:<sub>`; nenhum ID enviado pelo frontend escolhe a conta.
- Sessões são opacas, ficam no KV e usam cookie `HttpOnly`, `Secure` e `SameSite=Lax` por 30 dias.
- Escritas exigem mesma origem e um token CSRF da sessão.
- O `localStorage` também usa uma chave diferente para cada usuário.
- Uma conta nova recebe estado vazio. O antigo registro compartilhado `financeiro` nunca é lido ou migrado automaticamente.

## Desenvolvimento local

Execute:

```bash
node server.js
```

Abra o endereço exibido pelo comando, normalmente `http://127.0.0.1:4173`. Não use Live Server: ele serve apenas arquivos estáticos e não possui as rotas de sessão e `/api/data`.

O servidor local só aceita conexões de `127.0.0.1`, cria uma sessão local e grava cada alteração em `data/financeiro.json`. Esse arquivo fica ignorado pelo Git para que os dados locais nunca sejam publicados por acidente.

## Cloudflare Pages

O deploy pelo Git não utiliza comando de build. As Pages Functions implementam o OAuth do Google, a sessão e o endpoint `/api/data`; o binding `FINANCE_DATA` guarda sessões temporárias e um JSON separado para cada usuário.

O arquivo `wrangler.jsonc` declara o binding `FINANCE_DATA`, o domínio de produção e o ID do namespace.

### Configurar o Google

1. No Google Cloud Console, crie um cliente OAuth 2.0 do tipo **Aplicativo da Web**.
2. Configure a tela de consentimento do aplicativo.
3. Adicione esta URI de redirecionamento autorizada, exatamente como está:

```text
https://gates-financas.pages.dev/api/auth/google/callback
```

4. Cadastre o ID e o segredo do cliente como secrets no ambiente de produção do projeto Pages:

```bash
npx wrangler pages secret put GOOGLE_CLIENT_ID --project-name gates
npx wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name gates
```

Os comandos solicitam os valores de forma interativa. Não coloque essas credenciais no Git ou no `wrangler.jsonc`. Uma nova implantação é necessária depois de configurar os secrets.

Para este projeto sem framework, deixe o Build command vazio, o Root directory vazio e o Build output directory como `.`.

## Portabilidade

O botão **Exportar** produz o JSON completo da conta conectada. Em outra conta ou em uma janela anônima, entre com Google e use **Importar > Backup JSON**. A restauração só é gravada após a confirmação e substitui apenas os dados do usuário autenticado.
