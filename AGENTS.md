# Contexto do projeto — FORTIVA

## Objetivo
- Aplicativo de alimentação, treinos e evolução corporal; dados pertencem à conta autenticada.
- Leia `README.md` e, para funções de IA, os guias em `docs/` antes de alterar fluxos ou integração.

## Arquitetura
- Frontend React/TypeScript + Vite; rotas e shell em `src/App.tsx`, estado em `src/store.tsx`, Auth e persistência em `src/supabase.ts`.
- Domínio e UI por módulo em `src/domain.ts`, `src/nutrition.tsx`, `src/training.tsx`, `src/evolution.tsx` e `src/profile.tsx`.
- Banco PostgreSQL/Supabase: migrações em `supabase/migrations/`; RLS e escrita transacional via `fortiva_save`.
- Edge Functions de análise de fotos, planos de treino e chat em `supabase/functions/`; contratos compartilhados em `_shared/`.
- PWA: manifesto e offline em `public/`, geração do service worker em `scripts/build-pwa.mjs`.

## Áreas protegidas
- Não exponha chave secreta, `service_role` ou credenciais no frontend; `.env.example` só enumera chaves públicas `VITE_SUPABASE_*`.
- Preserve isolamento por `auth.uid()`, RLS, controle de revisão e gravação somente após confirmação remota; não altere migrações aplicadas sem plano de migração.
- Não trate estimativas de foto ou planos gerados por IA como registros confirmados: o usuário revisa antes de salvar.
- PWA não oferece gravação offline de dados pessoais; não armazene respostas do Supabase ou fotos no cache do service worker.
- Deploy da Vercel, Edge Functions e configuração/migração do Supabase são ações externas separadas; não as execute sem autorização.

## Verificação
- Scripts conferidos em `package.json`: `npm run build` (TypeScript, Vite e PWA), `npm test` (Vitest), `npm run test:e2e` e `npm run test:pwa` (Playwright).
- A configuração E2E usa `npm.cmd` no `webServer` em `playwright.supabase.config.ts`: no WSL/Linux, confira a disponibilidade desse comando antes de rodar; não afirme cobertura se o runner não iniciar.
- Para mudanças de banco, revise `src/supabase-sql.test.ts` e valide isolamento entre contas; para UI, confira fluxo afetado e estados de erro com os testes pertinentes.
- Estas instruções citam scripts documentados; nenhuma instalação, compilação ou suíte foi executada para elaborar este arquivo.
