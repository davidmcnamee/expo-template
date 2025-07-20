# Development commands for crypto payments workspace

# Run all services concurrently (backend, lib watch, expo server)
dev:
    concurrently --raw \
        --prefix-colors "blue,green,yellow" \
        --names "backend,lib,expo" \
        "yarn workspace backend dev" \
        "yarn workspace crypto-payments-lib dev" \
        "yarn workspace crypto-payments-example start"

# Run backend server only
backend:
    yarn workspace backend dev

# Run expo app only
expo:
    yarn workspace crypto-payments-example start

# Watch and rebuild lib only
lib:
    yarn workspace crypto-payments-lib dev

# Build lib once
build-lib:
    yarn workspace crypto-payments-lib build

# Install all dependencies
install:
    yarn install
