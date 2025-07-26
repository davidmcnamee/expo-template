# Run all services concurrently (backend, lib watch, expo server)
dev:
    just migrate-dev -n 'dev'
    just build
    concurrently --raw \
        --prefix-colors "blue,green,yellow" \
        --names "backend,lib,expo" \
        "just backend-dev" \
        "cd packages/crypto-payments-lib && yarn tsc --watch" \
        "cd apps/crypto-payments-example && yarn expo start"

backend-dev:
    cd packages/backend && yarn concurrently "yarn tsc --watch" "yarn nodemon --watch dist --exec node dist/index.js"

build: install
    cd packages/backend && yarn tsc
    cd packages/crypto-payments-lib && yarn tsc
    cd apps/crypto-payments-example && yarn expo prebuild

# Install all dependencies
install:
    yarn install

# Clean all gitignored files except .env* files
clean:
    git clean -ffdx --exclude='.env*'

migrate-dev *args:
    cd packages/backend && yarn prisma migrate dev {{args}}

migrate-deploy *args:
    cd packages/backend && yarn prisma migrate deploy {{args}}
