#!/usr/bin/env bash
set -euo pipefail

# Creates Liven Postgres role/DB only. Does not touch sumer_prod.

DB_USER="${1:-liven_app}"
DB_PASS="${2:?usage: $0 <db_user> <db_pass> [db_name]}"
DB_NAME="${3:-liven_prod}"

sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

role_literal="$(sql_escape "$DB_USER")"
pass_literal="$(sql_escape "$DB_PASS")"
db_literal="$(sql_escape "$DB_NAME")"
role_ident="${DB_USER//\"/\"\"}"
db_ident="${DB_NAME//\"/\"\"}"

sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$role_literal') THEN CREATE ROLE \"$role_ident\" LOGIN PASSWORD '$pass_literal'; ELSE ALTER ROLE \"$role_ident\" WITH LOGIN PASSWORD '$pass_literal'; END IF; END \$\$;"

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$db_literal';" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$db_ident\" OWNER \"$role_ident\";"
else
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER DATABASE \"$db_ident\" OWNER TO \"$role_ident\";"
fi

sudo -u postgres psql -tAc "SELECT datname FROM pg_database WHERE datname IN ('$db_literal','sumer_prod') ORDER BY 1;"
echo "OK: database $DB_NAME ready for role $DB_USER"
