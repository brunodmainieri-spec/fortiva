# Ativar o registro de refeição por foto

O aplicativo já chama a Edge Function `analyze-meal-photo`. Os arquivos foram preparados e testados localmente, mas a função precisa ser publicada no projeto Supabase. A chave pública do frontend não permite publicar funções ou configurar secrets.

## 1. Cadastrar a chave no servidor

No painel do projeto, abra **Edge Functions > Secrets** e adicione:

- Nome recomendado: `OPENAI_API_KEY` (o nome `OPEN_AI_API_KEY` também é aceito para compatibilidade com a configuração existente)
- Valor: sua chave da API da OpenAI

Salve. Não coloque essa chave no `.env.local` do Vite, em variáveis `VITE_*`, no código da função ou na conversa. A chave deve ter acesso à API e créditos disponíveis.

O modelo padrão é `gpt-4.1-mini`. Opcionalmente, defina `OPENAI_VISION_MODEL` com outro modelo que suporte imagens e Structured Outputs na Responses API.

## 2. Preparar o limite de uso

Em **SQL Editor > New query**, cole todo o arquivo:

`supabase/migrations/202609230002_meal_photo_usage.sql`

Clique em **Run**. Execute apenas essa nova migração, uma vez. Não execute novamente a migração inicial do aplicativo.

Ela cria um contador privado por conta: até 30 tentativas compartilhadas entre chat, fotos e treinos por dia UTC e intervalo de 10 segundos entre tentativas. Falhas do provedor depois da liberação também consomem uma tentativa. Usuários não podem alterar ou zerar esse contador. Os registros contam tentativas; não guardam fotos nem respostas da IA.

## 3. Publicar a função

Em **Edge Functions**, crie uma função pelo editor do painel:

- Nome exato: `analyze-meal-photo`
- Arquivo: `index.ts`
- Substitua o exemplo pelo conteúdo completo de `supabase/functions/analyze-meal-photo/index.ts`.
- Publique a função.

Na configuração da função, desative a opção de verificação JWT da plataforma (**Verify JWT / Enforce JWT Verification**, cujo rótulo pode variar). Esta função valida obrigatoriamente o token do usuário no Supabase Auth antes de ler a foto ou chamar a OpenAI. A validação dentro do código é compatível com as chaves de assinatura JWT novas e antigas; desligar a validação do gateway não libera a análise para usuários sem login.

Não precisa adicionar bibliotecas ou arquivos extras. A função usa `fetch` e os secrets de ambiente do Supabase. `SUPABASE_URL` e a chave pública/anon do projeto são fornecidos pelo ambiente; o código suporta os formatos de variáveis novos e antigos.

Alternativa pelo terminal, se já estiver autenticado no CLI:

```powershell
npm.cmd run deploy:meal-photo
```

A migração SQL e o secret também precisam estar configurados. O arquivo `supabase/config.toml` já define `verify_jwt = false`. O comando `deploy:meal-photo` também passa `--no-verify-jwt` explicitamente. Essas opções são aplicadas na publicação pelo CLI; colar apenas o `index.ts` no editor do painel não altera a configuração do gateway.

## 4. Testar com sua conta

1. Entre no FORTIVA e abra **Registrar refeição por foto**.
2. Escolha uma foto nítida do prato ou use a câmera.
3. Toque em **Analisar foto**. Somente nesse momento a imagem é enviada à OpenAI.
4. Revise nomes, quantidades e nutrientes. Os valores são estimativas da porção visível, não medições exatas nem valores por 100 g.
5. Ajuste o necessário e toque em **Salvar refeição**.

Os resultados ficam no rascunho durante a revisão; só entram no diário após salvar. A função de IA não grava refeições nem recebe o perfil, as metas ou o histórico do usuário. A foto pode já estar persistida como parte do rascunho no Supabase, como no fluxo anterior.

Se não houver comida reconhecível, o app pede outra foto e não inventa itens. Se houver falha, preserva a imagem para tentar novamente. Remover a foto ou fechar a tela cancela a espera no cliente; uma requisição já recebida pelo provedor pode ainda gerar cobrança.

## Verificações realizadas

Os testes de backend simulam Auth e OpenAI para verificar assinatura via Auth, rejeição de entradas inválidas, limite de uso, resposta estruturada, indisponibilidade e preservação de secrets. O SQL é executado em PostgreSQL embarcado. Os testes de navegador usam respostas interceptadas para validar erro, nova tentativa, edição e confirmação do registro.

Esses testes não substituem a verificação de uma foto real na função publicada, com sua chave.

## Referências

- [Imagens na API da OpenAI](https://developers.openai.com/api/docs/guides/images-vision)
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Secrets no Supabase](https://supabase.com/docs/guides/functions/secrets)
- [Publicação de Edge Functions](https://supabase.com/docs/guides/functions/deploy)
