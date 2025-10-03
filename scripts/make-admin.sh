#!/bin/bash
# Make a user an admin by email

set -e

if [ -z "$1" ]; then
  echo "Usage: ./scripts/make-admin.sh user@example.com"
  echo ""
  echo "Current users:"
  psql "${DATABASE_URL:-postgresql://ethancheung@localhost:5432/regintel}" -c "SELECT email, role FROM users;"
  exit 1
fi

EMAIL="$1"

echo "Making $EMAIL an admin..."

psql "${DATABASE_URL:-postgresql://ethancheung@localhost:5432/regintel}" -c \
  "UPDATE users SET role = 'ADMIN' WHERE email = '$EMAIL'; SELECT email, role FROM users WHERE email = '$EMAIL';"

echo ""
echo "✅ Done! $EMAIL is now an ADMIN"
echo "Refresh your browser to see the changes."
