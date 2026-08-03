import * as THREE from 'three';

// ============= CEL SHADING SHADERS =============

const celVertexShader = `
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;
varying vec3 vViewPosition;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
}
`;

const celFragmentShader = `
uniform vec3 lightDirection;
uniform vec3 lightColor;
uniform vec3 ambientColor;
uniform sampler2D rampTexture;
uniform vec3 baseColor;
uniform float specularIntensity;
uniform vec3 specularColor;

varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(lightDirection);
    vec3 viewDir = normalize(vViewPosition);
    
    float diffuse = dot(normal, lightDir);
    float diffuseClamped = clamp(diffuse, 0.0, 1.0);
    
    // Sample ramp texture for quantized lighting
    vec4 rampColor = texture2D(rampTexture, vec2(diffuseClamped, 0.5));
    
    // Ambient
    vec3 finalColor = ambientColor * baseColor;
    
    // Add ramp-based diffuse
    finalColor += rampColor.rgb * lightColor * baseColor;
    
    // Banded specular
    float specular = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 32.0);
    float specularBand = step(0.3, specular) * specularIntensity;
    finalColor += specularColor * specularBand;
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

const outlineVertexShader = `
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    vec3 newPosition = position + normal * 0.02;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

const outlineFragmentShader = `
uniform vec3 outlineColor;

void main() {
    gl_FragColor = vec4(outlineColor, 1.0);
}
`;

const skyVertexShader = `
varying vec3 vWorldPosition;
void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const skyFragmentShader = `
uniform vec3 zenithColor;
uniform vec3 horizonColor;
varying vec3 vWorldPosition;

void main() {
    float h = normalize(vWorldPosition).y;
    vec3 color = mix(horizonColor, zenithColor, smoothstep(-1.0, 1.0, h));
    
    // Quantize into bands
    float band = floor(h * 4.0) / 4.0;
    band = smoothstep(-1.0, 1.0, band);
    color = mix(horizonColor, zenithColor, band);
    
    gl_FragColor = vec4(color, 1.0);
}
`;

const terrainVertexShader = `
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;
varying float vHeight;

uniform float time;

// Simplex noise function
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float getTerrainHeight(vec2 pos) {
    vec2 p = pos * 0.01;
    float height = snoise(vec3(p.x, p.y, time * 0.0)) * 5.0;
    height += snoise(vec3(p.x * 3.0, p.y * 3.0, time * 0.0)) * 2.0;
    height += snoise(vec3(p.x * 8.0, p.y * 8.0, time * 0.0)) * 0.5;
    return height;
}

void main() {
    vUv = uv;
    float height = getTerrainHeight(position.xz);
    vHeight = height;
    vec3 newPos = position;
    newPos.y = height;
    vPosition = (modelMatrix * vec4(newPos, 1.0)).xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(vPosition, 1.0);
}
`;

const terrainFragmentShader = `
uniform vec3 sunColor;
uniform vec3 shadowColor;
uniform vec3 lightDirection;
varying vec3 vNormal;
varying float vHeight;

