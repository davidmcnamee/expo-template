
set dotenv-load

# Run all services concurrently (backend, lib watch, expo server)
dev:
    just migrate-dev -n 'dev'
    just build
    concurrently --raw \
        --prefix-colors "blue,green,yellow" \
        --names "backend,lib,expo" \
        "just backend-dev" \
        "cd packages/crypto-payments-lib && yarn tsc --watch" \
        "cd apps/crypto-payments-example && NODE_ENV=development yarn expo start"

# installs and runs the production app on your android device
run:
    EXPO_ENV=production just build
    cd apps/crypto-payments-example && EXPO_ENV=production yarn expo run:android --variant release

backend-dev:
    cd packages/backend && yarn concurrently "yarn tsc --watch" "yarn nodemon --watch dist --exec node dist/index.js"

build: install generate-icons
    cd packages/backend && yarn tsc
    cd packages/crypto-payments-lib && yarn tsc
    cd apps/crypto-payments-example && yarn expo prebuild
    cd apps/crypto-payments-example && yarn expo export --platform web

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

# Provision Hetzner Cloud server (one-time)
provision name="side-projects" type="cax11" location="nbg1" image="ubuntu-22.04":
    hcloud server create --type {{type}} --image {{image}} --location {{location}} --name {{name}} --ssh-key default
    @echo "Server {{name}} created, fetching ip..."
    hcloud server describe {{name}} -o json | jq -r '.public_net.ipv4.ip'

# Deploy app infrastructure
deploy:
    cd packages/app-infra && pulumi config set SERVER_URL "$SERVER_URL"
    cd packages/app-infra && pulumi config set SSH_KEY "$SSH_KEY"
    cd packages/app-infra && pulumi config set DOMAIN "$DOMAIN"
    cd packages/app-infra && pulumi up --yes

# Fix Pulumi state after interruption
pulumi-refresh:
    cd packages/app-infra && pulumi refresh --yes

# View server logs
logs:
    ssh "$SERVER_URL" "pm2 logs crypto-payments-backend --lines 50"

# Debug web build files on server
debug-web:
    ssh "$SERVER_URL" "ls -la /opt/crypto-payments/apps/crypto-payments-example/dist/"

ssh-backend *args:
    ssh "$SERVER_URL" {{args}}

# Generate all app icons based on assets/icon.png (dev watermark + adaptive versions)
generate-icons:
    @echo "Generating all app icons..."
    @if ! command -v magick >/dev/null 2>&1; then \
        echo "ImageMagick not found, installing..."; \
        brew install imagemagick; \
    fi
    cd apps/crypto-payments-example && \
    echo "  📱 Creating dev icon with watermark..." && \
    magick assets/icon.png \
        \( -clone 0 -fill "rgba(255,0,0,0.3)" -colorize 100 \) \
        -composite \
        -font Arial-Bold -pointsize 120 -fill white -stroke red -strokewidth 4 \
        -gravity center -annotate +0+0 "DEV" \
        assets/icon-dev.png && \
    echo "  🤖 Creating adaptive icons with padding..." && \
    magick assets/icon.png -resize 66%x66% -background transparent -gravity center -extent 1024x1024 assets/icon-adaptive.png && \
    magick assets/icon-dev.png -resize 66%x66% -background transparent -gravity center -extent 1024x1024 assets/icon-dev-adaptive.png
    @echo "✅ All icons generated:"
    @echo "   • icon-dev.png (watermarked)"
    @echo "   • icon-adaptive.png (66% with padding)"
    @echo "   • icon-dev-adaptive.png (watermarked + adaptive)"
