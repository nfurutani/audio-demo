#!/bin/bash

# Audio Demo Server Setup Script for Private Repositories
# Usage: 
#   Method 1 (SSH): ./setup-server-private.sh ssh git@github.com:user/repo.git
#   Method 2 (PAT): ./setup-server-private.sh pat https://TOKEN@github.com/user/repo.git
#   Method 3 (Interactive): ./setup-server-private.sh interactive https://github.com/user/repo.git

set -e

AUTH_METHOD=$1
REPO_URL=$2

if [ "$AUTH_METHOD" = "" ] || [ "$REPO_URL" = "" ]; then
    echo "❌ Usage examples:"
    echo "   SSH Key:     $0 ssh git@github.com:user/repo.git"
    echo "   PAT Token:   $0 pat https://TOKEN@github.com/user/repo.git"
    echo "   Interactive: $0 interactive https://github.com/user/repo.git"
    exit 1
fi

echo "🚀 Starting Audio Demo server setup for private repository..."
echo "🔐 Authentication method: $AUTH_METHOD"

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

# Handle different authentication methods
case $AUTH_METHOD in
    "ssh")
        echo "🔑 Using SSH key authentication..."
        
        # Check if SSH key exists
        if [ ! -f ~/.ssh/id_ed25519 ]; then
            echo "📝 Generating SSH key..."
            ssh-keygen -t ed25519 -C "server-deploy-$(date +%Y%m%d)" -f ~/.ssh/id_ed25519 -N ""
            echo ""
            echo "🔑 ADD THIS PUBLIC KEY TO GITHUB DEPLOY KEYS:"
            echo "----------------------------------------"
            cat ~/.ssh/id_ed25519.pub
            echo "----------------------------------------"
            echo ""
            echo "1. Go to: https://github.com/YOUR_USERNAME/YOUR_REPO/settings/keys"
            echo "2. Click 'Add deploy key'"
            echo "3. Paste the above key"
            echo "4. Check 'Allow write access' if needed"
            echo ""
            read -p "Press Enter after adding the deploy key to GitHub..."
        fi
        
        # Add GitHub to known hosts
        ssh-keyscan -H github.com >> ~/.ssh/known_hosts 2>/dev/null
        
        echo "📥 Cloning repository..."
        git clone $REPO_URL audio-demo
        ;;
        
    "pat")
        echo "🔑 Using Personal Access Token..."
        echo "📥 Cloning repository..."
        git clone $REPO_URL audio-demo
        ;;
        
    "interactive")
        echo "🔑 Using interactive authentication..."
        echo "📝 Setting up Git credential helper..."
        git config --global credential.helper store
        
        echo ""
        echo "🔐 You will be prompted for GitHub credentials:"
        echo "   Username: your-github-username"
        echo "   Password: your-personal-access-token"
        echo ""
        echo "📥 Cloning repository..."
        git clone $REPO_URL audio-demo
        ;;
        
    *)
        echo "❌ Invalid authentication method: $AUTH_METHOD"
        exit 1
        ;;
esac

# Verify clone was successful
if [ ! -d "audio-demo" ]; then
    echo "❌ Failed to clone repository. Please check:"
    echo "   - Repository URL is correct"
    echo "   - Authentication method is properly set up"
    echo "   - You have access to the repository"
    exit 1
fi

echo "✅ Repository cloned successfully!"
cd audio-demo

