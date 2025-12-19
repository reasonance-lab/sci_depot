import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// Scene setup
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
);
camera.position.set(5, 4, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 2;
controls.maxDistance = 20;

// Create procedural environment map for realistic reflections
function createEnvironmentMap() {
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256);
    cubeRenderTarget.texture.type = THREE.HalfFloatType;

    // Create a simple gradient environment
    const envScene = new THREE.Scene();

    // Gradient background sphere
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

    // Add some bright spots for reflections
    const lightGeometry = new THREE.SphereGeometry(2, 16, 16);
    const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const light1 = new THREE.Mesh(lightGeometry, lightMaterial);
    light1.position.set(20, 30, 20);
    envScene.add(light1);

    const light2 = new THREE.Mesh(lightGeometry, lightMaterial.clone());
    light2.material.color.setHex(0xaaddff);
    light2.position.set(-25, 15, -10);
    envScene.add(light2);

    // Render environment to cube map
    const cubeCamera = new THREE.CubeCamera(0.1, 100, cubeRenderTarget);
    cubeCamera.update(renderer, envScene);

    return cubeRenderTarget.texture;
}

// Lighting - enhanced for glass rendering
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
mainLight.position.set(5, 10, 7);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 2048;
mainLight.shadow.mapSize.height = 2048;
mainLight.shadow.camera.near = 0.5;
mainLight.shadow.camera.far = 50;
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0x8899bb, 0.4);
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);

const rimLight = new THREE.PointLight(0x00d4ff, 0.6, 20);
rimLight.position.set(-3, 3, -3);
scene.add(rimLight);

// Backlight for glass rim visibility
const backLight = new THREE.SpotLight(0xffffff, 0.8);
backLight.position.set(0, 5, -8);
backLight.angle = Math.PI / 4;
scene.add(backLight);

// Floor/table surface - lab bench style
const tableGeometry = new THREE.CylinderGeometry(8, 8, 0.3, 64);
const tableMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    metalness: 0.1,
    roughness: 0.4
});
const table = new THREE.Mesh(tableGeometry, tableMaterial);
table.position.y = -2.05;
table.receiveShadow = true;
scene.add(table);

// Create environment map
let envMap = null;
try {
    envMap = createEnvironmentMap();
    scene.environment = envMap;
} catch (e) {
    console.log('Environment map creation skipped');
}

// Materials
const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xeef8fc,
    metalness: 0.0,
    roughness: 0.05,
    transmission: 0.95,
    thickness: 0.5,
    ior: 1.52,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.0,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide
});

// Borosilicate glass - slight greenish-blue tint characteristic of lab glass
const borosilicateGlass = new THREE.MeshPhysicalMaterial({
    color: 0xe8f5f0,  // Slight green-blue tint
    metalness: 0.0,
    roughness: 0.02,
    transmission: 0.98,
    thickness: 1.2,
    ior: 1.474,  // Borosilicate glass IOR
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.5,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
    attenuationColor: new THREE.Color(0xddf5ee),
    attenuationDistance: 2.0,
    specularIntensity: 1.0,
    specularColor: new THREE.Color(0xffffff),
    sheen: 0.1,
    sheenColor: new THREE.Color(0xaaddcc)
});

// Ground glass joint material - frosted appearance
const groundGlassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xf0f5f3,
    metalness: 0.0,
    roughness: 0.6,  // Frosted surface
    transmission: 0.4,
    thickness: 0.8,
    ior: 1.474,
    clearcoat: 0.3,
    clearcoatRoughness: 0.8,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide
});

const ptfeMaterial = new THREE.MeshStandardMaterial({
    color: 0x404040,
    metalness: 0.1,
    roughness: 0.4
});

const liquidMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x4fc3f7,
    metalness: 0.0,
    roughness: 0.1,
    transmission: 0.6,
    thickness: 1.0,
    ior: 1.33,
    transparent: true,
    opacity: 0.7
});

