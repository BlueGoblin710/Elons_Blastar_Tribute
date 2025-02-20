const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Load images
const playerImage = new Image();
playerImage.src = 'player.png';
const enemyImage = new Image();
enemyImage.src = 'enemy.png';
const fuelImage = new Image();
fuelImage.src = 'fuel.png';

// Web Audio API setup for sounds
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
function playSound(frequency, duration) {
    const oscillator = audioContext.createOscillator();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
}

// Text-to-speech setup
const speech = new SpeechSynthesisUtterance();
speech.volume = 1;
speech.rate = 1;
speech.pitch = 1;
let introPlayed = false;

// Player object
const player = {
    x: canvas.width / 2,
    y: canvas.height - 50,
    width: 40, // Match player.png width
    height: 20, // Match player.png height
    fuel: 100,
    maxFuel: 100
};

// Game objects
let bullets = [];
let enemyBullets = [];
let enemies = [];
let powerUps = [];
let explosions = [];
let score = 0;
let frameCount = 0;
let gameStarted = false;
let gameMode = null;

// Mode settings
const modes = {
    easy: {
        playerSpeed: 1,
        bulletSpeed: 1,
        enemySpeeds: { fast: 1, tank: 0.3, basic: 0.5 },
        enemyShootCooldowns: { fast: 180, tank: 120, basic: 240 },
        powerUpSpeed: 0.3,
        fuelConsumption: 0.005,
        shootInterval: 30,
        enemySpawnInterval: 150,
        powerUpSpawnInterval: 600
    },
    medium: {
        playerSpeed: 2,
        bulletSpeed: 2,
        enemySpeeds: { fast: 2, tank: 0.5, basic: 1 },
        enemyShootCooldowns: { fast: 120, tank: 90, basic: 150 },
        powerUpSpeed: 0.5,
        fuelConsumption: 0.01,
        shootInterval: 20,
        enemySpawnInterval: 100,
        powerUpSpawnInterval: 400
    },
    hardcore: {
        playerSpeed: 3,
        bulletSpeed: 3,
        enemySpeeds: { fast: 3, tank: 1, basic: 2 },
        enemyShootCooldowns: { fast: 60, tank: 40, basic: 80 },
        powerUpSpeed: 1,
        fuelConsumption: 0.02,
        shootInterval: 10,
        enemySpawnInterval: 50,
        powerUpSpawnInterval: 200
    }
};

// Controls
let rightPressed = false;
let leftPressed = false;
let upPressed = false; // Added for forward movement
let downPressed = false; // Added for backward movement
let spacePressed = false;

// Event listeners
document.addEventListener('keydown', keyDownHandler);
document.addEventListener('keyup', keyUpHandler);

function keyDownHandler(e) {
    if (e.key === '1' && !gameStarted) {
        gameMode = 'easy';
        startGame();
    } else if (e.key === '2' && !gameStarted) {
        gameMode = 'medium';
        startGame();
    } else if (e.key === '3' && !gameStarted) {
        gameMode = 'hardcore';
        startGame();
    }
    if (gameStarted) {
        if (e.key === 'Right' || e.key === 'ArrowRight') rightPressed = true;
        if (e.key === 'Left' || e.key === 'ArrowLeft') leftPressed = true;
        if (e.key === 'Up' || e.key === 'ArrowUp') upPressed = true; // Forward
        if (e.key === 'Down' || e.key === 'ArrowDown') downPressed = true; // Backward
        if (e.key === ' ' && !spacePressed) spacePressed = true;
    }
    e.preventDefault();
}

function keyUpHandler(e) {
    if (e.key === 'Right' || e.key === 'ArrowRight') rightPressed = false;
    if (e.key === 'Left' || e.key === 'ArrowLeft') leftPressed = false;
    if (e.key === 'Up' || e.key === 'ArrowUp') upPressed = false; // Forward
    if (e.key === 'Down' || e.key === 'ArrowDown') downPressed = false; // Backward
    if (e.key === ' ') spacePressed = false;
    e.preventDefault();
}

function startGame() {
    gameStarted = true;
    player.speed = modes[gameMode].playerSpeed;
    if (!introPlayed) {
        speech.text = "Blastar Ship GO GO Enemies are on the Attack!";
        window.speechSynthesis.speak(speech);
        introPlayed = true;
    }
    update();
}

// Draw player with image
function drawPlayer() {
    if (playerImage.complete) { // Ensure image is loaded
        ctx.drawImage(playerImage, player.x - player.width / 2, player.y, player.width, player.height);
    } else {
        // Fallback to original drawing if image not loaded
        ctx.fillStyle = '#00f';
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(player.x - player.width / 2, player.y + player.height);
        ctx.lineTo(player.x + player.width / 2, player.y + player.height);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#aaa';
        ctx.fillRect(player.x - 10, player.y - 5, 20, 10);
    }
}

