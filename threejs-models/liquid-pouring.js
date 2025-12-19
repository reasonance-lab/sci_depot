import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================
// SCENE SETUP
// ============================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
);
camera.position.set(0, 5, 12);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// Controls - orbit only with right mouse button
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 5;
controls.maxDistance = 25;
controls.mouseButtons = {
    LEFT: null, // Disable left click for orbit (we use it for dragging)
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE
};

// ============================================
// ENVIRONMENT MAP
// ============================================
function createEnvironmentMap() {
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256);
    cubeRenderTarget.texture.type = THREE.HalfFloatType;

    const envScene = new THREE.Scene();
    const envGeometry = new THREE.SphereGeometry(50, 32, 32);
    const envMaterial = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
            topColor: { value: new THREE.Color(0x88aacc) },
            bottomColor: { value: new THREE.Color(0x223344) },
            offset: { value: 10 },
            exponent: { value: 0.6 }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize(vWorldPosition + offset).y;
                gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
            }
        `
    });
    const envSphere = new THREE.Mesh(envGeometry, envMaterial);
    envScene.add(envSphere);

    const lightGeometry = new THREE.SphereGeometry(2, 16, 16);
    const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const light1 = new THREE.Mesh(lightGeometry, lightMaterial);
    light1.position.set(20, 30, 20);
    envScene.add(light1);

    const light2 = new THREE.Mesh(lightGeometry, lightMaterial.clone());
    light2.material.color.setHex(0xaaddff);
    light2.position.set(-25, 15, -10);
    envScene.add(light2);

    const cubeCamera = new THREE.CubeCamera(0.1, 100, cubeRenderTarget);
    cubeCamera.update(renderer, envScene);

    return cubeRenderTarget.texture;
}

// ============================================
// LIGHTING
// ============================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
mainLight.position.set(5, 10, 7);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 2048;
mainLight.shadow.mapSize.height = 2048;
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0x8899bb, 0.4);
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);

const rimLight = new THREE.PointLight(0x00d4ff, 0.6, 20);
rimLight.position.set(-3, 3, -3);
scene.add(rimLight);

const backLight = new THREE.SpotLight(0xffffff, 0.8);
backLight.position.set(0, 5, -8);
backLight.angle = Math.PI / 4;
scene.add(backLight);

// ============================================
// FLOOR
// ============================================
const tableGeometry = new THREE.BoxGeometry(20, 0.3, 12);
const tableMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2a3e,
    metalness: 0.1,
    roughness: 0.4
});
const table = new THREE.Mesh(tableGeometry, tableMaterial);
table.position.y = -2.05;
table.receiveShadow = true;
scene.add(table);

// Environment map
let envMap = null;
try {
    envMap = createEnvironmentMap();
    scene.environment = envMap;
} catch (e) {
    console.log('Environment map creation skipped');
}

// ============================================
// MATERIALS
// ============================================
const borosilicateGlass = new THREE.MeshPhysicalMaterial({
    color: 0xe8f5f0,
    metalness: 0.0,
    roughness: 0.02,
    transmission: 0.98,
    thickness: 1.2,
    ior: 1.474,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.5,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
    attenuationColor: new THREE.Color(0xddf5ee),
    attenuationDistance: 2.0,
    specularIntensity: 1.0,
    specularColor: new THREE.Color(0xffffff)
});

const createLiquidMaterial = (color) => new THREE.MeshPhysicalMaterial({
    color: color,
    metalness: 0.0,
    roughness: 0.0,
    transmission: 0.85,
    thickness: 2.0,
    ior: 1.333,
    transparent: true,
    opacity: 0.6,
    attenuationColor: new THREE.Color(color).multiplyScalar(0.7),
    attenuationDistance: 1.5,
    side: THREE.DoubleSide
});

// ============================================
// CONTAINER CLASS - Base class for containers
// ============================================
class LiquidContainer {
    constructor(options = {}) {
        this.group = new THREE.Group();
        this.maxVolume = options.maxVolume || 250; // mL
        this.currentVolume = options.initialVolume || 150; // mL
        this.liquidColor = options.liquidColor || 0x4fc3f7;
        this.liquid = null;
        this.liquidMaterial = createLiquidMaterial(this.liquidColor);
        this.pourSpoutOffset = new THREE.Vector3(0, 0, 0);
        this.name = options.name || 'Container';
        this.isDragging = false;
        this.isPouring = false;

        // Interaction box for raycasting
        this.interactionMesh = null;
    }

    getPourSpoutWorldPosition() {
        const worldPos = new THREE.Vector3();
        this.group.localToWorld(worldPos.copy(this.pourSpoutOffset));
        return worldPos;
    }

    getTiltAngle() {
        const up = new THREE.Vector3(0, 1, 0);
        const containerUp = new THREE.Vector3(0, 1, 0);
        containerUp.applyQuaternion(this.group.quaternion);
        return Math.acos(Math.max(-1, Math.min(1, up.dot(containerUp))));
    }

    canPour() {
        return this.getTiltAngle() > Math.PI / 6 && this.currentVolume > 0; // > 30 degrees
    }

    getPourRate() {
        const tilt = this.getTiltAngle();
        if (tilt < Math.PI / 6) return 0;
        // Pour rate increases with tilt angle
        const normalizedTilt = (tilt - Math.PI / 6) / (Math.PI / 2);
        return Math.min(normalizedTilt * 80, 60); // mL per second, max 60
    }

    updateLiquid() {
        // Override in subclass
    }

    setVolume(volume) {
        this.currentVolume = Math.max(0, Math.min(this.maxVolume, volume));
        this.updateLiquid();
    }

    addVolume(amount) {
        this.setVolume(this.currentVolume + amount);
    }
}

// ============================================
// BEAKER CLASS
// ============================================
class Beaker extends LiquidContainer {
    constructor(options = {}) {
        super({
            maxVolume: 250,
            initialVolume: options.initialVolume || 150,
            liquidColor: options.liquidColor || 0x4fc3f7,
            name: 'Beaker'
        });

        this.height = 3.2;
        this.bottomRadius = 1.15;
        this.topRadius = 1.35;
        this.wallThickness = 0.06;
        this.bottomThickness = 0.08;

        this.createGeometry();
        this.pourSpoutOffset.set(this.topRadius + 0.1, this.height + 0.1, 0);
    }

    createGeometry() {
        // Outer wall
        const outerPoints = [];
        outerPoints.push(new THREE.Vector2(0.001, 0));
        outerPoints.push(new THREE.Vector2(this.bottomRadius - 0.15, 0));
        outerPoints.push(new THREE.Vector2(this.bottomRadius - 0.05, 0.02));
        outerPoints.push(new THREE.Vector2(this.bottomRadius, 0.08));
        outerPoints.push(new THREE.Vector2(this.topRadius, this.height));
        outerPoints.push(new THREE.Vector2(this.topRadius + 0.06, this.height + 0.02));
        outerPoints.push(new THREE.Vector2(this.topRadius + 0.08, this.height + 0.06));
        outerPoints.push(new THREE.Vector2(this.topRadius + 0.05, this.height + 0.10));
        outerPoints.push(new THREE.Vector2(this.topRadius - this.wallThickness, this.height + 0.08));

        const outerGeometry = new THREE.LatheGeometry(outerPoints, 64);
        const beakerOuter = new THREE.Mesh(outerGeometry, borosilicateGlass.clone());
        beakerOuter.castShadow = true;

        // Inner wall
        const innerPoints = [];
        innerPoints.push(new THREE.Vector2(0.001, this.bottomThickness));
        innerPoints.push(new THREE.Vector2(this.bottomRadius - this.wallThickness - 0.1, this.bottomThickness));
        innerPoints.push(new THREE.Vector2(this.bottomRadius - this.wallThickness, this.bottomThickness + 0.05));
        innerPoints.push(new THREE.Vector2(this.topRadius - this.wallThickness, this.height));
        innerPoints.push(new THREE.Vector2(this.topRadius - this.wallThickness, this.height + 0.06));

        const innerGeometry = new THREE.LatheGeometry(innerPoints, 64);
        const innerMat = borosilicateGlass.clone();
        innerMat.side = THREE.BackSide;
        const beakerInner = new THREE.Mesh(innerGeometry, innerMat);

        // Pour spout
        const spoutCurve = new THREE.Shape();
        spoutCurve.moveTo(-0.25, 0);
        spoutCurve.lineTo(0, 0.35);
        spoutCurve.lineTo(0.25, 0);
        spoutCurve.lineTo(0.20, -0.08);
        spoutCurve.lineTo(0, 0.25);
        spoutCurve.lineTo(-0.20, -0.08);
        spoutCurve.closePath();

        const spoutGeometry = new THREE.ExtrudeGeometry(spoutCurve, { depth: 0.12, bevelEnabled: false });
        const spout = new THREE.Mesh(spoutGeometry, borosilicateGlass.clone());
        spout.rotation.x = Math.PI / 2;
        spout.rotation.z = Math.PI;
        spout.position.set(this.topRadius + 0.02, this.height + 0.06, 0.06);

        // Graduation marks
        const markMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.6
        });

        const graduations = [
            { y: 0.6, label: '50' },
            { y: 1.2, label: '100' },
            { y: 1.8, label: '150' },
            { y: 2.4, label: '200' },
            { y: 3.0, label: '250' }
        ];

        graduations.forEach(grad => {
            const radiusAtHeight = this.bottomRadius + (this.topRadius - this.bottomRadius) * (grad.y / this.height);
            const markGeometry = new THREE.TorusGeometry(radiusAtHeight + 0.01, 0.008, 4, 16, 0.2);
            const mark = new THREE.Mesh(markGeometry, markMaterial);
            mark.rotation.x = Math.PI / 2;
            mark.rotation.z = -0.3;
            mark.position.y = grad.y + 0.1;
            this.group.add(mark);
        });

        // Interaction mesh (invisible, for raycasting)
        const interactionGeometry = new THREE.CylinderGeometry(
            this.topRadius + 0.1,
            this.bottomRadius + 0.1,
            this.height + 0.2,
            16
        );
        this.interactionMesh = new THREE.Mesh(
            interactionGeometry,
            new THREE.MeshBasicMaterial({ visible: false })
        );
        this.interactionMesh.position.y = this.height / 2;
        this.interactionMesh.userData.container = this;

        this.group.add(beakerOuter);
        this.group.add(beakerInner);
        this.group.add(spout);
        this.group.add(this.interactionMesh);

        this.updateLiquid();
    }

    updateLiquid() {
        // Remove old liquid
        if (this.liquid) {
            this.group.remove(this.liquid);
            this.liquid.geometry.dispose();
        }

        if (this.currentVolume <= 0) return;

        // Calculate liquid height based on volume (simplified cylinder approximation)
        const volumeRatio = this.currentVolume / this.maxVolume;
        const liquidHeight = volumeRatio * (this.height - this.bottomThickness - 0.1) + this.bottomThickness;

        const liquidPoints = [];
        const liquidBottomR = this.bottomRadius - this.wallThickness - 0.02;
        const liquidTopR = liquidBottomR + (this.topRadius - this.bottomRadius) * ((liquidHeight - this.bottomThickness) / this.height);

        liquidPoints.push(new THREE.Vector2(0.001, this.bottomThickness + 0.01));
        liquidPoints.push(new THREE.Vector2(liquidBottomR, this.bottomThickness + 0.02));
        liquidPoints.push(new THREE.Vector2(liquidTopR - 0.02, liquidHeight));

        // Meniscus curve
        for (let i = 0; i <= 10; i++) {
            const t = i / 10;
            const r = (liquidTopR - 0.02) * (1 - t);
            const meniscusHeight = 0.05 * Math.pow(t, 2);
            liquidPoints.push(new THREE.Vector2(r, liquidHeight + meniscusHeight));
        }

        const liquidGeometry = new THREE.LatheGeometry(liquidPoints, 48);
        this.liquid = new THREE.Mesh(liquidGeometry, this.liquidMaterial);
        this.liquid.position.y = 0.01;
        this.group.add(this.liquid);
    }
}

// ============================================
// ERLENMEYER FLASK CLASS
// ============================================
class ErlenmeyerFlask extends LiquidContainer {
    constructor(options = {}) {
        super({
            maxVolume: 250,
            initialVolume: options.initialVolume || 100,
            liquidColor: options.liquidColor || 0xff9800,
            name: 'Erlenmeyer'
        });

        this.bodyHeight = 2.8;
        this.neckHeight = 1.0;
        this.bottomRadius = 1.6;
        this.neckRadius = 0.32;
        this.wallThickness = 0.05;
        this.bottomThickness = 0.07;
        this.power = 1.8;

        this.createGeometry();
        this.pourSpoutOffset.set(0, this.bodyHeight + this.neckHeight + 0.15, this.neckRadius);
    }

    createGeometry() {
        // Outer profile
        const outerPoints = [];
        outerPoints.push(new THREE.Vector2(0.001, 0));
        outerPoints.push(new THREE.Vector2(this.bottomRadius - 0.2, 0));
        outerPoints.push(new THREE.Vector2(this.bottomRadius - 0.08, 0.02));
        outerPoints.push(new THREE.Vector2(this.bottomRadius, 0.08));
        outerPoints.push(new THREE.Vector2(this.bottomRadius, 0.12));

        const curveSteps = 40;
        const curveStartY = 0.12;
        const curveEndY = this.bodyHeight;
        const curveHeight = curveEndY - curveStartY;

        for (let i = 1; i <= curveSteps; i++) {
            const t = i / curveSteps;
            const y = curveStartY + curveHeight * t;
            const r = this.neckRadius + (this.bottomRadius - this.neckRadius) * Math.pow(1 - t, this.power);
            outerPoints.push(new THREE.Vector2(r, y));
        }

        outerPoints.push(new THREE.Vector2(this.neckRadius, this.bodyHeight));
        outerPoints.push(new THREE.Vector2(this.neckRadius, this.bodyHeight + this.neckHeight));
        outerPoints.push(new THREE.Vector2(this.neckRadius + 0.05, this.bodyHeight + this.neckHeight + 0.02));
        outerPoints.push(new THREE.Vector2(this.neckRadius + 0.06, this.bodyHeight + this.neckHeight + 0.06));
        outerPoints.push(new THREE.Vector2(this.neckRadius + 0.03, this.bodyHeight + this.neckHeight + 0.09));
        outerPoints.push(new THREE.Vector2(this.neckRadius - this.wallThickness, this.bodyHeight + this.neckHeight + 0.07));

        const outerGeometry = new THREE.LatheGeometry(outerPoints, 64);
        const flaskOuter = new THREE.Mesh(outerGeometry, borosilicateGlass.clone());
        flaskOuter.castShadow = true;

        // Inner profile
        const innerPoints = [];
        const innerBottomR = this.bottomRadius - this.wallThickness;
        const innerNeckR = this.neckRadius - this.wallThickness;

        innerPoints.push(new THREE.Vector2(0.001, this.bottomThickness));
        innerPoints.push(new THREE.Vector2(innerBottomR - 0.15, this.bottomThickness));
        innerPoints.push(new THREE.Vector2(innerBottomR, this.bottomThickness + 0.05));

        const innerCurveStartY = this.bottomThickness + 0.05;
        const innerCurveHeight = this.bodyHeight - innerCurveStartY;

        for (let i = 1; i <= curveSteps; i++) {
            const t = i / curveSteps;
            const y = innerCurveStartY + innerCurveHeight * t;
            const r = innerNeckR + (innerBottomR - innerNeckR) * Math.pow(1 - t, this.power);
            innerPoints.push(new THREE.Vector2(r, y));
        }

        innerPoints.push(new THREE.Vector2(innerNeckR, this.bodyHeight + this.neckHeight));

        const innerGeometry = new THREE.LatheGeometry(innerPoints, 64);
        const innerMat = borosilicateGlass.clone();
        innerMat.side = THREE.BackSide;
        const flaskInner = new THREE.Mesh(innerGeometry, innerMat);

        // Volume graduations
        const markMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5
        });

        [0.8, 1.4, 2.0, 2.5].forEach(y => {
            const markT = (y - curveStartY) / curveHeight;
            const radiusAtY = this.neckRadius + (this.bottomRadius - this.neckRadius) * Math.pow(1 - Math.min(markT, 1), this.power);
            if (radiusAtY > this.neckRadius + 0.1) {
                const markGeometry = new THREE.TorusGeometry(radiusAtY + 0.01, 0.006, 4, 16, 0.15);
                const mark = new THREE.Mesh(markGeometry, markMaterial);
                mark.rotation.x = Math.PI / 2;
                mark.rotation.z = -0.4;
                mark.position.y = y + 0.1;
                this.group.add(mark);
            }
        });

        // Interaction mesh (invisible, for raycasting)
        const interactionGeometry = new THREE.CylinderGeometry(
            this.neckRadius + 0.1,
            this.bottomRadius + 0.1,
            this.bodyHeight + this.neckHeight + 0.2,
            16
        );
        this.interactionMesh = new THREE.Mesh(
            interactionGeometry,
            new THREE.MeshBasicMaterial({ visible: false })
        );
        this.interactionMesh.position.y = (this.bodyHeight + this.neckHeight) / 2;
        this.interactionMesh.userData.container = this;

        this.group.add(flaskOuter);
        this.group.add(flaskInner);
        this.group.add(this.interactionMesh);

        this.updateLiquid();
    }

    updateLiquid() {
        // Remove old liquid
        if (this.liquid) {
            this.group.remove(this.liquid);
            this.liquid.geometry.dispose();
        }

        if (this.currentVolume <= 0) return;

        const volumeRatio = this.currentVolume / this.maxVolume;
        // Erlenmeyer has non-linear volume due to conical shape
        // Approximate: liquid height grows slower at bottom due to wider base
        const liquidHeight = Math.pow(volumeRatio, 0.6) * (this.bodyHeight - this.bottomThickness) + this.bottomThickness;

        const liquidPoints = [];
        const innerBottomR = this.bottomRadius - this.wallThickness - 0.02;
        const innerNeckR = this.neckRadius - this.wallThickness - 0.02;
        const curveStartY = 0.12;
        const curveHeight = this.bodyHeight - curveStartY;

        liquidPoints.push(new THREE.Vector2(0.001, this.bottomThickness + 0.01));
        liquidPoints.push(new THREE.Vector2(innerBottomR, this.bottomThickness + 0.02));

        // Follow the power curve for liquid sides
        const liquidStartY = this.bottomThickness + 0.02;
        const liquidEndY = liquidHeight + this.bottomThickness;

        for (let i = 1; i <= 15; i++) {
            const t = i / 15;
            const y = liquidStartY + (liquidEndY - liquidStartY) * t;
            const flaskT = (y - curveStartY) / curveHeight;
            const r = innerNeckR + (innerBottomR - innerNeckR) * Math.pow(1 - Math.min(flaskT, 1), this.power);
            liquidPoints.push(new THREE.Vector2(r, y));
        }

        // Get the radius at liquid surface
        const liquidSurfaceT = (liquidEndY - curveStartY) / curveHeight;
        const liquidTopR = innerNeckR + (innerBottomR - innerNeckR) * Math.pow(1 - Math.min(liquidSurfaceT, 1), this.power);

        // Meniscus
        for (let i = 0; i <= 10; i++) {
            const t = i / 10;
            const r = liquidTopR * (1 - t);
            const meniscus = 0.04 * Math.pow(t, 2.5);
            liquidPoints.push(new THREE.Vector2(r, liquidEndY + meniscus));
        }

        const liquidGeometry = new THREE.LatheGeometry(liquidPoints, 48);
        this.liquid = new THREE.Mesh(liquidGeometry, this.liquidMaterial);
        this.group.add(this.liquid);
    }
}

// ============================================
// LIQUID STREAM (Combined Tube + Particles)
// ============================================
class LiquidStream {
    constructor() {
        this.particles = [];
        this.maxParticles = 150;
        this.particleGeometry = new THREE.SphereGeometry(0.035, 6, 6);
        this.particleMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x4fc3f7,
            metalness: 0.0,
            roughness: 0.0,
            transmission: 0.8,
            ior: 1.333,
            transparent: true,
            opacity: 0.75
        });
        this.group = new THREE.Group();
        this.isActive = false;
        this.sourceContainer = null;
        this.targetContainer = null;

        // Continuous stream tube
        this.streamTube = null;
        this.streamMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x4fc3f7,
            metalness: 0.0,
            roughness: 0.0,
            transmission: 0.85,
            ior: 1.333,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });

        // Splash particles at impact point
        this.splashParticles = [];
        this.splashGeometry = new THREE.SphereGeometry(0.02, 4, 4);
    }

    setColor(color) {
        this.particleMaterial.color.setHex(color);
        this.streamMaterial.color.setHex(color);
        const attColor = new THREE.Color(color).multiplyScalar(0.7);
        this.particleMaterial.attenuationColor = attColor;
        this.streamMaterial.attenuationColor = attColor;
    }

    start(source, target) {
        this.isActive = true;
        this.sourceContainer = source;
        this.targetContainer = target;
        this.setColor(source.liquidColor);
    }

    stop() {
        this.isActive = false;
        this.sourceContainer = null;
        this.targetContainer = null;

        // Remove stream tube
        if (this.streamTube) {
            this.group.remove(this.streamTube);
            this.streamTube.geometry.dispose();
            this.streamTube = null;
        }
    }

    updateStreamTube(spoutPos, targetPos) {
        // Remove old tube
        if (this.streamTube) {
            this.group.remove(this.streamTube);
            this.streamTube.geometry.dispose();
        }

        const tiltAngle = this.sourceContainer.getTiltAngle();
        const streamLength = Math.max(0.5, (tiltAngle - Math.PI / 6) * 3);

        // Calculate parabolic arc points
        const points = [];
        const startY = spoutPos.y;
        const endY = targetPos ? targetPos.y + 2 : spoutPos.y - 2;

        // Get pour direction
        const pourDir = new THREE.Vector3(1, 0, 0);
        pourDir.applyQuaternion(this.sourceContainer.group.quaternion);
        pourDir.y = 0;
        pourDir.normalize();

        const horizontalDist = targetPos ?
            Math.sqrt(Math.pow(targetPos.x - spoutPos.x, 2) + Math.pow(targetPos.z - spoutPos.z, 2)) :
            streamLength;

        const numPoints = 12;
        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const x = spoutPos.x + pourDir.x * horizontalDist * t;
            const z = spoutPos.z + pourDir.z * horizontalDist * t;
            // Parabolic trajectory
            const y = spoutPos.y - t * Math.abs(startY - endY) - t * t * 2;
            points.push(new THREE.Vector3(x, y, z));
        }

        if (points.length >= 2) {
            const curve = new THREE.CatmullRomCurve3(points);
            const tubeRadius = 0.03 + (tiltAngle - Math.PI / 6) * 0.04;
            const tubeGeometry = new THREE.TubeGeometry(curve, 16, tubeRadius, 8, false);
            this.streamTube = new THREE.Mesh(tubeGeometry, this.streamMaterial);
            this.group.add(this.streamTube);
        }
    }

    update(deltaTime) {
        if (!this.isActive || !this.sourceContainer) return;

        const spoutPos = this.sourceContainer.getPourSpoutWorldPosition();
        const tiltAngle = this.sourceContainer.getTiltAngle();

        // Update continuous stream tube
        if (tiltAngle > Math.PI / 6) {
            const targetPos = this.targetContainer ? this.targetContainer.group.position : null;
            this.updateStreamTube(spoutPos, targetPos);
        }

        // Spawn droplet particles along the stream
        const spawnChance = 0.6 + (tiltAngle - Math.PI / 6) * 0.5;
        if (this.particles.length < this.maxParticles && Math.random() < spawnChance) {
            const particle = new THREE.Mesh(this.particleGeometry, this.particleMaterial.clone());

            // Spawn at spout with slight random offset
            particle.position.copy(spoutPos);
            particle.position.x += (Math.random() - 0.5) * 0.05;
            particle.position.z += (Math.random() - 0.5) * 0.05;

            // Initial velocity based on tilt and pour direction
            const speed = 1.5 + tiltAngle * 1.5;
            const pourDir = new THREE.Vector3(1, 0, 0);
            pourDir.applyQuaternion(this.sourceContainer.group.quaternion);
            pourDir.y = -0.2;
            pourDir.normalize();

            particle.userData.velocity = pourDir.multiplyScalar(speed);
            particle.userData.velocity.x += (Math.random() - 0.5) * 0.4;
            particle.userData.velocity.z += (Math.random() - 0.5) * 0.4;
            particle.userData.life = 0;
            particle.userData.maxLife = 2.5;
            particle.userData.hasHit = false;

            this.particles.push(particle);
            this.group.add(particle);
        }

        // Update particles with physics
        const gravity = -12;
        const tableY = -1.85;

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            // Apply gravity
            p.userData.velocity.y += gravity * deltaTime;

            // Update position
            p.position.x += p.userData.velocity.x * deltaTime;
            p.position.y += p.userData.velocity.y * deltaTime;
            p.position.z += p.userData.velocity.z * deltaTime;

            // Scale particle based on velocity (elongation effect)
            const speed = p.userData.velocity.length();
            p.scale.y = 1 + speed * 0.1;

            // Update life
            p.userData.life += deltaTime;

            // Check collision with target container
            if (this.targetContainer && !p.userData.hasHit) {
                const targetPos = this.targetContainer.group.position;
                const dx = p.position.x - targetPos.x;
                const dz = p.position.z - targetPos.z;
                const horizontalDist = Math.sqrt(dx * dx + dz * dz);

                // Use appropriate radius based on container type and height
                let containerRadius, containerTop, containerBottom;
                if (this.targetContainer instanceof Beaker) {
                    containerRadius = 1.3;
                    containerTop = targetPos.y + 3.3;
                    containerBottom = targetPos.y;
                } else {
                    // Erlenmeyer - use neck radius at top, body radius at bottom
                    containerTop = targetPos.y + 3.9;
                    containerBottom = targetPos.y;
                    const heightRatio = (p.position.y - containerBottom) / (containerTop - containerBottom);
                    containerRadius = heightRatio > 0.7 ? 0.35 : 1.5 * (1 - heightRatio * 0.5);
                }

                if (horizontalDist < containerRadius &&
                    p.position.y < containerTop &&
                    p.position.y > containerBottom) {
                    // Create splash effect
                    this.createSplash(p.position.clone());
                    p.userData.hasHit = true;
                    p.userData.life = p.userData.maxLife;
                }
            }

            // Remove particles that hit the table or are too old
            if (p.userData.life >= p.userData.maxLife || p.position.y < tableY) {
                if (p.position.y < tableY && !p.userData.hasHit) {
                    this.createSplash(new THREE.Vector3(p.position.x, tableY, p.position.z));
                }
                this.group.remove(p);
                p.geometry = null; // Don't dispose shared geometry
                this.particles.splice(i, 1);
            }
        }

        // Update splash particles
        this.updateSplashParticles(deltaTime);
    }

    createSplash(position) {
        const numSplashParticles = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < numSplashParticles; i++) {
            const splash = new THREE.Mesh(this.splashGeometry, this.particleMaterial.clone());
            splash.position.copy(position);
            splash.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 1.5 + 0.5,
                (Math.random() - 0.5) * 2
            );
            splash.userData.life = 0;
            splash.userData.maxLife = 0.4;
            this.splashParticles.push(splash);
            this.group.add(splash);
        }
    }

    updateSplashParticles(deltaTime) {
        for (let i = this.splashParticles.length - 1; i >= 0; i--) {
            const p = this.splashParticles[i];
            p.userData.velocity.y -= 15 * deltaTime;
            p.position.x += p.userData.velocity.x * deltaTime;
            p.position.y += p.userData.velocity.y * deltaTime;
            p.position.z += p.userData.velocity.z * deltaTime;
            p.userData.life += deltaTime;

            // Fade out
            p.material.opacity = 0.7 * (1 - p.userData.life / p.userData.maxLife);

            if (p.userData.life >= p.userData.maxLife) {
                this.group.remove(p);
                p.material.dispose();
                this.splashParticles.splice(i, 1);
            }
        }
    }

    clear() {
        for (const p of this.particles) {
            this.group.remove(p);
        }
        this.particles = [];

        for (const p of this.splashParticles) {
            this.group.remove(p);
            p.material.dispose();
        }
        this.splashParticles = [];

        if (this.streamTube) {
            this.group.remove(this.streamTube);
            this.streamTube.geometry.dispose();
            this.streamTube = null;
        }
    }
}

// ============================================
// INTERACTION MANAGER
// ============================================
class InteractionManager {
    constructor(camera, renderer, containers) {
        this.camera = camera;
        this.renderer = renderer;
        this.containers = containers;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.dragOffset = new THREE.Vector3();
        this.selectedContainer = null;
        this.hoveredContainer = null;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.initialMouseY = 0;
        this.rotationSpeed = 0.012;

        // Track initial rotation for smooth tilting
        this.initialRotation = new THREE.Euler();

        // Container return-to-upright animation
        this.returnAnimations = new Map();

        this.setupEventListeners();
    }

    setupEventListeners() {
        const canvas = this.renderer.domElement;

        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));

        // Touch support for mobile
        canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
        canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));
    }

    updateMouse(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    getIntersectedContainer() {
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const interactionMeshes = this.containers.map(c => c.interactionMesh);
        const intersects = this.raycaster.intersectObjects(interactionMeshes);

        if (intersects.length > 0) {
            return intersects[0].object.userData.container;
        }
        return null;
    }

    onMouseMove(event) {
        this.updateMouse(event);

        if (this.isDragging && this.selectedContainer) {
            // Cancel any return animation for this container
            this.returnAnimations.delete(this.selectedContainer);

            // Calculate mouse delta for rotation
            const deltaX = event.clientX - this.lastMouseX;
            const deltaY = event.clientY - this.lastMouseY;
            const totalDeltaY = event.clientY - this.initialMouseY;

            // Move container horizontally based on mouse position
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersectPoint = new THREE.Vector3();
            this.dragPlane.constant = -this.selectedContainer.group.position.y - 1;
            this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint);

            if (intersectPoint) {
                // Smooth position interpolation
                const targetX = intersectPoint.x - this.dragOffset.x;
                const targetZ = intersectPoint.z - this.dragOffset.z;

                // Clamp to table bounds
                const maxDist = 8;
                this.selectedContainer.group.position.x = Math.max(-maxDist, Math.min(maxDist, targetX));
                this.selectedContainer.group.position.z = Math.max(-maxDist, Math.min(maxDist, targetZ));
            }

            // Tilt container based on vertical mouse movement from initial position
            // Moving mouse up = tilt forward (pour)
            const targetTilt = -totalDeltaY * this.rotationSpeed;
            const maxTilt = Math.PI * 0.55; // ~100 degrees max

            // Calculate desired tilt (clamped)
            const clampedTilt = Math.max(-0.1, Math.min(maxTilt, targetTilt));

            // Get the current Y rotation (aiming direction)
            const currentYRotation = this.selectedContainer.group.rotation.y;

            // Set rotation with tilt on Z axis (pour direction) and Y axis (aiming)
            this.selectedContainer.group.rotation.set(
                0,
                currentYRotation + deltaX * this.rotationSpeed * 0.3,
                clampedTilt
            );

            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;
        } else {
            // Hover detection for cursor feedback
            const container = this.getIntersectedContainer();

            if (container !== this.hoveredContainer) {
                this.hoveredContainer = container;
                if (container) {
                    this.renderer.domElement.style.cursor = 'grab';
                } else {
                    this.renderer.domElement.style.cursor = 'default';
                }
            }
        }
    }

    onMouseDown(event) {
        if (event.button !== 0) return; // Only left click

        this.updateMouse(event);
        const container = this.getIntersectedContainer();

        if (container) {
            this.selectedContainer = container;
            this.isDragging = true;
            container.isDragging = true;
            this.renderer.domElement.style.cursor = 'grabbing';

            // Stop any return animation
            this.returnAnimations.delete(container);

            // Store initial rotation
            this.initialRotation.copy(container.group.rotation);

            // Calculate drag offset
            this.raycaster.setFromCamera(this.mouse, this.camera);
            this.dragPlane.constant = -container.group.position.y - 1;
            const intersectPoint = new THREE.Vector3();
            this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint);

            if (intersectPoint) {
                this.dragOffset.x = intersectPoint.x - container.group.position.x;
                this.dragOffset.z = intersectPoint.z - container.group.position.z;
            }

            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;
            this.initialMouseY = event.clientY;

            // Disable orbit controls while dragging
            controls.enabled = false;
        }
    }

    onMouseUp(event) {
        if (this.selectedContainer) {
            // Start return-to-upright animation
            this.startReturnAnimation(this.selectedContainer);

            this.selectedContainer.isDragging = false;
            this.selectedContainer = null;
        }
        this.isDragging = false;

        // Check if still hovering
        const container = this.getIntersectedContainer();
        if (container) {
            this.renderer.domElement.style.cursor = 'grab';
        } else {
            this.renderer.domElement.style.cursor = 'default';
        }

        // Re-enable orbit controls
        controls.enabled = true;
    }

    // Touch event handlers
    onTouchStart(event) {
        if (event.touches.length === 1) {
            event.preventDefault();
            const touch = event.touches[0];
            this.onMouseDown({ clientX: touch.clientX, clientY: touch.clientY, button: 0 });
        }
    }

    onTouchMove(event) {
        if (event.touches.length === 1 && this.isDragging) {
            event.preventDefault();
            const touch = event.touches[0];
            this.onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
        }
    }

    onTouchEnd(event) {
        this.onMouseUp({});
    }

    // Smooth return-to-upright animation
    startReturnAnimation(container) {
        this.returnAnimations.set(container, {
            startRotation: container.group.rotation.clone(),
            targetRotation: new THREE.Euler(0, container.group.rotation.y, 0),
            progress: 0,
            duration: 0.5 // seconds
        });
    }

    update(deltaTime) {
        // Update return animations
        for (const [container, anim] of this.returnAnimations) {
            anim.progress += deltaTime / anim.duration;

            if (anim.progress >= 1) {
                // Animation complete
                container.group.rotation.copy(anim.targetRotation);
                this.returnAnimations.delete(container);
            } else {
                // Smooth ease-out interpolation
                const t = 1 - Math.pow(1 - anim.progress, 3);
                container.group.rotation.x = THREE.MathUtils.lerp(anim.startRotation.x, anim.targetRotation.x, t);
                container.group.rotation.z = THREE.MathUtils.lerp(anim.startRotation.z, anim.targetRotation.z, t);
            }
        }
    }
}

// ============================================
// POUR MANAGER
// ============================================
class PourManager {
    constructor(containers, liquidStream) {
        this.containers = containers;
        this.liquidStream = liquidStream;
        this.pouringContainer = null;
    }

    findTargetContainer(source) {
        const sourcePos = source.getPourSpoutWorldPosition();

        for (const container of this.containers) {
            if (container === source) continue;

            const targetPos = container.group.position;
            const dx = sourcePos.x - targetPos.x;
            const dz = sourcePos.z - targetPos.z;
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);

            // Check if spout is above the target container opening
            const containerRadius = container instanceof Beaker ? 1.35 : 0.32;
            const containerTop = targetPos.y + (container instanceof Beaker ? 3.3 : 3.9);

            if (horizontalDist < containerRadius * 1.5 && sourcePos.y > containerTop - 1) {
                return container;
            }
        }
        return null;
    }

    update(deltaTime) {
        let activePouringContainer = null;
        let targetContainer = null;

        // Check each container for pouring
        for (const container of this.containers) {
            if (container.canPour() && container.isDragging) {
                activePouringContainer = container;
                targetContainer = this.findTargetContainer(container);
                break;
            }
        }

        if (activePouringContainer) {
            // Start or continue pouring
            if (!this.liquidStream.isActive) {
                this.liquidStream.start(activePouringContainer, targetContainer);
            }

            const pourRate = activePouringContainer.getPourRate();
            const amountPoured = pourRate * deltaTime;

            // Remove liquid from source
            activePouringContainer.addVolume(-amountPoured);

            // Add liquid to target if there is one
            if (targetContainer) {
                targetContainer.addVolume(amountPoured * 0.9); // 90% efficiency (some spillage)
                this.liquidStream.targetContainer = targetContainer;
            } else {
                this.liquidStream.targetContainer = null;
            }

            this.pouringContainer = activePouringContainer;
        } else {
            // Stop pouring
            if (this.liquidStream.isActive) {
                this.liquidStream.stop();
            }
            this.pouringContainer = null;
        }

        // Update liquid stream particles
        this.liquidStream.update(deltaTime);
    }
}

// ============================================
// UI UPDATES
// ============================================
function updateUI(beaker, erlenmeyer) {
    const beakerVolumeEl = document.getElementById('beaker-volume');
    const erlenmeyerVolumeEl = document.getElementById('erlenmeyer-volume');
    const beakerBarEl = document.getElementById('beaker-bar');
    const erlenmeyerBarEl = document.getElementById('erlenmeyer-bar');

    if (beakerVolumeEl) {
        beakerVolumeEl.textContent = `${Math.round(beaker.currentVolume)} mL`;
    }
    if (erlenmeyerVolumeEl) {
        erlenmeyerVolumeEl.textContent = `${Math.round(erlenmeyer.currentVolume)} mL`;
    }
    if (beakerBarEl) {
        beakerBarEl.style.width = `${(beaker.currentVolume / beaker.maxVolume) * 100}%`;
    }
    if (erlenmeyerBarEl) {
        erlenmeyerBarEl.style.width = `${(erlenmeyer.currentVolume / erlenmeyer.maxVolume) * 100}%`;
    }
}

// ============================================
// MAIN INITIALIZATION
// ============================================

// Create containers
const beaker = new Beaker({
    initialVolume: 150,
    liquidColor: 0x4fc3f7
});
beaker.group.position.set(-2.5, -1.9, 0);
scene.add(beaker.group);

const erlenmeyer = new ErlenmeyerFlask({
    initialVolume: 100,
    liquidColor: 0xff9800
});
erlenmeyer.group.position.set(2.5, -1.9, 0);
scene.add(erlenmeyer.group);

const containers = [beaker, erlenmeyer];

// Create liquid stream
const liquidStream = new LiquidStream();
scene.add(liquidStream.group);

// Create interaction manager
const interactionManager = new InteractionManager(camera, renderer, containers);

// Create pour manager
const pourManager = new PourManager(containers, liquidStream);

// Reset button
const resetBtn = document.getElementById('reset-btn');
if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        // Reset positions
        beaker.group.position.set(-2.5, -1.9, 0);
        beaker.group.rotation.set(0, 0, 0);
        erlenmeyer.group.position.set(2.5, -1.9, 0);
        erlenmeyer.group.rotation.set(0, 0, 0);

        // Reset volumes
        beaker.setVolume(150);
        erlenmeyer.setVolume(100);

        // Clear stream
        liquidStream.clear();
        liquidStream.stop();
    });
}

// Window resize
window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});

// ============================================
// ANIMATION LOOP
// ============================================
let lastTime = performance.now();

function animate() {
    requestAnimationFrame(animate);

    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1); // Cap delta time
    lastTime = currentTime;

    // Update interaction manager (for return-to-upright animations)
    interactionManager.update(deltaTime);

    // Update pour manager
    pourManager.update(deltaTime);

    // Update UI
    updateUI(beaker, erlenmeyer);

    // Update controls
    controls.update();

    // Render
    renderer.render(scene, camera);
}

animate();

console.log('Liquid Pouring Interaction initialized');
console.log('Instructions:');
console.log('- Click and drag containers to move them horizontally');
console.log('- Drag upward (move mouse up while holding) to tilt and pour');
console.log('- Position tilted container over another to transfer liquid');
console.log('- Right-click drag to orbit camera, scroll to zoom');
