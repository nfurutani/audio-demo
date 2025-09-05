let scene, camera, renderer, leftPlane, rightPlane, analyser, dataArray;
let audio, audioContext;
let isPlaying = false;
let timeInterval = null;
let selectedMesh = null;
let raycaster, mouse;
let animationId = null; // requestAnimationFrameのIDを保持する変数


init();

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
  
  // モバイルではカメラを引いて全体を表示
  const isMobileCamera = window.innerWidth < 480;
  camera.position.z = isMobileCamera ? 7 : 5;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // レスポンシブレイアウト
  const isMobile = window.innerWidth < 480;
  
  // 左の平面（緑）
  let leftGeometry = new THREE.PlaneGeometry(6, 6, 64, 64);
  let leftMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x00ff00,
    wireframe: true,
    transparent: true,
    opacity: 0.8
  });
  leftPlane = new THREE.Mesh(leftGeometry, leftMaterial);
  
  // モバイルでは縦並び、デスクトップでは横並び
  if (isMobile) {
    leftPlane.position.set(0, 1.2, 0);
    leftPlane.scale.set(0.35, 0.35, 0.35);
  } else {
    leftPlane.position.x = -2;
    leftPlane.scale.set(0.5, 0.5, 0.5);
  }
  leftPlane.userData = { audioFile: "/IORI-Neophoca.m4a", colorTheme: "green" };
  scene.add(leftPlane);

  // 右の平面（紫）
  let rightGeometry = new THREE.PlaneGeometry(6, 6, 64, 64);
  let rightMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x8800ff,
    wireframe: true,
    transparent: true,
    opacity: 0.8
  });
  rightPlane = new THREE.Mesh(rightGeometry, rightMaterial);
  
  // モバイルでは縦並び、デスクトップでは横並び
  if (isMobile) {
    rightPlane.position.set(0, -1.2, 0);
    rightPlane.scale.set(0.35, 0.35, 0.35);
  } else {
    rightPlane.position.x = 2;
    rightPlane.scale.set(0.5, 0.5, 0.5);
  }
  rightPlane.userData = { audioFile: "/ganga_blues.m4a", colorTheme: "purple" };
  scene.add(rightPlane);

  // レイキャスターとマウス
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();


  // マウスクリック処理
  document.body.addEventListener("click", async (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([leftPlane, rightPlane]);
    
    if (intersects.length > 0 && !selectedMesh) {
      const clickedMesh = intersects[0].object;
      selectedMesh = clickedMesh;
      
      if (clickedMesh === leftPlane) {
        rightPlane.visible = false;
        leftPlane.position.set(0, 0, 0);
        leftPlane.scale.set(1, 1, 1);
      } else {
        leftPlane.visible = false;
        rightPlane.position.set(0, 0, 0);
        rightPlane.scale.set(1, 1, 1);
      }
      
      if (!analyser) {
        try {
          // HTMLMediaElementを作成（Apple推奨のcontrols属性を追加）
          audio = document.createElement('audio');
          audio.src = clickedMesh.userData.audioFile;
          audio.loop = true;
          audio.crossOrigin = "anonymous";
          audio.controls = true;
          document.body.appendChild(audio);
          // display:noneを削除（iOS背景再生の問題を回避）

          // Media Session APIの設定
          if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: clickedMesh.userData.audioFile.split('/').pop().split('.')[0],
              artist: 'Audio Demo',
              album: 'Web Audio Visualizer'
            });
            
            navigator.mediaSession.setActionHandler('play', async () => {
              // audio要素を再開
              await audio.play();
            });
            
            navigator.mediaSession.setActionHandler('pause', () => {
              audio.pause();
              // AudioContextを一時停止
              if (audioContext) {
                audioContext.suspend();
              }
            });
          }
          
          const filename = audio.src.split('/').pop().split('.')[0];
          document.getElementById("filename").innerText = filename;
        
          // AudioContextを初期化
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
          
          const src = audioContext.createMediaElementSource(audio);
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.8;
          
          src.connect(analyser);
          analyser.connect(audioContext.destination);
          
          dataArray = new Uint8Array(analyser.frequencyBinCount);
          
          // AudioContextの積極的な監視・復旧
          const monitorAudioContext = () => {
            if (audioContext && isPlaying) {
              // suspended状態の場合
              if (audioContext.state === 'suspended') {
                audioContext.resume();
              }
              
              // interrupted状態の場合 - iOS特有の状態
              if (audioContext.state === 'interrupted') {
                audioContext.resume();
              }
            }
          };
          
          // 定期的にAudioContextの状態をチェック
          setInterval(monitorAudioContext, 1000);
          
          // ユーザー操作で再生を開始
          await audio.play();
          
          isPlaying = true;
          document.getElementById("ui").innerText = "Audio playing... Click again to pause";
          
          
          updateTime();
          timeInterval = setInterval(updateTime, 1000);
          
          // ここでanimateループを開始
          if (!animationId) {
            animate();
          }

        } catch (error) {
          console.error("Audio error:", error);
        }
      }
    } else if (selectedMesh && audioContext) {
      // 再生/一時停止の切り替え
      if (audio.paused) {
        await audio.play();
        isPlaying = true;
        document.getElementById("ui").innerText = "Audio playing... Click to resume";
        
        
        updateTime();
        timeInterval = setInterval(updateTime, 1000);
        
        // アニメーションを再開
        if (!animationId) {
          animate();
        }
      } else {
        audio.pause();
        // AudioContextを一時停止
        audioContext.suspend();
        isPlaying = false;
        document.getElementById("ui").innerText = "Audio paused... Click to resume";
        
        
        if (timeInterval) {
          clearInterval(timeInterval);
          timeInterval = null;
        }
        document.getElementById('time').textContent = '';
        
        // アニメーションを停止
        if (animationId) {
          cancelAnimationFrame(animationId);
          animationId = null;
        }
      }
    }
  });

  // 初期レンダリングを実行して、二つの平面を表示
  renderer.render(scene, camera);
}

