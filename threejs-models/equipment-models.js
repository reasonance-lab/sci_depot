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
    'beaker': { name: 'Laboratory Beaker', description: 'Graduated borosilicate glass beaker with pour spout' },
    'test-tube': { name: 'Microcentrifuge Tube', description: '1.5mL microcentrifuge tube with snap cap' },
    'erlenmeyer': { name: 'Erlenmeyer Flask', description: 'Conical flask for mixing and heating solutions' },
    'round-bottom': { name: '500mL Round Bottom Flask', description: 'Borosilicate glass with 24/40 ground glass joint, meniscus effect, and volume markings' },
    'all': { name: 'All Equipment', description: 'Complete laboratory equipment collection' }
};

// ============================================
// MODEL CREATION FUNCTIONS
// ============================================

function createStirBar() {
    const group = new THREE.Group();

    // Main body - capsule shape using lathe
    const capsulePoints = [];
    const segments = 32;
    const length = 2.0;
    const radius = 0.25;

    // Create capsule profile
    for (let i = 0; i <= segments; i++) {
        const angle = (Math.PI / 2) * (i / segments);
        capsulePoints.push(new THREE.Vector2(
            Math.cos(angle) * radius,
            -length/2 + Math.sin(angle) * radius
        ));
    }
    for (let i = 0; i <= segments; i++) {
        const angle = (Math.PI / 2) + (Math.PI / 2) * (i / segments);
        capsulePoints.push(new THREE.Vector2(
            Math.cos(angle) * radius,
            length/2 - radius + Math.sin(angle) * radius + radius
        ));
    }

    const capsuleGeometry = new THREE.LatheGeometry(capsulePoints, 32);
    const stirBar = new THREE.Mesh(capsuleGeometry, ptfeMaterial.clone());
    stirBar.rotation.z = Math.PI / 2;
    stirBar.castShadow = true;
    stirBar.position.y = -1.75;

    // Add subtle highlight ring
    const ringGeometry = new THREE.TorusGeometry(0.28, 0.02, 8, 32);
    const highlightMaterial = new THREE.MeshStandardMaterial({
        color: 0x606060,
        metalness: 0.3,
        roughness: 0.2
    });
    const ring1 = new THREE.Mesh(ringGeometry, highlightMaterial);
    ring1.rotation.y = Math.PI / 2;
    ring1.position.x = -0.6;
    ring1.position.y = -1.75;

    const ring2 = ring1.clone();
    ring2.position.x = 0.6;

    group.add(stirBar, ring1, ring2);
    return group;
}