// Enhanced liquid for round bottom flask - aqueous solution
const aqueousSolutionMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x5ecfff,
    metalness: 0.0,
    roughness: 0.0,
    transmission: 0.85,
    thickness: 2.0,
    ior: 1.333,  // Water
    transparent: true,
    opacity: 0.6,
    attenuationColor: new THREE.Color(0x3399cc),
    attenuationDistance: 1.5,
    side: THREE.DoubleSide
});

const plasticCapMaterial = new THREE.MeshStandardMaterial({
    color: 0xeeeeee,
    metalness: 0.0,
    roughness: 0.3
});

// Cork stopper material
const corkMaterial = new THREE.MeshStandardMaterial({
    color: 0xc4a574,
    metalness: 0.0,
    roughness: 0.9,
    bumpScale: 0.02
});

// Model groups
let currentModels = [];

// Model info data
const modelInfo = {
    'stir-bar': { name: 'Magnetic Stir Bar', description: 'PTFE-coated magnetic stir bar for mixing solutions' },
    'beaker': { name: 'Laboratory Beaker', description: 'Borosilicate glass beaker with pour spout and graduated markings' },
    'test-tube': { name: 'Microcentrifuge Tube', description: '1.5mL microcentrifuge tube with snap cap' },
    'erlenmeyer': { name: 'Erlenmeyer Flask', description: 'Conical flask with straight sloping sides and cylindrical neck' },
    'round-bottom': { name: 'Round Bottom Flask', description: 'Spherical borosilicate glass flask for reactions and distillation' },
    'all': { name: 'All Equipment', description: 'Complete laboratory equipment collection' }
};

// ============================================
// MODEL CREATION FUNCTIONS
// ============================================

function createStirBar() {
    const group = new THREE.Group();

    // ============================================
    // MAGNETIC STIR BAR - Capsule/pill shape
    // PTFE-coated with embedded magnet
    // ============================================
    const length = 1.8;      // Total length
    const radius = 0.22;     // Radius of the bar
    const segments = 24;

    // Create capsule profile for lathe geometry
    // Profile goes: top center -> top hemisphere -> cylinder side -> bottom hemisphere -> bottom center
    const capsulePoints = [];

    // Start at top center
    capsulePoints.push(new THREE.Vector2(0.001, length / 2));

    // Top hemisphere (quarter circle from top to side)
    for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const angle = (Math.PI / 2) * t;  // 0 to 90 degrees
        const r = Math.sin(angle) * radius;
        const y = (length / 2 - radius) + Math.cos(angle) * radius;
        capsulePoints.push(new THREE.Vector2(r, y));
    }

    // Cylinder side (straight section) - just need the bottom point since top is from hemisphere
    capsulePoints.push(new THREE.Vector2(radius, -(length / 2 - radius)));

    // Bottom hemisphere (quarter circle from side to bottom)
    for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const angle = (Math.PI / 2) * t;  // 0 to 90 degrees
        const r = Math.cos(angle) * radius;
        const y = -(length / 2 - radius) - Math.sin(angle) * radius;
        capsulePoints.push(new THREE.Vector2(r, y));
    }

    // End at bottom center
    capsulePoints.push(new THREE.Vector2(0.001, -length / 2));

    const capsuleGeometry = new THREE.LatheGeometry(capsulePoints, 32);
    const stirBar = new THREE.Mesh(capsuleGeometry, ptfeMaterial.clone());
    stirBar.castShadow = true;
    stirBar.receiveShadow = true;

    // Position on table (lying flat - rotate to horizontal)
    stirBar.rotation.x = Math.PI / 2;
    stirBar.position.y = -1.88 + radius;

    // Add subtle center ridge (characteristic of many stir bars)
    const ridgeGeometry = new THREE.TorusGeometry(radius + 0.01, 0.015, 8, 32);
    const ridgeMaterial = new THREE.MeshStandardMaterial({
        color: 0x505050,
        metalness: 0.2,
        roughness: 0.3
    });
    const ridge = new THREE.Mesh(ridgeGeometry, ridgeMaterial);
    ridge.rotation.x = Math.PI / 2;
    ridge.position.y = -1.88 + radius;

    group.add(stirBar);
    group.add(ridge);

    return group;
}

