FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* bun.lockb* ./
RUN 	if [ -f package-lock.json ]; then npm ci; 	elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; 	elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; 	elif [ -f bun.lockb ]; then bun install --frozen-lockfile; 	else npm install; fi

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