function createBeaker() {
    const group = new THREE.Group();

    // Beaker body using lathe geometry
    const beakerPoints = [];
    const height = 3.0;
    const bottomRadius = 1.2;
    const topRadius = 1.4;
    const wallThickness = 0.08;

    // Outer profile
    beakerPoints.push(new THREE.Vector2(bottomRadius - 0.1, 0)); // Slight curve at bottom
    beakerPoints.push(new THREE.Vector2(bottomRadius, 0.1));
    beakerPoints.push(new THREE.Vector2(topRadius, height));
    beakerPoints.push(new THREE.Vector2(topRadius + 0.1, height + 0.05)); // Lip
    beakerPoints.push(new THREE.Vector2(topRadius - wallThickness + 0.1, height + 0.05));
    beakerPoints.push(new THREE.Vector2(topRadius - wallThickness, height));
    beakerPoints.push(new THREE.Vector2(bottomRadius - wallThickness, 0.1));
    beakerPoints.push(new THREE.Vector2(bottomRadius - wallThickness - 0.05, 0.05));

    const beakerGeometry = new THREE.LatheGeometry(beakerPoints, 64);
    const beaker = new THREE.Mesh(beakerGeometry, glassMaterial.clone());
    beaker.castShadow = true;
    beaker.receiveShadow = true;
    beaker.position.y = -1.9;

    // Pour spout
    const spoutShape = new THREE.Shape();
    spoutShape.moveTo(0, 0);
    spoutShape.lineTo(0.3, 0.4);
    spoutShape.lineTo(0, 0.5);
    spoutShape.lineTo(-0.3, 0.4);
    spoutShape.lineTo(0, 0);

    const spoutGeometry = new THREE.ExtrudeGeometry(spoutShape, {
        depth: 0.15,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02,
        bevelSegments: 3
    });
    const spout = new THREE.Mesh(spoutGeometry, glassMaterial.clone());
    spout.position.set(1.35, height - 1.9 - 0.3, 0);
    spout.rotation.z = -Math.PI / 2;
    spout.rotation.y = Math.PI / 2;

    // Graduation marks (using thin cylinders)
    const markMaterial = new THREE.MeshBasicMaterial({ color: 0x6ba3be, transparent: true, opacity: 0.6 });
    const markPositions = [0.8, 1.4, 2.0, 2.6];

    markPositions.forEach((y, i) => {
        const markWidth = i % 2 === 0 ? 0.4 : 0.25;
        const markGeometry = new THREE.BoxGeometry(0.02, 0.02, markWidth);
        const mark = new THREE.Mesh(markGeometry, markMaterial);
        mark.position.set(1.25, y - 1.9 + 0.2, 0);
        group.add(mark);
    });

    // Liquid inside (partial fill)
    const liquidPoints = [];
    liquidPoints.push(new THREE.Vector2(0, 0));
    liquidPoints.push(new THREE.Vector2(bottomRadius - wallThickness - 0.02, 0.05));
    liquidPoints.push(new THREE.Vector2(bottomRadius - wallThickness + 0.25, 1.5));
    liquidPoints.push(new THREE.Vector2(0, 1.5));

    const liquidGeometry = new THREE.LatheGeometry(liquidPoints, 64);
    const liquid = new THREE.Mesh(liquidGeometry, liquidMaterial.clone());
    liquid.position.y = -1.85;

    group.add(beaker, spout, liquid);
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

    // Flask body - conical shape with neck
    const flaskPoints = [];
    const bodyHeight = 2.5;
    const neckHeight = 1.2;
    const bottomRadius = 1.8;
    const neckRadius = 0.4;
    const wallThickness = 0.06;

    // Bottom curve
    flaskPoints.push(new THREE.Vector2(0, 0));
    flaskPoints.push(new THREE.Vector2(bottomRadius * 0.3, 0.02));
    flaskPoints.push(new THREE.Vector2(bottomRadius * 0.7, 0.08));
    flaskPoints.push(new THREE.Vector2(bottomRadius, 0.15));

    // Conical body transitioning to neck
    const transitionHeight = bodyHeight * 0.7;
    flaskPoints.push(new THREE.Vector2(bottomRadius, 0.2));

    // Smooth transition from body to neck using bezier-like curve
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = 0.2 + transitionHeight * t + (bodyHeight - transitionHeight) * Math.pow(t, 2);
        const r = bottomRadius - (bottomRadius - neckRadius) * Math.pow(t, 0.8);
        flaskPoints.push(new THREE.Vector2(r, y));
    }

    // Neck
    flaskPoints.push(new THREE.Vector2(neckRadius, bodyHeight + 0.5));
    flaskPoints.push(new THREE.Vector2(neckRadius, bodyHeight + neckHeight));

    // Rim
    flaskPoints.push(new THREE.Vector2(neckRadius + 0.08, bodyHeight + neckHeight + 0.02));
    flaskPoints.push(new THREE.Vector2(neckRadius + 0.08, bodyHeight + neckHeight + 0.1));
    flaskPoints.push(new THREE.Vector2(neckRadius - wallThickness, bodyHeight + neckHeight + 0.1));

    const flaskGeometry = new THREE.LatheGeometry(flaskPoints, 64);
    const flask = new THREE.Mesh(flaskGeometry, glassMaterial.clone());
    flask.position.y = -1.9;
    flask.castShadow = true;
    flask.receiveShadow = true;

    // Liquid inside
    const liquidPoints3 = [];
    liquidPoints3.push(new THREE.Vector2(0, 0.1));
    liquidPoints3.push(new THREE.Vector2(bottomRadius - wallThickness - 0.05, 0.15));

    const liquidHeight = 1.2;
    for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const y = 0.15 + liquidHeight * t;
        const r = (bottomRadius - wallThickness - 0.05) - (bottomRadius - neckRadius - 0.3) * Math.pow(t, 0.8) * 0.4;
        liquidPoints3.push(new THREE.Vector2(r, y));
    }
    liquidPoints3.push(new THREE.Vector2(0, liquidHeight + 0.15));

    const liquidGeometry3 = new THREE.LatheGeometry(liquidPoints3, 64);
    const flaskLiquid = new THREE.Mesh(liquidGeometry3, liquidMaterial.clone());
    flaskLiquid.position.y = -1.85;

    // Glass reflection line (decorative)
    const reflectionGeometry = new THREE.CylinderGeometry(0.02, 0.02, 2, 8);
    const reflectionMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3
    });
    const reflection = new THREE.Mesh(reflectionGeometry, reflectionMaterial);
    reflection.position.set(-1.2, -0.5, 0.5);
    reflection.rotation.z = 0.2;

    group.add(flask, flaskLiquid, reflection);
    return group;
}

