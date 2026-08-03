import * as THREE from 'three';

const PALETTE = {
  skyZenith: new THREE.Color('#1a0a2e'),
  skyHorizon: new THREE.Color('#ff6b35'),
  sunCore: new THREE.Color('#fff5e0'),
  sunGlow: new THREE.Color('#ffaa55'),
  dirtShadow: new THREE.Color('#2d1f4e'),
  dirtLit: new THREE.Color('#d4a574'),
  bikeFrame: new THREE.Color('#ff4444'),
  outlineColor: new THREE.Color('#1a0a3e'),
  riderGear: new THREE.Color('#1a2a4e'),
  glowTeal: new THREE.Color('#00ffff'),
};

const skyVS = `varying vec3 vWorldPosition; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vWorldPosition = wp.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const skyFS = `uniform vec3 zenithColor; uniform vec3 horizonColor; uniform vec3 sunDirection; varying vec3 vWorldPosition; void main() { vec3 dir = normalize(vWorldPosition); float h = dir.y * 0.5 + 0.5; vec3 skyColor = mix(zenithColor, horizonColor, h); skyColor += vec3(1.0, 0.5, 0.2) * smoothstep(0.95, 1.0, max(0.0, dot(dir, sunDirection))) * 0.5; gl_FragColor = vec4(skyColor, 1.0); }`;
const terrainVS = `uniform vec3 cameraPosition; varying vec3 vNormal; varying float vHeight; float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); } float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y); } float fbm(vec2 p) { float v = 0.0, a = 0.5; for(int i=0;i<5;i++) { v+=a*noise(p); p*=2.0; a*=0.5; } return v; } void main() { vec3 pos = position; vec2 uv = (pos.xz - cameraPosition.xz) * 0.01; pos.y += fbm(uv)*8.0 + fbm(uv*5.0)*1.5; vHeight = pos.y; vNormal = normalize(normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0); }`;
const terrainFS = `uniform vec3 shadowColor; uniform vec3 litColor; uniform vec3 lightDirection; varying vec3 vNormal; void main() { float ndotl = dot(normalize(vNormal), normalize(lightDirection)); vec3 baseColor = mix(shadowColor, litColor, ndotl*0.5+0.5); gl_FragColor = vec4(baseColor, 1.0); }`;

class AudioEngine {
  ctx: any | null = null;
  engineOsc: any | null = null;
  engineGain: any | null = null;
  init() {
    this.ctx = new AudioContext();
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 80;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.1;
    this.engineOsc.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    this.engineGain.connect(this.ctx.destination);
  }
  update(speed: any) {
    if (!this.engineOsc || !this.ctx) return;
    this.engineOsc.frequency.setTargetAtTime(60 + speed * 0.3, this.ctx.currentTime, 0.1);
  }
  playGateDrop() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }
}

class TerrainSystem {
  scene: anyScene;
  mesh: anyMesh;
  material: anyShaderMaterial;
  glitter: anyPoints;
  constructor(scene: anyScene) {
    this.scene = scene;
    const geo = new THREE.PlaneGeometry(400, 400, 128, 128);
    geo.rotateX(-Math.PI / 2);
    this.material = new THREE.ShaderMaterial({
      vertexShader: terrainVS,
      fragmentShader: terrainFS,
      uniforms: {
        cameraPosition: { value: new THREE.Vector3() },
        shadowColor: { value: PALETTE.dirtShadow },
        litColor: { value: PALETTE.dirtLit },
        lightDirection: { value: new THREE.Vector3(1, 0.3, 0.5).normalize() },
      },
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.scene.add(this.mesh);
    const gGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      positions[i*3] = (Math.random()-0.5)*200;
      positions[i*3+1] = 0.5 + Math.random()*2;
      positions[i*3+2] = (Math.random()-0.5)*200;
    }
    gGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const gMat = new THREE.PointsMaterial({ color: PALETTE.sunGlow, size: 0.3, transparent: true, opacity: 0.8, blending: anyAdditiveBlending });
    this.glitter = new THREE.Points(gGeo, gMat);
    this.scene.add(this.glitter);
  }
  update(cam: anyCamera) {
    this.material.uniforms.cameraPosition.value.copy(cam.position);
    this.mesh.position.x = cam.position.x;
    this.mesh.position.z = cam.position.z;
    this.glitter.position.x = cam.position.x;
    this.glitter.position.z = cam.position.z;
  }
  getHeight(x: any, z: any): any {
    const s = 0.01;
    return Math.sin(x*s*2)*Math.cos(z*s*2)*4 + Math.sin(x*s*10+z*s*10)*0.5;
  }
}

class BikeMesh {
  group: anyGroup;
  constructor() {
    this.group = new THREE.Group();
    const frameGeo = new THREE.BoxGeometry(0.4, 0.3, 1.2);
    const frameMat = new THREE.MeshToonMaterial({ color: PALETTE.bikeFrame });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = 0.6;
    this.group.add(frame);
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.15, 16);
    wheelGeo.rotateZ(Math.PI/2);
    const wheelMat = new THREE.MeshToonMaterial({ color: 0x222222 });
    const wf = new THREE.Mesh(wheelGeo, wheelMat);
    wf.position.set(0, 0.4, 0.7);
    this.group.add(wf);
    const wr = new THREE.Mesh(wheelGeo, wheelMat);
    wr.position.set(0, 0.4, -0.6);
    this.group.add(wr);
    const bodyGeo = new THREE.CapsuleGeometry(0.15, 0.4, 4, 8);
    const bodyMat = new THREE.MeshToonMaterial({ color: PALETTE.riderGear });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.0;
    this.group.add(body);
    const headGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.y = 1.45;
    this.group.add(head);
  }
  update(throttle: any, lean: any) {
    this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, -lean*0.5, 0.1);
    this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, -throttle*0.1, 0.1);
  }
}

class AIRider {
  bike: any;
  spline: anyCatmullRomCurve3;
  progress: any;
  speed: any;
  personality: any;
  constructor(spline: anyCatmullRomCurve3, personality: any) {
    this.bike = new BikeMesh();
    this.spline = spline;
    this.progress = Math.random() * 0.1;
    this.speed = 0;
    this.personality = personality;
  }
  update(delta: any, playerProg: any) {
    let mod = 1.0;
    if (playerProg - this.progress > 0.1) mod = 1.05;
    else if (this.progress - playerProg > 0.05) mod = 0.95;
    if (this.personality === 'aggressive') mod *= 1.02;
    if (this.personality === 'erratic') mod *= (0.95 + Math.random()*0.1);
    this.speed = THREE.MathUtils.lerp(this.speed, 20*mod, delta*0.5);
    this.progress += (this.speed * delta) / this.spline.getLength();
    if (this.progress >= 1) this.progress = 0;
    const pt = this.spline.getPointAt(this.progress);
    const tan = this.spline.getTangentAt(this.progress);
    this.bike.group.position.copy(pt);
    this.bike.group.lookAt(pt.clone().add(tan));
    this.bike.update(0.5, Math.sin(this.progress*Math.PI*8)*0.3);
  }
}

class HUD {
  speedEl: any;
  lapEl: any;
  posEl: any;
  constructor() {
    const c = document.getElementById('hud')!;
    c.innerHTML = '<div style="position:absolute;bottom:20px;left:20px;font-family:monospace;color:#fff;text-shadow:2px 2px 0 #1a0a3e"><div id="speed" style="font-size:48px;font-weight:bold">0</div><div style="font-size:14px;color:#ffaa55">KM/H</div></div><div style="position:absolute;top:20px;left:20px;font-family:monospace;color:#fff;text-shadow:2px 2px 0 #1a0a3e"><div id="lap" style="font-size:24px">LAP 1/3</div><div id="pos" style="font-size:32px;font-weight:bold;color:#00ffff">POS 4</div></div><div id="countdown" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:120px;font-family:monospace;color:#ffaa55;text-shadow:4px 4px 0 #1a0a3e;display:none"></div><div id="results" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(26,10,62,0.9);padding:40px;border:3px solid #ffaa55;display:none;text-align:center;color:#fff;font-family:monospace"><h2 style="font-size:48px;margin-bottom:20px;color:#ffaa55">RACE COMPLETE</h2><div id="finalPos" style="font-size:32px;margin-bottom:20px"></div><button id="restartBtn" style="padding:15px 30px;font-size:20px;background:#ff4444;color:#fff;border:none;cursor:pointer;font-family:monospace">RACE AGAIN</button></div>';
    this.speedEl = document.getElementById('speed')!;
    this.lapEl = document.getElementById('lap')!;
    this.posEl = document.getElementById('pos')!;
  }
  update(speed: any, lap: any, pos: any) {
    this.speedEl.textContent = Math.floor(speed).toString();
    this.lapEl.textContent = 'LAP '+lap+'/3';
    this.posEl.textContent = 'POS '+pos;
  }
  showCountdown(n: any|string) {
    const el = document.getElementById('countdown')!;
    el.textContent = n.toString();
    el.style.display = 'block';
  }
  hideCountdown() { document.getElementById('countdown')!.style.display = 'none'; }
  showResults(pos: any, onRestart: () => void) {
    document.getElementById('results')!.style.display = 'block';
    document.getElementById('finalPos')!.textContent = pos===1?'1ST PLACE!':pos+'TH PLACE';
    document.getElementById('restartBtn')!.addEventListener('click', onRestart);
  }
}

class Game {
  scene: anyScene;
  camera: anyPerspectiveCamera;
  renderer: anyWebGLRenderer;
  terrain: any;
  playerBike: any;
  aiRiders: any[];
  audio: any;
  hud: any;
  trackSpline: anyCatmullRomCurve3;
  playerProgress = 0;
  playerSpeed = 0;
  currentLap = 1;
  raceStarted = false;
  raceFinished = false;
  keys: {[k:string]:boolean} = {};
  throttle = 0;
  steer = 0;
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 5, -10);
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(this.renderer.domElement);
    this.terrain = new TerrainSystem(this.scene);
    this.playerBike = new BikeMesh();
    this.scene.add(this.playerBike.group);
    this.audio = new AudioEngine();
    this.hud = new HUD();
    this.trackSpline = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0,0,0), new THREE.Vector3(50,2,100), new THREE.Vector3(100,0,150),
      new THREE.Vector3(150,-2,100), new THREE.Vector3(200,0,50), new THREE.Vector3(250,3,0),
      new THREE.Vector3(200,0,-50), new THREE.Vector3(150,-1,-100), new THREE.Vector3(100,0,-150),
      new THREE.Vector3(50,2,-100), new THREE.Vector3(0,0,-50),
    ], true);
    this.aiRiders = [new AIRider(this.trackSpline,'aggressive'), new AIRider(this.trackSpline,'clean'), new AIRider(this.trackSpline,'erratic')];
    this.aiRiders.forEach(ai => this.scene.add(ai.bike.group));
    this.scene.add(new THREE.AmbientLight(PALETTE.skyHorizon, 0.5));
    const sun = new THREE.DirectionalLight(PALETTE.sunGlow, 1.5);
    sun.position.set(100, 30, 50);
    this.scene.add(sun);
    const skyGeo = new THREE.SphereGeometry(400, 32, 32);
    const skyMat = new THREE.ShaderMaterial({ vertexShader: skyVS, fragmentShader: skyFS, uniforms: { zenithColor: { value: PALETTE.skyZenith }, horizonColor: { value: PALETTE.skyHorizon }, sunDirection: { value: new THREE.Vector3(1,0.3,0.5).normalize() } }, side: anyBackSide });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));
    const linePts = [];
    for (let i = 0; i <= 100; i++) linePts.push(this.trackSpline.getPoint(i/100));
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
    const lineMat = new THREE.LineBasicMaterial({ color: PALETTE.glowTeal, transparent: true, opacity: 0.7 });
    this.scene.add(new THREE.Line(lineGeo, lineMat));
    window.addEventListener('keydown', e => this.keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', e => this.keys[e.key.toLowerCase()] = false);
    window.addEventListener('resize', () => this.onResize());
    setTimeout(() => this.startCountdown(), 1000);
  }
  startCountdown() {
    let c = 3;
    const int = setInterval(() => {
      if (c > 0) { this.hud.showCountdown(c); c--; }
      else if (c === 0) { this.hud.showCountdown('GO!'); this.raceStarted = true; this.audio.playGateDrop(); clearInterval(int); setTimeout(() => this.hud.hideCountdown(), 1000); }
    }, 1000);
  }
  updatePhysics(delta: any) {
    if (!this.raceStarted || this.raceFinished) return;
    const tThrottle = (this.keys['w']||this.keys['arrowup'])?1:0;
    const tSteer = ((this.keys['d']||this.keys['arrowright'])?1:0)-((this.keys['a']||this.keys['arrowleft'])?1:0);
    this.throttle = THREE.MathUtils.lerp(this.throttle, tThrottle, delta*5);
    this.steer = THREE.MathUtils.lerp(this.steer, tSteer, delta*5);
    this.playerSpeed += 25*this.throttle*delta - 0.5*delta;
    this.playerSpeed = Math.max(0, Math.min(this.playerSpeed, 45));
    const next = this.playerProgress + (this.playerSpeed*delta)/this.trackSpline.getLength();
    if (next >= 1) { if (this.currentLap < 3) { this.currentLap++; this.playerProgress = next-1; } else { this.raceFinished = true; this.finishRace(); return; } }
    else { this.playerProgress = next; }
    const pt = this.trackSpline.getPointAt(this.playerProgress);
    const tan = this.trackSpline.getTangentAt(this.playerProgress);
    const lat = this.steer*(this.playerSpeed/45)*3;
    const norm = new THREE.Vector3(-tan.z, 0, tan.x);
    pt.add(norm.multiplyScalar(lat));
    pt.y = this.terrain.getHeight(pt.x, pt.z);
    this.playerBike.group.position.lerp(pt, delta*10);
    this.playerBike.group.lookAt(pt.clone().add(tan));
    this.playerBike.group.position.y += Math.sin(Date.now()*0.02)*(this.playerSpeed/45)*0.1;
    this.playerBike.update(this.throttle, this.steer);
    this.audio.update(this.playerSpeed);
  }
  updateCamera(delta: any) {
    const bp = this.playerBike.group.position;
    const bf = new THREE.Vector3(0,0,1).applyQuaternion(this.playerBike.group.quaternion);
    const target = bp.clone().sub(bf.multiplyScalar(8)).add(new THREE.Vector3(0,4,0));
    this.camera.position.lerp(target, delta*5);
    this.camera.lookAt(bp.clone().add(new THREE.Vector3(0,1,0)));
  }
  calcPos(): any { let p = 1; this.aiRiders.forEach(ai => { if (ai.progress > this.playerProgress) p++; }); return p; }
  finishRace() { this.hud.showResults(this.calcPos(), () => location.reload()); }
  onResize() { this.camera.aspect = window.innerWidth/window.innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(window.innerWidth, window.innerHeight); }
  animate() {
    requestAnimationFrame(() => this.animate());
    const delta = 0.016;
    this.updatePhysics(delta);
    this.aiRiders.forEach(ai => ai.update(delta, this.playerProgress));
    this.updateCamera(delta);
    this.terrain.update(this.camera);
    this.hud.update(this.playerSpeed, this.currentLap, this.calcPos());
    this.renderer.render(this.scene, this.camera);
  }
}

const game = new Game();
game.audio.init();
game.animate();
