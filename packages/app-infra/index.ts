import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import * as random from "@pulumi/random";
import * as fs from "fs";

// Stack configuration
const config = new pulumi.Config();
const serverUrl = config.require("SERVER_URL"); // e.g., "root@1.2.3.4"
const sshKeyPath = config.require("SSH_KEY"); // SSH private key path
const domain = config.require("DOMAIN"); // e.g., "example.mcnamee.io"
const sshKey = fs.readFileSync(sshKeyPath, "utf8");

// Generate random passwords
const postgresPassword = new random.RandomPassword("postgres-password", {
    length: 32,
    special: false,
});

const redisPassword = new random.RandomPassword("redis-password", {
    length: 32,
    special: false,
});

// Generate hash of source files to trigger redeployment on changes
const hashCommand = `cd ../../ && git ls-files | sort | xargs cat | sha256sum | cut -d' ' -f1`;
const sourceHash = new command.local.Command("source-hash", {
    create: hashCommand,
    update: hashCommand,
    triggers: [Date.now()], // Force re-run on every deploy
});

// Sync project files to server (only git-tracked files)
const syncCommand = `cd ../../ && git ls-files | rsync -avz --files-from=- . ${serverUrl}:/opt/crypto-payments/`;
const syncFiles = new command.local.Command("sync-files", {
    create: syncCommand,
    update: syncCommand,
    triggers: [sourceHash.stdout], // Trigger when source files change
});

// Create .env file on server
const createEnv = new command.remote.Command("create-env", {
    connection: {
        host: serverUrl.split("@")[1],
        user: serverUrl.split("@")[0],
        privateKey: sshKey,
    },
    create: pulumi.interpolate`
cd /opt/crypto-payments
cat > .env << EOF
DATABASE_URL=postgresql://payments:${postgresPassword.result}@localhost:5432/payments
REDIS_URL=redis://:${redisPassword.result}@localhost:6379
POSTGRES_PASSWORD=${postgresPassword.result}
REDIS_PASSWORD=${redisPassword.result}
EOF
    `,
    triggers: [syncFiles.stdout], // Trigger when syncFiles updates
}, { dependsOn: [syncFiles] });

// Install dependencies on server (only once)
const installDeps = new command.remote.Command("install-deps", {
    connection: {
        host: serverUrl.split("@")[1],
        user: serverUrl.split("@")[0],
        privateKey: sshKey,
    },
    create: `
# Check if dependencies are already installed
if command -v docker &> /dev/null && command -v node &> /dev/null && command -v just &> /dev/null && command -v pm2 &> /dev/null && command -v nginx &> /dev/null && command -v certbot &> /dev/null && [ "$(node -v | cut -d. -f1)" = "v20" ]; then
    echo "Dependencies already installed"
    exit 0
fi

# Remove conflicting Docker packages
for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do apt-get remove -y $pkg; done

# Install Docker using official method
apt-get update
apt-get install -y ca-certificates curl nginx certbot python3-certbot-nginx
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$UBUNTU_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start Docker and nginx
systemctl enable docker nginx
systemctl start docker nginx

# Install Node.js 20 and yarn
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g yarn pm2

# Install just (skip if exists)
if ! command -v just &> /dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin
fi

echo "All dependencies installed successfully"
    `,
}, { dependsOn: [createEnv] });

// Setup Docker and services on server
const setupServices = new command.remote.Command("setup-services", {
    connection: {
        host: serverUrl.split("@")[1],
        user: serverUrl.split("@")[0],
        privateKey: sshKey,
    },
    create: pulumi.interpolate`
cd /opt/crypto-payments

# Create docker-compose.yml
cat > docker-compose.yml << EOF
version: '3.8'
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_DB: payments
      POSTGRES_USER: payments
      POSTGRES_PASSWORD: ${postgresPassword.result}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${redisPassword.result}
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
EOF

# Start services
docker compose down || true
docker compose up -d
sleep 10
    `,
}, { dependsOn: [installDeps] });

// Setup nginx configuration
const setupNginx = new command.remote.Command("setup-nginx", {
    connection: {
        host: serverUrl.split("@")[1],
        user: serverUrl.split("@")[0],
        privateKey: sshKey,
    },
    create: pulumi.interpolate`
# Create nginx configuration
cat > /etc/nginx/sites-available/${domain} << 'EOF'
server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload nginx
nginx -t
systemctl reload nginx
    `,
}, { dependsOn: [setupServices] });

// Build and run migrations
const buildCommand = `
cd /opt/crypto-payments
yarn install
just build
cd packages/backend && npx prisma generate
just migrate-deploy
`;
const buildAndMigrate = new command.remote.Command("build-and-migrate", {
    connection: {
        host: serverUrl.split("@")[1],
        user: serverUrl.split("@")[0],
        privateKey: sshKey,
    },
    create: buildCommand,
    update: buildCommand,
    triggers: [syncFiles.stdout], // Trigger when syncFiles updates
}, { dependsOn: [setupNginx, syncFiles] });

// Start the backend application
const startApp = new command.remote.Command("start-app", {
    connection: {
        host: serverUrl.split("@")[1],
        user: serverUrl.split("@")[0],
        privateKey: sshKey,
    },
    create: `
cd /opt/crypto-payments
# Stop any existing PM2 processes
pm2 delete crypto-payments-backend || true
# Start backend with PM2
pm2 start packages/backend/dist/index.js --name crypto-payments-backend --log backend.log
# Save PM2 configuration
pm2 save
# Setup PM2 to start on boot
pm2 startup systemd -u root --hp /root || true
echo "Backend started with PM2"
    `,
    update: `
cd /opt/crypto-payments
# Restart the PM2 process
pm2 restart crypto-payments-backend || pm2 start packages/backend/dist/index.js --name crypto-payments-backend --log backend.log
pm2 save
echo "Backend restarted with PM2"
    `,
    triggers: [buildAndMigrate.stdout], // Trigger when buildAndMigrate updates
}, { dependsOn: [buildAndMigrate] });

// Setup SSL certificate with certbot
const setupSSL = new command.remote.Command("setup-ssl", {
    connection: {
        host: serverUrl.split("@")[1],
        user: serverUrl.split("@")[0],
        privateKey: sshKey,
    },
    create: pulumi.interpolate`
# Get SSL certificate from Let's Encrypt
certbot --nginx -d ${domain} --non-interactive --agree-tos --email admin@${domain} --redirect

# Setup auto-renewal
systemctl enable certbot.timer
systemctl start certbot.timer

echo "SSL certificate installed and auto-renewal configured"
    `,
}, { dependsOn: [startApp] });

// Exports
export const postgresPasswordOutput = postgresPassword.result;
export const redisPasswordOutput = redisPassword.result;
export const appUrl = pulumi.interpolate`https://${domain}`;
export const sshCommand = `ssh ${serverUrl}`;
export const backendPid = startApp.stdout;
export const sslStatus = setupSSL.stdout;
