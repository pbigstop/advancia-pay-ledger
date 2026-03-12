#!/bin/bash
# ════════════════════════════════════════════════════════════════════
#  ADVANCIA PAY LEDGER — VPS DEPLOY
#  VPS: <YOUR_VPS_IP> | advanciapayledger.com
#  Frontend: api.advanciapayledger.com → localhost:3001
#  Banking:  advanciapayledger.com/api/banking → localhost:3005
#  Demo:     advanciapayledger.com/demo → /var/www/html/demo
# ════════════════════════════════════════════════════════════════════
set -e
G='\033[0;32m'; C='\033[0;36m'; R='\033[0;31m'; B='\033[1m'; N='\033[0m'
ok()  { echo -e "${G}✅ $1${N}"; }
log() { echo -e "${C}▶  $1${N}"; }
err() { echo -e "${R}⚠️  $1${N}"; }

echo -e "\n${B}${C}  ADVANCIA — DEPLOY  $(date '+%Y-%m-%d %H:%M:%S')${N}\n"

MAIN_DIR="/var/www/advanciapayledger"
BANKING_DIR="/var/www/advancia-banking"
DEMO_DIR="/var/www/html/demo"

# ─────────────────────────────────────────────────────────────────
# PART 1: MAIN BACKEND (api.advanciapayledger.com → :3001)
# ─────────────────────────────────────────────────────────────────
log "Checking main backend..."
if [ -d "$MAIN_DIR" ]; then
  cd "$MAIN_DIR"
  if [ -d ".git" ]; then
    git pull origin master 2>/dev/null || git pull origin main 2>/dev/null || err "Git pull failed"
    ok "Code updated"
  fi
  [ -f "package.json" ] && npm install --production && ok "Main deps installed"
  if [ -f "prisma/schema.prisma" ]; then
    npx prisma generate 2>/dev/null && ok "Prisma generated"
    npx prisma db push 2>/dev/null || err "DB push failed"
  fi
  if pm2 list | grep -q "advancia-backend"; then
    pm2 restart advancia-backend && ok "Main backend restarted"
  else
    ENTRY=""
    [ -f "dist/server.js" ]   && ENTRY="dist/server.js"
    [ -f "src/server.js" ]    && ENTRY="src/server.js"
    [ -f "server.js" ]        && ENTRY="server.js"
    [ -f "dist/index.js" ]    && ENTRY="dist/index.js"
    [ -f "src/index.js" ]     && ENTRY="src/index.js"
    if [ -n "$ENTRY" ]; then
      pm2 start "$ENTRY" --name advancia-backend --instances 2 --exec-mode cluster --max-memory-restart 500M
      pm2 save
      ok "Main backend started → $ENTRY"
    else
      err "No entry point found in $MAIN_DIR"
    fi
  fi
else
  err "Main backend dir not found: $MAIN_DIR"
fi

# ─────────────────────────────────────────────────────────────────
# PART 2: BANKING SERVICE (:3005)
# ─────────────────────────────────────────────────────────────────
log "Deploying banking service..."
if [ -f "/tmp/advancia-banking.zip" ]; then
  mkdir -p /tmp/banking_extract
  unzip -o /tmp/advancia-banking.zip -d /tmp/banking_extract/
  mkdir -p "$BANKING_DIR"
  cp -r /tmp/banking_extract/advancia-banking/. "$BANKING_DIR/"
  ok "Banking files deployed"
elif [ -d "$BANKING_DIR" ]; then
  ok "Banking dir exists"
else
  err "Upload advancia-banking.zip to /tmp/"
fi

if [ -d "$BANKING_DIR" ]; then
  cd "$BANKING_DIR"
  npm install --production
  if [ ! -f ".env" ]; then
    cat > .env << ENV
BANKING_PORT=3005
JWT_SECRET=$(openssl rand -hex 32)
FRONTEND_URL=https://advanciapayledger.com
NODE_ENV=production
DATABASE_URL="file:./prod.db"
ENV
    ok "Banking .env created"
  fi
  npx prisma generate 2>/dev/null && ok "Prisma generated"
  npx prisma db push 2>/dev/null && ok "DB schema pushed"
  node dist/db/seed.js 2>/dev/null && ok "Banking DB seeded" || err "Seed failed (may already exist)"
  pm2 delete advancia-banking 2>/dev/null || true
  pm2 start dist/server.js --name advancia-banking --instances 2 --exec-mode cluster --max-memory-restart 300M
  pm2 save
  ok "Banking service running on :3005"
fi

# ─────────────────────────────────────────────────────────────────
# PART 3: DEMO PAGE
# ─────────────────────────────────────────────────────────────────
log "Deploying demo page..."
mkdir -p "$DEMO_DIR"
if [ -f "/tmp/advancia-demo.html" ]; then
  cp /tmp/advancia-demo.html "$DEMO_DIR/index.html"
  ok "Demo page deployed"