function createBeaker() {
    const group = new THREE.Group();

    // ============================================
    // BEAKER DIMENSIONS - Classic lab beaker shape
    // Slight outward taper, flat bottom, pour spout
    // ============================================
    const height = 3.2;
    const bottomRadius = 1.15;
    const topRadius = 1.35;  // Slight taper outward
    const wallThickness = 0.06;
    const bottomThickness = 0.08;

    // Create beaker profile (outer wall)
    const outerPoints = [];

    // Flat bottom with small corner radius
    outerPoints.push(new THREE.Vector2(0.001, 0));  // Center bottom
    outerPoints.push(new THREE.Vector2(bottomRadius - 0.15, 0));
    outerPoints.push(new THREE.Vector2(bottomRadius - 0.05, 0.02));
    outerPoints.push(new THREE.Vector2(bottomRadius, 0.08));  // Corner

    // Straight tapered wall
    outerPoints.push(new THREE.Vector2(topRadius, height));

    // Rolled rim (beaded edge)
    outerPoints.push(new THREE.Vector2(topRadius + 0.06, height + 0.02));
    outerPoints.push(new THREE.Vector2(topRadius + 0.08, height + 0.06));
    outerPoints.push(new THREE.Vector2(topRadius + 0.05, height + 0.10));
    outerPoints.push(new THREE.Vector2(topRadius - wallThickness, height + 0.08));

    const outerGeometry = new THREE.LatheGeometry(outerPoints, 64);
    const beakerOuter = new THREE.Mesh(outerGeometry, borosilicateGlass.clone());
    beakerOuter.castShadow = true;

    // Inner wall
    const innerPoints = [];
    innerPoints.push(new THREE.Vector2(0.001, bottomThickness));
    innerPoints.push(new THREE.Vector2(bottomRadius - wallThickness - 0.1, bottomThickness));
    innerPoints.push(new THREE.Vector2(bottomRadius - wallThickness, bottomThickness + 0.05));
    innerPoints.push(new THREE.Vector2(topRadius - wallThickness, height));
    innerPoints.push(new THREE.Vector2(topRadius - wallThickness, height + 0.06));

    const innerGeometry = new THREE.LatheGeometry(innerPoints, 64);
    const innerMat = borosilicateGlass.clone();
    innerMat.side = THREE.BackSide;
    const beakerInner = new THREE.Mesh(innerGeometry, innerMat);

    // Pour spout - V-shaped notch at rim
    const spoutGroup = new THREE.Group();
    const spoutCurve = new THREE.Shape();
    spoutCurve.moveTo(-0.25, 0);
    spoutCurve.lineTo(0, 0.35);
    spoutCurve.lineTo(0.25, 0);
    spoutCurve.lineTo(0.20, -0.08);
    spoutCurve.lineTo(0, 0.25);
    spoutCurve.lineTo(-0.20, -0.08);
    spoutCurve.closePath();

    const spoutExtrudeSettings = { depth: 0.12, bevelEnabled: false };
    const spoutGeometry = new THREE.ExtrudeGeometry(spoutCurve, spoutExtrudeSettings);
    const spout = new THREE.Mesh(spoutGeometry, borosilicateGlass.clone());
    spout.rotation.x = Math.PI / 2;
    spout.rotation.z = Math.PI;
    spout.position.set(topRadius + 0.02, height + 0.06, 0.06);
    spoutGroup.add(spout);

    // Graduation marks
    const markMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.6
    });

    const graduations = [
        { y: 0.6, major: true, label: '50' },
        { y: 1.2, major: true, label: '100' },
        { y: 1.8, major: true, label: '150' },
        { y: 2.4, major: true, label: '200' },
        { y: 3.0, major: true, label: '250' }
    ];

    graduations.forEach(grad => {
        const radiusAtHeight = bottomRadius + (topRadius - bottomRadius) * (grad.y / height);
        const markLength = grad.major ? 0.25 : 0.15;

        // Curved mark following the beaker surface
        const markGeometry = new THREE.TorusGeometry(radiusAtHeight + 0.01, 0.008, 4, 16, 0.2);
        const mark = new THREE.Mesh(markGeometry, markMaterial);
        mark.rotation.x = Math.PI / 2;
        mark.rotation.z = -0.3;
        mark.position.y = grad.y + 0.1;
        group.add(mark);
    });

    // Liquid with meniscus
    const liquidHeight = 1.6;
    const liquidPoints = [];
    const liquidBottomR = bottomRadius - wallThickness - 0.02;
    const liquidTopR = liquidBottomR + (topRadius - bottomRadius) * (liquidHeight / height);

    liquidPoints.push(new THREE.Vector2(0.001, bottomThickness + 0.01));
    liquidPoints.push(new THREE.Vector2(liquidBottomR, bottomThickness + 0.02));
    liquidPoints.push(new THREE.Vector2(liquidTopR - 0.02, liquidHeight));

    // Meniscus curve
    for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const r = (liquidTopR - 0.02) * (1 - t);
        const meniscusHeight = 0.05 * Math.pow(t, 2);
        liquidPoints.push(new THREE.Vector2(r, liquidHeight + meniscusHeight));
    }

    const liquidGeometry = new THREE.LatheGeometry(liquidPoints, 48);
    const liquid = new THREE.Mesh(liquidGeometry, aqueousSolutionMaterial.clone());
    liquid.position.y = 0.01;

    // Assemble
    group.add(beakerOuter);
    group.add(beakerInner);
    group.add(spoutGroup);
    group.add(liquid);
    group.position.y = -1.9;

    return group;
}

