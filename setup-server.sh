#!/bin/bash

# Audio Demo Server Setup Script for Vultr Ubuntu 22.04
# Run as: curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/audio-demo/main/setup-server.sh | bash

set -e

echo "🚀 Starting Audio Demo server setup..."

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js 18.x
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Install PM2 and other tools
echo "📦 Installing PM2 and tools..."
npm install -g pm2
apt install -y nginx git ufw certbot python3-certbot-nginx

# Setup firewall
echo "🔒 Configuring firewall..."
ufw allow 22
ufw allow 80
ufw allow 443
echo "y" | ufw enable

# Create project directory
echo "📁 Setting up project directory..."
mkdir -p /var/www
cd /var/www

# Clone project (if URL provided as argument)
if [ "$1" != "" ]; then
    echo "📥 Cloning project from $1..."
    git clone $1 audio-demo
else
    echo "⚠️  No git repository provided. Please clone manually:"
    echo "   cd /var/www && git clone YOUR_REPO_URL audio-demo"
fi

if [ -d "audio-demo" ]; then
    cd audio-demo
    echo "📦 Installing project dependencies..."
    npm install
    
    # Create PM2 ecosystem config
    echo "⚙️  Creating PM2 configuration..."
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'audio-demo',
    script: './server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF
fi

# Create Nginx configuration
echo "🌐 Configuring Nginx..."
cat > /etc/nginx/sites-available/audio-demo << 'EOF'
server {
    listen 80;
    server_name _;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
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
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Static file caching
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable Nginx site
ln -sf /etc/nginx/sites-available/audio-demo /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
echo "🔧 Testing Nginx configuration..."
nginx -t
systemctl restart nginx
systemctl enable nginx

# Create deploy user
echo "👤 Creating deploy user..."
if ! id "deploy" &>/dev/null; then
    adduser --disabled-password --gecos "" deploy
    usermod -aG sudo deploy
    
    # Setup SSH for deploy user
    mkdir -p /home/deploy/.ssh
    if [ -f /root/.ssh/authorized_keys ]; then
        cp /root/.ssh/authorized_keys /home/deploy/.ssh/
        chown -R deploy:deploy /home/deploy/.ssh
        chmod 700 /home/deploy/.ssh
        chmod 600 /home/deploy/.ssh/authorized_keys
    fi
fi

# Create backup directory
mkdir -p /home/deploy/backups
chown deploy:deploy /home/deploy/backups

# Start application with PM2 (if project exists)
if [ -d "/var/www/audio-demo" ]; then
    echo "🚀 Starting application..."
    cd /var/www/audio-demo
    chown -R deploy:deploy /var/www/audio-demo
    
    # Start with PM2 as deploy user
    sudo -u deploy pm2 start ecosystem.config.js
    sudo -u deploy pm2 startup
    sudo -u deploy pm2 save
    
    # Generate startup script
    env PATH=$PATH:/usr/bin pm2 startup systemd -u deploy --hp /home/deploy
fi

# Create update script
echo "📝 Creating update script..."
cat > /home/deploy/update-app.sh << 'EOF'
#!/bin/bash
cd /var/www/audio-demo
git pull origin main
npm install --production
pm2 restart audio-demo
echo "✅ Application updated successfully!"
EOF

chmod +x /home/deploy/update-app.sh
chown deploy:deploy /home/deploy/update-app.sh

# Create backup script
cat > /home/deploy/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p /home/deploy/backups
tar -czf /home/deploy/backups/audio-demo_$DATE.tar.gz /var/www/audio-demo
find /home/deploy/backups -name "*.tar.gz" -mtime +7 -delete
echo "✅ Backup created: audio-demo_$DATE.tar.gz"
EOF

chmod +x /home/deploy/backup.sh
chown deploy:deploy /home/deploy/backup.sh

# Setup log rotation
echo "📋 Setting up log rotation..."
cat > /etc/logrotate.d/audio-demo << 'EOF'
/home/deploy/.pm2/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    notifempty
    create 0640 deploy deploy
    postrotate
        sudo -u deploy pm2 reloadLogs
    endscript
}
EOF

# Get server IP
SERVER_IP=$(curl -s ifconfig.me)

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📍 Server Information:"
echo "   IP Address: $SERVER_IP"
echo "   Application: http://$SERVER_IP"
echo ""
echo "🔧 Management Commands:"
echo "   Check status: sudo -u deploy pm2 status"
echo "   View logs: sudo -u deploy pm2 logs audio-demo"
echo "   Restart app: sudo -u deploy pm2 restart audio-demo"
echo "   Update app: /home/deploy/update-app.sh"
echo "   Backup: /home/deploy/backup.sh"
echo ""
echo "🔒 Security Recommendations:"
echo "   1. Change SSH port: edit /etc/ssh/sshd_config"
echo "   2. Disable root login: PermitRootLogin no"
echo "   3. Setup SSL: certbot --nginx -d yourdomain.com"
echo "   4. Regular updates: apt update && apt upgrade"
echo ""
echo "✅ Your Audio Visualizer is ready at: http://$SERVER_IP"