else
  err "Upload advancia-demo.html to /tmp/"
fi

# ─────────────────────────────────────────────────────────────────
# PART 4: NGINX
# ─────────────────────────────────────────────────────────────────
log "Configuring Nginx..."

cat > /etc/nginx/sites-available/advanciapayledger.com << 'NGINX'
server {
    listen 80;
    server_name advanciapayledger.com www.advanciapayledger.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name advanciapayledger.com www.advanciapayledger.com;

    ssl_certificate     /etc/letsencrypt/live/advanciapayledger.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/advanciapayledger.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;

    client_max_body_size 10M;

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
        proxy_read_timeout 60s;
    }

    location /api/banking/ {
        proxy_pass http://localhost:3005/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    location = /api/banking/health {
        proxy_pass http://localhost:3005/health;
        proxy_set_header Host $host;
    }

    location /demo {
        alias /var/www/html/demo;
        index index.html;
        try_files $uri $uri/ /demo/index.html;
        add_header Cache-Control "no-cache";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
NGINX

cat > /etc/nginx/sites-available/api.advanciapayledger.com << 'NGINX'
server {
    listen 80;
    server_name api.advanciapayledger.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.advanciapayledger.com;

    ssl_certificate     /etc/letsencrypt/live/advanciapayledger.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/advanciapayledger.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header Access-Control-Allow-Origin "https://advanciapayledger.com" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;

    location / {
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "https://advanciapayledger.com";
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Authorization, Content-Type";
            add_header Content-Length 0;
            return 204;
        }
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 120s;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/advanciapayledger.com /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/api.advanciapayledger.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

if [ ! -f "/etc/letsencrypt/live/api.advanciapayledger.com/fullchain.pem" ]; then
  log "Issuing SSL for api subdomain..."
  certbot certonly --nginx -d api.advanciapayledger.com --non-interactive --agree-tos --email admin@advanciapayledger.com 2>/dev/null || \
  err "SSL for api.advanciapayledger.com failed"
  if [ -f "/etc/letsencrypt/live/api.advanciapayledger.com/fullchain.pem" ]; then
    sed -i 's|/etc/letsencrypt/live/advanciapayledger.com/|/etc/letsencrypt/live/api.advanciapayledger.com/|g' \
      /etc/nginx/sites-available/api.advanciapayledger.com
  fi
fi

nginx -t && systemctl reload nginx && ok "Nginx configured and reloaded"

# ─────────────────────────────────────────────────────────────────
# PART 5: FIREWALL
# ─────────────────────────────────────────────────────────────────
log "Firewall rules..."
ufw allow 22/tcp   2>/dev/null
ufw allow 80/tcp   2>/dev/null
ufw allow 443/tcp  2>/dev/null
ufw deny 3000/tcp  2>/dev/null
ufw deny 3001/tcp  2>/dev/null
ufw deny 3005/tcp  2>/dev/null
ufw --force enable 2>/dev/null
ok "Firewall locked down"

# ─────────────────────────────────────────────────────────────────
# PART 6: HEALTH CHECKS
# ─────────────────────────────────────────────────────────────────
log "Running health checks..."
sleep 3

BACK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null || echo "000")
[ "$BACK" = "200" ] && ok "Main backend healthy (:3001)" || err "Main backend :3001 → $BACK"

BANK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3005/health 2>/dev/null || echo "000")
[ "$BANK" = "200" ] && ok "Banking service healthy (:3005)" || err "Banking :3005 → $BANK"

TOKEN=$(curl -s -X POST http://localhost:3005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cfo@advanciapayledger.com","password":"Demo@2025!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token','FAIL')[:20])" 2>/dev/null)
[ "$TOKEN" != "FAIL" ] && ok "Auth working — JWT: ${TOKEN}..." || err "Auth failed"

pm2 status

echo ""
echo -e "${B}${G}  ╔═══════════════════════════════════════════════════════════╗"
echo -e "  ║  🚀  ADVANCIA IS LIVE                                     ║"
echo -e "  ╠═══════════════════════════════════════════════════════════╣"
echo -e "  ║  🌐  Site:      https://advanciapayledger.com             ║"
echo -e "  ║  🎯  Demo:      https://advanciapayledger.com/demo        ║"
echo -e "  ║  🔌  Main API:  https://api.advanciapayledger.com         ║"
echo -e "  ║  💳  Banking:   https://advanciapayledger.com/api/banking ║"
echo -e "  ╠═══════════════════════════════════════════════════════════╣"
echo -e "  ║  Login: cfo@advanciapayledger.com / Demo@2025!            ║"
echo -e "  ╚═══════════════════════════════════════════════════════════╝${N}"
echo ""
echo -e "  Logs:  pm2 logs | Restart: pm2 restart all | Status: pm2 status"
