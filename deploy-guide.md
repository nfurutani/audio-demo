# Vultr デプロイガイド

## 1. Vultr インスタンス作成

### インスタンス設定
- **OS**: Ubuntu 22.04 LTS
- **Instance Size**: Regular Cloud Compute (最低$6/月)
- **Location**: Tokyo, Japan (低レイテンシーのため)
- **IPv4**: 有効
- **IPv6**: 有効（オプション）

### SSH キー設定
```bash
# ローカルでSSHキーを生成（まだない場合）
ssh-keygen -t ed25519 -C "your-email@example.com"

# 公開鍵をコピー
cat ~/.ssh/id_ed25519.pub
```

## 2. 初期サーバーセットアップ

### SSH接続
```bash
ssh root@YOUR_SERVER_IP
```

### システム更新とNode.js インストール
```bash
# システム更新
apt update && apt upgrade -y

# Node.js 18.x のインストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# PM2（プロセス管理）のインストール
npm install -g pm2

# Nginx のインストール
apt install -y nginx

# UFW ファイアウォール設定
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw --force enable
```

### Git とプロジェクトのクローン
```bash
# Git インストール
apt install -y git

# プロジェクトディレクトリ作成
mkdir -p /var/www
cd /var/www

# プロジェクトをクローン（GitHubにpushした場合）
git clone https://github.com/YOUR_USERNAME/audio-demo.git
cd audio-demo

# 依存関係インストール
npm install
```

## 3. Nginx 設定

### Nginx 設定ファイル作成
```bash
nano /etc/nginx/sites-available/audio-demo
```

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;
    
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
```

### Nginx 有効化
```bash
# 設定ファイルを有効化
ln -s /etc/nginx/sites-available/audio-demo /etc/nginx/sites-enabled/

# デフォルト設定を削除
rm /etc/nginx/sites-enabled/default

# Nginx テストと再起動
nginx -t
systemctl restart nginx
```

## 4. PM2 でアプリケーション起動

### PM2 設定ファイル作成
```bash
cd /var/www/audio-demo
nano ecosystem.config.js
```

```javascript
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
```

### アプリケーション開始
```bash
# PM2 でアプリケーション開始
pm2 start ecosystem.config.js

# 起動時に自動開始設定
pm2 startup
pm2 save
```

## 5. SSL証明書（Let's Encrypt）

### Certbot インストール
```bash
apt install -y certbot python3-certbot-nginx
```

### SSL証明書取得
```bash
# ドメインがある場合
certbot --nginx -d yourdomain.com

# IPアドレスのみの場合はスキップ
```

## 6. セキュリティ設定

### 非rootユーザー作成
```bash
# 新しいユーザー作成
adduser deploy
usermod -aG sudo deploy

# SSH鍵をコピー
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

### SSH設定強化
```bash
nano /etc/ssh/sshd_config
```

```
Port 22
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

```bash
systemctl restart ssh
```

## 7. モニタリングとログ

### PM2 モニタリング
```bash
# アプリケーション状態確認
pm2 status
pm2 logs audio-demo

# リアルタイムモニタリング
pm2 monit
```

### Nginx ログ
```bash
# アクセスログ
tail -f /var/log/nginx/access.log

# エラーログ
tail -f /var/log/nginx/error.log
```

## 8. 更新とメンテナンス

### アプリケーション更新
```bash
cd /var/www/audio-demo
git pull origin main
npm install
pm2 restart audio-demo
```

### 自動バックアップ（オプション）
```bash
# 日次バックアップスクリプト
nano /home/deploy/backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /home/deploy/backups/audio-demo_$DATE.tar.gz /var/www/audio-demo
find /home/deploy/backups -name "*.tar.gz" -mtime +7 -delete
```

```bash
chmod +x /home/deploy/backup.sh
# クーロンジョブに追加
crontab -e
# 毎日午前2時にバックアップ
0 2 * * * /home/deploy/backup.sh
```

## 接続テスト

デプロイ完了後、ブラウザで以下にアクセス：
- `http://YOUR_SERVER_IP` または `https://yourdomain.com`

## トラブルシューティング

### よくある問題
1. **ポート3000が使えない**: `lsof -i :3000` でプロセス確認
2. **Nginx 502 エラー**: PM2でアプリが起動しているか確認
3. **音声ファイルが再生されない**: ブラウザのHTTPS要件を確認

### ログ確認コマンド
```bash
pm2 logs audio-demo       # アプリログ
systemctl status nginx   # Nginx状態
journalctl -u nginx       # Nginx詳細ログ
```