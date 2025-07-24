# Development commands for crypto payments workspace

# Run all services concurrently (backend, lib watch, expo server)
dev:
    concurrently --raw \
        --prefix-colors "blue,green,yellow" \
        --names "backend,lib,expo" \
        "yarn workspace backend dev" \
        "just packages/crypto-payments-lib/dev" \
        "yarn workspace crypto-payments-example start --clear"

# Build backend and lib
build: install
    yarn workspace backend build
    just packages/crypto-payments-lib/build

# Install all dependencies
install:
    yarn install

# Clean all gitignored files except .env* files and babel configs
clean:
    git clean -ffdx --exclude='.env*'
