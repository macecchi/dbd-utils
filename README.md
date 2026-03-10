# Fila DBD

[![Discord](https://img.shields.io/badge/Discord-Join%20Server-5865F2?logo=discord&logoColor=white)](https://discord.gg/6pY7Efhxd)

Site para gerenciar pedidos de personagens de Dead by Daylight durante streams na Twitch.

Feito com carinho para a comunidade brasileira 🇧🇷 de Dead by Daylight, em especial [MandyMess](https://twitch.tv/mandymess) 🫶

Use o nosso [Discord](https://discord.gg/6pY7Efhxd) ou o próprio GitHub para mandar feedback, sugerir funcionalidades e reportar bugs.

## Como funciona

1. Conecta ao chat da Twitch em tempo real
2. Detecta pedidos de personagens de múltiplas fontes que o streamer configura (donates, resubs, comandos de chat)
3. Identifica automaticamente o personagem mencionado, usando IA quando necessário
4. Exibe fila ordenada com retratos dos personagens


## Como usar

1. Acesse o site e clique em **Começar minha fila** para conectar com sua conta da Twitch
2. Sua fila será aberta automaticamente
3. Configure as fontes de pedidos

É preciso estar com o site aberto para receber pedidos.

**Notificações**: só mostramos um pequeno aviso na página quando um novo pedido é recebido. Ative as notificações do navegador para receber alertas quando houver algum problema.

### Fontes de pedidos

| Fonte | Como funciona |
|-------|---------------|
| **Donates** | Detecta mensagens do bot de doação (ex: LivePix). Filtra por valor mínimo |
| **Resubs** | Captura mensagens de resub via USERNOTICE do Twitch IRC |
| **Chat** | Comando configurável (padrão: `!fila`) para inscritos. Filtra por tier mínimo |
| **Manual** | Entrada manual de personagens |

### Fila de pedidos

- Clique em um pedido para marcar como feito
- Arraste para reordenar manualmente
- Selecione a ordenação de pedidos por fila de chegada ou por prioridade
- Botão **+** adiciona pedido manual

### Painel de fontes

Ative/desative cada fonte individualmente e a qualquer momento:

- **Donates**: configure valor mínimo
- **Chat**: configure comando e tier mínimo de inscrito (ex: só Tier 2 e 3 podem pedir)
- **Resubs**: mensagens de reinscrição

Arraste os pills de prioridade para definir ordem que os novos pedidos entram na fila. 


## Instalação

Instale o [Bun](https://bun.sh) e execute:

```bash
bun install
bun dev  # Servidor local com frontend + API + PartyKit
```

## Deploy

O serviço foi feito para ser deployado no [Cloudflare Workers](https://workers.cloudflare.com/) e [PartyKit](https://www.partykit.io/).

**Secrets necessários no GitHub:**
- `CLOUDFLARE_API_TOKEN` - token com permissão Workers
- `PARTYKIT_TOKEN` e `PARTYKIT_LOGIN` - obtido com `bunx partykit@latest token generate`

**Secrets no Cloudflare (via `wrangler secret put`):**
- `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` - app Twitch
- `JWT_SECRET` - qualquer string segura
- `INTERNAL_API_SECRET` - secret compartilhado entre Worker e PartyKit

**KV Namespace (via `wrangler kv namespace create CACHE`):**
- Criar o namespace e atualizar o `id` no `wrangler.toml`

**Database D1 (via `wrangler d1 create fila-dbd`):**
- Criar o database e atualizar o `database_id` no `wrangler.toml`
- Aplicar migrations: `wrangler d1 migrations apply fila-dbd`

**Secrets no PartyKit (via `bunx partykit env add`):**
- `JWT_SECRET` - mesmo valor do Cloudflare
- `INTERNAL_API_SECRET` - mesmo valor do Cloudflare
- `API_URL` - URL do Worker em produção (ex: `https://dbd-tracker.<account>.workers.dev`)

## Debug

Adicione `#debug` na URL para ativar o painel de debug. Exemplo: `http://localhost:5173/meriw_/#debug`.

- **Testar extração**: testa identificação de personagem em uma mensagem
- **Re-identificar todos**: reprocessa todos os pedidos da fila
- **Replay VOD**: reproduz chat de uma VOD para testes (requer ID da VOD, que pode ser encontrada na url do vídeo)

### Console (DevTools)

```js
dbdDebug.chat('User', 'msg')                      // chat sub tier 1
dbdDebug.chat('User', 'msg', { tier: 2 })         // chat sub tier 2
dbdDebug.chat('User', 'msg', { sub: false })      // chat não-sub
dbdDebug.donate('Donor', 50, 'msg')               // donate R$50
dbdDebug.resub('User', 'msg')                     // resub
dbdDebug.raw('@tags... PRIVMSG #ch :msg')         // raw IRC
```

## Licença

MIT ([LICENSE](LICENSE))

Todos os direitos de Dead by Daylight pertencem à Behaviour Interactive.

## Agradecimentos

- [MandyMess](https://twitch.tv/mandymess) - por me inspirar a criar o projeto
- [Dead by Daylight Wiki](https://deadbydaylight.wiki.gg/) - banco de dados e imagens dos personagens
