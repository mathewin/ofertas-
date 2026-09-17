# Sistema de Ofertas

Rastreador e divulgador automatico de ofertas. O site exibe as ofertas como uma conversa
estilo WhatsApp e o sistema captura, filtra, organiza e publica tudo sozinho.

```
API -> SISTEMA DE RASTREAMENTO -> FILTRO -> OFERTA -> SITE -> (FUTURO) WHATSAPP
```

## Principios

- **Simples, funcional e automatico.** Nao e um marketplace: nao existe carrinho nem checkout.
- O site apenas **encontra, organiza e apresenta** a oferta. O botao "VER OFERTA" leva a loja.
- Apenas **APIs oficiais/autorizadas**. Nao ha burla de CAPTCHA, login ou bloqueios.
- IA e **opcional**; o sistema funciona 100% por regras.

## Stack

- Node.js 22 (ESM, `fetch` nativo)
- Express 5
- Banco: **SQLite** (padrao, zero configuracao) ou **Supabase/Postgres** (`pg`)
- Frontend sem build: HTML/CSS/JS puro, responsivo
- Agendador interno (sem dependencia externa) + execucao manual pelo painel

## Como rodar

```bash
cp .env.example .env

npm install

npm start
```

- Site: http://localhost:3000
- Painel: http://localhost:3000/admin (token em `ADMIN_TOKEN`)
- Healthcheck: http://localhost:3000/health

Na primeira execucao o banco e criado, populado com categorias/configuracoes e o
rastreador roda automaticamente (fonte `demo` ligada por padrao para o site ja aparecer cheio).

Comandos auxiliares:

```bash
npm run migrate

npm run track

npm run seed
```

## Fluxo de rastreamento

```
1. Consultar API        7. Identificar categoria
2. Receber produtos     8. Verificar duplicidade
3. Organizar dados      9. Aplicar filtros
4. Identificar preco   10. Validar oferta
5. Identificar desconto 11. Salvar no banco
6. Identificar loja    12. Disponibilizar no site
```

Cada etapa esta em `src/tracker/engine.js`:

- **Normalizacao** fica no adaptador de cada fonte (`src/sources/*`).
- **Categoria** por regras de palavras-chave (`src/tracker/category.js`), com IA opcional.
- **Filtro** configuravel (`src/tracker/filter.js`): desconto minimo, link valido, preco,
  imagem, palavras bloqueadas, categorias permitidas.
- **Anti-duplicidade** por `fingerprint` (`fonte:external_id`) e tambem por URL.
  Se o preco mudar, a oferta existente e atualizada e o historico registrado.
- **Expiracao** por ausencia na ultima captura ou por TTL de validade.
- **Publicacao** automatica ou manual (`publishMode`).

## Fontes de ofertas

| Fonte | Status | Configuracao |
|-------|--------|--------------|
| Demonstracao | ativa por padrao | `DEMO_SOURCE_ENABLED` |
| Shopee (Affiliate Open API) | pronta, desligada | `SHOPEE_ENABLED`, `SHOPEE_APP_ID`, `SHOPEE_APP_SECRET` |
| TikTok Shop (Open API) | pronta, desligada | `TIKTOK_ENABLED`, `TIKTOK_APP_KEY`, `TIKTOK_APP_SECRET`, `TIKTOK_ACCESS_TOKEN`, `TIKTOK_SHOP_CIPHER` |

Adicionar uma nova fonte: crie `src/sources/minhaFonte.js` exportando
`{ id, name, isConfigured(), fetchOffers() }` retornando ofertas normalizadas e
registre no `src/sources/index.js`. Nada mais precisa mudar.

Campos normalizados de uma oferta: `source`, `external_id`, `title`, `description`,
`image_url`, `price`, `previous_price`, `currency`, `store`, `category`,
`product_url`, `affiliate_url`, `rating`, `sales`, `raw`.

> Os adaptadores Shopee/TikTok implementam as assinaturas oficiais (SHA256 e HMAC-SHA256).
> Os nomes de campos podem exigir pequenos ajustes conforme as permissoes concedidas a
> sua aplicacao. Sem credenciais, a fonte apenas registra "Credenciais nao configuradas"
> no log e nao e executada.

## Banco de dados

Padrao SQLite: `data/ofertas.db` (criado automaticamente).

Para usar Supabase, defina no `.env`:

```env
DB_DRIVER=postgres
DATABASE_URL=postgresql://postgres.<ref>:<senha>@<host>:5432/postgres
```

O schema tambem esta em `supabase/schema.sql` caso queira criar as tabelas manualmente
no SQL Editor do Supabase. As tabelas sao criadas/garantidas automaticamente ao iniciar.

## Painel administrativo

- **Dashboard**: ofertas encontradas, publicadas/ativas, pendentes, expiradas, ocultas,
  ofertas por categoria, status das fontes e ultimos eventos.
- **Ofertas**: visualizar, editar, publicar, ocultar, destacar e excluir (arquivar).
- **Fontes**: ativar/desativar, ultima atualizacao, erros e rodar agora.
- **Categorias**: criar/editar, palavras-chave e ativacao.
- **Configuracoes**: desconto minimo, TTL, intervalo, modo de publicacao, limites,
  palavras bloqueadas, categorias permitidas e IA.
- **Eventos**: log completo.

## Site estilo WhatsApp

- Bales de conversa com imagem, titulo, preco anterior riscado, preco atual, `% OFF`,
  loja, categoria e botao `VER OFERTA`.
- Busca, filtro por categoria e ordenacao (recentes / maior desconto / menor preco).
- Atualizacao em tempo real via **Server-Sent Events** (`/api/stream`), com polling de seguranca.

## API publica

```
GET /api/offers?category=&source=&search=&sort=&limit=&offset=
GET /api/offers/:id
GET /api/offers/:id/history
GET /api/categories
GET /api/sources
GET /api/stats
GET /api/stream        (SSE)
GET /api/placeholder/:seed
```

## API administrativa

Todas exigem o header `x-admin-token`.

```
GET   /api/admin/dashboard
GET   /api/admin/offers
GET   /api/admin/offers/:id
PATCH /api/admin/offers/:id
GET   /api/admin/events
GET   /api/admin/sources
PATCH /api/admin/sources/:id
POST  /api/admin/sources/:id/run
POST  /api/admin/track
GET   /api/admin/categories
POST  /api/admin/categories
GET   /api/admin/settings
PUT   /api/admin/settings
```

## Estrutura

```
src/
  config.js              variaveis de ambiente
  server.js              Express + bootstrap
  api/                   rotas publica e administrativa, SSE
  db/                    repositorio, schema e drivers (sqlite/postgres)
  sources/               adaptadores (demo, shopee, tiktok)
  tracker/               engine, filtro, categoria, IA, scheduler
  channels/              publicacao (site agora, WhatsApp futuro)
  cli/                   migrate, seed, track
public/
  index.html             site estilo WhatsApp
  admin.html             painel administrativo
supabase/schema.sql      schema Postgres/Supabase
```

## Futuro WhatsApp

O `src/channels/index.js` ja possui o canal `whatsappChannel` usando a API oficial do
WhatsApp Cloud. Basta preencher `WHATSAPP_ENABLED`, `WHATSAPP_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_RECIPIENTS`. O mesmo rastreamento passa a publicar
no site **e** no WhatsApp sem alterar o motor.

## Monetizacao (preparado)

As ofertas possuem campos `affiliate_url`, `sponsored` e `featured`. Basta preencher o
link de afiliado (a fonte Shopee ja retorna `offerLink`) e usar destaque/patrocinado no
painel. Nenhuma comissao e processada pela primeira versao.