// Player Bullet class
class Bullet {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 10;
        this.speed = modes[gameMode].bulletSpeed;
    }

    draw() {
        ctx.fillStyle = '#ff0';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    update() {
        this.y -= this.speed;
    }
}

// Enemy Bullet class
class EnemyBullet {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 10;
        this.speed = modes[gameMode].bulletSpeed;
    }

    draw() {
        ctx.fillStyle = '#f00';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    update() {
        this.y += this.speed;
    }
}

// Enemy class
class Enemy {
    constructor(type = 'basic') {
        this.x = Math.random() * (canvas.width - 30);
        this.y = -20;
        this.type = type;
        this.speed = modes[gameMode].enemySpeeds[type];
        this.width = type === 'tank' ? 40 : 30; // Match enemy.png scaled for tank
        this.height = type === 'tank' ? 30 : 20; // Match enemy.png scaled for tank
        this.health = type === 'tank' ? 2 : 1;
        this.shootCooldown = modes[gameMode].enemyShootCooldowns[type];
        this.shootTimer = Math.random() * this.shootCooldown;
    }

    draw() {
        if (enemyImage.complete) { // Ensure image is loaded
            ctx.drawImage(enemyImage, this.x, this.y, this.width, this.height);
        } else {
            // Fallback to original drawing if image not loaded
            ctx.fillStyle = this.type === 'fast' ? '#f00' : this.type === 'tank' ? '#0f0' : '#0ff';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            if (this.type === 'tank') {
                ctx.fillStyle = '#fff';
                ctx.fillRect(this.x + 10, this.y - 5, 10, 10);
            }
        }
    }

    update() {
        this.y += this.speed;
        this.shootTimer--;
        if (this.shootTimer <= 0) {
            enemyBullets.push(new EnemyBullet(this.x + this.width / 2 - 2, this.y + this.height));
            playSound(300, 0.1); // Enemy shoot sound
            this.shootTimer = this.shootCooldown;
        }
    }
}

// Explosion particle class
class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 5 + 2;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * 0.5 - 0.25;
        this.life = 50;
        this.color = `hsl(${Math.random() * 60 + 20}, 100%, 50%)`;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.size *= 0.99;
        this.life--;
    }
}

// Power-up class
class PowerUp {
    constructor() {
        this.x = Math.random() * (canvas.width - 20);
        this.y = -20;
        this.width = 20; // Match fuel.png width
        this.height = 20; // Match fuel.png height
        this.speed = modes[gameMode].powerUpSpeed;
        this.type = Math.random() > 0.5 ? 'fuel' : 'speed';
    }

    draw() {
        if (this.type === 'fuel' && fuelImage.complete) {
            ctx.drawImage(fuelImage, this.x, this.y, this.width, this.height);
        } else if (this.type === 'fuel') {
            // Fallback for fuel if image not loaded
            ctx.fillStyle = '#ff0';
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Speed power-up remains a circle
            ctx.fillStyle = '#f0f';
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    update() {
        this.y += this.speed;
    }
}

// Create explosion
function createExplosion(x, y) {
    for (let i = 0; i < 20; i++) {
        explosions.push(new Particle(x + Math.random() * 20 - 10, y + Math.random() * 20 - 10));
    }
    playSound(100, 0.3); // Explosion sound
}

// Game loop
function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!gameStarted) {
        ctx.fillStyle = 'white';
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Select Mode:', canvas.width / 2, canvas.height / 2 - 50);
        ctx.fillText('1 - Easy', canvas.width / 2, canvas.height / 2);
        ctx.fillText('2 - Medium', canvas.width / 2, canvas.height / 2 + 50);
        ctx.fillText('3 - Hardcore', canvas.width / 2, canvas.height / 2 + 100);
        drawPlayer();
        requestAnimationFrame(update);
        return;
    }

    // Fuel consumption
    player.fuel -= modes[gameMode].fuelConsumption;
    if (player.fuel <= 0) {
        alert(`Game Over! Out of fuel. Score: ${score}`);
        resetGame();
        return;
    }

    // Move player
    if (rightPressed && player.x + player.width / 2 < canvas.width) player.x += player.speed;
    if (leftPressed && player.x - player.width / 2 > 0) player.x -= player.speed;
    if (upPressed && player.y > 0) player.y -= player.speed; // Move forward (up)
    if (downPressed && player.y + player.height < canvas.height) player.y += player.speed; // Move backward (down)

    // Shoot two bullets from left and right sides
    if (spacePressed && frameCount % modes[gameMode].shootInterval === 0) {
        bullets.push(new Bullet(player.x - player.width / 2 + 5, player.y));
        bullets.push(new Bullet(player.x + player.width / 2 - 5, player.y));
        playSound(500, 0.1); // Player shoot sound
    }

