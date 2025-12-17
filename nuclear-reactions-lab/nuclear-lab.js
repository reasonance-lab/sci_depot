/**
 * Nuclear Reactions Lab - Interactive 3D Simulation
 * Implements nuclear fission with corresponding fission products
 */

class NuclearLab {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.nucleusGroup = null;
        this.particles = [];
        this.isAnimating = false;
        this.currentNucleus = null;
        this.animationId = null;

        // Nucleus definitions
        this.nuclei = {
            'U-235': { symbol: 'U-235', name: 'Uranium', Z: 92, N: 143, A: 235, color: '#22d3ee' },
            'Ba-141': { symbol: 'Ba-141', name: 'Barium', Z: 56, N: 85, A: 141, color: '#10b981' },
            'Kr-92': { symbol: 'Kr-92', name: 'Krypton', Z: 36, N: 56, A: 92, color: '#f59e0b' },
            'Pu-239': { symbol: 'Pu-239', name: 'Plutonium', Z: 94, N: 145, A: 239, color: '#8b5cf6' }
        };

        // Fission reactions
        this.fissionReactions = {
            'u235-fission': {
                parent: 'U-235',
                products: ['Ba-141', 'Kr-92'],
                neutrons: 3,
                equation: 'U-235 → Ba-141 + Kr-92 + 3n',
                energy: '200 MeV'
            },
            'pu239-fission': {
                parent: 'Pu-239',
                products: ['Ba-144', 'Kr-89'],
                neutrons: 3,
                equation: 'Pu-239 → Ba-144 + Kr-89 + 3n',
                energy: '210 MeV'
            }
        };