void main() {
    float diffuse = dot(normalize(vNormal), normalize(lightDirection));
    
    // Quantized color bands based on lighting and height
    vec3 color;
    if (diffuse > 0.7) {
        color = vec3(1.0, 0.42, 0.21); // Warm orange in direct sun
    } else if (diffuse > 0.3) {
        color = vec3(0.8, 0.5, 0.2); // Ochre in partial light
    } else if (diffuse > 0.0) {
        color = vec3(0.4, 0.3, 0.5); // Purple in shadow
    } else {
        color = shadowColor; // Deep indigo in full shadow
    }
    
    // Height-based variation
    color *= 0.8 + 0.2 * sin(vHeight * 0.5);
    
    gl_FragColor = vec4(color, 1.0);
}
`;

// ============= TEXTURE GENERATION =============

function createRampTexture(): THREE.DataTexture {
    const data = new Uint8Array(256 * 4);
    const colors = [
        [40, 20, 60],   // Deep shadow - indigo
        [80, 50, 100],  // Shadow mid
        [150, 100, 80], // Lit mid
        [255, 150, 80], // Full sun - orange
    ];
    
    for (let i = 0; i < 256; i++) {
        const band = Math.floor(i / 64);
        const t = (i % 64) / 64;
        const c1 = colors[Math.min(band, 3)];
        const c2 = colors[Math.min(band + 1, 3)];
        
        // Hard transition - no interpolation within bands
        const hardT = t > 0.5 ? 1 : 0;
        
        const r = Math.round(c1[0] + (c2[0] - c1[0]) * hardT);
        const g = Math.round(c1[1] + (c2[1] - c1[1]) * hardT);
        const b = Math.round(c1[2] + (c2[2] - c1[2]) * hardT);
        
        data[i * 4 + 0] = r;
        data[i * 4 + 1] = g;
        data[i * 4 + 2] = b;
        data[i * 4 + 3] = 255;
    }
    
    const texture = new THREE.DataTexture(data, 256, 1, THREE.RGBAFormat);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
}

function createSunTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, '#ffaa00');
    gradient.addColorStop(0.3, '#ff6b35');
    gradient.addColorStop(0.6, '#ff356b');
    gradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

// ============= AUDIO SYSTEM =============

class AudioEngine {
    context: AudioContext | null = null;
    engineOscillator: OscillatorNode | null = null;
    engineGain: GainNode | null = null;
    
    init() {
        this.context = new AudioContext();
    }
    
    startEngine() {
        if (!this.context) return;
        
        this.engineOscillator = this.context.createOscillator();
        this.engineGain = this.context.createGain();
        
        this.engineOscillator.type = 'sawtooth';
        this.engineOscillator.frequency.value = 100;
        this.engineGain.gain.value = 0.1;
        
        this.engineOscillator.connect(this.engineGain);
        this.engineGain.connect(this.context.destination);
        this.engineOscillator.start();
    }
    
    updateEngine(rpm: number) {
        if (!this.engineOscillator || !this.context) return;
        const freq = 80 + rpm * 0.5;
        this.engineOscillator.frequency.setTargetAtTime(freq, this.context.currentTime, 0.1);
    }
    
    playLandingSound() {
        if (!this.context) return;
        
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, this.context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.context.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.3);
        
        osc.connect(gain);
        gain.connect(this.context.destination);
        osc.start();
        osc.stop(this.context.currentTime + 0.3);
    }
    
    playCountdownSound(num: number) {
        if (!this.context) return;
        
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440 + num * 100, this.context.currentTime);
        gain.gain.setValueAtTime(0.3, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.2);
        
        osc.connect(gain);
        gain.connect(this.context.destination);
        osc.start();
        osc.stop(this.context.currentTime + 0.2);
    }
}

// ============= TERRAIN SYSTEM =============

class TerrainSystem {
    scene: THREE.Scene;
    mesh: THREE.Mesh;
    material: THREE.ShaderMaterial;
    
    constructor(scene: THREE.Scene) {
        this.scene = scene;
        
        const geometry = new THREE.PlaneGeometry(500, 500, 128, 128);
        geometry.rotateX(-Math.PI / 2);
        
        this.material = new THREE.ShaderMaterial({
            vertexShader: terrainVertexShader,
            fragmentShader: terrainFragmentShader,
            uniforms: {
                time: { value: 0 },
                sunColor: { value: new THREE.Color(0xff6b35) },
                shadowColor: { value: new THREE.Color(0x1a0a2e) },
                lightDirection: { value: new THREE.Vector3(1, 0.2, 0.5).normalize() }
            }
        });
        
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.scene.add(this.mesh);
    }
    
    update(time: number) {
        this.material.uniforms.time.value = time;
    }
    
    getHeight(x: number, z: number): number {
        // Simplified height calculation for physics
        const p = new THREE.Vector2(x, z).multiplyScalar(0.01);
        let height = Math.sin(p.x) * Math.cos(p.y) * 5;
        height += Math.sin(p.x * 3) * Math.cos(p.y * 3) * 2;
        height += Math.sin(p.x * 8) * Math.cos(p.y * 8) * 0.5;
        return height;
    }
    
    getNormal(x: number, z: number): THREE.Vector3 {
        const delta = 0.1;
        const hL = this.getHeight(x - delta, z);
        const hR = this.getHeight(x + delta, z);
        const hD = this.getHeight(x, z - delta);
        const hU = this.getHeight(x, z + delta);
        
        const normal = new THREE.Vector3(hL - hR, 2 * delta, hD - hU);
        return normal.normalize();
    }
}

// ============= BIKE PHYSICS =============

interface BikeState {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    rotation: THREE.Euler;
    angularVelocity: THREE.Vector3;
    speed: number;
    rpm: number;
    boost: number;
    airborne: boolean;
    onGround: boolean;
}

class BikePhysics {
    state: BikeState;
    controls = { throttle: 0, brake: 0, steer: 0, jump: false, boost: false };
    
    constructor(startPos: THREE.Vector3) {
        this.state = {
            position: startPos.clone(),
            velocity: new THREE.Vector3(),
            rotation: new THREE.Euler(0, 0, 0, 'YXZ'),
            angularVelocity: new THREE.Vector3(),
            speed: 0,
            rpm: 0,
            boost: 100,
            airborne: false,
            onGround: true
        };
    }
    
    update(dt: number, terrain: TerrainSystem) {
        const { state, controls } = this;
        
        // Acceleration
        const maxSpeed = controls.boost && state.boost > 0 ? 180 : 120;
        const acceleration = controls.throttle * 80 * (1 - state.speed / maxSpeed);
        const braking = controls.brake * 100;
        
        state.speed += (acceleration - braking) * dt;
        state.speed = Math.max(0, Math.min(state.speed, maxSpeed));
        
        // Steering (tighter at high speed)
        const steerFactor = Math.max(0.3, 1 - state.speed / 200);
        state.rotation.y -= controls.steer * 1.5 * steerFactor * dt;
        
        // Calculate direction
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), state.rotation.y);
        
        // Move bike
        state.position.add(direction.multiplyScalar(state.speed * dt));
        
        // Terrain following
        const groundHeight = terrain.getHeight(state.position.x, state.position.z);
        const normal = terrain.getNormal(state.position.x, state.position.z);
        
        if (state.position.y > groundHeight + 0.5) {
            // Airborne
            state.airborne = true;
            state.onGround = false;
            state.velocity.y -= 20 * dt; // Gravity
            
            // Air control
            state.rotation.z -= controls.steer * 0.5 * dt;
            
        } else if (state.position.y <= groundHeight) {
            // Landing
            if (state.airborne && state.velocity.y < -5) {
                // Hard landing
                state.speed *= 0.7;
            }
            
            state.position.y = groundHeight;
            state.velocity.y = 0;
            state.airborne = false;
            state.onGround = true;
            
            // Align to terrain
            const targetPitch = Math.atan2(normal.y, Math.sqrt(normal.x * normal.x + normal.z * normal.z));
            state.rotation.x = THREE.MathUtils.lerp(state.rotation.x, targetPitch, dt * 5);
            state.rotation.z = THREE.MathUtils.lerp(state.rotation.z, -normal.x * 0.3, dt * 5);
        }
        
        state.position.y += state.velocity.y * dt;
        
        // RPM based on speed
        state.rpm = state.speed * 50 + Math.sin(Date.now() * 0.01) * 200;
        
        // Boost regeneration
        if (!controls.boost && state.boost < 100) {
            state.boost += 10 * dt;
        } else if (controls.boost && state.boost > 0) {
            state.boost -= 30 * dt;
        }
        
        return this.state;
    }
}

// ============= BIKE MESH =============

class BikeMesh {
    scene: THREE.Scene;
    group: THREE.Group;
    rampTexture: THREE.DataTexture;
    outlineMaterial: THREE.MeshBasicMaterial;
    
    constructor(scene: THREE.Scene, color: THREE.Color) {
        this.scene = scene;
        this.rampTexture = createRampTexture();
        
        this.group = new THREE.Group();
        
        // Frame
        const frameGeo = new THREE.BoxGeometry(0.3, 0.15, 0.8);
        const frameMat = this.createCelMaterial(color, new THREE.Color(0x1a0a2e));
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.y = 0.5;
        this.group.add(frame);
        
        // Wheels
        const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheelMat = this.createCelMaterial(new THREE.Color(0x222222), new THREE.Color(0x000000));
        
        const frontWheel = new THREE.Mesh(wheelGeo, wheelMat);
        frontWheel.position.set(0, 0.3, 0.6);
        this.group.add(frontWheel);
        
        const rearWheel = new THREE.Mesh(wheelGeo, wheelMat);
        rearWheel.position.set(0, 0.3, -0.5);
        this.group.add(rearWheel);
        
        // Handlebars
        const handlebarGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8);
        handlebarGeo.rotateX(Math.PI / 2);
        const handlebar = new THREE.Mesh(handlebarGeo, this.createCelMaterial(new THREE.Color(0x888888), new THREE.Color(0x444444)));
        handlebar.position.set(0, 0.7, 0.4);
        this.group.add(handlebar);
        
        // Seat
        const seatGeo = new THREE.BoxGeometry(0.25, 0.05, 0.3);
        const seat = new THREE.Mesh(seatGeo, this.createCelMaterial(new THREE.Color(0x333333), new THREE.Color(0x111111)));
        seat.position.set(0, 0.6, -0.2);
        this.group.add(seat);
        
        // Outlines
        this.outlineMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(0x2a1a4e),
            side: THREE.BackSide
        });
        
        this.addOutlines();
        
        scene.add(this.group);
    }
    
    createCelMaterial(baseColor: THREE.Color, shadowColor: THREE.Color): THREE.ShaderMaterial {
        return new THREE.ShaderMaterial({
            vertexShader: celVertexShader,
            fragmentShader: celFragmentShader,
            uniforms: {
                lightDirection: { value: new THREE.Vector3(1, 0.2, 0.5).normalize() },
                lightColor: { value: new THREE.Color(0xffaa55) },
                ambientColor: { value: new THREE.Color(0x332244) },
                rampTexture: { value: this.rampTexture },
                baseColor: { value: baseColor },
                specularIntensity: { value: 0.5 },
                specularColor: { value: new THREE.Color(0xffffff) }
            }
        });
    }
    
    addOutlines() {
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                const outlineMesh = child.clone();
                outlineMesh.material = this.outlineMaterial;
                outlineMesh.scale.multiplyScalar(1.05);
                this.group.add(outlineMesh);
            }
        });
    }
    
    update(state: BikeState) {
        this.group.position.copy(state.position);
        this.group.rotation.set(state.rotation.x, state.rotation.y, state.rotation.z);
    }
    
    dispose() {
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        this.scene.remove(this.group);
    }
}

// ============= RIDER MESH =============

class RiderMesh {
    scene: THREE.Scene;
    group: THREE.Group;
    rampTexture: THREE.DataTexture;
    leftArm: THREE.Mesh;
    rightArm: THREE.Mesh;
    body: THREE.Mesh;
    
    constructor(scene: THREE.Scene, shirtColor: THREE.Color) {
        this.scene = scene;
        this.rampTexture = createRampTexture();
        
        this.group = new THREE.Group();
        
        // Body
        const bodyGeo = new THREE.BoxGeometry(0.25, 0.35, 0.15);
        this.body = new THREE.Mesh(bodyGeo, this.createCelMaterial(shirtColor));
        this.body.position.y = 0.85;
        this.group.add(this.body);
        
        // Head
        const headGeo = new THREE.SphereGeometry(0.12, 16, 16);
        const head = new THREE.Mesh(headGeo, this.createCelMaterial(new THREE.Color(0x333333)));
        head.position.y = 1.1;
        this.group.add(head);
        
        // Arms
        const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.25, 8);
        this.leftArm = new THREE.Mesh(armGeo, this.createCelMaterial(shirtColor));
        this.leftArm.position.set(-0.18, 0.85, 0.15);
        this.leftArm.rotation.x = -0.5;
        this.group.add(this.leftArm);
        
        this.rightArm = new THREE.Mesh(armGeo, this.createCelMaterial(shirtColor));
        this.rightArm.position.set(0.18, 0.85, 0.15);
        this.rightArm.rotation.x = -0.5;
        this.group.add(this.rightArm);
        
        // Legs
        const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.35, 8);
        const leftLeg = new THREE.Mesh(legGeo, this.createCelMaterial(new THREE.Color(0x222244)));
        leftLeg.position.set(-0.1, 0.55, 0);
        this.group.add(leftLeg);
        
        const rightLeg = new THREE.Mesh(legGeo, this.createCelMaterial(new THREE.Color(0x222244)));
        rightLeg.position.set(0.1, 0.55, 0);
        this.group.add(rightLeg);
        
        // Outlines
        const outlineMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(0x2a1a4e),
            side: THREE.BackSide
        });
        
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                const outlineMesh = child.clone();
                outlineMesh.material = outlineMaterial;
                outlineMesh.scale.multiplyScalar(1.08);
                this.group.add(outlineMesh);
            }
        });
        
        scene.add(this.group);
    }
    
    createCelMaterial(baseColor: THREE.Color): THREE.ShaderMaterial {
        return new THREE.ShaderMaterial({
            vertexShader: celVertexShader,
            fragmentShader: celFragmentShader,
            uniforms: {
                lightDirection: { value: new THREE.Vector3(1, 0.2, 0.5).normalize() },
                lightColor: { value: new THREE.Color(0xffaa55) },
                ambientColor: { value: new THREE.Color(0x332244) },
                rampTexture: { value: this.rampTexture },
                baseColor: { value: baseColor },
                specularIntensity: { value: 0.3 },
                specularColor: { value: new THREE.Color(0xffffff) }
            }
        });
    }
    
    update(bikeState: BikeState, isPlayer: boolean) {
        this.group.position.copy(bikeState.position);
        this.group.rotation.copy(bikeState.rotation);
        this.group.position.y += 0.35;
        
        // Animation
        if (bikeState.airborne) {
            this.leftArm.rotation.x = -1.0;
            this.rightArm.rotation.x = -1.0;
            this.body.rotation.x = 0.2;
        } else if (bikeState.speed > 50) {
            const pump = Math.sin(Date.now() * 0.015) * 0.1;
            this.leftArm.rotation.x = -0.5 + pump;
            this.rightArm.rotation.x = -0.5 - pump;
            this.body.rotation.x = -0.1;
        } else {
            this.leftArm.rotation.x = -0.5;
            this.rightArm.rotation.x = -0.5;
            this.body.rotation.x = 0;
        }
    }
}

// ============= AI RIDER =============

class AIRider {
    physics: BikePhysics;
    mesh: BikeMesh;
    rider: RiderMesh;
    spline: THREE.CatmullRomCurve3;
    progress: number;
    personality: 'aggressive' | 'clean' | 'erratic';
    mistakes: number;
    
    constructor(scene: THREE.Scene, spline: THREE.CatmullRomCurve3, startPos: THREE.Vector3, color: THREE.Color, personality: 'aggressive' | 'clean' | 'erratic') {
        this.physics = new BikePhysics(startPos);
        this.mesh = new BikeMesh(scene, color);
        this.rider = new RiderMesh(scene, color);
        this.spline = spline;
        this.progress = 0;
        this.personality = personality;
        this.mistakes = 0;
    }
    
    update(dt: number, terrain: TerrainSystem, playerProgress: number) {
        // Follow spline with lookahead
        const lookahead = 0.005 + (this.personality === 'aggressive' ? 0.003 : this.personality === 'erratic' ? 0.001 : 0.002);
        this.progress += lookahead * (1 + Math.random() * 0.1);
        
        if (this.progress > 1) {
            this.progress = 0;
        }
        
        // Get target point on spline
        const targetPoint = this.spline.getPointAt(this.progress);
        const nextPoint = this.spline.getPointAt(Math.min(this.progress + 0.05, 1));
        
        // Steer toward target
        const direction = new THREE.Vector3().subVectors(nextPoint, targetPoint).normalize();
        const currentDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.physics.state.rotation.y);
        
        const cross = currentDir.cross(direction).y;
        this.physics.controls.steer = Math.sign(cross) * Math.min(1, Math.abs(cross) * 2);
        
        // Throttle
        this.physics.controls.throttle = 0.8 + (this.personality === 'aggressive' ? 0.2 : 0);
        
        // Occasional mistakes
        if (this.personality === 'erratic' && Math.random() < 0.01) {
            this.mistakes++;
            this.physics.controls.throttle = 0;
            this.physics.controls.brake = 0.5;
        }
        
        // Rubber banding
        const progressDiff = playerProgress - this.progress;
        if (progressDiff > 0.1) {
            this.physics.controls.throttle = 1.0;
        } else if (progressDiff < -0.1) {
            this.physics.controls.throttle = 0.6;
        }
        
        this.physics.update(dt, terrain);
        this.mesh.update(this.physics.state);
        this.rider.update(this.physics.state, false);
    }
}

// ============= RACE TRACK =============

class RaceTrack {
    scene: THREE.Scene;
    spline: THREE.CatmullRomCurve3;
    ribbonMesh: THREE.Mesh;
    checkpoints: THREE.Mesh[];
    startLine: THREE.Vector3;
    finishLine: THREE.Vector3;
    
    constructor(scene: THREE.Scene) {
        this.scene = scene;
        
        // Create interesting circuit
        const points = [
            new THREE.Vector3(0, 0, 0),           // Start/Finish
            new THREE.Vector3(50, 0, -100),       // Fast straight
            new THREE.Vector3(100, 0, -150),      // Into hairpin
            new THREE.Vector3(150, 0, -100),      // Hairpin apex
            new THREE.Vector3(200, 0, -50),       // Exit hairpin
            new THREE.Vector3(250, 0, 0),         // Sweeper entry
            new THREE.Vector3(280, 0, 50),        // Sweeper mid
            new THREE.Vector3(250, 0, 100),       // Sweeper exit
            new THREE.Vector3(200, 0, 120),       // Chicane 1
            new THREE.Vector3(180, 0, 100),       // Chicane 2
            new THREE.Vector3(150, 0, 120),       // Whoops entry
            new THREE.Vector3(100, 0, 120),       // Whoops
            new THREE.Vector3(50, 0, 100),        // Tabletop approach
            new THREE.Vector3(0, 5, 50),          // Tabletop (jump!)
            new THREE.Vector3(-50, 0, 50),        // Landing
            new THREE.Vector3(-80, 0, 0),         // Back straight
            new THREE.Vector3(-50, 0, -50),       // Turn 1
            new THREE.Vector3(0, 0, -50),         // Turn 2
        ];
        
        this.spline = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);
        this.startLine = points[0];
        this.finishLine = points[0];
        
        // Racing line ribbon
        const ribbonGeo = new THREE.TubeGeometry(this.spline, 200, 0.5, 3, true);
        const ribbonMat = new THREE.ShaderMaterial({
            vertexShader: celVertexShader,
            fragmentShader: `
                uniform vec3 glowColor;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                
                void main() {
                    vec3 normal = normalize(vNormal);
                    vec3 viewDir = normalize(vViewPosition);
                    float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 2.0);
                    gl_FragColor = vec4(glowColor * fresnel, 0.8);
                }
            `,
            uniforms: {
                glowColor: { value: new THREE.Color(0x00d4aa) }
            },
            transparent: true,
            side: THREE.DoubleSide
        });
        
        this.ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
        this.scene.add(this.ribbonMesh);
        
        // Checkpoint gates
        this.checkpoints = [];
        const checkpointPositions = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85];
        
        checkpointPositions.forEach(t => {
            const point = this.spline.getPointAt(t);
            const tangent = this.spline.getTangentAt(t);
            
            const gateGeo = new THREE.TorusGeometry(8, 0.3, 8, 16);
            const gateMat = new THREE.ShaderMaterial({
                vertexShader: celVertexShader,
                fragmentShader: celFragmentShader,
                uniforms: {
                    lightDirection: { value: new THREE.Vector3(1, 0.2, 0.5).normalize() },
                    lightColor: { value: new THREE.Color(0xffaa55) },
                    ambientColor: { value: new THREE.Color(0x332244) },
                    rampTexture: { value: createRampTexture() },
                    baseColor: { value: new THREE.Color(0x00d4aa) },
                    specularIntensity: { value: 0.8 },
                    specularColor: { value: new THREE.Color(0xffffff) }
                }
            });
            
            const gate = new THREE.Mesh(gateGeo, gateMat);
            gate.position.copy(point);
            gate.lookAt(point.clone().add(tangent));
            gate.rotation.x += Math.PI / 2;
            
            this.scene.add(gate);
            this.checkpoints.push(gate);
        });
    }
    
    getProgress(position: THREE.Vector3): number {
        let closestT = 0;
        let closestDist = Infinity;
        
        for (let t = 0; t <= 1; t += 0.01) {
            const point = this.spline.getPointAt(t);
            const dist = position.distanceTo(point);
            if (dist < closestDist) {
                closestDist = dist;
                closestT = t;
            }
        }
        
        return closestT;
    }
}

// ============= DUST PARTICLES =============

class DustSystem {
    scene: THREE.Scene;
    particles: THREE.Points[];
    material: THREE.ShaderMaterial;
    
    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.particles = [];
        
        this.material = new THREE.ShaderMaterial({
            vertexShader: `
                attribute float size;
                attribute vec3 customColor;
                varying vec3 vColor;
                void main() {
                    vColor = customColor;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                void main() {
                    float r = distance(gl_PointCoord, vec2(0.5, 0.5));
                    if (r > 0.5) discard;
                    float alpha = 1.0 - r * 2.0;
                    gl_FragColor = vec4(vColor, alpha);
                }
            `,
            transparent: true,
            vertexColors: true
        });
    }
    
    emit(position: THREE.Vector3, velocity: THREE.Vector3, count: number, color: THREE.Color) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const colors = new Float32Array(count * 3);
        
        for (let i = 0; i < count; i++) {
            positions[i * 3 + 0] = position.x + (Math.random() - 0.5) * 0.5;
            positions[i * 3 + 1] = position.y + (Math.random() - 0.5) * 0.5;
            positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.5;
            
            velocities[i * 3 + 0] = velocity.x * 0.5 + (Math.random() - 0.5) * 5;
            velocities[i * 3 + 1] = Math.random() * 5;
            velocities[i * 3 + 2] = velocity.z * 0.5 + (Math.random() - 0.5) * 5;
            
            sizes[i] = Math.random() * 0.5 + 0.2;
            colors[i * 3 + 0] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const points = new THREE.Points(geometry, this.material);
        (points as any).velocities = velocities;
        (points as any).age = 0;
        
        this.scene.add(points);
        this.particles.push(points);
    }
    
    update(dt: number) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            const geometry = particle.geometry as THREE.BufferGeometry;
            const positions = geometry.attributes.position.array as Float32Array;
            const velocities = (particle as any).velocities as Float32Array;
            
            (particle as any).age += dt;
            
            for (let j = 0; j < positions.length / 3; j++) {
                positions[j * 3 + 0] += velocities[j * 3 + 0] * dt;
                positions[j * 3 + 1] += velocities[j * 3 + 1] * dt - 2 * dt;
                positions[j * 3 + 2] += velocities[j * 3 + 2] * dt;
            }
            
            geometry.attributes.position.needsUpdate = true;
            
            if ((particle as any).age > 2) {
                this.scene.remove(particle);
                geometry.dispose();
                this.particles.splice(i, 1);
            }
        }
    }
}

// ============= MAIN GAME =============

class Game {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    terrain: TerrainSystem;
    track: RaceTrack;
    playerPhysics: BikePhysics;
    playerBike: BikeMesh;
    playerRider: RiderMesh;
    aiRiders: AIRider[];
    dustSystem: DustSystem;
    audio: AudioEngine;
    
    raceActive = false;
    lap = 1;
    totalLaps = 3;
    lastCheckpoint = 0;
    startTime = 0;
    finishTimes: { position: number; time: number }[] = [];
    
    keys: { [key: string]: boolean } = {};
    
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(this.renderer.domElement);
        
        // Initialize systems
        this.terrain = new TerrainSystem(this.scene);
        this.track = new RaceTrack(this.scene);
        this.dustSystem = new DustSystem(this.scene);
        this.audio = new AudioEngine();
        
        // Player
        this.playerPhysics = new BikePhysics(this.track.startLine.clone());
        this.playerBike = new BikeMesh(this.scene, new THREE.Color(0xff4444));
        this.playerRider = new RiderMesh(this.scene, new THREE.Color(0xff6666));
        
        // AI riders
        this.aiRiders = [
            new AIRider(this.scene, this.track.spline, this.track.startLine.clone().add(new THREE.Vector3(-5, 0, 0)), new THREE.Color(0x4444ff), 'aggressive'),
            new AIRider(this.scene, this.track.spline, this.track.startLine.clone().add(new THREE.Vector3(5, 0, 0)), new THREE.Color(0x44ff44), 'clean'),
            new AIRider(this.scene, this.track.spline, this.track.startLine.clone().add(new THREE.Vector3(-3, 0, 5)), new THREE.Color(0xffff44), 'erratic')
        ];
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0x403060, 0.5);
        this.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffaa55, 1);
        dirLight.position.set(100, 20, 50);
        this.scene.add(dirLight);
        
        // Sky dome
        this.createSky();
        
        // Event listeners
        window.addEventListener('resize', () => this.onResize());
        window.addEventListener('keydown', (e) => this.keys[e.key.toLowerCase()] = true);
        window.addEventListener('keyup', (e) => this.keys[e.key.toLowerCase()] = false);
        
        // UI buttons
        document.getElementById('start-btn')!.addEventListener('click', () => this.startRace());
        document.getElementById('restart-btn')!.addEventListener('click', () => this.restartRace());
        
        // Start loop
        this.animate();
    }
    
    createSky() {
        const skyGeo = new THREE.SphereGeometry(400, 32, 32);
        const skyMat = new THREE.ShaderMaterial({
            vertexShader: skyVertexShader,
            fragmentShader: skyFragmentShader,
            uniforms: {
                zenithColor: { value: new THREE.Color(0x1a0a2e) },
                horizonColor: { value: new THREE.Color(0xff6b35) }
            },
            side: THREE.BackSide
        });
        
        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);
        
        // Sun disc
        const sunGeo = new THREE.PlaneGeometry(30, 30);
        const sunMat = new THREE.MeshBasicMaterial({
            map: createSunTexture(),
            transparent: true,
            blending: THREE.AdditiveBlending
        });
        const sun = new THREE.Mesh(sunGeo, sunMat);
        sun.position.set(50, 10, -100);
        sun.lookAt(new THREE.Vector3(0, 0, 0));
        this.scene.add(sun);
    }
    
    startRace() {
        document.getElementById('start-screen')!.classList.add('hidden');
        document.getElementById('hud')!.classList.add('active');
        
        this.audio.init();
        this.audio.startEngine();
        
        // Countdown
        let count = 3;
        const countdownEl = document.getElementById('countdown')!;
        
        const countInterval = setInterval(() => {
            this.audio.playCountdownSound(count);
            countdownEl.textContent = count.toString();
            countdownEl.classList.add('active');
            
            setTimeout(() => {
                countdownEl.classList.remove('active');
            }, 500);
            
            count--;
            
            if (count < 0) {
                clearInterval(countInterval);
                this.raceActive = true;
                this.startTime = Date.now();
            }
        }, 1000);
    }
    
    restartRace() {
        // Reset player
        this.playerPhysics = new BikePhysics(this.track.startLine.clone());
        this.playerBike.update(this.playerPhysics.state);
        this.playerRider.update(this.playerPhysics.state, true);
        
        // Reset AI
        this.aiRiders.forEach((ai, i) => {
            ai.physics = new BikePhysics(this.track.startLine.clone().add(new THREE.Vector3([-5, 5, -3, 0][i], 0, [0, 0, 5, 10][i])));
            ai.progress = 0;
        });
        
        // Reset race state
        this.raceActive = false;
        this.lap = 1;
        this.lastCheckpoint = 0;
        this.finishTimes = [];
        
        document.getElementById('results')!.classList.remove('active');
        document.getElementById('current-lap').textContent = '1';
        document.getElementById('current-pos').textContent = '4';
        
        this.startRace();
    }
    
    updatePlayerControls() {
        this.playerPhysics.controls.throttle = this.keys['w'] || this.keys['arrowup'] ? 1 : 0;
        this.playerPhysics.controls.brake = this.keys['s'] || this.keys['arrowdown'] ? 1 : 0;
        this.playerPhysics.controls.steer = (this.keys['a'] || this.keys['arrowleft'] ? 1 : 0) - (this.keys['d'] || this.keys['arrowright'] ? 1 : 0);
        this.playerPhysics.controls.jump = this.keys[' '];
        this.playerPhysics.controls.boost = this.keys['shift'];
    }
    
    updateCamera() {
        const bikePos = this.playerPhysics.state.position;
        const bikeRot = this.playerPhysics.state.rotation;
        
        // Chase camera
        const offset = new THREE.Vector3(0, 3, 8);
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), bikeRot.y);
        
        const targetPos = bikePos.clone().add(offset);
        this.camera.position.lerp(targetPos, 0.1);
        this.camera.lookAt(bikePos.clone().add(new THREE.Vector3(0, 1, 0)));
        
        // FOV kick with speed
        const speed = this.playerPhysics.state.speed;
        this.camera.fov = THREE.MathUtils.lerp(75, 90, Math.min(speed / 150, 1));
        this.camera.updateProjectionMatrix();
    }
    
    updateHUD() {
        const state = this.playerPhysics.state;
        
        // Speed
        document.getElementById('speed-value')!.textContent = Math.round(state.speed);
        
        // Lap
        document.getElementById('current-lap')!.textContent = this.lap.toString();
        
        // Position
        const playerProgress = this.track.getProgress(state.position) + (this.lap - 1);
        const aiProgresses = this.aiRiders.map(ai => ai.progress + (ai.physics.state.position.distanceTo(state.position) > 50 ? 0 : 0));
        let position = 1;
        aiProgresses.forEach(p => { if (p > playerProgress) position++; });
        document.getElementById('current-pos')!.textContent = position.toString();
        
        // Boost
        document.getElementById('boost-fill')!.style.width = `${state.boost}%`;
        
        // Minimap
        this.drawMinimap();
    }
    
    drawMinimap() {
        const canvas = document.getElementById('minimap') as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw track
        ctx.strokeStyle = '#00d4aa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let t = 0; t <= 1; t += 0.01) {
            const point = this.track.spline.getPointAt(t);
            const x = 90 + point.x * 0.3;
            const y = 60 + point.z * 0.3;
            
            if (t === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        
        // Draw riders
        const riders = [
            { pos: this.playerPhysics.state.position, color: '#ff4444' },
            ...this.aiRiders.map(ai => ({ pos: ai.physics.state.position, color: '#4444ff' }))
        ];
        
        riders.forEach(r => {
            const x = 90 + r.pos.x * 0.3;
            const y = 60 + r.pos.z * 0.3;
            ctx.fillStyle = r.color;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    
    showResults() {
        document.getElementById('hud')!.classList.remove('active');
        const resultsEl = document.getElementById('results')!;
        resultsEl.classList.add('active');
        
        const listEl = document.getElementById('results-list')!;
        listEl.innerHTML = '';
        
        const finalTimes = [
            { pos: 1, time: this.finishTimes.find(t => t.position === 1)?.time || 0 },
            { pos: 2, time: this.finishTimes.find(t => t.position === 2)?.time || 0 },
            { pos: 3, time: this.finishTimes.find(t => t.position === 3)?.time || 0 },
            { pos: 4, time: this.finishTimes.find(t => t.position === 4)?.time || 0 }
        ].sort((a, b) => a.time - b.time);
        
        finalTimes.forEach((result, i) => {
            const row = document.createElement('div');
            row.className = 'result-row';
            const minutes = Math.floor(result.time / 60000);
            const seconds = ((result.time % 60000) / 1000).toFixed(2);
            row.innerHTML = `<span>${i + 1}${['st', 'nd', 'rd'][i] || 'th'}</span><span>${minutes}:${seconds}</span>`;
            listEl.appendChild(row);
        });
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const dt = 0.016;
        const time = Date.now() * 0.001;
        
        // Update terrain
        this.terrain.update(time);
        
        if (this.raceActive) {
            // Update player
            this.updatePlayerControls();
            this.playerPhysics.update(dt, this.terrain);
            this.playerBike.update(this.playerPhysics.state);
            this.playerRider.update(this.playerPhysics.state, true);
            
            // Dust emission
            if (this.playerPhysics.state.speed > 30 && this.playerPhysics.state.onGround) {
                const velocity = new THREE.Vector3(0, 0, -this.playerPhysics.state.speed * 0.5);
                velocity.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerPhysics.state.rotation.y);
                this.dustSystem.emit(this.playerPhysics.state.position.clone().add(new THREE.Vector3(0, 0.2, 0.5)), velocity, 5, new THREE.Color(0xcc8855));
            }
            
            // Update AI
            const playerProgress = this.track.getProgress(this.playerPhysics.state.position);
            this.aiRiders.forEach(ai => ai.update(dt, this.terrain, playerProgress));
            
            // Update dust
            this.dustSystem.update(dt);
            
            // Lap counting
            const currentProgress = this.track.getProgress(this.playerPhysics.state.position);
            if (currentProgress < this.lastCheckpoint && currentProgress < 0.1) {
                this.lap++;
                if (this.lap > this.totalLaps) {
                    this.raceActive = false;
                    const totalTime = Date.now() - this.startTime;
                    this.finishTimes.push({ position: 4, time: totalTime });
                    this.showResults();
                } else {
                    document.getElementById('current-lap')!.textContent = this.lap.toString();
                }
            }
            this.lastCheckpoint = currentProgress;
            
            // Update audio
            this.audio.updateEngine(this.playerPhysics.state.rpm);
        }
        
        // Camera
        this.updateCamera();
        
        // HUD
        if (this.raceActive) {
            this.updateHUD();
        }
        
        // Render
        this.renderer.render(this.scene, this.camera);
    }
    
    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Start game
new Game();
