const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const resetButton = document.getElementById('resetButton');

let width, height;
let apples = [];
let particles = [];
const GRAVITY = 0.5;
const BOUNCE = 0.6;
const DT = 1; // Time step

// Sound Manager (Web Audio API)
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

const sounds = {
    tap: () => playTone(800, 'sine', 0.1),
    bounce: () => playTone(150, 'triangle', 0.2),
    fall: () => { /* Continuous sound not implemented for simplicity, maybe wind? */ }
};

function playTone(freq, type, duration) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    // Envelope
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// Game State
const APPLE_COUNT = 8;
let resetTimer = null;

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.life = 1.0;
        this.decay = 0.02 + Math.random() * 0.03;
        this.color = color;
        this.rotation = Math.random() * Math.PI * 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2; // Gravity
        this.life -= this.decay;
        this.rotation += 0.1;
    }

    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        // Simple leaf shape
        ctx.ellipse(this.x, this.y, 8, 4, this.rotation || 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class Apple {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = 40; // Visual radius
        this.hitRadius = this.radius * 1.3; // Hit area radius
        this.isFalling = false;
        this.rotation = 0;
        this.angularVelocity = 0;
        this.color = '#FF4444'; // Red
        // Random initial sway for "hanging" effect (visual only for now)
        this.swayOffset = Math.random() * Math.PI * 2;
    }

    update() {
        if (this.isFalling) {
            // Apply Gravity
            this.vy += GRAVITY;
            this.x += this.vx;
            this.y += this.vy;
            this.rotation += this.angularVelocity;

            // Ground Collision
            const groundLevel = height - (height * 0.2); // Grass height
            if (this.y + this.radius > groundLevel) {
                // Play sound only on significant impacts
                if (Math.abs(this.vy) > 2) sounds.bounce();

                this.y = groundLevel - this.radius;
                this.vy *= -BOUNCE;
                this.vx *= 0.9; // Friction
                this.angularVelocity *= 0.9;

                // Stop if speed is low
                if (Math.abs(this.vy) < 1) this.vy = 0;
                if (Math.abs(this.vx) < 0.1) this.vx = 0;
            }

            // Wall Collision
            if (this.x - this.radius < 0) {
                this.x = this.radius;
                this.vx *= -BOUNCE;
            }
            if (this.x + this.radius > width) {
                this.x = width - this.radius;
                this.vx *= -BOUNCE;
            }
        } else {
            // Swaying animation when hanging
            const time = Date.now() / 1000;
            this.rotation = Math.sin(time * 2 + this.swayOffset) * 0.1;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Debug Hit Area (uncomment to see)
        // ctx.beginPath();
        // ctx.arc(0, 0, this.hitRadius, 0, Math.PI * 2);
        // ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        // ctx.stroke();

        // Draw Apple Body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Draw Stem
        ctx.fillStyle = '#654321';
        ctx.fillRect(-2, -this.radius - 8, 4, 10);

        ctx.restore();
    }
}

function initGame() {
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = null;

    apples = [];
    particles = []; // Clear particles too
    const treeCenterX = width / 2;
    const treeCenterY = height * 0.4;
    // Match visual crown radius (0.35)
    const crownRadius = Math.min(width, height) * 0.35;

    for (let i = 0; i < APPLE_COUNT; i++) {
        let x, y, validPosition = false;
        let attempts = 0;

        // Try to find a valid position
        while (!validPosition && attempts < 200) {
            const angle = Math.random() * Math.PI * 2;
            // Keep completely inside key circle: max radius = crownRadius - appleRadius
            // Using 35 as safe margin for apple radius (approx 40)
            const maxR = Math.max(0, crownRadius - 35);
            const r = Math.sqrt(Math.random()) * maxR;

            x = treeCenterX + r * Math.cos(angle);
            y = treeCenterY + r * Math.sin(angle);

            // Check distance from all existing apples
            let overlap = false;
            for (const existingApple of apples) {
                const dx = x - existingApple.x;
                const dy = y - existingApple.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                // Apple diameter is 80. Allow slight visual overlap (75) to pack better on small screens
                // or if we have many apples.
                if (dist < 75) {
                    overlap = true;
                    break;
                }
            }

            if (!overlap) {
                validPosition = true;
            }
            attempts++;
        }

        // If we really can't fit it (e.g. ultra small screen), we skip it 
        // OR we place it anyway. Placing it anyway causes overlap which user hates.
        // Let's try to place it with relaxed constraint? 
        // No, let's just place it. It's better than having 7 apples.
        apples.push(new Apple(x, y));
    }
}

function drawTree() {
    // Reset globalAlpha just in case
    ctx.globalAlpha = 1.0;

    const treeCenterX = width / 2;
    const trunkWidth = Math.min(width, height) * 0.1;
    const trunkHeight = height * 0.5;

    // Trunk
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(treeCenterX - trunkWidth / 2, height * 0.4, trunkWidth, trunkHeight);

    // Crown (Leaves)
    ctx.fillStyle = '#228B22'; // Forest Green
    ctx.beginPath();
    const crownRadius = Math.min(width, height) * 0.35;

    // Main circle
    ctx.arc(treeCenterX, height * 0.4, crownRadius, 0, Math.PI * 2);

    // Additional circles for more coverage and fluffiness
    const fluffR = crownRadius * 0.7;
    // Bottom left
    ctx.moveTo(treeCenterX - crownRadius * 0.5 + fluffR, height * 0.45);
    ctx.arc(treeCenterX - crownRadius * 0.5, height * 0.45, fluffR, 0, Math.PI * 2);

    // Bottom right
    ctx.moveTo(treeCenterX + crownRadius * 0.5 + fluffR, height * 0.45);
    ctx.arc(treeCenterX + crownRadius * 0.5, height * 0.45, fluffR, 0, Math.PI * 2);

    // Top center
    ctx.moveTo(treeCenterX + fluffR, height * 0.25);
    ctx.arc(treeCenterX, height * 0.25, fluffR, 0, Math.PI * 2);

    // Center filler
    ctx.moveTo(treeCenterX + crownRadius * 0.4, height * 0.35);
    ctx.arc(treeCenterX, height * 0.35, crownRadius * 0.4, 0, Math.PI * 2);

    ctx.fill();

    // Add shading for depth (optional, keeping flat for simplicity but robust)
}

function loop() {
    // Clear screen
    ctx.fillStyle = '#87CEEB'; // Sky
    ctx.fillRect(0, 0, width, height);

    // Draw Grass
    const grassHeight = height * 0.2;
    ctx.fillStyle = '#90EE90'; // Light Green
    ctx.fillRect(0, height - grassHeight, width, grassHeight);

    drawTree();

    // Update and Draw Apples
    apples.forEach(apple => {
        apple.update();
        apple.draw(ctx);
    });

    // Update and Draw Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw(ctx);
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }

    requestAnimationFrame(loop);
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // Re-initialize apples only if empty or significant resize? 
    // For now, let's keep them if possible, but positions might be off.
    // Simpler to re-init on major resize for this prototype, 
    // but better to just adjust ground level.
    // Let's re-init for now to ensure they stay on tree.
    initGame();
}