function createTestTube() {
    const group = new THREE.Group();

    // Tube body with rounded bottom
    const tubePoints = [];
    const height = 2.5;
    const radius = 0.4;
    const wallThickness = 0.05;

    // Create tube with hemispherical bottom
    const bottomSegments = 16;
    for (let i = 0; i <= bottomSegments; i++) {
        const angle = -Math.PI/2 + (Math.PI/2) * (i / bottomSegments);
        tubePoints.push(new THREE.Vector2(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius
        ));
    }
    tubePoints.push(new THREE.Vector2(radius, height));
    tubePoints.push(new THREE.Vector2(radius + 0.05, height + 0.1)); // Rim

    const tubeGeometry = new THREE.LatheGeometry(tubePoints, 32);
    const tube = new THREE.Mesh(tubeGeometry, glassMaterial.clone());
    tube.position.y = -1.5;
    tube.castShadow = true;

    // Cap
    const capGroup = new THREE.Group();

    // Cap body
    const capPoints = [];
    capPoints.push(new THREE.Vector2(0, 0));
    capPoints.push(new THREE.Vector2(radius + 0.08, 0));
    capPoints.push(new THREE.Vector2(radius + 0.08, 0.3));
    capPoints.push(new THREE.Vector2(radius + 0.15, 0.35));
    capPoints.push(new THREE.Vector2(radius + 0.15, 0.6));
    capPoints.push(new THREE.Vector2(0.15, 0.7));
    capPoints.push(new THREE.Vector2(0, 0.7));

    const capGeometry = new THREE.LatheGeometry(capPoints, 32);
    const cap = new THREE.Mesh(capGeometry, plasticCapMaterial);
    cap.position.y = height - 1.4;
    capGroup.add(cap);

    // Hinge
    const hingeGeometry = new THREE.BoxGeometry(0.15, 0.3, 0.1);
    const hinge = new THREE.Mesh(hingeGeometry, plasticCapMaterial);
    hinge.position.set(radius + 0.2, height - 1.2, 0);
    capGroup.add(hinge);

    // Liquid inside
    const liquidPoints2 = [];
    for (let i = 0; i <= bottomSegments; i++) {
        const angle = -Math.PI/2 + (Math.PI/2) * (i / bottomSegments);
        liquidPoints2.push(new THREE.Vector2(
            Math.cos(angle) * (radius - wallThickness),
            Math.sin(angle) * (radius - wallThickness)
        ));
    }
    liquidPoints2.push(new THREE.Vector2(radius - wallThickness, height * 0.6));
    liquidPoints2.push(new THREE.Vector2(0, height * 0.6));

    const liquidGeometry2 = new THREE.LatheGeometry(liquidPoints2, 32);
    const tubeliquid = new THREE.Mesh(liquidGeometry2, liquidMaterial.clone());
    tubeliquid.position.y = -1.5;

    group.add(tube, capGroup, tubeliquid);
    return group;
}