        this.init();
    }

    init() {
        this.setupScene();
        this.setupLighting();
        this.createNucleus('U-235');
        this.setupEventListeners();
        this.animate();
        this.updateUI('U-235');
    }

    setupScene() {
        const container = document.getElementById('visualizationContainer');
        const canvas = document.getElementById('nucleusCanvas');

        // Scene
        this.scene = new THREE.Scene();

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            60,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.z = 15;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x000000, 0);

        // Handle resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        // Point lights for 3D effect
        const pointLight1 = new THREE.PointLight(0xffffff, 0.8);
        pointLight1.position.set(10, 10, 10);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x4488ff, 0.4);
        pointLight2.position.set(-10, -10, 5);
        this.scene.add(pointLight2);
    }

    createNucleus(nucleusType, targetGroup = null, scale = 1) {
        const nucleus = this.nuclei[nucleusType];
        if (!nucleus) return null;

        const group = targetGroup || new THREE.Group();

        // Clear existing particles if using main group
        if (!targetGroup && this.nucleusGroup) {
            this.scene.remove(this.nucleusGroup);
        }

        const protonCount = nucleus.Z;
        const neutronCount = nucleus.N;
        const totalParticles = protonCount + neutronCount;

        // Calculate radius based on particle count (nuclear radius formula)
        const baseRadius = 0.4 * scale;
        const nucleusRadius = baseRadius * Math.pow(totalParticles, 1/3) * 1.2;

        // Particle geometry and materials
        const particleRadius = 0.35 * scale;
        const geometry = new THREE.SphereGeometry(particleRadius, 16, 16);

        const protonMaterial = new THREE.MeshPhongMaterial({
            color: 0xdc2626,
            shininess: 100,
            specular: 0x444444
        });

        const neutronMaterial = new THREE.MeshPhongMaterial({
            color: 0x3b82f6,
            shininess: 100,
            specular: 0x444444
        });

        // Create particles array for this nucleus
        const nucleusParticles = [];

        // Place particles using a sphere packing algorithm
        const positions = this.generateNucleusPositions(totalParticles, nucleusRadius, particleRadius);

        // Shuffle positions and assign protons/neutrons
        this.shuffleArray(positions);

        for (let i = 0; i < totalParticles; i++) {
            const isProton = i < protonCount;
            const material = isProton ? protonMaterial : neutronMaterial;
            const particle = new THREE.Mesh(geometry, material.clone());

            particle.position.copy(positions[i]);
            particle.userData = {
                isProton: isProton,
                originalPosition: positions[i].clone(),
                velocity: new THREE.Vector3()
            };

            group.add(particle);
            nucleusParticles.push(particle);
        }

        if (!targetGroup) {
            this.nucleusGroup = group;
            this.particles = nucleusParticles;
            this.scene.add(this.nucleusGroup);
            this.currentNucleus = nucleusType;
        }

        return { group, particles: nucleusParticles };
    }

    generateNucleusPositions(count, maxRadius, particleRadius) {
        const positions = [];
        const minDistance = particleRadius * 2.2;

        // Use golden spiral for initial distribution
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));

        for (let i = 0; i < count; i++) {
            let position;
            let attempts = 0;
            const maxAttempts = 100;

            do {
                // Golden spiral distribution
                const t = i / count;
                const inclination = Math.acos(1 - 2 * t);
                const azimuth = goldenAngle * i;

                // Add some randomness
                const r = maxRadius * (0.3 + 0.7 * Math.pow(Math.random(), 0.5));
                const theta = inclination + (Math.random() - 0.5) * 0.5;
                const phi = azimuth + (Math.random() - 0.5) * 0.5;

                position = new THREE.Vector3(
                    r * Math.sin(theta) * Math.cos(phi),
                    r * Math.sin(theta) * Math.sin(phi),
                    r * Math.cos(theta)
                );

                attempts++;
            } while (this.checkCollision(position, positions, minDistance) && attempts < maxAttempts);

            positions.push(position);
        }

        return positions;
    }

    checkCollision(position, existingPositions, minDistance) {
        for (const existing of existingPositions) {
            if (position.distanceTo(existing) < minDistance) {
                return true;
            }
        }
        return false;
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    triggerFission() {
        if (this.isAnimating) return;
        this.isAnimating = true;

        const reactionType = document.getElementById('reactionSelect').value;
        const reaction = this.fissionReactions[reactionType];

        if (!reaction) {
            console.error('Unknown reaction type');
            this.isAnimating = false;
            return;
        }

        // Update equation display
        document.querySelector('.equation-text').textContent = reaction.equation;

        // Start the fission animation sequence
        this.animateFission(reaction);
    }

    animateFission(reaction) {
        const duration = 2000;
        const startTime = Date.now();

        // Phase 1: Vibration and expansion (0-30%)
        // Phase 2: Split into products (30-60%)
        // Phase 3: Products fly apart + neutrons (60-100%)

        // Store original positions
        const originalPositions = this.particles.map(p => p.position.clone());

        // Determine which particles go to which product
        const totalParticles = this.particles.length;
        const product1Nucleus = this.nuclei[reaction.products[0]];
        const product2Nucleus = this.nuclei[reaction.products[1]];

        const product1ParticleCount = product1Nucleus ? (product1Nucleus.Z + product1Nucleus.N) : Math.floor(totalParticles * 0.6);
        const product2ParticleCount = product2Nucleus ? (product2Nucleus.Z + product2Nucleus.N) : totalParticles - product1ParticleCount - reaction.neutrons;

        // Sort particles by x position and assign to products
        const sortedIndices = this.particles
            .map((p, i) => ({ index: i, x: p.position.x }))
            .sort((a, b) => a.x - b.x);

        const product1Indices = new Set(sortedIndices.slice(0, product1ParticleCount).map(p => p.index));
        const product2Indices = new Set(sortedIndices.slice(product1ParticleCount, product1ParticleCount + product2ParticleCount).map(p => p.index));
        const neutronIndices = new Set(sortedIndices.slice(product1ParticleCount + product2ParticleCount).map(p => p.index));

        // Generate random directions for neutrons
        const neutronDirections = [];
        for (let i = 0; i < reaction.neutrons; i++) {
            const angle = (Math.PI * 2 * i) / reaction.neutrons + Math.random() * 0.5;
            neutronDirections.push(new THREE.Vector3(
                Math.cos(angle) * 2,
                Math.sin(angle) * 2,
                (Math.random() - 0.5) * 2
            ));
        }

        // Show energy burst
        const energyBurst = document.getElementById('energyBurst');

        const animateFissionFrame = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Phase 1: Vibration (0-30%)
            if (progress < 0.3) {
                const phaseProgress = progress / 0.3;
                const vibrationIntensity = phaseProgress * 0.3;
                const expansionFactor = 1 + phaseProgress * 0.2;

                this.particles.forEach((particle, i) => {
                    const original = originalPositions[i];
                    particle.position.x = original.x * expansionFactor + (Math.random() - 0.5) * vibrationIntensity;
                    particle.position.y = original.y * expansionFactor + (Math.random() - 0.5) * vibrationIntensity;
                    particle.position.z = original.z * expansionFactor + (Math.random() - 0.5) * vibrationIntensity;
                });

                // Glow effect on nucleus
                this.particles.forEach(p => {
                    p.material.emissive = new THREE.Color(0xffaa00);
                    p.material.emissiveIntensity = phaseProgress * 0.5;
                });
            }
            // Phase 2: Split (30-60%)
            else if (progress < 0.6) {
                const phaseProgress = (progress - 0.3) / 0.3;

                // Trigger energy burst at start of split
                if (phaseProgress < 0.1) {
                    energyBurst.classList.add('active');
                }

                this.particles.forEach((particle, i) => {
                    const original = originalPositions[i];

                    if (product1Indices.has(i)) {
                        // Move left
                        particle.position.x = original.x - phaseProgress * 4;
                        particle.position.y = original.y + (Math.random() - 0.5) * 0.1;
                        particle.position.z = original.z + (Math.random() - 0.5) * 0.1;
                        particle.material.emissive = new THREE.Color(0x00ff00);
                    } else if (product2Indices.has(i)) {
                        // Move right
                        particle.position.x = original.x + phaseProgress * 4;
                        particle.position.y = original.y + (Math.random() - 0.5) * 0.1;
                        particle.position.z = original.z + (Math.random() - 0.5) * 0.1;
                        particle.material.emissive = new THREE.Color(0xffaa00);
                    } else if (neutronIndices.has(i)) {
                        // Neutrons fly outward
                        const neutronIndex = Array.from(neutronIndices).indexOf(i);
                        const dir = neutronDirections[neutronIndex] || new THREE.Vector3(0, 1, 0);
                        particle.position.x = original.x + dir.x * phaseProgress * 3;
                        particle.position.y = original.y + dir.y * phaseProgress * 3;
                        particle.position.z = original.z + dir.z * phaseProgress * 3;
                        particle.material.emissive = new THREE.Color(0x00aaff);
                        particle.material.emissiveIntensity = 1;
                    }

                    particle.material.emissiveIntensity = 0.5 * (1 - phaseProgress);
                });
            }
            // Phase 3: Products separate further (60-100%)
            else {
                const phaseProgress = (progress - 0.6) / 0.4;

                energyBurst.classList.remove('active');

                this.particles.forEach((particle, i) => {
                    const original = originalPositions[i];

                    if (product1Indices.has(i)) {
                        // Continue moving left and stabilize
                        const targetX = original.x - 6;
                        particle.position.x = original.x - 4 - phaseProgress * 2;
                        particle.material.emissive = new THREE.Color(0x000000);
                        particle.material.emissiveIntensity = 0;
                    } else if (product2Indices.has(i)) {
                        // Continue moving right and stabilize
                        particle.position.x = original.x + 4 + phaseProgress * 2;
                        particle.material.emissive = new THREE.Color(0x000000);
                        particle.material.emissiveIntensity = 0;
                    } else if (neutronIndices.has(i)) {
                        // Neutrons continue flying and fade
                        const neutronIndex = Array.from(neutronIndices).indexOf(i);
                        const dir = neutronDirections[neutronIndex] || new THREE.Vector3(0, 1, 0);
                        particle.position.x = original.x + dir.x * (3 + phaseProgress * 5);
                        particle.position.y = original.y + dir.y * (3 + phaseProgress * 5);
                        particle.position.z = original.z + dir.z * (3 + phaseProgress * 5);
                        particle.material.opacity = 1 - phaseProgress * 0.5;
                        particle.material.transparent = true;
                    }
                });
            }

            if (progress < 1) {
                requestAnimationFrame(animateFissionFrame);
            } else {
                // Animation complete - show final state
                this.showFissionProducts(reaction, product1Indices, product2Indices, neutronIndices);
            }
        };

        animateFissionFrame();
    }

    showFissionProducts(reaction, product1Indices, product2Indices, neutronIndices) {
        // Update UI to show products
        const product1 = reaction.products[0];
        const product2 = reaction.products[1];

        // Update nucleus info panel to show both products
        const nucleusSymbol = document.getElementById('nucleusSymbol');
        const nucleusDetails = document.getElementById('nucleusDetails');

        nucleusSymbol.innerHTML = `${product1} + ${product2}`;
        nucleusSymbol.style.fontSize = '24px';

        const p1 = this.nuclei[product1];
        const p2 = this.nuclei[product2];

        if (p1 && p2) {
            nucleusDetails.textContent = `${p1.name} (Z=${p1.Z}) + ${p2.name} (Z=${p2.Z}) + ${reaction.neutrons}n`;
        }

        // Create labels for the products in the scene
        this.createProductLabels(product1, product2, reaction.neutrons);

        // Allow reset after a delay
        setTimeout(() => {
            this.isAnimating = false;
        }, 500);
    }

    createProductLabels(product1Name, product2Name, neutronCount) {
        // Create floating labels using HTML overlay
        const container = document.getElementById('visualizationContainer');

        // Remove existing labels
        container.querySelectorAll('.product-label-3d').forEach(el => el.remove());

        // Product 1 label (left)
        const label1 = document.createElement('div');
        label1.className = 'product-label-3d';
        label1.innerHTML = `<span class="product-name">${product1Name}</span><span class="product-desc">Fission Product</span>`;
        label1.style.cssText = `
            position: absolute;
            left: 25%;
            top: 70%;
            transform: translateX(-50%);
            text-align: center;
            color: #10b981;
            font-weight: bold;
            font-size: 18px;
            text-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
            animation: fadeIn 0.5s ease-out;
        `;
        container.appendChild(label1);

        // Product 2 label (right)
        const label2 = document.createElement('div');
        label2.className = 'product-label-3d';
        label2.innerHTML = `<span class="product-name">${product2Name}</span><span class="product-desc">Fission Product</span>`;
        label2.style.cssText = `
            position: absolute;
            right: 25%;
            top: 70%;
            transform: translateX(50%);
            text-align: center;
            color: #f59e0b;
            font-weight: bold;
            font-size: 18px;
            text-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
            animation: fadeIn 0.5s ease-out;
        `;
        container.appendChild(label2);

        // Neutrons label (center)
        const neutronLabel = document.createElement('div');
        neutronLabel.className = 'product-label-3d';
        neutronLabel.innerHTML = `<span class="neutron-count">${neutronCount} Neutrons</span><span class="energy-release">+ Energy Released</span>`;
        neutronLabel.style.cssText = `
            position: absolute;
            left: 50%;
            top: 85%;
            transform: translateX(-50%);
            text-align: center;
            color: #3b82f6;
            font-weight: bold;
            font-size: 14px;
            text-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
            animation: fadeIn 0.5s ease-out 0.3s both;
        `;
        container.appendChild(neutronLabel);

        // Add CSS animation
        if (!document.getElementById('productLabelStyles')) {
            const style = document.createElement('style');
            style.id = 'productLabelStyles';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px) translateX(-50%); }
                    to { opacity: 1; transform: translateY(0) translateX(-50%); }
                }
                .product-label-3d .product-name,
                .product-label-3d .neutron-count {
                    display: block;
                    font-size: 20px;
                }
                .product-label-3d .product-desc,
                .product-label-3d .energy-release {
                    display: block;
                    font-size: 12px;
                    opacity: 0.7;
                    margin-top: 4px;
                }
            `;
            document.head.appendChild(style);
        }
    }

    resetSimulation() {
        // Remove product labels
        document.querySelectorAll('.product-label-3d').forEach(el => el.remove());

        // Reset to original nucleus
        const reactionType = document.getElementById('reactionSelect').value;
        const reaction = this.fissionReactions[reactionType];
        const parentNucleus = reaction ? reaction.parent : 'U-235';

        this.createNucleus(parentNucleus);
        this.updateUI(parentNucleus);
        this.isAnimating = false;
    }

    updateUI(nucleusType) {
        const nucleus = this.nuclei[nucleusType];
        if (!nucleus) return;

        document.getElementById('nucleusSymbol').textContent = nucleus.symbol;
        document.getElementById('nucleusSymbol').style.fontSize = '32px';
        document.getElementById('nucleusDetails').textContent =
            `${nucleus.name} · Z=${nucleus.Z} · N=${nucleus.N} · A=${nucleus.A}`;
    }

    setupEventListeners() {
        // Trigger Fission button
        document.getElementById('triggerFission').addEventListener('click', () => {
            this.triggerFission();
        });

        // Trigger Fusion button
        document.getElementById('triggerFusion').addEventListener('click', () => {
            // Fusion not implemented yet
            alert('Fusion simulation coming soon!');
        });

        // Reset button
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetSimulation();
        });

        // Reaction select
        document.getElementById('reactionSelect').addEventListener('change', (e) => {
            const reaction = this.fissionReactions[e.target.value];
            if (reaction) {
                this.createNucleus(reaction.parent);
                this.updateUI(reaction.parent);
                document.querySelector('.equation-text').textContent = reaction.equation;
            }
        });

        // Reaction type buttons
        document.querySelectorAll('.reaction-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.reaction-type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const type = btn.dataset.type;
                if (type === 'fission') {
                    this.resetSimulation();
                }
            });
        });

        // Level buttons
        document.querySelectorAll('.level-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.classList.contains('locked')) return;
                document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Quiz
        document.querySelectorAll('.quiz-option').forEach(option => {
            option.addEventListener('click', () => {
                const answer = option.dataset.answer;
                const feedback = document.getElementById('quizFeedback');

                document.querySelectorAll('.quiz-option').forEach(o => {
                    o.classList.remove('correct', 'incorrect');
                });

                if (answer === 'fusion') {
                    option.classList.add('correct');
                    feedback.textContent = '✓ Correct! Nuclear fusion powers the Sun, combining hydrogen into helium.';
                    feedback.className = 'quiz-feedback show correct';
                } else {
                    option.classList.add('incorrect');
                    feedback.textContent = '✗ Not quite. The Sun is powered by nuclear fusion, not fission.';
                    feedback.className = 'quiz-feedback show incorrect';
                    // Highlight correct answer
                    document.querySelector('[data-answer="fusion"]').classList.add('correct');
                }
            });
        });

        // Mouse interaction for rotation
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };

        const container = document.getElementById('visualizationContainer');

        container.addEventListener('mousedown', (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging || !this.nucleusGroup) return;

            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;

            this.nucleusGroup.rotation.y += deltaX * 0.01;
            this.nucleusGroup.rotation.x += deltaY * 0.01;

            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    onWindowResize() {
        const container = document.getElementById('visualizationContainer');
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());

        // Gentle rotation when not animating fission
        if (this.nucleusGroup && !this.isAnimating) {
            this.nucleusGroup.rotation.y += 0.003;
        }

        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the lab when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.nuclearLab = new NuclearLab();
});