function createRoundBottomFlask() {
    const group = new THREE.Group();

    // ============================================
    // DIMENSIONS - Based on real 500mL RB Flask
    // ============================================
    const sphereRadius = 1.6;           // Main bulb radius
    const wallThickness = 0.08;         // Realistic glass thickness
    const neckOuterRadius = 0.38;       // Neck outer radius
    const neckInnerRadius = neckOuterRadius - wallThickness;
    const neckHeight = 1.0;             // Straight neck section
    const jointHeight = 0.5;            // 24/40 ground glass joint height
    const jointTopRadius = 0.32;        // Tapered joint top (smaller)
    const jointBottomRadius = 0.42;     // Tapered joint bottom (larger)

    // ============================================
    // OUTER FLASK SURFACE
    // ============================================
    const outerPoints = [];
    const segments = 80;  // High resolution for smooth curves

    // Perfect hemisphere bottom (180 degrees)
    for (let i = 0; i <= segments; i++) {
        const angle = -Math.PI/2 + (Math.PI/2) * (i / segments);
        outerPoints.push(new THREE.Vector2(
            Math.cos(angle) * sphereRadius,
            Math.sin(angle) * sphereRadius + sphereRadius
        ));
    }

    // Smooth sphere-to-neck transition using cubic Bezier-like curve
    // This creates the characteristic "shoulder" of real RB flasks
    const transitionSteps = 30;
    const sphereTopY = sphereRadius * 2;
    const sphereTopR = sphereRadius;
    const neckBottomY = sphereTopY + 0.4;  // Transition zone

    for (let i = 1; i <= transitionSteps; i++) {
        const t = i / transitionSteps;
        // Smooth cubic interpolation for natural curve
        const smoothT = t * t * (3 - 2 * t);  // Smoothstep
        const r = sphereTopR - (sphereTopR - neckOuterRadius) * smoothT;
        const y = sphereTopY + (neckBottomY - sphereTopY) * t;
        outerPoints.push(new THREE.Vector2(r, y));
    }

    // Straight neck section
    const neckStartY = neckBottomY;
    outerPoints.push(new THREE.Vector2(neckOuterRadius, neckStartY + neckHeight));

    // 24/40 Ground glass joint - tapered section
    const jointStartY = neckStartY + neckHeight;
    outerPoints.push(new THREE.Vector2(jointBottomRadius, jointStartY));
    outerPoints.push(new THREE.Vector2(jointTopRadius, jointStartY + jointHeight));

    // Beaded rim at top
    const rimRadius = jointTopRadius + 0.06;
    outerPoints.push(new THREE.Vector2(rimRadius, jointStartY + jointHeight + 0.02));
    outerPoints.push(new THREE.Vector2(rimRadius, jointStartY + jointHeight + 0.08));
    outerPoints.push(new THREE.Vector2(jointTopRadius - 0.02, jointStartY + jointHeight + 0.1));

    const outerGeometry = new THREE.LatheGeometry(outerPoints, 96);
    const outerFlask = new THREE.Mesh(outerGeometry, borosilicateGlass.clone());
    outerFlask.castShadow = true;
    outerFlask.receiveShadow = true;

    // ============================================
    // INNER FLASK SURFACE (for wall thickness)
    // ============================================
    const innerPoints = [];
    const innerRadius = sphereRadius - wallThickness;

    // Inner hemisphere
    for (let i = 0; i <= segments; i++) {
        const angle = -Math.PI/2 + (Math.PI/2) * (i / segments);
        innerPoints.push(new THREE.Vector2(
            Math.cos(angle) * innerRadius,
            Math.sin(angle) * innerRadius + sphereRadius
        ));
    }

    // Inner transition
    for (let i = 1; i <= transitionSteps; i++) {
        const t = i / transitionSteps;
        const smoothT = t * t * (3 - 2 * t);
        const r = innerRadius - (innerRadius - neckInnerRadius) * smoothT;
        const y = sphereTopY + (neckBottomY - sphereTopY) * t;
        innerPoints.push(new THREE.Vector2(r, y));
    }

    // Inner neck
    innerPoints.push(new THREE.Vector2(neckInnerRadius, neckStartY + neckHeight));
    innerPoints.push(new THREE.Vector2(jointBottomRadius - wallThickness, jointStartY));
    innerPoints.push(new THREE.Vector2(jointTopRadius - wallThickness * 0.8, jointStartY + jointHeight));

    const innerGeometry = new THREE.LatheGeometry(innerPoints, 96);
    const innerMaterial = borosilicateGlass.clone();
    innerMaterial.side = THREE.BackSide;
    const innerFlask = new THREE.Mesh(innerGeometry, innerMaterial);

    // ============================================
    // GROUND GLASS JOINT OVERLAY
    // ============================================
    const jointPoints = [];
    jointPoints.push(new THREE.Vector2(jointBottomRadius - 0.001, jointStartY));
    jointPoints.push(new THREE.Vector2(jointTopRadius - 0.001, jointStartY + jointHeight));
    jointPoints.push(new THREE.Vector2(jointTopRadius - wallThickness + 0.001, jointStartY + jointHeight));
    jointPoints.push(new THREE.Vector2(jointBottomRadius - wallThickness + 0.001, jointStartY));

    const jointGeometry = new THREE.LatheGeometry(jointPoints, 64);
    const groundJoint = new THREE.Mesh(jointGeometry, groundGlassMaterial.clone());

    // Add subtle texture lines to ground glass joint
    const jointLinesMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.15
    });

    for (let i = 0; i < 12; i++) {
        const lineY = jointStartY + (jointHeight * i / 12);
        const lineR = jointBottomRadius - (jointBottomRadius - jointTopRadius) * (i / 12);
        const lineGeometry = new THREE.TorusGeometry(lineR, 0.003, 4, 48);
        const line = new THREE.Mesh(lineGeometry, jointLinesMaterial);
        line.rotation.x = Math.PI / 2;
        line.position.y = lineY;
        group.add(line);
    }

    // ============================================
    // LIQUID WITH MENISCUS EFFECT
    // ============================================
    const liquidLevel = 0.55;  // 55% full
    const liquidPoints = [];
    const liquidMaxY = sphereRadius + sphereRadius * liquidLevel * 0.7;

    // Liquid follows inner sphere contour
    for (let i = 0; i <= 50; i++) {
        const angle = -Math.PI/2 + (Math.PI * 0.42) * (i / 50);
        const r = Math.cos(angle) * (innerRadius - 0.02);
        const y = Math.sin(angle) * (innerRadius - 0.02) + sphereRadius;
        if (y <= liquidMaxY) {
            liquidPoints.push(new THREE.Vector2(r, y));
        }
    }

    // Find the radius at liquid surface level
    const surfaceAngle = Math.asin((liquidMaxY - sphereRadius) / (innerRadius - 0.02));
    const surfaceRadius = Math.cos(surfaceAngle) * (innerRadius - 0.02);

    // Meniscus curve - liquid curves up at the glass wall
    const meniscusSteps = 15;
    const meniscusHeight = 0.08;  // Height of meniscus climb

    for (let i = 0; i <= meniscusSteps; i++) {
        const t = i / meniscusSteps;
        // Meniscus profile: curves up at edge, flat in center
        const meniscusCurve = Math.pow(t, 2.5);  // Sharp rise at edge
        const r = surfaceRadius * (1 - t);
        const y = liquidMaxY + meniscusHeight * meniscusCurve;
        liquidPoints.push(new THREE.Vector2(r, y));
    }

    const liquidGeometry = new THREE.LatheGeometry(liquidPoints, 64);
    const liquid = new THREE.Mesh(liquidGeometry, aqueousSolutionMaterial.clone());

    // ============================================
    // VOLUME MARKINGS
    // ============================================
    const markMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.5
    });

    // Add volume marks at key positions
    const volumeMarks = [
        { y: sphereRadius * 0.7, label: '100' },
        { y: sphereRadius * 1.2, label: '250' },
        { y: sphereRadius * 1.6, label: '400' },
        { y: sphereRadius * 1.9, label: '500' }
    ];

    volumeMarks.forEach(mark => {
        // Calculate radius at this height for the sphere
        const relY = mark.y - sphereRadius;
        const markRadius = Math.sqrt(Math.max(0, sphereRadius * sphereRadius - relY * relY));

        if (markRadius > 0.2) {
            // Main mark line
            const markWidth = 0.3;
            const markGeometry = new THREE.TorusGeometry(markRadius + 0.01, 0.008, 4, 32, markWidth);
            const markMesh = new THREE.Mesh(markGeometry, markMaterial);
            markMesh.rotation.x = Math.PI / 2;
            markMesh.rotation.z = -0.5;  // Position marks on one side
            markMesh.position.y = mark.y;
            group.add(markMesh);

            // Small tick marks
            const tickGeometry = new THREE.BoxGeometry(0.15, 0.01, 0.01);
            const tick = new THREE.Mesh(tickGeometry, markMaterial);
            tick.position.set(markRadius + 0.08, mark.y, 0);
            group.add(tick);
        }
    });

    // ============================================
    // GLASS REFLECTIONS / HIGHLIGHTS
    // ============================================
    // Vertical highlight line (simulates window reflection)
    const highlightCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.2, 0.5, 0.5),
        new THREE.Vector3(-1.35, 1.5, 0.4),
        new THREE.Vector3(-1.1, 2.5, 0.3),
        new THREE.Vector3(-0.3, 3.5, 0.2)
    ]);
    const highlightGeometry = new THREE.TubeGeometry(highlightCurve, 20, 0.015, 8, false);
    const highlightMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.35
    });
    const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    group.add(highlight);

    // Secondary smaller highlight
    const highlight2Curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.9, 0.8, -0.8),
        new THREE.Vector3(1.0, 1.8, -0.6)
    ]);
    const highlight2Geometry = new THREE.TubeGeometry(highlight2Curve, 10, 0.01, 6, false);
    const highlight2 = new THREE.Mesh(highlight2Geometry, highlightMaterial);
    highlight2.material = highlightMaterial.clone();
    highlight2.material.opacity = 0.2;
    group.add(highlight2);

    // ============================================
    // CAUSTIC HINT (light pattern on table)
    // ============================================
    const causticGeometry = new THREE.RingGeometry(0.8, 1.5, 32);
    const causticMaterial = new THREE.MeshBasicMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide
    });
    const caustic = new THREE.Mesh(causticGeometry, causticMaterial);
    caustic.rotation.x = -Math.PI / 2;
    caustic.position.y = -sphereRadius + 0.01;
    group.add(caustic);

    // ============================================
    // ASSEMBLE AND POSITION
    // ============================================
    group.add(outerFlask);
    group.add(innerFlask);
    group.add(groundJoint);
    group.add(liquid);

    // Center the flask
    group.position.y = -1.6;

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
