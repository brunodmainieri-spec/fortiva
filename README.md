# FORTIVA

Aplicação React + Vite para alimentação, treinos e evolução corporal, com autenticação e persistência em PostgreSQL pelo Supabase.

## Configuração do Supabase

1. Crie um projeto Supabase.
2. No **SQL Editor**, execute o arquivo completo `supabase/migrations/202609230001_fortiva.sql` uma vez. Ele cria sete tabelas, duas funções e as permissões. A migração é transacional: um erro desfaz a execução inteira. Não execute novamente após uma execução bem-sucedida.
3. Copie `.env.example` para `.env.local` e informe a URL do projeto e a chave **publishable**. O projeto atual já foi configurado localmente. Nunca use `service_role`, chave secreta ou senha do banco no frontend.
4. Em **Authentication > URL Configuration**, configure o Site URL para a origem usada ao abrir o aplicativo. Em desenvolvimento: `http://127.0.0.1:5173`.
5. Adicione às Redirect URLs:
   - `http://127.0.0.1:5173/entrar`
   - `http://127.0.0.1:5173/redefinir-senha`
   - Se usar localhost, adicione também as mesmas rotas com `http://localhost:5173`.
   - Em produção, cadastre as duas rotas na origem HTTPS publicada.
6. Mantenha o provedor Email ativo. Com confirmação de e-mail habilitada, o cadastro informa para confirmar o endereço antes de entrar. Configure o envio de e-mails no Supabase conforme o uso do aplicativo.
7. Reinicie o Vite após mudar variáveis de ambiente.

A chave pública permite que o aplicativo use Auth e a API de dados, mas não permite criar tabelas. Essa etapa precisa ser executada no painel administrativo pelo dono do projeto.

## Executar e verificar

Requisitos: Node.js 22 ou 24 e npm.

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run build
npm.cmd test
npm.cmd run test:e2e
```

Abra `http://127.0.0.1:5173`, crie sua conta e confirme o e-mail. O onboarding começa vazio e salva cada etapa no banco.

Os testes de navegador atuais usam `playwright.supabase.config.ts`, porta 5174 e interceptação HTTP: não enviam e-mails nem criam contas no Supabase real. Os antigos arquivos de testes de demonstração foram preservados como referência, mas dependem do login simulado e do localStorage removidos; não fazem parte da suíte E2E atual. Os testes de domínio continuam usando fixtures isoladas.

`src/supabase-sql.test.ts` executa a migração em PostgreSQL embarcado (PGlite), com os papéis e funções de autenticação mínimos de teste. Verifica anonimato, separação entre dois usuários, transações, remoção de registros, rejeição de dados simulados e concorrência. Isso não substitui a verificação no projeto Supabase após aplicar o SQL.

## Dados e segurança

- Login, cadastro, confirmação, recuperação e atualização de senha usam Supabase Auth.
- O identificador da conta é o UUID autenticado. E-mail não é usado para autorizar acesso.
- `fortiva_profiles` guarda dados de perfil, preferências, rascunhos e versão de gravação.
- `fortiva_meals`, `fortiva_goals`, `fortiva_measurements`, `fortiva_plans`, `fortiva_sessions` e `fortiva_energy` guardam uma linha por registro, vinculada à conta.
- As tabelas são SQL/PostgreSQL; os campos internos dos registros usam JSONB nesta primeira integração, preservando o formato atual do aplicativo. Podem ser consultados no SQL Editor, por exemplo:

```sql
select payload->>'date' as dia, payload->>'weight' as peso
from public.fortiva_measurements
where user_id = 'UUID_DO_USUARIO'
order by payload->>'date';
```

- RLS permite que usuários autenticados leiam apenas suas próprias linhas. Anônimos não acessam tabelas ou funções.
- Escritas passam exclusivamente por `fortiva_save`, uma função transacional com `search_path` fixo que obtém o dono por `auth.uid()` e valida a revisão. Não aceita um UUID de dono fornecido pelo cliente. Escrita direta nas tabelas é revogada para os clientes.
- A versão de gravação impede sobrescrever silenciosamente alterações feitas em outra aba/dispositivo. Em conflito, a tela mantém o formulário e pede recarregamento. Não há atualização em tempo real; os dados remotos são carregados ao entrar/recarregar.
- O frontend mantém os registros em memória e só atualiza a interface após confirmação do banco. O SDK persiste a sessão de autenticação no navegador. Dados antigos em `asimov-fit:v1:*` são ignorados e não são enviados ao banco; não foram apagados automaticamente.
- Fotos comprimidas permanecem em campos JSONB nesta primeira versão. Não há bucket de Storage configurado. Para grandes históricos de fotos, migrar imagens para Storage privado e paginar leituras é uma próxima etapa: atualmente a API carrega o histórico completo e recebe o documento completo nas gravações, atualizando apenas linhas alteradas.

## Recursos disponíveis

Diário e alimentos manuais, metas e onboarding, planos e séries de treino, registro de medidas e fotos, gráficos e preferências continuam disponíveis. Contas novas não recebem histórico demonstrativo.

