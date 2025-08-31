let scene, camera, renderer, plane, analyser, dataArray;
let audio, audioContext;
let isPlaying = false;
let timeInterval = null;

init();
animate();

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.z = 5;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // 平面ジオメトリ（分割多めにして波打つようにする）
  let geometry = new THREE.PlaneGeometry(6, 6, 64, 64);
  let material = new THREE.MeshBasicMaterial({ 
    color: 0x00ff88,
    wireframe: true,
    transparent: true,
    opacity: 0.8
  });
  plane = new THREE.Mesh(geometry, material);
  scene.add(plane);

  // 音声をロード
  document.body.addEventListener("click", async () => {
    if (!analyser) {
      try {
        // audio = new Audio("/IORI-Neophoca.m4a");
        audio = new Audio("/trimmed_ganga_blues_w_Symrin.m4a");
        audio.loop = true;
        audio.crossOrigin = "anonymous";
        
        // ファイル名を表示（拡張子なし）
        const filename = audio.src.split('/').pop().split('.')[0];
        document.getElementById("filename").innerText = filename;
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        await audioContext.resume();
        
        const src = audioContext.createMediaElementSource(audio);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.8;
        
        src.connect(analyser);
        analyser.connect(audioContext.destination);

        dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        await audio.play();
        isPlaying = true;
        document.getElementById("ui").innerText = "Audio playing... Click again to pause";
        
        // 音楽再生時に時刻表示開始
        updateTime();
        timeInterval = setInterval(updateTime, 1000);
      } catch (error) {
        console.error("Audio error:", error);
      }
    } else {
      // 再生/一時停止の切り替え
      if (audio.paused) {
        audio.play();
        isPlaying = true;
        document.getElementById("ui").innerText = "Audio playing... Click again to pause";
        
        // 音楽再生時に時刻表示開始
        updateTime();
        timeInterval = setInterval(updateTime, 1000);
      } else {
        audio.pause();
        isPlaying = false;
        document.getElementById("ui").innerText = "Audio paused... Click to resume";
        
        // 音楽停止時に時刻表示停止
        if (timeInterval) {
          clearInterval(timeInterval);
          timeInterval = null;
        }
        document.getElementById('time').textContent = '';
      }
    }
  });
}

function animate() {
  requestAnimationFrame(animate);

  if (analyser && isPlaying) {
    analyser.getByteFrequencyData(dataArray);

    // 平面の頂点を音響データに応じて変形
    const positions = plane.geometry.attributes.position;
    const positionArray = positions.array;
    
    for (let i = 0; i < positions.count; i++) {
      const x = positionArray[i * 3];
      const y = positionArray[i * 3 + 1];
      
      // 頂点の位置に基づいて周波数データをマッピング
      const freq = Math.floor((Math.abs(x) + Math.abs(y)) * 10) % dataArray.length;
      const amplitude = dataArray[freq] / 255.0;
      
      // Z軸方向に変形
      positionArray[i * 3 + 2] = Math.sin(Date.now() * 0.001 + x + y) * amplitude * 2;
    }
    
    positions.needsUpdate = true;

    // 音響データに基づく色の変化
    const avgAmplitude = dataArray.reduce((a,b) => a+b) / dataArray.length / 255;
    plane.material.color.setHSL(avgAmplitude * 0.3, 0.8, 0.5 + avgAmplitude * 0.3);
    
    // 回転速度も音に反応
    plane.rotation.z += 0.002 + avgAmplitude * 0.01;
    plane.rotation.x += 0.001 + avgAmplitude * 0.005;
  }

  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 日本時刻を表示
function updateTime() {
  const now = new Date();
  const japanTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
  
  const year = japanTime.getFullYear();
  const month = String(japanTime.getMonth() + 1).padStart(2, '0');
  const day = String(japanTime.getDate()).padStart(2, '0');
  const hours = String(japanTime.getHours()).padStart(2, '0');
  const minutes = String(japanTime.getMinutes()).padStart(2, '0');
  const seconds = String(japanTime.getSeconds()).padStart(2, '0');
  
  const timeString = `${year}/${month}/${day} ${hours}:${minutes}:${seconds} JST`;
  document.getElementById('time').textContent = timeString;
}