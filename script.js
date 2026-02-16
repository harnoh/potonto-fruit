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
const FRUIT_COUNT = 8;
let resetTimer = null;
let currentFruitType = 'apple'; // 'apple', 'mikan', 'banana'

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

class Fruit {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.vx = 0;
        this.vy = 0;
        this.radius = 40; // Visual radius
        this.hitRadius = this.radius * 1.3; // Hit area radius
        this.isFalling = false;
        this.rotation = 0;
        this.angularVelocity = 0;

        // Settings based on type
        if (this.type === 'apple') {
            this.color = '#FF4444'; // Red
        } else if (this.type === 'mikan') {
            this.color = '#FF8C00'; // Dark Orange
        } else if (this.type === 'banana') {
            this.color = '#FFE135'; // Banana Yellow
        }

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

        if (this.type === 'banana') {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            // Draw a crescent
            ctx.arc(0, -this.radius * 0.5, this.radius, 0.1 * Math.PI, 0.9 * Math.PI);
            ctx.quadraticCurveTo(0, this.radius * 0.5, this.radius * Math.cos(0.1 * Math.PI), -this.radius * 0.5 + this.radius * Math.sin(0.1 * Math.PI));
            ctx.fill();

            // Stem
            ctx.fillStyle = '#654321';
            ctx.fillRect(-5, -this.radius * 1.2, 10, 15);

        } else {
            // Apple or Mikan (Round)
            ctx.fillStyle = this.color;
            ctx.beginPath();
            if (this.type === 'mikan') {
                // Slightly oblate for mikan?
                ctx.ellipse(0, 0, this.radius, this.radius * 0.85, 0, 0, Math.PI * 2);
            } else {
                ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            }
            ctx.fill();

            // Highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.2, 0, Math.PI * 2);
            ctx.fill();

            // Mikan dots (pores)
            if (this.type === 'mikan') {
                ctx.fillStyle = 'rgba(200, 100, 0, 0.3)';
                for (let i = 0; i < 5; i++) {
                    ctx.beginPath();
                    ctx.arc((Math.random() - 0.5) * this.radius, (Math.random() - 0.5) * this.radius, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Stem (Green for Mikan, Brown for Apple)
            ctx.fillStyle = this.type === 'mikan' ? '#228B22' : '#654321';
            ctx.fillRect(-2, -this.radius - 8, 4, 10);
        }

        ctx.restore();
    }
}

function initGame() {
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = null;

    fruits = [];
    particles = []; // Clear particles too
    const treeCenterX = width / 2;
    const treeCenterY = height * 0.4;
    // Match visual crown radius (0.35)
    const crownRadius = Math.min(width, height) * 0.35;

    // Pick random fruit type
    const types = ['apple', 'mikan', 'banana'];
    currentFruitType = types[Math.floor(Math.random() * types.length)];

    for (let i = 0; i < FRUIT_COUNT; i++) {
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

            // Check distance from all existing fruits
            let overlap = false;
            for (const existingFruit of fruits) {
                const dx = x - existingFruit.x;
                const dy = y - existingFruit.y;
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

        fruits.push(new Fruit(x, y, currentFruitType));
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

    // Update and Draw Fruits
    fruits.forEach(fruit => {
        fruit.update();
        fruit.draw(ctx);
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

    initGame();
}

// Input Handling
function handleInput(x, y) {
    // Check collision with fruits in reverse order (topmost first)
    for (let i = fruits.length - 1; i >= 0; i--) {
        const fruit = fruits[i];
        if (fruit.isFalling) continue; // Already falling

        const dx = x - fruit.x;
        const dy = y - fruit.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < fruit.hitRadius) {
            fruit.isFalling = true;
            // Add slight randomness to fall
            fruit.vx = (Math.random() - 0.5) * 2;
            fruit.angularVelocity = (Math.random() - 0.5) * 0.1;

            sounds.tap();

            // Spawn leaves
            for (let j = 0; j < 5; j++) {
                particles.push(new Particle(fruit.x, fruit.y - 10, '#228B22'));
            }

            // Check if all fruits have fallen
            if (fruits.every(f => f.isFalling)) {
                if (resetTimer) clearTimeout(resetTimer);
                resetTimer = setTimeout(() => {
                    initGame();
                    // Optional: sound for reset/regrowth?
                }, 10000); // 10 seconds
            }

            break; // Only trigger one fruit per tap
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
