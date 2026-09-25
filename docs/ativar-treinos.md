# Treinos com IA

A função Supabase generate-training-plan usa a API Responses da OpenAI. A IA escolhe os nomes dos exercícios livremente; o catálogo do aplicativo não é enviado nem consultado na geração. A edição manual usa nomes em texto livre, sem seletor de catálogo. A quantidade de exercícios é escolhida pela IA dentro do tempo disponível; não há teto fixo de exercícios por sessão.

## Configuração

1. Use as migrações 202609230001_fortiva.sql e 202609230002_meal_photo_usage.sql já utilizadas pela análise de fotos. Não há migração adicional.
2. Cadastre OPENAI_API_KEY nos secrets do Supabase. O nome alternativo OPEN_AI_API_KEY também é aceito, reutilizando a chave das fotos.
3. Execute npm run deploy:training no terminal do projeto. O script publica a função com verify_jwt desativado no gateway; a própria função valida a sessão pelo Supabase Auth antes de chamar a IA.

O modelo padrão é gpt-4.1-mini. OPENAI_TRAINING_MODEL permite configurar outro modelo compatível com Responses e JSON Schema estrito.

## Uso e limites

Em Treinos → Gerar com IA, informe idade, objetivo, experiência, meses de prática, frequência e minutos disponíveis. Somente esses seis campos são enviados à IA. A proposta assume academia convencional e não avalia lesões ou limitações individuais.

O servidor valida quantidade de dias, estrutura, nomes, séries, repetições, descanso e uma estimativa de duração. As cargas começam em zero para ajuste pelo usuário. O plano só é salvo após revisão e não é ativado automaticamente. Fechar a janela cancela a espera no aplicativo; uma solicitação já recebida pelo servidor ainda pode consumir uso.

Chat, fotos e treinos compartilham o contador existente: 30 tentativas por dia UTC por conta e intervalo mínimo de 10 segundos. Falhas após liberar a tentativa também contam. A chave fica somente no servidor e a chamada usa store:false.