function createErlenmeyerFlask() {
    const group = new THREE.Group();

    // ============================================
    // ERLENMEYER FLASK - Classic conical shape
    // Wide flat bottom, straight sloping sides, cylindrical neck
    // ============================================
    const bodyHeight = 2.8;        // Height of conical section
    const neckHeight = 1.0;        // Cylindrical neck
    const bottomRadius = 1.6;      // Wide base
    const neckRadius = 0.32;       // Narrow neck
    const wallThickness = 0.05;
    const bottomThickness = 0.07;

    // Outer profile
    const outerPoints = [];

    // Flat bottom
    outerPoints.push(new THREE.Vector2(0.001, 0));
    outerPoints.push(new THREE.Vector2(bottomRadius - 0.2, 0));
    outerPoints.push(new THREE.Vector2(bottomRadius - 0.08, 0.02));
    outerPoints.push(new THREE.Vector2(bottomRadius, 0.08));

    // Straight conical sides - but stop earlier to allow smooth transition
    const coneEndHeight = bodyHeight * 0.65;  // Cone goes up to 65% of body height
    const coneEndRadius = bottomRadius - (bottomRadius - neckRadius) * (coneEndHeight / bodyHeight);

    outerPoints.push(new THREE.Vector2(bottomRadius, 0.12));
    outerPoints.push(new THREE.Vector2(coneEndRadius, coneEndHeight));

    // Smooth shoulder curve using cubic easing
    // This creates a gradual S-curve from cone to neck
    const shoulderSteps = 25;
    const transitionHeight = bodyHeight - coneEndHeight;

    for (let i = 1; i <= shoulderSteps; i++) {
        const t = i / shoulderSteps;
        // Use smoothstep for gradual transition
        const smoothT = t * t * (3 - 2 * t);

        // Radius transitions from coneEndRadius to neckRadius
        const r = coneEndRadius - (coneEndRadius - neckRadius) * smoothT;
        // Height goes from coneEndHeight to bodyHeight
        const y = coneEndHeight + transitionHeight * t;

        outerPoints.push(new THREE.Vector2(r, y));
    }

    // Cylindrical neck
    outerPoints.push(new THREE.Vector2(neckRadius, bodyHeight));
    outerPoints.push(new THREE.Vector2(neckRadius, bodyHeight + neckHeight));

    // Rolled rim
    outerPoints.push(new THREE.Vector2(neckRadius + 0.05, bodyHeight + neckHeight + 0.02));
    outerPoints.push(new THREE.Vector2(neckRadius + 0.06, bodyHeight + neckHeight + 0.06));
    outerPoints.push(new THREE.Vector2(neckRadius + 0.03, bodyHeight + neckHeight + 0.09));
    outerPoints.push(new THREE.Vector2(neckRadius - wallThickness, bodyHeight + neckHeight + 0.07));

    const outerGeometry = new THREE.LatheGeometry(outerPoints, 64);
    const flaskOuter = new THREE.Mesh(outerGeometry, borosilicateGlass.clone());
    flaskOuter.castShadow = true;

    // Inner profile - follows the same curve logic
    const innerPoints = [];
    const innerBottomR = bottomRadius - wallThickness;
    const innerNeckR = neckRadius - wallThickness;
    const innerConeEndR = innerBottomR - (innerBottomR - innerNeckR) * (coneEndHeight / bodyHeight);

    innerPoints.push(new THREE.Vector2(0.001, bottomThickness));
    innerPoints.push(new THREE.Vector2(innerBottomR - 0.15, bottomThickness));
    innerPoints.push(new THREE.Vector2(innerBottomR, bottomThickness + 0.05));
    innerPoints.push(new THREE.Vector2(innerConeEndR, coneEndHeight));

    // Inner shoulder curve
    for (let i = 1; i <= shoulderSteps; i++) {
        const t = i / shoulderSteps;
        const smoothT = t * t * (3 - 2 * t);
        const r = innerConeEndR - (innerConeEndR - innerNeckR) * smoothT;
        const y = coneEndHeight + transitionHeight * t;
        innerPoints.push(new THREE.Vector2(r, y));
    }

    innerPoints.push(new THREE.Vector2(innerNeckR, bodyHeight + neckHeight));

    const innerGeometry = new THREE.LatheGeometry(innerPoints, 64);
    const innerMat = borosilicateGlass.clone();
    innerMat.side = THREE.BackSide;
    const flaskInner = new THREE.Mesh(innerGeometry, innerMat);

    // Liquid - follows the conical shape
    const liquidHeight = 1.4;
    const liquidPoints = [];

    // Calculate liquid radius at different heights (linear interpolation for cone)
    const liquidBottomR = bottomRadius - wallThickness - 0.03;
    const coneSlope = (neckRadius - bottomRadius) / bodyHeight;

    liquidPoints.push(new THREE.Vector2(0.001, bottomThickness + 0.01));
    liquidPoints.push(new THREE.Vector2(liquidBottomR, bottomThickness + 0.02));

    const liquidTopR = liquidBottomR + coneSlope * liquidHeight;
    liquidPoints.push(new THREE.Vector2(liquidTopR, liquidHeight + bottomThickness));

    // Meniscus
    for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const r = liquidTopR * (1 - t);
        const meniscus = 0.04 * Math.pow(t, 2.5);
        liquidPoints.push(new THREE.Vector2(r, liquidHeight + bottomThickness + meniscus));
    }

    const liquidGeometry = new THREE.LatheGeometry(liquidPoints, 48);
    const liquid = new THREE.Mesh(liquidGeometry, aqueousSolutionMaterial.clone());

    // Volume graduations on the side
    const markMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.5
    });

    [0.8, 1.4, 2.0, 2.5].forEach(y => {
        const radiusAtY = bottomRadius + coneSlope * y;
        if (radiusAtY > neckRadius + 0.1) {
            const markGeometry = new THREE.TorusGeometry(radiusAtY + 0.01, 0.006, 4, 16, 0.15);
            const mark = new THREE.Mesh(markGeometry, markMaterial);
            mark.rotation.x = Math.PI / 2;
            mark.rotation.z = -0.4;
            mark.position.y = y + 0.1;
            group.add(mark);
        }
    });

    // Assemble
    group.add(flaskOuter);
    group.add(flaskInner);
    group.add(liquid);
    group.position.y = -1.9;

    return group;
}

