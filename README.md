# Audio Demo - Three.js Audio Reactive Visualization

Audio reactive 3D visualization demo

## Local Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Start server
```bash
npm start
```

### 3. Open in browser
```
http://localhost:3000
```

## Features

- **Three.js Audio Reactive Demo** (`/index.html`)
  - Web Audio API for audio analysis
  - Real-time 3D plane deformation
  - Color changes based on volume
  - Click to play/pause music

- **p5.js FernTilt Animation** (`/ferntilt.html`)
  - 3D isometric structure
  - State changes during music playback
  - Independent movement of blue cube and red structure

## File Structure

```
audio-demo/
├── public/
│   ├── index.html       # Three.js Audio Reactive Demo
│   ├── ferntilt.html    # p5.js Animation
│   ├── sample.wav       # Audio file 1
│   └── sample2.flac     # Audio file 2
├── server.js            # Express server
├── package.json
└── README.md           # This file
```

## Tech Stack

- **Three.js** - 3D graphics
- **Web Audio API** - Audio analysis
- **p5.js** - Creative coding
- **Express** - Node.js server

## Deploy

See `deploy-guide.md` for Vultr server deployment instructions.


---

サーバーが頻繁に落ちる原因：

  1. メモリ不足: 大きな音声ファイル（100MB+）を配信
  2. エラーハンドリング不足: Node.jsがクラッシュ
  3. プロセス管理なし: 単純なnode server.js &では不安定

  解決策 - PM2を使用:

  # 既存のNode.jsプロセスを停止
  pkill -f node

  # プロセスが停止したか確認
  ps aux | grep node

  # PM2をインストール（未インストールの場合）
  npm install -g pm2

  # PM2でサーバー起動
  cd /var/www/html
  
  

  # 自動再起動を設定
  pm2 save
  pm2 startup

  # ログを確認
  pm2 logs audio-demo

  # ステータス確認
  pm2 status

  PM2の利点：
  - 自動再起動: クラッシュしても自動復旧
  - ログ管理: エラーを記録
  - メモリ監視: リソース使用状況を確認
  - システム起動時に自動開始