# Multi-stage; runs the stateless Streamable HTTP transport as a non-root user. No secrets needed.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 MCP_HTTP_HOST=0.0.0.0
# Host headers accepted behind a proxy (DNS-rebinding protection), e.g. mcp.example.com,mcp.example.com:443
ENV MCP_ALLOWED_HOSTS=
RUN addgroup -g 1001 -S nodejs && adduser -S mcp -u 1001
COPY --from=prod-deps --chown=mcp:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=mcp:nodejs /app/dist ./dist
COPY --chown=mcp:nodejs public ./public
COPY --chown=mcp:nodejs package.json ./
USER mcp
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/http.js"]
