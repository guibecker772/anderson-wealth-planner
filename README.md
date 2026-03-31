# Anderson Wealth Planner

Projeto web em Next.js/App Router.

## Fluxo local seguro

- Uso diario em desenvolvimento: `npm run dev`
- Se acabou de rodar build local ou aparecer erro estranho de chunk/cache: `npm run dev:clean`
- Para gerar um build local limpo: `npm run build:clean`
- Se o ambiente local ficar inconsistente e precisar de reset mais forte: `npm run repair:local`

## O que cada script faz

- `npm run clean`: limpa `.next` e `node_modules/.cache`
- `npm run dev:clean`: limpa cache do Next, garante `prisma generate` e sobe o dev
- `npm run build:clean`: limpa cache do Next e gera um build limpo
- `npm run repair:local`: limpeza mais agressiva, incluindo `.prisma`, e regenera o Prisma Client

## Troca recomendada entre modos

- De `build` para `dev`: use `npm run dev:clean`
- De `dev` para `build`: use `npm run build:clean`
- Se `/configuracoes` ou outra rota apresentar comportamento estranho de cache: rode `npm run dev:clean`
