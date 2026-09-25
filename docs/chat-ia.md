# Chat com IA

## Interface

A análise encontrou repetição de títulos, cartões de contexto, listas de dados, botões por resposta e sugestões permanentes. O chat agora abre sem gastar uma chamada, mostra três sugestões iniciais e mantém o foco nas mensagens. O histórico tem rolagem própria; contexto e nova conversa ficam na barra superior. Não há respostas simuladas como fallback.

Contexto permite escolher data inicial e final, até hoje, em intervalos de até 31 dias. Aplicar período atualiza os fatos da próxima mensagem. As respostas anteriores permanecem com o contexto que tinham; um aviso indica quando os registros mudaram. A seleção não altera os filtros das outras telas.

## Integração e privacidade

assistant-chat verifica a sessão no Supabase Auth antes de liberar a cota e chamar a API Responses. A chave permanece no servidor: OPENAI_API_KEY ou OPEN_AI_API_KEY. O modelo padrão é gpt-4.1-mini; OPENAI_CHAT_MODEL permite configuração explícita. Publicação: npm run deploy:chat.

Usa as migrações existentes 001 e 002, sem novo SQL. Chat, fotos e treinos compartilham 30 tentativas por dia UTC por usuário, com intervalo de 10 segundos. Falhas depois da liberação também contam; interromper no navegador não garante cancelamento do processamento remoto.

Mensagens, seis pares anteriores de pergunta/resposta e um resumo de alimentação, energia, treino e medidas do período são enviados à OpenAI. A projeção remove campos desconhecidos tanto no cliente quanto no servidor. Fotos, nome, e-mail e tokens não são incluídos no contexto. Informações digitadas pelo usuário na conversa são enviadas como mensagem. O resumo é fornecido pelo cliente; a IA não consulta diretamente o banco. O assistente não tem ferramentas de escrita e não altera registros.

Conversa temporária em memória, limitada às últimas 12 interações na tela; recarregar ou sair descarta o histórico. A chamada usa store:false; isso não equivale a uma garantia de retenção zero pelo provedor. Referência: [documentação oficial da OpenAI](https://developers.openai.com/api/docs/guides/migrate-to-responses).

## Validação

Testes cobrem sessão inválida, validação e projeção de entrada, cota, histórico, saída inválida, erros do provedor e ausência de ferramentas de escrita. O teste de navegador cobre abertura sem chamada, datas do contexto, erro e nova tentativa, continuidade, nova conversa e cancelamento ao fechar, incluindo tela de celular. As chamadas OpenAI são simuladas nesses testes; geração real requer sessão autenticada no projeto remoto.