A análise de fotos está integrada a uma Edge Function do Supabase e à OpenAI. Para ativá-la no projeto remoto, siga [Ativar fotos](docs/ativar-fotos.md). Os resultados são estimativas editáveis e só entram no diário após confirmação. A conexão com relógios/Strava/Garmin continua desativada, sem gastos fictícios. O gerador de planos usa a OpenAI para escolher livremente os exercícios, séries, repetições e descansos, sem consultar o catálogo do app. A proposta exige revisão antes de salvar. Veja [Ativar treinos](docs/ativar-treinos.md). O chat usa a OpenAI via Edge Function autenticada, mantém a conversa em memória e permite selecionar o período do contexto (até 31 dias). Veja [Chat com IA](docs/chat-ia.md).

## Verificação manual no projeto real

Depois de aplicar a migração e configurar os redirecionamentos:

1. Cadastre e confirme uma conta; confira que não há refeições ou treinos de exemplo.
2. Complete o onboarding, registre uma refeição e recarregue.
3. Entre em outro navegador com a mesma conta e confira os registros.
4. Crie uma segunda conta e confirme que ela começa vazia.
5. Solicite recuperação de senha e abra o link recebido. Salve uma nova senha e entre novamente.
6. Edite a mesma conta em duas abas sem recarregar: a segunda gravação deve avisar sobre o conflito.

## PWA: instalação no celular

A estrutura de PWA está pronta para publicação em HTTPS. O manifesto define nome, ícones normais e maskable, idioma e abertura em janela independente (`standalone`). Os PNGs são derivados do monograma vetorial já existente em `public/favicon.svg`. Para gerá-los novamente, use `npm.cmd run pwa:icons` (requer Chromium do Playwright).

O menu **Perfil > Preferências** contém as instruções de instalação para Android e iPhone. Quando o navegador disponibiliza o evento de instalação, aparece o botão **Instalar aplicativo**. Se o evento não estiver disponível, a instalação pode ser feita pelo menu do navegador. A decisão de oferecer instalação depende do navegador; ainda não foi validada em um aparelho físico.

- **Android/Chrome:** menu > Instalar aplicativo ou Adicionar à tela inicial.
- **iPhone/Safari:** Compartilhar > Adicionar à Tela de Início; ativar Abrir como App da Web, se essa opção aparecer.
- O endereço `127.0.0.1` aponta para o próprio dispositivo. Para instalar no celular, publique em HTTPS e abra o endereço publicado. Um endereço HTTP da rede local não substitui essa publicação para testar todos os recursos.
- Atualize as URLs de autenticação do Supabase para o endereço publicado, como descrito acima.

### Conexão, cache e atualizações

Nesta primeira versão, o PWA **precisa de internet para acessar e salvar os dados**. Não há gravação offline, sincronização em segundo plano ou cache de registros pessoais. O service worker guarda somente `offline.html` e seu ícone público. As requisições de navegação usam a rede; se a conexão falhar, mostram a página offline. Reconectar e tocar em **Tentar novamente** retoma o mesmo endereço. Uma janela já aberta exibe um aviso de perda de conexão, preservando os formulários em memória.

Respostas do Supabase, páginas de login com parâmetros, fotos e registros não são guardados no Cache Storage pelo service worker. O SDK do Supabase continua persistindo a sessão no navegador, como antes.

O build gera `dist/sw.js` com uma versão derivada dos arquivos. Uma atualização espera o fechamento das janelas controladas pela versão anterior; não força recarregamento durante um treino ou formulário. Ao ativar, remove somente os caches antigos com o prefixo `fortiva-offline-`.

O registro do service worker é habilitado apenas no build de produção/preview, em contexto seguro. `npm.cmd run dev` continua sem service worker para evitar interferência no desenvolvimento.

```powershell
npm.cmd run build
npm.cmd run preview
# Verificação automatizada: recompila e testa em http://127.0.0.1:4174
npm.cmd run test:pwa
```

Os testes PWA verificam manifesto, dimensões dos ícones, navegação offline, reconexão e conteúdo permitido no cache. A suíte `test:e2e` também verifica o fluxo do botão de instalação com eventos de navegador simulados.

Na publicação, envie toda a pasta `dist`, inclusive `sw.js`, `offline.html`, `manifest.webmanifest` e `icons`. O servidor deve entregar arquivos estáticos existentes e usar `index.html` como fallback para rotas do React. Recomenda-se servir `sw.js` e `index.html` com revalidação (`Cache-Control: no-cache`). A publicação não foi realizada nesta etapa.

## Publicação na Vercel

Site de produção: https://fortiva-fit.vercel.app

Projeto: eu-sou-pro/fortiva-app. Para publicar alterações desta pasta já vinculada: `npx vercel deploy --prod`. O build roda `npm run build`; `vercel.json` configura as rotas do React e impede cache persistente do service worker. A Vercel possui somente VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY para o frontend; a chave OpenAI permanece nos secrets do Supabase. `.vercelignore` exclui arquivos de ambiente, resultados de testes e artefatos locais do upload.

As URLs de autenticação de produção estão em `supabase/config.toml`. Antes de atualizar configurações remotas, use `npx supabase config diff --project-ref sylkxxfnvmqbxbopshix` e confira o diff.
