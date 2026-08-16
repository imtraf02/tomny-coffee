#!/usr/bin/env bash
set -euo pipefail

database_name="${1:-tomny-coffee}"

sql_file="$(mktemp)"
trap 'rm -f "$sql_file"' EXIT

node "$(dirname "$0")/seed-local.mjs" > "$sql_file"
npx wrangler d1 execute "$database_name" --local --file "$sql_file"

printf 'Seeded sample data into %s (local).\n' "$database_name"
printf 'Demo logins (password: 123456): owner@tomny.coffee, cashier@tomny.coffee, barista@tomny.coffee, stock@tomny.coffee\n'