function animate() {
  animationId = requestAnimationFrame(animate);

  if (analyser && isPlaying && selectedMesh) {
    analyser.getByteFrequencyData(dataArray);

    const positions = selectedMesh.geometry.attributes.position;
    const positionArray = positions.array;
    
    for (let i = 0; i < positions.count; i++) {
      const x = positionArray[i * 3];
      const y = positionArray[i * 3 + 1];
      
      const freq = Math.floor((Math.abs(x) + Math.abs(y)) * 10) % dataArray.length;
      const amplitude = dataArray[freq] / 255.0;
      
      positionArray[i * 3 + 2] = Math.sin(Date.now() * 0.001 + x + y) * amplitude * 2;
    }
    
    positions.needsUpdate = true;

    const avgAmplitude = dataArray.reduce((a,b) => a+b) / dataArray.length / 255;
    
    if (selectedMesh.userData.colorTheme === "green") {
      selectedMesh.material.color.setHSL(0.33, 0.8, 0.4 + avgAmplitude * 0.3);
    } else if (selectedMesh.userData.colorTheme === "purple") {
      selectedMesh.material.color.setHSL(0.75, 0.8, 0.4 + avgAmplitude * 0.3);
    }
    
    selectedMesh.rotation.z += 0.002 + avgAmplitude * 0.01;
    selectedMesh.rotation.x += 0.001 + avgAmplitude * 0.005;
  }

  renderer.render(scene, camera);
}


window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  const isMobile = window.innerWidth < 480;
  
  camera.position.z = isMobile ? 7 : 5;
  
  if (!selectedMesh) {
    if (isMobile) {
      leftPlane.position.set(0, 1.2, 0);
      rightPlane.position.set(0, -1.2, 0);
      leftPlane.scale.set(0.35, 0.35, 0.35);
      rightPlane.scale.set(0.35, 0.35, 0.35);
    } else {
      leftPlane.position.set(-2, 0, 0);
      rightPlane.position.set(2, 0, 0);
      leftPlane.scale.set(0.5, 0.5, 0.5);
      rightPlane.scale.set(0.5, 0.5, 0.5);
    }
  }
});

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
// let audio, audioContext;
// let isPlaying = false;
// let timeInterval = null;
// let selectedMesh = null;
// let raycaster, mouse;

// init();
// animate();

// function init() {
//   scene = new THREE.Scene();

//   camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
  
//   // モバイルではカメラを引いて全体を表示
//   const isMobileCamera = window.innerWidth < 480;
//   camera.position.z = isMobileCamera ? 7 : 5;

//   renderer = new THREE.WebGLRenderer({ antialias: true });
//   renderer.setSize(window.innerWidth, window.innerHeight);
//   document.body.appendChild(renderer.domElement);

//   // レスポンシブレイアウト
//   const isMobile = window.innerWidth < 480;
  
//   // 左の平面（緑）
//   let leftGeometry = new THREE.PlaneGeometry(6, 6, 64, 64);
//   let leftMaterial = new THREE.MeshBasicMaterial({ 
//     color: 0x00ff00,
//     wireframe: true,
//     transparent: true,
//     opacity: 0.8
//   });
//   leftPlane = new THREE.Mesh(leftGeometry, leftMaterial);
  
