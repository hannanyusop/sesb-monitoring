#!/bin/sh
set -eu

pnpm --filter @sesb/database db:migrate
pnpm --filter @sesb/database db:seed
exec node apps/api/dist/server.js
