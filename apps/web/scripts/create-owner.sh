#!/usr/bin/env bash
set -euo pipefail

database_name="${1:-tomny-coffee}"
target="${2:---remote}"
if [[ "$target" != "--local" && "$target" != "--remote" ]]; then
  printf 'Usage: %s [database-name] [--local|--remote]\n' "$0" >&2
  exit 1
fi
read -r -p "Owner email: " owner_email
read -r -s -p "Owner password: " owner_password
printf '\n'

owner_id="$(node -e 'console.log(crypto.randomUUID())')"
created_at="$(date +%s000)"
password_hash="$(OWNER_PASSWORD="$owner_password" node --input-type=module -e '
  const value = process.env.OWNER_PASSWORD
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const derive = await crypto.subtle.importKey("raw", new TextEncoder().encode(value), "PBKDF2", false, ["deriveBits"])
  const bytes = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" }, derive, 256))
  const encode = (v) => Buffer.from(v).toString("base64url")
  console.log(`pbkdf2$310000$${encode(salt)}$${encode(bytes)}`)
')"

sql_file="$(mktemp)"
trap 'rm -f "$sql_file"' EXIT
escaped_email="${owner_email//\'/\'\'}"
escaped_hash="${password_hash//\'/\'\'}"
printf "INSERT INTO users (id, email, display_name, password_hash, active, created_at, updated_at) VALUES ('%s', '%s', 'Chủ quán', '%s', 1, %s, %s);\n" "$owner_id" "$escaped_email" "$escaped_hash" "$created_at" "$created_at" > "$sql_file"
printf "INSERT INTO user_permissions (user_id, permission_id, granted_at) SELECT '%s', id, %s FROM permissions;\n" "$owner_id" "$created_at" >> "$sql_file"

npx wrangler d1 execute "$database_name" "$target" --file "$sql_file"
printf 'Owner created for %s\n' "$owner_email"
