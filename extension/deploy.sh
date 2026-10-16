#!/usr/bin/env bash
# Publica extension/web/ en la carpeta que sirve nginx (heist-frontend). Excluye tests y fixtures.
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)/web/"
DEST="${HEIST_WEB_DIR:-/home/david/heist-web}/"
mkdir -p "$DEST"
rsync -a --delete \
  --exclude 'test/' --exclude 'package.json' --exclude 'node_modules/' \
  "$SRC" "$DEST"

# Cloudflare fuerza max-age de 4h en css/js: estampamos una version en las URLs para que el
# navegador recoja cada despliegue (mismo truco que viz/deploy.sh de baobab-project-fraud).
V="$(cd "$DEST" && find . -type f \( -name '*.js' -o -name '*.css' -o -name '*.json' -o -name '*.html' \) -print0 | sort -z | xargs -0 cat | sha1sum | cut -c1-10)"

# index.html: css, el entry point del modulo y la version para los sprites (window.__V)
sed -i -E "s#(href=\"css/style\.css)\"#\1?v=$V\"#; s#(src=\"js/app\.js)\"#\1?v=$V\"#" "${DEST}index.html"
sed -i -E "s#window\.__V='[^']*'#window.__V='$V'#" "${DEST}index.html"
# imports ES entre modulos (from './x.js') y los fetch de datos
sed -i -E "s#(from '\./[a-zA-Z]+\.js)'#\1?v=$V'#g" "${DEST}"js/*.js
sed -i -E "s#(fetch\('data/[a-z_]+\.json)'\)#\1?v=$V')#g" "${DEST}"js/*.js

echo "publicado en $DEST (version $V)"