function createRoundBottomFlask() {
    const group = new THREE.Group();

    // ============================================
    // ROUND BOTTOM FLASK - True spherical bulb
    // The defining feature is the SPHERICAL body
    // ============================================
    const sphereRadius = 1.5;          // Main spherical bulb
    const neckRadius = 0.28;           // Narrow neck
    const neckHeight = 0.9;            // Short neck
    const wallThickness = 0.05;

    // ============================================
    // OUTER PROFILE - Nearly complete sphere + neck
    // Key: Sphere goes from -90° (bottom) to about +60° (where neck starts)
    // That's 150° of arc = 5/6 of a hemisphere = nearly complete sphere
    // ============================================
    const outerPoints = [];
    const sphereSegments = 60;

    // The angle where neck meets sphere (about 60 degrees from horizontal)
    const neckAngle = Math.PI * 0.38;  // ~68 degrees - sphere curves inward here
    const neckJoinRadius = Math.cos(neckAngle) * sphereRadius;
    const neckJoinY = Math.sin(neckAngle) * sphereRadius + sphereRadius;

    // Draw sphere from bottom (-90°) up to neck join point
    // This creates a nearly-complete sphere shape
    const startAngle = -Math.PI / 2;  // -90° (bottom of sphere)
    const endAngle = neckAngle;        // Where neck begins
    const totalAngle = endAngle - startAngle;

    for (let i = 0; i <= sphereSegments; i++) {
        const t = i / sphereSegments;
        const angle = startAngle + totalAngle * t;
        const r = Math.cos(angle) * sphereRadius;
        const y = Math.sin(angle) * sphereRadius + sphereRadius;
        outerPoints.push(new THREE.Vector2(r, y));
    }

    // Smooth transition from sphere to cylindrical neck
    // Short curve that brings the sphere smoothly into the neck
    const transitionSteps = 10;
    for (let i = 1; i <= transitionSteps; i++) {
        const t = i / transitionSteps;
        const smoothT = t * t * (3 - 2 * t);  // Smoothstep
        const r = neckJoinRadius - (neckJoinRadius - neckRadius) * smoothT;
        const y = neckJoinY + 0.2 * t;
        outerPoints.push(new THREE.Vector2(r, y));
    }

    // Cylindrical neck
    const neckStartY = neckJoinY + 0.2;
    outerPoints.push(new THREE.Vector2(neckRadius, neckStartY));
    outerPoints.push(new THREE.Vector2(neckRadius, neckStartY + neckHeight));

    // Simple rolled rim
    outerPoints.push(new THREE.Vector2(neckRadius + 0.04, neckStartY + neckHeight + 0.02));
    outerPoints.push(new THREE.Vector2(neckRadius + 0.05, neckStartY + neckHeight + 0.05));
    outerPoints.push(new THREE.Vector2(neckRadius + 0.02, neckStartY + neckHeight + 0.07));
    outerPoints.push(new THREE.Vector2(neckRadius - wallThickness, neckStartY + neckHeight + 0.05));

    const outerGeometry = new THREE.LatheGeometry(outerPoints, 64);
    const flaskOuter = new THREE.Mesh(outerGeometry, borosilicateGlass.clone());
    flaskOuter.castShadow = true;

    // ============================================
    // INNER PROFILE
    // ============================================
    const innerPoints = [];
    const innerSphereRadius = sphereRadius - wallThickness;

    // Inner sphere
    for (let i = 0; i <= sphereSegments; i++) {
        const t = i / sphereSegments;
        const angle = startAngle + totalAngle * t;
        const r = Math.cos(angle) * innerSphereRadius;
        const y = Math.sin(angle) * innerSphereRadius + sphereRadius;
        innerPoints.push(new THREE.Vector2(r, y));
    }

    // Inner neck transition
    const innerNeckJoinR = Math.cos(neckAngle) * innerSphereRadius;
    for (let i = 1; i <= transitionSteps; i++) {
        const t = i / transitionSteps;
        const smoothT = t * t * (3 - 2 * t);
        const r = innerNeckJoinR - (innerNeckJoinR - (neckRadius - wallThickness)) * smoothT;
        const y = neckJoinY + 0.2 * t;
        innerPoints.push(new THREE.Vector2(r, y));
    }

    // Inner neck
    innerPoints.push(new THREE.Vector2(neckRadius - wallThickness, neckStartY));
    innerPoints.push(new THREE.Vector2(neckRadius - wallThickness, neckStartY + neckHeight + 0.03));

    const innerGeometry = new THREE.LatheGeometry(innerPoints, 64);
    const innerMat = borosilicateGlass.clone();
    innerMat.side = THREE.BackSide;
    const flaskInner = new THREE.Mesh(innerGeometry, innerMat);

    // ============================================
    // LIQUID - Follows spherical contour
    // ============================================
    const liquidLevel = 0.45;  // 45% full
    const liquidPoints = [];

    // Liquid height in the sphere
    const liquidAngle = Math.asin(liquidLevel - 0.5) + Math.PI / 6;
    const liquidMaxAngle = Math.min(liquidAngle, neckAngle * 0.6);

    for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const angle = startAngle + (liquidMaxAngle - startAngle) * t;
        const r = Math.cos(angle) * (innerSphereRadius - 0.02);
        const y = Math.sin(angle) * (innerSphereRadius - 0.02) + sphereRadius;
        liquidPoints.push(new THREE.Vector2(r, y));
    }

    // Flat top with slight meniscus
    const liquidTopY = liquidPoints[liquidPoints.length - 1].y;
    const liquidTopR = liquidPoints[liquidPoints.length - 1].x;

    for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const r = liquidTopR * (1 - t);
        const meniscus = 0.03 * Math.pow(t, 2);
        liquidPoints.push(new THREE.Vector2(r, liquidTopY + meniscus));
    }

    const liquidGeometry = new THREE.LatheGeometry(liquidPoints, 48);
    const liquid = new THREE.Mesh(liquidGeometry, aqueousSolutionMaterial.clone());

    // ============================================
    // SIMPLE HIGHLIGHT (glass reflection)
    // ============================================
    const highlightCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.1, 0.4, 0.6),
        new THREE.Vector3(-1.3, 1.2, 0.5),
        new THREE.Vector3(-1.2, 2.0, 0.4),
        new THREE.Vector3(-0.6, 2.8, 0.2)
    ]);
    const highlightGeometry = new THREE.TubeGeometry(highlightCurve, 16, 0.02, 6, false);
    const highlightMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3
    });
    const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);

    // Assemble
    group.add(flaskOuter);
    group.add(flaskInner);
    group.add(liquid);
    group.add(highlight);

    // Position so bottom of sphere sits on table
    group.position.y = -1.9;

    return group;
}