//   // モバイルでは縦並び、デスクトップでは横並び
//   if (isMobile) {
//     leftPlane.position.set(0, 1.2, 0);
//     leftPlane.scale.set(0.35, 0.35, 0.35); // モバイルではさらに小さく
//   } else {
//     leftPlane.position.x = -2;
//     leftPlane.scale.set(0.5, 0.5, 0.5); // デスクトップは従来どおり
//   }
//   leftPlane.userData = { audioFile: "/IORI-Neophoca.m4a", colorTheme: "green" };
//   scene.add(leftPlane);

//   // 右の平面（紫）
//   let rightGeometry = new THREE.PlaneGeometry(6, 6, 64, 64);
//   let rightMaterial = new THREE.MeshBasicMaterial({ 
//     color: 0x8800ff,
//     wireframe: true,
//     transparent: true,
//     opacity: 0.8
//   });
//   rightPlane = new THREE.Mesh(rightGeometry, rightMaterial);
  
//   // モバイルでは縦並び、デスクトップでは横並び
//   if (isMobile) {
//     rightPlane.position.set(0, -1.2, 0);
//     rightPlane.scale.set(0.35, 0.35, 0.35); // モバイルではさらに小さく
//   } else {
//     rightPlane.position.x = 2;
//     rightPlane.scale.set(0.5, 0.5, 0.5); // デスクトップは従来どおり
//   }
//   rightPlane.userData = { audioFile: "/ganga_blues.m4a", colorTheme: "purple" };
//   scene.add(rightPlane);

//   // レイキャスターとマウス
//   raycaster = new THREE.Raycaster();
//   mouse = new THREE.Vector2();

//   // マウスクリック処理
//   document.body.addEventListener("click", async (event) => {
//     // マウス座標を正規化
//     mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//     mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
//     // レイキャスト
//     raycaster.setFromCamera(mouse, camera);
//     const intersects = raycaster.intersectObjects([leftPlane, rightPlane]);
    
//     if (intersects.length > 0 && !selectedMesh) {
//       const clickedMesh = intersects[0].object;
//       selectedMesh = clickedMesh;
      
//       // 選択されたメッシュ以外を非表示
//       if (clickedMesh === leftPlane) {
//         rightPlane.visible = false;
//         leftPlane.position.set(0, 0, 0);
//         leftPlane.scale.set(1, 1, 1);
//       } else {
//         leftPlane.visible = false;
//         rightPlane.position.set(0, 0, 0);
//         rightPlane.scale.set(1, 1, 1);
//       }
      
//       // 音声を初期化して再生
//       if (!analyser) {
//         try {
//           // HTMLMediaElementを作成してDOMに追加（ブラウザが正式なメディア要素として認識）
//           audio = document.createElement('audio');
//           audio.src = clickedMesh.userData.audioFile;
//           audio.loop = true;
//           audio.crossOrigin = "anonymous";
//           document.body.appendChild(audio);
//           audio.style.display = 'none';
          
//           // バックグラウンド再生を有効化
//           if ('mediaSession' in navigator) {
//             navigator.mediaSession.metadata = new MediaMetadata({
//               title: clickedMesh.userData.audioFile.split('/').pop().split('.')[0],
//               artist: 'Audio Demo',
//               album: 'Web Audio Visualizer'
//             });
            
//             navigator.mediaSession.setActionHandler('play', async () => {
//               await audio.play();
//               isPlaying = true;
//               // AudioContextも再開
//               if (audioContext.state === 'suspended') {
//                 await audioContext.resume();
//               }
//             });
            
//             navigator.mediaSession.setActionHandler('pause', () => {
//               audio.pause();
//               isPlaying = false;
//             });
//           }
          
//           // ファイル名を表示（拡張子なし）
//           const filename = audio.src.split('/').pop().split('.')[0];
//           document.getElementById("filename").innerText = filename;
        
//         audioContext = new (window.AudioContext || window.webkitAudioContext)();
//         await audioContext.resume();
        
//         const src = audioContext.createMediaElementSource(audio);
//         analyser = audioContext.createAnalyser();
//         analyser.fftSize = 512;
//         analyser.smoothingTimeConstant = 0.8;
        
//         src.connect(analyser);
//         analyser.connect(audioContext.destination);
        

//         dataArray = new Uint8Array(analyser.frequencyBinCount);
        
//           await audio.play();
//           isPlaying = true;
//           document.getElementById("ui").innerText = "Audio playing... Click again to pause";
          
