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