// Input Handling
function handleInput(x, y) {
    // Check collision with apples in reverse order (topmost first)
    for (let i = apples.length - 1; i >= 0; i--) {
        const apple = apples[i];
        if (apple.isFalling) continue; // Already falling

        const dx = x - apple.x;
        const dy = y - apple.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < apple.hitRadius) {
            apple.isFalling = true;
            // Add slight randomness to fall
            apple.vx = (Math.random() - 0.5) * 2;
            apple.angularVelocity = (Math.random() - 0.5) * 0.1;

            sounds.tap();

            // Spawn leaves
            for (let j = 0; j < 5; j++) {
                particles.push(new Particle(apple.x, apple.y - 10, '#228B22'));
            }

            // Check if all apples have fallen
            if (apples.every(a => a.isFalling)) {
                if (resetTimer) clearTimeout(resetTimer);
                resetTimer = setTimeout(() => {
                    initGame();
                    // Optional: sound for reset/regrowth?
                }, 10000); // 10 seconds
            }

            break; // Only trigger one apple per tap
        }
    }
}

canvas.addEventListener('mousedown', (e) => {
    handleInput(e.clientX, e.clientY);
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent scrolling
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        handleInput(touch.clientX, touch.clientY);
    }
}, { passive: false });

resetButton.addEventListener('click', () => {
    initGame();
});

window.addEventListener('resize', resize);

// Start
resize(); // This calls initGame via resize logic
loop();
