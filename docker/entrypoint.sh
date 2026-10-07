#!/bin/sh
# Chon CSDL cho ung dung trong Docker theo APP_DB_TARGET (xem docs/DOCKER-NEON-SYNC.md):
#   neon  (mac dinh) - dung chung CSDL Neon voi web Render -> du lieu 2 ben trung khop 100%,
#                      Postgres trong Docker la ban sao realtime/du phong do container "sync" lo.
#   local            - dung Postgres trong Docker (chay offline tai Trung tam / demo khong Internet).
set -e
case "${APP_DB_TARGET:-neon}" in
  local)
    export DATABASE_URL="$LOCAL_DATABASE_URL"; export DB_SSL=false
    echo "[entrypoint] APP_DB_TARGET=local -> PostgreSQL trong Docker" ;;
  *)
    if [ -n "$NEON_DATABASE_URL" ]; then
      export DATABASE_URL="$NEON_DATABASE_URL"; export DB_SSL=true
      echo "[entrypoint] APP_DB_TARGET=neon -> Neon"
    else
      export DATABASE_URL="$LOCAL_DATABASE_URL"; export DB_SSL=false
      echo "[entrypoint] CANH BAO: chua co NEON_DATABASE_URL/DATABASE_URL trong .env -> tam dung PostgreSQL trong Docker"
    fi ;;
esac
node scripts/ensure-schema.js
exec "$@"
