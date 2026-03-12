#!/bin/bash
# Advancia Pay Ledger - Production VPS Deployment Script
# Supports Ubuntu 20.04/22.04 LTS

set -e

# ==========================================
# CONFIGURATION
# ==========================================
APP_DIR="/var/www/advancia-pay-ledger"
NODE_VERSION="20.x"
DOMAIN="api.advancia-pay.com" # Change this to your actual domain
FRONTEND_DOMAIN="app.advancia-pay.com" # Change this to your frontend domain

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[INFO] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

# ==========================================
# 1. SYSTEM UPDATES & DEPENDENCIES
# ==========================================
log "Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y

log "Installing required dependencies (curl, git, build-essential, nginx)..."
sudo apt-get install -y curl git build-essential nginx

# Install Node.js
log "Installing Node.js ${NODE_VERSION}..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION} | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
log "Installing PM2 globally..."
sudo npm install -pm2@latest -g

# Install Docker & Docker Compose
log "Installing Docker and Docker Compose..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
else
    log "Docker is already installed."
fi

# Install Certbot for SSL
log "Installing Certbot..."
sudo apt-get install -y certbot python3-certbot-nginx

# ==========================================
# 2. APPLICATION SETUP
# ==========================================
log "Setting up application directory at ${APP_DIR}..."
sudo mkdir -p ${APP_DIR}
sudo chown -R $USER:$USER ${APP_DIR}

# Clone or copy application (assuming running from within the repo, we copy to APP_DIR)
# In a real scenario, you'd likely git clone here. For this script, we'll sync the current dir.
rsync -a --exclude 'node_modules' --exclude '.git' --exclude '.next' --exclude 'dist' ./ ${APP_DIR}/

cd ${APP_DIR}

# ==========================================
# 3. BACKEND SETUP
# ==========================================
log "Setting up Backend..."
npm install

log "Building Backend..."
npm run build

# Generate Prisma Client
log "Generating Prisma Client..."
npx prisma generate

# ==========================================
# 4. FRONTEND SETUP
# ==========================================
log "Setting up Frontend..."
cd ${APP_DIR}/frontend
npm install

log "Building Frontend Next.js app..."
npm run build
cd ${APP_DIR}

# ==========================================
# 5. DOCKER SERVICES (Postgres & Redis)
# ==========================================
log "Starting Database and Cache services via Docker..."
# We use docker-compose up for the db and redis, but NOT the app itself since we use PM2
sudo docker compose up -d db redis

log "Waiting for Database to be ready..."
sleep 10

# Run Prisma Migrations
log "Running Database Migrations..."
npx prisma migrate deploy

# ==========================================
# 6. PM2 CONFIGURATION
# ==========================================
log "Configuring PM2 for backend and frontend..."

cat << EOF > ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "advancia-backend",
      script: "dist/server.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 8080
      }
    },
    {
      name: "advancia-frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: "./frontend",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};
EOF

log "Starting applications with PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup | tail -n 1 | sudo bash

# ==========================================
# 7. NGINX & SSL CONFIGURATION
# ==========================================
log "Configuring Nginx..."

# Nginx config for Backend API
sudo cat << EOF > /etc/nginx/sites-available/advancia-api
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        
        # SSE specific configurations
        proxy_set_header Cache-Control no-cache;
        proxy_set_header Connection keep-alive;
        chunked_transfer_encoding off;
        proxy_buffering off;
        proxy_read_timeout 24h;
    }
}
EOF

# Nginx config for Frontend
sudo cat << EOF > /etc/nginx/sites-available/advancia-frontend
server {
    listen 80;
    server_name ${FRONTEND_DOMAIN};

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable Nginx sites
sudo ln -sf /etc/nginx/sites-available/advancia-api /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/advancia-frontend /etc/nginx/sites-enabled/

# Remove default nginx site
sudo rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
sudo nginx -t
sudo systemctl restart nginx

# ==========================================
# 8. SECURING WITH SSL (Certbot)
# ==========================================
log "Setting up SSL Certificates..."
warn "Please ensure DNS records for ${DOMAIN} and ${FRONTEND_DOMAIN} point to this server's IP."
read -p "Are DNS records configured? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    sudo certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos -m admin@${DOMAIN}
    sudo certbot --nginx -d ${FRONTEND_DOMAIN} --non-interactive --agree-tos -m admin@${DOMAIN}
    log "SSL Configuration Complete."
else
    warn "Skipping SSL setup. You must run certbot manually later: sudo certbot --nginx"
fi

# ==========================================
# 9. FINALIZE
# ==========================================
log "Deployment Script Completed Successfully!"
echo -e "
${GREEN}Next Steps:${NC}
1. Create and populate ${APP_DIR}/.env based on .env.example
2. Create and populate ${APP_DIR}/frontend/.env.local based on frontend/.env.example
3. Restart PM2 to pick up env vars: 'pm2 reload all'
4. Access your API at https://${DOMAIN}
5. Access your Frontend at https://${FRONTEND_DOMAIN}

${YELLOW}Important Security Notes:${NC}
- Ensure UFW (Uncomplicated Firewall) is enabled: sudo ufw allow 'Nginx Full' && sudo ufw allow OpenSSH && sudo ufw enable
- Never commit your .env files.
"
