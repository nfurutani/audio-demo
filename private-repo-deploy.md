# プライベートリポジトリでのデプロイ

## 方法1: SSH鍵認証（推奨）

### 1. サーバーでSSH鍵を生成
```bash
# SSH接続後
ssh-keygen -t ed25519 -C "server-deploy-key"
# Enterを3回押してパスフレーズなしで作成

# 公開鍵をコピー
cat ~/.ssh/id_ed25519.pub
```

### 2. GitHubにDeploy Keyを追加
1. GitHubのリポジトリページ → **Settings** → **Deploy keys**
2. **Add deploy key** をクリック
3. **Title**: `Vultr Server Deploy Key`
4. **Key**: 上でコピーした公開鍵を貼り付け
5. ✅ **Allow write access** にチェック（更新が必要な場合）
6. **Add key** をクリック

### 3. サーバーでクローン
```bash
cd /var/www
git clone git@github.com:YOUR_USERNAME/audio-demo.git
```

## 方法2: Personal Access Token (PAT)

### 1. GitHubでPATを作成
1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. **Generate new token (classic)**
3. **Note**: `Audio Demo Deployment`
4. **Expiration**: 90 days（お好みで）
5. **Scopes**: ✅ `repo` (Full control of private repositories)
6. **Generate token**
7. ⚠️ トークンをコピー（一度しか表示されません）

### 2. サーバーでクローン（PATを使用）
```bash
cd /var/www
git clone https://YOUR_PAT_TOKEN@github.com/YOUR_USERNAME/audio-demo.git
```

## 方法3: Git Credentialヘルパー（便利）

### 1. Git Credential Helperを設定
```bash
# サーバーで実行
git config --global credential.helper store
```

### 2. 初回クローン時に認証情報を入力
```bash
cd /var/www
git clone https://github.com/YOUR_USERNAME/audio-demo.git

# ユーザー名: あなたのGitHubユーザー名
# パスワード: Personal Access Token（上で作成したもの）
```

これで認証情報が保存され、以後のgit操作で自動認証されます。

---

## セキュアな自動セットアップ

プライベートリポジトリ用の改良セットアップスクリプト：