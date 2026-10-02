#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_dir"
fail() { printf '\n%s\n' "$1" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || fail "Instala Docker Desktop."
docker compose version >/dev/null 2>&1 || fail "Actualiza Docker Desktop para tener Docker Compose."
docker info >/dev/null 2>&1 || fail "Abre Docker Desktop y espera a que esté listo."
case "${1:-iniciar}" in
  iniciar|preparar|detener) ;;
  *) fail "Usa: bash iniciar.sh [preparar|detener]" ;;
esac

free_port() {
  local candidate="$1"
  for ((attempt=0; attempt<100; attempt++)); do
    if [[ -z "$(docker ps --filter "publish=$candidate" --format '{{.ID}}')" ]] &&
       ! ( : > "/dev/tcp/127.0.0.1/$candidate" ) 2>/dev/null; then
      printf '%s' "$candidate"; return
    fi
    candidate=$((candidate + 1))
  done
  fail "No se encontró un puerto libre."
}
if [[ ! -f .env.docker ]]; then
  [[ "${1:-iniciar}" != detener ]] || fail "Este entorno todavía no se ha iniciado."
  db_port="$(free_port 5433)"
  api_port="$(free_port 4000)"
  node_image='node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6'
  db_password="$(docker run --rm "$node_image" node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
  [[ "$db_password" =~ ^[a-f0-9]{64}$ ]] || fail "No se pudo generar la contraseña de PostgreSQL."
  (umask 077; set -o noclobber; printf 'POSTGRES_PASSWORD=%s\nPOSTGRES_PORT=%s\nBACKEND_PORT=%s\n' "$db_password" "$db_port" "$api_port" > .env.docker)
  unset db_password
fi
case "${1:-iniciar}" in
  preparar) printf 'Configuración del backend preparada.\n' ;;
  detener) docker compose --env-file .env.docker stop backend db ;;
  iniciar)
    docker compose --env-file .env.docker up --build --detach --wait --wait-timeout 180
    api_address="$(docker compose --env-file .env.docker port backend 4000)"
    printf '\nBackend listo: http://localhost:%s/api/health\n' "${api_address##*:}"
    ;;
esac
