import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 2;
controls.maxDistance = 20;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
mainLight.position.set(5, 10, 7);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 2048;
mainLight.shadow.mapSize.height = 2048;
mainLight.shadow.camera.near = 0.5;
mainLight.shadow.camera.far = 50;
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);

const rimLight = new THREE.PointLight(0x00d4ff, 0.5, 20);
rimLight.position.set(-3, 3, -3);
scene.add(rimLight);

// Floor/table surface
const tableGeometry = new THREE.CylinderGeometry(8, 8, 0.2, 64);
const tableMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2a4a,
    metalness: 0.3,
    roughness: 0.7
});
const table = new THREE.Mesh(tableGeometry, tableMaterial);
table.position.y = -2;
table.receiveShadow = true;
scene.add(table);

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

const plasticCapMaterial = new THREE.MeshStandardMaterial({
    color: 0xeeeeee,
    metalness: 0.0,
    roughness: 0.3
});

// Model groups
let currentModels = [];

// Model info data
const modelInfo = {
    'stir-bar': { name: 'Magnetic Stir Bar', description: 'PTFE-coated magnetic stir bar for mixing solutions' },
    'beaker': { name: 'Laboratory Beaker', description: 'Graduated borosilicate glass beaker with pour spout' },
    'test-tube': { name: 'Microcentrifuge Tube', description: '1.5mL microcentrifuge tube with snap cap' },
    'erlenmeyer': { name: 'Erlenmeyer Flask', description: 'Conical flask for mixing and heating solutions' },
    'round-bottom': { name: 'Round Bottom Flask', description: 'Spherical flask for rotary evaporation and reactions' },
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

    // Spherical body with neck
    const sphereRadius = 1.5;
    const neckRadius = 0.35;
    const neckHeight = 1.5;
    const wallThickness = 0.05;

    const flaskPoints = [];

    // Spherical bottom (270 degrees of sphere)
    const sphereSegments = 40;
    for (let i = 0; i <= sphereSegments; i++) {
        const angle = -Math.PI/2 + (Math.PI * 0.85) * (i / sphereSegments);
        flaskPoints.push(new THREE.Vector2(
            Math.cos(angle) * sphereRadius,
            Math.sin(angle) * sphereRadius + sphereRadius
        ));
    }

    // Transition to neck
    const transitionSteps = 10;
    const startRadius = Math.cos(Math.PI * 0.35) * sphereRadius;
    const startY = Math.sin(Math.PI * 0.35) * sphereRadius + sphereRadius;

    for (let i = 1; i <= transitionSteps; i++) {
        const t = i / transitionSteps;
        const r = startRadius - (startRadius - neckRadius) * t;
        const y = startY + 0.3 * t;
        flaskPoints.push(new THREE.Vector2(r, y));
    }

    // Neck
    const neckStart = startY + 0.3;
    flaskPoints.push(new THREE.Vector2(neckRadius, neckStart + neckHeight));

    // Rim
    flaskPoints.push(new THREE.Vector2(neckRadius + 0.1, neckStart + neckHeight + 0.02));
    flaskPoints.push(new THREE.Vector2(neckRadius + 0.1, neckStart + neckHeight + 0.12));
    flaskPoints.push(new THREE.Vector2(neckRadius - wallThickness, neckStart + neckHeight + 0.12));

    const rbFlaskGeometry = new THREE.LatheGeometry(flaskPoints, 64);
    const rbFlask = new THREE.Mesh(rbFlaskGeometry, glassMaterial.clone());
    rbFlask.position.y = -1.9;
    rbFlask.castShadow = true;
    rbFlask.receiveShadow = true;

    // Liquid (partial fill in sphere)
    const liquidPoints4 = [];
    const liquidLevel = 0.6; // 60% full

    for (let i = 0; i <= 30; i++) {
        const angle = -Math.PI/2 + (Math.PI * liquidLevel * 0.5) * (i / 30);
        const r = Math.cos(angle) * (sphereRadius - wallThickness);
        const y = Math.sin(angle) * (sphereRadius - wallThickness) + sphereRadius;
        liquidPoints4.push(new THREE.Vector2(r, y));
    }
    liquidPoints4.push(new THREE.Vector2(0, liquidPoints4[liquidPoints4.length-1].y));

    const liquidGeometry4 = new THREE.LatheGeometry(liquidPoints4, 64);
    const rbLiquid = new THREE.Mesh(liquidGeometry4, liquidMaterial.clone());
    rbLiquid.position.y = -1.85;

    group.add(rbFlask, rbLiquid);
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
