# DBD Tracker

Aplicação web para gerenciar pedidos de personagens de Dead by Daylight durante streams na Twitch.

## Como funciona

1. Conecta ao chat da Twitch via IRC (somente leitura, sem autenticação)
2. Detecta pedidos de personagens de múltiplas fontes (donates, resubs, comandos de chat)
3. Identifica automaticamente o personagem mencionado usando IA (Gemini) ou correspondência local
4. Exibe fila ordenada por prioridade com retratos dos killers

## Fontes de pedidos

| Fonte | Como funciona |
|-------|---------------|
| **Donates** | Detecta mensagens do bot de doação (ex: LivePix). Filtra por valor mínimo |
| **Resubs** | Captura mensagens de resub via USERNOTICE do Twitch IRC |
| **Chat** | Comando configurável (padrão: `!request`) para inscritos. Filtra por tier mínimo |
| **Manual** | Entrada manual com autocomplete de personagens |

## Instalação

```bash
bun install
bun dev
```

## Uso

1. Digite o nome do canal e clique em **Conectar**
2. (Opcional) Adicione uma [API key do Gemini](https://aistudio.google.com/apikey) nas configurações para identificação automática de personagens

Funciona sem API key se os nomes dos personagens forem mencionados diretamente na mensagem.

## Interface

### Fila de pedidos

- Clique em um pedido para marcar como feito
- Botão direito abre menu de contexto (concluir, re-identificar, excluir)
- Arraste para reordenar manualmente
- `Ctrl/Cmd+Z` desfaz a última exclusão
- **Limpar feitos** remove todos os pedidos feitos
- **+** adiciona pedido manual com autocomplete

### Painel de fontes

- Ative/desative cada fonte individualmente
- **Donates**: configure valor mínimo
- **Chat**: configure comando e tier mínimo de inscrito
- Arraste os pills de prioridade para definir ordem de classificação

### Configurações LLM

- **API Key**: chave do Google Gemini para identificação de personagens
- **Modelos**: lista de modelos em ordem de prioridade (fallback em caso de rate limit)
- **Bot de donates**: nome do bot que posta mensagens de doação no chat

### Chat ao vivo

Exibe mensagens do chat em tempo real. Pode ser escondido para mais espaço.

## Debug

Painel expansível com ferramentas de desenvolvimento:

- **Testar extração**: testa identificação de personagem em uma mensagem
- **Re-identificar todos**: reprocessa todos os pedidos da fila
- **Replay VOD**: reproduz chat de uma VOD para testes (requer ID da VOD)

## Dados

Todos os dados são salvos em localStorage:

- `dbd-requests` - fila de pedidos
- `dbd-settings` - configurações (canal, API key, modelos)
- `dbd-sources` - configurações de fontes
- `dbd-chat` - histórico recente do chat

## Licença

MIT