// ============================================
// SCENE MANAGEMENT
// ============================================

function clearModels() {
    currentModels.forEach(model => {
        scene.remove(model);
        model.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    });
    currentModels = [];
}

function showModel(modelType) {
    clearModels();

    // Update info panel
    const info = modelInfo[modelType];
    document.getElementById('model-name').textContent = info.name;
    document.getElementById('model-description').textContent = info.description;

    if (modelType === 'all') {
        // Show all models in a row
        const models = [
            { create: createStirBar, x: -5 },
            { create: createBeaker, x: -2.5 },
            { create: createTestTube, x: 0 },
            { create: createErlenmeyerFlask, x: 2.5 },
            { create: createRoundBottomFlask, x: 5 }
        ];

        models.forEach(({ create, x }) => {
            const model = create();
            model.position.x = x;
            model.scale.setScalar(0.7);
            scene.add(model);
            currentModels.push(model);
        });

        camera.position.set(0, 5, 15);
    } else {
        let model;
        switch (modelType) {
            case 'stir-bar':
                model = createStirBar();
                break;
            case 'beaker':
                model = createBeaker();
                break;
            case 'test-tube':
                model = createTestTube();
                break;
            case 'erlenmeyer':
                model = createErlenmeyerFlask();
                break;
            case 'round-bottom':
                model = createRoundBottomFlask();
                break;
        }

        if (model) {
            scene.add(model);
            currentModels.push(model);
            camera.position.set(5, 4, 8);
        }
    }

    controls.target.set(0, 0, 0);
    controls.update();
}

// ============================================
// EVENT HANDLERS
// ============================================

// Button click handlers
document.querySelectorAll('.controls button').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.controls button').forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        showModel(button.dataset.model);
    });
});

// Window resize
window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});

// ============================================
// ANIMATION LOOP
// ============================================

function animate() {
    requestAnimationFrame(animate);

    // Subtle rotation for stir bar when it's the active model
    const activeButton = document.querySelector('.controls button.active');
    if (activeButton && activeButton.dataset.model === 'stir-bar' && currentModels.length > 0) {
        currentModels[0].rotation.y += 0.02;
    }

    controls.update();
    renderer.render(scene, camera);
}

// Initialize with stir bar
showModel('stir-bar');
animate();

console.log('3D Laboratory Equipment Viewer initialized');
