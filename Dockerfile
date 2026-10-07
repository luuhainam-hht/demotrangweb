# =====================================================================================
# Image chay he thong Mot Cua Thong Minh (web + WebSocket) va cong cu dong bo CSDL.
# Dung chung 1 image cho 2 container: "app" (node src/server.js) va "sync" (scripts/db-sync.js).
# postgresql17-client: pg_dump/pg_restore ban 17 doc duoc ca Neon PostgreSQL 16 lan 17.
# =====================================================================================
FROM node:22-alpine

RUN apk add --no-cache postgresql17-client tini tzdata
ENV NODE_ENV=production \
    TZ=Asia/Ho_Chi_Minh \
    PORT=3000

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .
# Sua loi xuong dong Windows (CRLF) neu file .sh bi Git/Notepad doi -> "/bin/sh^M: not found".
RUN sed -i 's/\r$//' docker/entrypoint.sh && chmod +x docker/entrypoint.sh \
 && mkdir -p backups && chown -R node:node /app

USER node
EXPOSE 3000

# /api/health/deep cham ca CSDL: container chi "healthy" khi ket noi duoc database.
HEALTHCHECK --interval=30s --timeout=8s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health/deep >/dev/null || exit 1

ENTRYPOINT ["/sbin/tini", "--", "docker/entrypoint.sh"]
CMD ["node", "src/server.js"]