# Install dependencies
echo "📦 Installing project dependencies..."
npm install --production

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
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|wav|mp3)$ {
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

# Transfer Git credentials to deploy user
if [ "$AUTH_METHOD" = "ssh" ]; then
    echo "🔑 Setting up SSH keys for deploy user..."
    cp -r /root/.ssh/* /home/deploy/.ssh/ 2>/dev/null || true
    chown -R deploy:deploy /home/deploy/.ssh
    chmod 700 /home/deploy/.ssh
    chmod 600 /home/deploy/.ssh/id_ed25519 2>/dev/null || true
    chmod 644 /home/deploy/.ssh/id_ed25519.pub 2>/dev/null || true
    chmod 644 /home/deploy/.ssh/known_hosts 2>/dev/null || true
elif [ "$AUTH_METHOD" = "interactive" ]; then
    echo "🔑 Setting up Git credentials for deploy user..."
    # Copy Git credentials if they exist
    if [ -f /root/.git-credentials ]; then
        cp /root/.git-credentials /home/deploy/.git-credentials
        chown deploy:deploy /home/deploy/.git-credentials
        chmod 600 /home/deploy/.git-credentials
    fi
    # Set Git config for deploy user
    sudo -u deploy git config --global credential.helper store
fi

# Change ownership of project
chown -R deploy:deploy /var/www/audio-demo

# Create backup directory
mkdir -p /home/deploy/backups
chown deploy:deploy /home/deploy/backups

# Start application with PM2
echo "🚀 Starting application..."
cd /var/www/audio-demo
sudo -u deploy pm2 start ecosystem.config.js
sudo -u deploy pm2 startup
sudo -u deploy pm2 save

# Generate startup script
env PATH=$PATH:/usr/bin pm2 startup systemd -u deploy --hp /home/deploy

# Create secure update script for private repo
echo "📝 Creating secure update script..."
cat > /home/deploy/update-app.sh << EOF
#!/bin/bash
set -e

echo "🔄 Updating Audio Demo application..."
cd /var/www/audio-demo

# Pull latest changes
echo "📥 Pulling latest changes from repository..."
git pull origin main

# Install/update dependencies
echo "📦 Installing dependencies..."
npm install --production

# Restart application
echo "🚀 Restarting application..."
pm2 restart audio-demo

# Show status
pm2 status

echo "✅ Application updated successfully!"
echo "🌐 Access at: http://\$(curl -s ifconfig.me)"
EOF

chmod +x /home/deploy/update-app.sh
chown deploy:deploy /home/deploy/update-app.sh

# Create backup script
cat > /home/deploy/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p /home/deploy/backups
cd /var/www
tar -czf /home/deploy/backups/audio-demo_$DATE.tar.gz audio-demo --exclude=audio-demo/node_modules --exclude=audio-demo/.git
find /home/deploy/backups -name "*.tar.gz" -mtime +7 -delete
echo "✅ Backup created: audio-demo_$DATE.tar.gz"
ls -la /home/deploy/backups/
EOF

chmod +x /home/deploy/backup.sh
chown deploy:deploy /home/deploy/backup.sh

# Create SSH security script
cat > /home/deploy/secure-ssh.sh << 'EOF'
#!/bin/bash
echo "🔒 Applying SSH security settings..."

# Backup original config
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

# Apply security settings
sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config

# Test and restart SSH
sshd -t && systemctl restart ssh

echo "✅ SSH security applied:"
echo "   - Root login disabled"
echo "   - Password authentication disabled"  
echo "   - Only SSH key authentication allowed"
echo ""
echo "⚠️  Make sure you have SSH key access before logging out!"
EOF

chmod +x /home/deploy/secure-ssh.sh

# Get server IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "Unable to detect IP")

echo ""
echo "🎉 Private repository deployment completed successfully!"
echo ""
echo "📍 Server Information:"
echo "   IP Address: $SERVER_IP"
echo "   Application: http://$SERVER_IP"
echo "   SSH User: deploy"
echo ""
echo "🔧 Management Commands (as deploy user):"
echo "   Check status: pm2 status"
echo "   View logs: pm2 logs audio-demo"
echo "   Restart app: pm2 restart audio-demo"
echo "   Update app: /home/deploy/update-app.sh"
echo "   Backup: /home/deploy/backup.sh"
echo "   Secure SSH: /home/deploy/secure-ssh.sh"
echo ""
echo "🔒 Security Recommendations:"
echo "   1. Run: /home/deploy/secure-ssh.sh"
echo "   2. Setup SSL: certbot --nginx -d yourdomain.com"
echo "   3. Regular updates: apt update && apt upgrade"
echo "   4. Change default SSH port in /etc/ssh/sshd_config"
echo ""
if [ "$AUTH_METHOD" = "ssh" ]; then
echo "🔑 SSH Key Authentication:"
echo "   Private key saved at: /home/deploy/.ssh/id_ed25519"
echo "   Make sure to backup this key securely!"
echo ""
fi
echo "✅ Your 3D Audio Visualizer is ready at: http://$SERVER_IP"