//           // 音楽再生時に時刻表示開始
//           updateTime();
//           timeInterval = setInterval(updateTime, 1000);
//         } catch (error) {
//           console.error("Audio error:", error);
//         }
//       }
//     } else if (selectedMesh && analyser) {
//       // 再生/一時停止の切り替え
//       if (audio.paused) {
//         audio.play();
//         isPlaying = true;
//         document.getElementById("ui").innerText = "Audio playing... Click again to pause";
        
//         // 音楽再生時に時刻表示開始
//         updateTime();
//         timeInterval = setInterval(updateTime, 1000);
//       } else {
//         audio.pause();
//         isPlaying = false;
//         document.getElementById("ui").innerText = "Audio paused... Click to resume";
        
//         // 音楽停止時に時刻表示停止
//         if (timeInterval) {
//           clearInterval(timeInterval);
//           timeInterval = null;
//         }
//         document.getElementById('time').textContent = '';
//       }
//     }
//   });
// }

// function animate() {
//   requestAnimationFrame(animate);

//   if (analyser && isPlaying && selectedMesh) {
//     analyser.getByteFrequencyData(dataArray);

//     // 選択されたメッシュの頂点を音響データに応じて変形
//     const positions = selectedMesh.geometry.attributes.position;
//     const positionArray = positions.array;
    
//     for (let i = 0; i < positions.count; i++) {
//       const x = positionArray[i * 3];
//       const y = positionArray[i * 3 + 1];
      
//       // 頂点の位置に基づいて周波数データをマッピング
//       const freq = Math.floor((Math.abs(x) + Math.abs(y)) * 10) % dataArray.length;
//       const amplitude = dataArray[freq] / 255.0;
      
//       // Z軸方向に変形
//       positionArray[i * 3 + 2] = Math.sin(Date.now() * 0.001 + x + y) * amplitude * 2;
//     }
    
//     positions.needsUpdate = true;

//     // 音響データに基づく色の変化（元の色系統を維持）
//     const avgAmplitude = dataArray.reduce((a,b) => a+b) / dataArray.length / 255;
    
//     if (selectedMesh.userData.colorTheme === "green") {
//       // 緑系の色変化（H: 0.33 = 120度 = 緑）
//       selectedMesh.material.color.setHSL(0.33, 0.8, 0.4 + avgAmplitude * 0.3);
//     } else if (selectedMesh.userData.colorTheme === "purple") {
//       // 紫系の色変化（H: 0.75 = 270度 = 紫）
//       selectedMesh.material.color.setHSL(0.75, 0.8, 0.4 + avgAmplitude * 0.3);
//     }
    
//     // 回転速度も音に反応
//     selectedMesh.rotation.z += 0.002 + avgAmplitude * 0.01;
//     selectedMesh.rotation.x += 0.001 + avgAmplitude * 0.005;
//   }

//   renderer.render(scene, camera);
// }

// window.addEventListener("resize", () => {
//   camera.aspect = window.innerWidth/window.innerHeight;
//   camera.updateProjectionMatrix();
//   renderer.setSize(window.innerWidth, window.innerHeight);
  
//   // リサイズ時にレイアウトとカメラを再調整
//   const isMobile = window.innerWidth < 480;
  
//   // カメラ位置を調整
//   camera.position.z = isMobile ? 7 : 5;
  
//   if (!selectedMesh) {
//     if (isMobile) {
//       leftPlane.position.set(0, 1.2, 0);
//       rightPlane.position.set(0, -1.2, 0);
//       leftPlane.scale.set(0.35, 0.35, 0.35);
//       rightPlane.scale.set(0.35, 0.35, 0.35);
//     } else {
//       leftPlane.position.set(-2, 0, 0);
//       rightPlane.position.set(2, 0, 0);
//       leftPlane.scale.set(0.5, 0.5, 0.5);
//       rightPlane.scale.set(0.5, 0.5, 0.5);
//     }
//   }
// });

// // 日本時刻を表示
// function updateTime() {
//   const now = new Date();
//   const japanTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
  
//   const year = japanTime.getFullYear();
//   const month = String(japanTime.getMonth() + 1).padStart(2, '0');
//   const day = String(japanTime.getDate()).padStart(2, '0');
//   const hours = String(japanTime.getHours()).padStart(2, '0');
//   const minutes = String(japanTime.getMinutes()).padStart(2, '0');
//   const seconds = String(japanTime.getSeconds()).padStart(2, '0');
  
//   const timeString = `${year}/${month}/${day} ${hours}:${minutes}:${seconds} JST`;
//   document.getElementById('time').textContent = timeString;
// }