    // Update and draw player bullets
    bullets = bullets.filter(b => b.y > 0);
    bullets.forEach(bullet => {
        bullet.update();
        bullet.draw();
    });

    // Update and draw enemy bullets
    enemyBullets = enemyBullets.filter(b => b.y < canvas.height);
    enemyBullets.forEach(bullet => {
        bullet.update();
        bullet.draw();

        // Collision with player
        if (bullet.y + bullet.height > player.y &&
            bullet.x < player.x + player.width / 2 &&
            bullet.x + bullet.width > player.x - player.width / 2) {
            alert(`Game Over! Hit by enemy fire. Score: ${score}`);
            resetGame();
            return;
        }
    });

    // Spawn enemies and power-ups
    frameCount++;
    if (frameCount % modes[gameMode].enemySpawnInterval === 0) {
        const type = Math.random() < 0.3 ? 'fast' : Math.random() < 0.6 ? 'tank' : 'basic';
        enemies.push(new Enemy(type));
    }
    if (frameCount % modes[gameMode].powerUpSpawnInterval === 0) {
        powerUps.push(new PowerUp());
    }

    // Update and draw enemies
    enemies = enemies.filter(e => e.y < canvas.height);
    enemies.forEach(enemy => {
        enemy.update();
        enemy.draw();

        // Collision with player bullets
        bullets.forEach((bullet, bulletIndex) => {
            if (bullet.x < enemy.x + enemy.width &&
                bullet.x + bullet.width > enemy.x &&
                bullet.y < enemy.y + enemy.height &&
                bullet.y + bullet.height > enemy.y) {
                enemy.health--;
                bullets.splice(bulletIndex, 1);
                if (enemy.health <= 0) {
                    createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                    enemies.splice(enemies.indexOf(enemy), 1);
                    score += enemy.type === 'tank' ? 20 : 10;
                    if (Math.random() < 0.1) {
                        speech.text = "Don't give up Blastar Ship";
                        window.speechSynthesis.speak(speech);
                    }
                }
            }
        });

        // Collision with player
        if (enemy.y + enemy.height > player.y &&
            enemy.x < player.x + player.width / 2 &&
            enemy.x + enemy.width > player.x - player.width / 2) {
            alert(`Game Over! Score: ${score}`);
            resetGame();
            return;
        }
    });

    // Update and draw explosions
    explosions = explosions.filter(p => p.life > 0);
    explosions.forEach(particle => {
        particle.update();
        particle.draw();
    });

    // Update and draw power-ups
    powerUps = powerUps.filter(p => p.y < canvas.height);
    powerUps.forEach((powerUp, index) => {
        powerUp.update();
        powerUp.draw();

        // Power-up collection
        if (powerUp.y + powerUp.height > player.y &&
            powerUp.x < player.x + player.width / 2 &&
            powerUp.x + powerUp.width > player.x - player.width / 2) {
            if (powerUp.type === 'fuel') {
                player.fuel = Math.min(player.maxFuel, player.fuel + 30);
            } else if (powerUp.type === 'speed') {
                player.speed = modes[gameMode].playerSpeed + 1;
                setTimeout(() => player.speed = modes[gameMode].playerSpeed, 5000);
            }
            powerUps.splice(index, 1);
            if (Math.random() < 0.5) {
                speech.text = "Don't give up Blastar Ship";
                window.speechSynthesis.speak(speech);
            }
        }
    });

    drawPlayer();

    // Draw HUD
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 10, 30);
    ctx.fillText(`Fuel: ${Math.floor(player.fuel)}`, 10, 60);
    ctx.fillText(`Mode: ${gameMode}`, 10, 90);

    requestAnimationFrame(update);
}

function resetGame() {
    bullets = [];
    enemyBullets = [];
    enemies = [];
    powerUps = [];
    explosions = [];
    score = 0;
    player.x = canvas.width / 2;
    player.y = canvas.height - 50; // Reset y position
    player.fuel = player.maxFuel;
    rightPressed = false;
    leftPressed = false;
    upPressed = false;
    downPressed = false;
    spacePressed = false;
    gameStarted = false;
    frameCount = 0;
    gameMode = null;
}

// Wait for images to load before starting
Promise.all([
    new Promise(resolve => playerImage.onload = resolve),
    new Promise(resolve => enemyImage.onload = resolve),
    new Promise(resolve => fuelImage.onload = resolve)
]).then(() => {
    update(); // Start game loop after images are loaded
}).catch(() => {
    console.log("Images failed to load, starting with fallback graphics");
    update(); // Start anyway with fallback
});