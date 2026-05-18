//This app design is designed as a snooker simulation. It focuses on core interactions, physics behavior, and practise based 
//gameplay. The structure of the codes are kept as straightforward as possible, so that each feature is easy to understand and
//modified if needed to. The game and design logic are seperated into small functions, to keep the code readable.

//The cue design and interaction is a mouse based cue control. The mouse pulls the cue backwards from the cue ball, projecting
// the cue ball in the opposite direction. The distance between the mouse and the cue ball determines the power, and the power 
// itself, has a limit. I chose this design because it feels more intuitive and natural for cue sports, and also similar to the
// game, 8ball. It allows precise control over the direction and power using only the mouse. The cue only applies force when
// the shot is taken, or similarly when user let go of their left click.

//The ball physics and movement are handled by Matter.js physics, since the balls are Matter.js circle bodies. Restitutions are
// used to control the bounce, and FrictionAir to gradually slow down the ball over time. Table cushions and pinball bumpers are
// both static bodies, and the bumpers collisions are handled by Matter.js collision detection. Matter.js handles the ball-ball 
// collisions, ball-cushion collisions, and ball-bumpers collisions. The only flaws, is for mode 3, the prediction might be off, 
// if the speed of the ball during the collision is too high, and the ball skips some frames, causing the point of contact to 
// be different.

//We have 4 game modes, 1 of them is the extension. The 3 expected game modes includes the standard setup, the random red
// placements, and practise with guided aim. The extension I have created, is a Pinball Mode. Random static pinball-style bumpers
// are being generated on the table. The bumpers acts as an obstacle, and collisions will cause balls to bounce off. This
// extension is unique as traditional snooker or snooker games, does not contain obstacles. Players are required to adapt to the
// unpredictable ball paths and indirect angles. It is clearly seperated from core snooker games, and is not required for normal
// play.

//For the visual effect and animations, firstly, I have added ball trails when the ball travels. Secondly, cue impact animations,
// when a shot is taken. Thirdly, pocket animations to help indicate the ball has been successfully potted. These effects are just
// visual effects, and does not affect gameplay.


const Engine = Matter.Engine;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
let engine;
let world;
let balls = [];
let cueBall = null;
let canShoot = true;
let aiming = false;
let power = 0;
let tableWidth = 800;
let tableHeight = 400;
let tableX, tableY;
let ballSize = 20;
let gameMode = 1;
let score = 0;
let placingCueBall = false;
let cueBallPlaced = false;
let aimStartX = 0;
let aimStartY = 0;
let pinballMode = false;
let bumpers = [];
let cushions = [];
const BUMPER_RING = 6;
let colourOrder = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];
let colourIndex = 0;
let expectedBall = 'red';
let foulPoints = 0;

// animations
let ballTrails = []; // Array to store ball trail particles
let cueImpactAnimations = []; // Array for cue impact effects
let pocketAnimations = []; // Array for pocket entry animations
let ballHistory = new Map(); // Store recent positions for trails
let coloredSpots = {}; // Remember original spots for each colour

function updateColoredSpots() {
  // basic snooker spots (rough positions)
  let centerY = tableY + tableHeight / 2;
  let dRadius = tableHeight / 4;
  let baulkLineX = tableX + tableWidth * 0.25;

  coloredSpots = {
    yellow: { x: baulkLineX, y: centerY - dRadius },
    green: { x: baulkLineX, y: centerY + dRadius },
    brown: { x: baulkLineX, y: centerY },
    blue: { x: tableX + tableWidth / 2, y: centerY },
    pink: { x: tableX + tableWidth * 0.6, y: centerY },
    black: { x: tableX + tableWidth - 60, y: centerY }
  };
}


function makeBall(x, y, ballColor, type, points, trailColor) {
  let body = Bodies.circle(x, y, ballSize / 2, {
    restitution: 0.9,
    friction: 0.01,
    frictionAir: 0.03,
    inertia: Infinity
  });
  World.add(world, body);

  return {
    body: body,
    x: x, y: y,
    vx: 0, vy: 0,
    color: ballColor,
    type: type,
    points: points,
    trailColor: trailColor
  };
}

function removeBall(ball) {
  if (ball && ball.body) {
    World.remove(world, ball.body);
  }
}

function syncBall(ball) {
  if (!ball || !ball.body) return;
  ball.x = ball.body.position.x;
  ball.y = ball.body.position.y;
  ball.vx = ball.body.velocity.x;
  ball.vy = ball.body.velocity.y;
}

function stopBall(ball) {
  if (!ball || !ball.body) return;
  Body.setVelocity(ball.body, { x: 0, y: 0 });
}

function setup() {
  engine = Engine.create();
  world = engine.world;
  world.gravity.y = 0;
  world.gravity.x = 0;
  createCanvas(windowWidth, windowHeight);

  tableX = width / 2 - tableWidth / 2;
  tableY = height / 2 - tableHeight / 2;

  updateColoredSpots();
  createCushions();

  setupMode1();
}

function draw() {
  Engine.update(engine);
  background(40, 120, 40);

  drawTable();
  if (pinballMode) {
    drawBumpers();
  }
  updateBalls();

  // Update and draw animations
  updateAnimations();
  drawBallTrails();
  drawCueImpactAnimations();
  drawPocketAnimations();

  drawBalls();

  if (cueBall && canShoot) {
    drawCue();
  }

  // Highlight D-zone if placing cue ball
  if (placingCueBall) {
    drawDZoneHighlight();
  }

  drawUI();
}

// animations
function updateAnimations() {
  // Update ball trails - add new positions for moving balls
  updateBallHistory();
  createTrailParticles();

  // Update trail particles (fade out and move)
  for (let i = ballTrails.length - 1; i >= 0; i--) {
    let trail = ballTrails[i];
    trail.life -= 2; // Fade out faster
    trail.alpha -= 2;

    // Apply slight movement to trail particles
    trail.x += trail.vx;
    trail.y += trail.vy;
    trail.vx *= 0.95;
    trail.vy *= 0.95;

    // Remove dead particles
    if (trail.life <= 0 || trail.alpha <= 0) {
      ballTrails.splice(i, 1);
    }
  }

  // Update cue impact animations
  for (let i = cueImpactAnimations.length - 1; i >= 0; i--) {
    let impact = cueImpactAnimations[i];
    impact.radius += impact.growth;
    impact.alpha -= impact.fade;

    // Remove finished animations
    if (impact.alpha <= 0) {
      cueImpactAnimations.splice(i, 1);
    }
  }

  // Update pocket animations
  for (let i = pocketAnimations.length - 1; i >= 0; i--) {
    let anim = pocketAnimations[i];
    anim.progress += anim.speed;
    anim.alpha -= anim.fade;

    // Remove finished animations
    if (anim.progress >= 1 || anim.alpha <= 0) {
      pocketAnimations.splice(i, 1);
    }
  }
}

function updateBallHistory() {
  let allBalls = [...balls];
  if (cueBall) allBalls.push(cueBall);

  for (let ball of allBalls) {
    // Only store history for moving balls
    let speed = sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed > 0.5) {
      if (!ballHistory.has(ball)) {
        ballHistory.set(ball, []);
      }

      let history = ballHistory.get(ball);
      history.push({ x: ball.x, y: ball.y, speed: speed });

      // Keep only recent history (last 5 frames)
      if (history.length > 5) {
        history.shift();
      }
    } else {
      // Clear history for stationary balls
      ballHistory.delete(ball);
    }
  }
}

function createTrailParticles() {
  for (let [ball, history] of ballHistory.entries()) {
    if (history.length > 1) {
      let speed = sqrt(ball.vx * ball.vx + ball.vy * ball.vy);

      // Create more particles for faster balls
      let particleCount = floor(speed / 3);
      particleCount = constrain(particleCount, 0, 3);

      for (let i = 0; i < particleCount; i++) {
        // Create trail particle slightly behind the ball
        let offset = random(-3, 3);
        let trailX = ball.x - ball.vx * 0.2 + offset;
        let trailY = ball.y - ball.vy * 0.2 + offset;

        ballTrails.push({
          x: trailX,
          y: trailY,
          size: random(ballSize * 0.3, ballSize * 0.6),
          color: ball.color,
          life: 30, // Starting life
          alpha: 150, // Starting alpha
          vx: random(-0.5, 0.5),
          vy: random(-0.5, 0.5)
        });
      }
    }
  }
}

function drawBallTrails() {
  for (let trail of ballTrails) {
    let c = trail.color;
    fill(red(c), green(c), blue(c), trail.alpha);
    noStroke();
    ellipse(trail.x, trail.y, trail.size);
  }
}

function createCueImpact(x, y, angle) {
  // Create impact flash
  cueImpactAnimations.push({
    x: x,
    y: y,
    radius: 5,
    growth: 3,
    alpha: 255,
    fade: 15,
    color: color(255, 255, 200)
  });

  // Create emanating circles
  for (let i = 0; i < 3; i++) {
    cueImpactAnimations.push({
      x: x,
      y: y,
      radius: 10 + i * 8,
      growth: 2,
      alpha: 200 - i * 50,
      fade: 10,
      color: color(255, 255, 255, 150 - i * 30)
    });
  }
}

function drawCueImpactAnimations() {
  for (let impact of cueImpactAnimations) {
    // Draw emanating circles
    noFill();
    stroke(red(impact.color), green(impact.color), blue(impact.color), impact.alpha);
    strokeWeight(2);
    circle(impact.x, impact.y, impact.radius * 2);

    // Draw central flash for the main impact
    if (impact.radius < 15) {
      fill(255, 255, 200, impact.alpha);
      noStroke();
      ellipse(impact.x, impact.y, impact.radius * 1.5);
    }
  }
}

function createPocketAnimation(pocketX, pocketY, ballColor) {
  pocketAnimations.push({
    x: pocketX,
    y: pocketY,
    progress: 0,
    speed: 0.05,
    size: ballSize,
    color: ballColor,
    alpha: 255,
    fade: 3
  });
}

function drawPocketAnimations() {
  for (let anim of pocketAnimations) {
    let currentSize = anim.size * (1 - anim.progress);
    let pulseSize = currentSize * (1 + sin(frameCount * 0.2) * 0.2);

    // Draw pulsing pocket effect
    let c = anim.color;
    fill(red(c), green(c), blue(c), anim.alpha);
    noStroke();
    ellipse(anim.x, anim.y, pulseSize);

    // Draw concentric circles for ripple effect
    for (let i = 1; i <= 3; i++) {
      noFill();
      stroke(255, 255, 255, anim.alpha * 0.5);
      strokeWeight(1);
      let rippleSize = currentSize + i * 10 * anim.progress;
      circle(anim.x, anim.y, rippleSize);
    }
  }
}

// main game stuff
function drawTable() {
  // Table border
  fill(101, 67, 33);
  noStroke();
  rect(tableX - 30, tableY - 30, tableWidth + 60, tableHeight + 60, 10);

  // Table cloth
  fill(0, 100, 0);
  rect(tableX, tableY, tableWidth, tableHeight);

  // D-zone
  stroke(255);
  strokeWeight(2);
  noFill();
  let dRadius = tableHeight / 4;
  let dCenterX = tableX + tableWidth * 0.25;
  let dCenterY = tableY + tableHeight / 2;

  arc(dCenterX, dCenterY, dRadius * 2, dRadius * 2, HALF_PI, -HALF_PI);
  line(dCenterX, tableY, dCenterX, tableY + tableHeight);

  // Pockets
  fill(0);
  noStroke();
  circle(tableX, tableY, 30);
  circle(tableX + tableWidth, tableY, 30);
  circle(tableX, tableY + tableHeight, 30);
  circle(tableX + tableWidth, tableY + tableHeight, 30);
  circle(tableX + tableWidth / 2, tableY, 30);
  circle(tableX + tableWidth / 2, tableY + tableHeight, 30);
}


function createCushions() {
  // remove old cushions
  for (let c of cushions) {
    World.remove(world, c);
  }
  cushions = [];

  let t = 30; // thickness
  let r = 0.85; // cushion bounce

  let left = Bodies.rectangle(tableX - t / 2, tableY + tableHeight / 2, t, tableHeight + t * 2, { isStatic: true, restitution: r });
  let right = Bodies.rectangle(tableX + tableWidth + t / 2, tableY + tableHeight / 2, t, tableHeight + t * 2, { isStatic: true, restitution: r });
  let top = Bodies.rectangle(tableX + tableWidth / 2, tableY - t / 2, tableWidth + t * 2, t, { isStatic: true, restitution: r });
  let bottom = Bodies.rectangle(tableX + tableWidth / 2, tableY + tableHeight + t / 2, tableWidth + t * 2, t, { isStatic: true, restitution: r });

  cushions.push(left, right, top, bottom);
  World.add(world, cushions);
}

function setupMode1() {
  fouls = 0;
  colourIndex = 0;
  expectedBall = 'red';
  clearBalls();
  score = 0;
  ballHistory.clear();
  ballTrails = [];
  cueImpactAnimations = [];
  pocketAnimations = [];

  // 15 red balls in triangle 
  let tipX = tableX + tableWidth * 0.675;
  let triY = tableY + tableHeight / 2;
  let spacing = ballSize * 1.1;

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      let x = tipX + row * spacing * 0.866;
      let y = triY + (col * spacing) - (row * spacing / 2);
      balls.push(makeBall(x, y, color(255, 0, 0), 'red', null, color(255, 100, 100, 150)));
    }
  }

  setupColoredBalls();

  cueBall = null;
  cueBallPlaced = false;
  placingCueBall = true;
  canShoot = false;
  canShoot = true;
  gameMode = 1;
}

function setupMode2() {
  fouls = 0;
  colourIndex = 0;
  expectedBall = 'red';
  clearBalls();
  score = 0;
  ballHistory.clear();
  ballTrails = [];
  cueImpactAnimations = [];
  pocketAnimations = [];

  for (let cluster = 0; cluster < 3; cluster++) {
    let centerX = random(tableX + 200, tableX + tableWidth - 200);
    let centerY = random(tableY + 100, tableY + tableHeight - 100);

    for (let i = 0; i < 5; i++) {
      let angle = random(TWO_PI);
      let radius = random(30, 80);
      let x = centerX + cos(angle) * radius;
      let y = centerY + sin(angle) * radius;

      x = constrain(x, tableX + ballSize, tableX + tableWidth - ballSize);
      y = constrain(y, tableY + ballSize, tableY + tableHeight - ballSize);

      balls.push(makeBall(x, y, color(255, 0, 0), 'red', null, color(255, 100, 100, 150)));
    }
  }

  setupColoredBalls();
  cueBall = null;
  cueBall = null;
  cueBallPlaced = false;
  placingCueBall = true;
  canShoot = false;
  canShoot = true;
  gameMode = 2;
}

function setupMode3() {
  fouls = 0;
  colourIndex = 0;
  expectedBall = 'red';
  clearBalls();
  score = 0;

  ballHistory.clear();
  ballTrails = [];
  cueImpactAnimations = [];
  pocketAnimations = [];

  setupColoredBalls();

  let gapY = ballSize * 1.2;
  let gapX = ballSize * 1.9;

  let px = coloredSpots.pink.x;
  let py = coloredSpots.pink.y;

  for (let i = -6; i <= 6; i++) {
    if (i === 0) continue; // skip pink
    balls.push(makeBall(px, py + i * gapY, color(255, 0, 0), 'red', null, color(255, 100, 100, 150)));
  }

  for (let j = 1; j <= 6; j++) {
    balls.push(makeBall(px + j * gapX, py, color(255, 0, 0), 'red', null, color(255, 100, 100, 150)));
  }

  cueBall = null;
  cueBallPlaced = false;
  placingCueBall = true;
  canShoot = true;
  gameMode = 3;
}


function setupColoredBalls() {
  // make sure spots match the current table position
  updateColoredSpots();

  // Add the coloured balls
  addColoredBall('yellow', color(255, 255, 0), 2, color(255, 255, 150, 150));
  addColoredBall('green', color(0, 200, 0), 3, color(150, 255, 150, 150));
  addColoredBall('brown', color(139, 69, 19), 4, color(200, 150, 100, 150));
  addColoredBall('blue', color(0, 0, 255), 5, color(150, 150, 255, 150));
  addColoredBall('pink', color(255, 105, 180), 6, color(255, 200, 220, 150));
  addColoredBall('black', color(0), 7, color(50, 50, 50, 150));
}

function addColoredBall(type, ballColor, points, trailColor) {
  let spot = coloredSpots[type];
  balls.push(makeBall(spot.x, spot.y, ballColor, type, points, trailColor));
}

function redsRemaining() {
  for (let b of balls) {
    if (b.type === 'red') return true;
  }
  return false;
}

function respotColoredBall(ball) {
  let spot = coloredSpots[ball.type];
  if (!spot) return;

  // Try the spot first. If blocked, nudge up/down a bit until free.
  let x = spot.x;
  let y = spot.y;

  let attempts = 20;
  let step = ballSize * 1.1;

  for (let i = 0; i < attempts; i++) {
    let blocked = false;
    for (let other of balls) {
      if (other === ball) continue;
      if (dist(x, y, other.x, other.y) < ballSize) {
        blocked = true;
        break;
      }
    }

    if (!blocked) break;

    // alternate up/down
    let dir = (i % 2 === 0) ? 1 : -1;
    y = spot.y + dir * step * (Math.floor(i / 2) + 1);
  }

  Body.setPosition(ball.body, { x: x, y: y });
  Body.setVelocity(ball.body, { x: 0, y: 0 });
  syncBall(ball);
}

function clearBalls() {
  for (let b of balls) {
    removeBall(b);
  }
  balls = [];

  if (cueBall) {
    removeBall(cueBall);
    cueBall = null;
  }
}

function updateBalls() {
  let allBalls = [...balls];
  if (cueBall) allBalls.push(cueBall);

  for (let ball of allBalls) {
    syncBall(ball);
    checkPocket(ball);
  }

  // allow next shot when everything stops
  if (!canShoot && cueBall && !placingCueBall) {
    let allStopped = true;

    for (let ball of balls) {
      if (abs(ball.vx) > 0.05 || abs(ball.vy) > 0.05) {
        allStopped = false;
        break;
      }
    }

    if (cueBall && (abs(cueBall.vx) > 0.05 || abs(cueBall.vy) > 0.05)) {
      allStopped = false;
    }

    if (allStopped) {
      canShoot = true;
    }
  }
}

function checkPocket(ball) {
  let pockets = [
    { x: tableX, y: tableY },
    { x: tableX + tableWidth, y: tableY },
    { x: tableX, y: tableY + tableHeight },
    { x: tableX + tableWidth, y: tableY + tableHeight },
    { x: tableX + tableWidth / 2, y: tableY },
    { x: tableX + tableWidth / 2, y: tableY + tableHeight }
  ];

  let enforceRules = (gameMode !== 3);

  for (let pocket of pockets) {
    let d = dist(ball.x, ball.y, pocket.x, pocket.y);

    if (d < 20) {
      createPocketAnimation(pocket.x, pocket.y, ball.color);
      ballHistory.delete(ball);

      // cue ball
      if (ball === cueBall) {
        if (enforceRules) fouls += 1;

        removeBall(ball);
        cueBall = null;
        cueBallPlaced = false;
        placingCueBall = true;
        canShoot = false;
        return;
      }

      let index = balls.indexOf(ball);
      if (index === -1) return;

      if (ball.type === 'red') {
        // practice mode: always allow red
        if (!enforceRules) {
          score += 1;
          removeBall(ball);
          balls.splice(index, 1);
          break;
        }

        // rule modes: must be red when expected
        if (expectedBall === 'red') {
          score += 1;
          removeBall(ball);
          balls.splice(index, 1);
          expectedBall = 'colour';
        } else {
          // foul: red when colour expected
          fouls += 1;
          removeBall(ball);
          balls.splice(index, 1);
          // expectedBall stays 'colour'
        }

        break;
      }

      let redsLeft = balls.some(b => b.type === 'red');

      // while reds exist, colours respot
      if (redsLeft) {
        // practice mode: always score colour and respot
        if (!enforceRules) {
          if (ball.points) score += ball.points;
          respotColoredBall(ball);
          break;
        }

        // rule modes: only score if colour is expected
        if (expectedBall === 'colour') {
          if (ball.points) score += ball.points;
          respotColoredBall(ball);
          expectedBall = 'red';
        } else {
          // foul: colour when red expected
          fouls += 1;
          respotColoredBall(ball);
          // expectedBall stays 'red'
        }

        break;
      }

      // after reds are gone, clear colours in order
      if (ball.type === colourOrder[colourIndex]) {
        if (ball.points) score += ball.points;
        removeBall(ball);
        balls.splice(index, 1);
        colourIndex++;
      } else {
        // wrong colour potted
        if (enforceRules) fouls += 1;
        respotColoredBall(ball);
      }

      break;
    }
  }
}



function resolveBallBumperCollision(ball) {
  for (let bumper of bumpers) {
    let bp = bumper.body.position;

    let dx = ball.x - bp.x;
    let dy = ball.y - bp.y;
    let distSq = dx * dx + dy * dy;

    let bumperRadius = bumper.r + BUMPER_RING;
    let minDist = ballSize / 2 + bumperRadius;

    if (distSq < minDist * minDist) {
      let dist = Math.sqrt(distSq) || 0.001;

      // normal vector
      let nx = dx / dist;
      let ny = dy / dist;

      // reflect velocity
      let dot = ball.vx * nx + ball.vy * ny;
      ball.vx -= 2 * dot * nx;
      ball.vy -= 2 * dot * ny;

      // pinball-style boost
      ball.vx *= 1.2;
      ball.vy *= 1.2;

      // push ball out of bumper
      ball.x = bp.x + nx * minDist;
      ball.y = bp.y + ny * minDist;
    }
  }
}

function resolveBallBumperCollision(ball) {
  for (let bumper of bumpers) {
    let bp = bumper.body.position;

    let dx = ball.x - bp.x;
    let dy = ball.y - bp.y;
    let distSq = dx * dx + dy * dy;

    let bumperRadius = bumper.r + BUMPER_RING;
    let minDist = ballSize / 2 + bumperRadius;

    if (distSq < minDist * minDist) {
      let dist = Math.sqrt(distSq) || 0.001;

      // normal vector
      let nx = dx / dist;
      let ny = dy / dist;

      // reflect velocity
      let dot = ball.vx * nx + ball.vy * ny;
      ball.vx -= 2 * dot * nx;
      ball.vy -= 2 * dot * ny;

      // pinball-style boost 
      ball.vx *= 1.2;
      ball.vy *= 1.2;

      // push ball out of bumper
      ball.x = bp.x + nx * minDist;
      ball.y = bp.y + ny * minDist;
    }
  }
}

function handleBumperCollisions() {
  if (!pinballMode) return;

  // check cue ball first
  if (cueBall) {
    resolveBallBumperCollision(cueBall);
  }

  // then check all other balls
  for (let ball of balls) {
    resolveBallBumperCollision(ball);
  }
}

function drawBalls() {
  for (let ball of balls) {
    noStroke();
    // Shadow
    fill(0, 0, 0, 50);
    ellipse(ball.x + 2, ball.y + 2, ballSize, ballSize);

    // Ball
    fill(ball.color);
    ellipse(ball.x, ball.y, ballSize, ballSize);

    // White circle for colored balls
    if (ball.type !== 'red' && ball.type !== 'white') {
      fill(255);
      circle(ball.x, ball.y, ballSize * 0.7);
      fill(ball.color);
      circle(ball.x, ball.y, ballSize * 0.5);

      // Number for black ball
      if (ball.type === 'black') {
        fill(255);
        textAlign(CENTER, CENTER);
        textSize(10);
        text("7", ball.x, ball.y);
      }
    }
  }

  // Draw cue ball
  if (cueBall) {
    fill(0, 0, 0, 50);
    ellipse(cueBall.x + 2, cueBall.y + 2, ballSize, ballSize);

    fill(cueBall.color);
    ellipse(cueBall.x, cueBall.y, ballSize, ballSize);
    fill(0);
    circle(cueBall.x + 4, cueBall.y, 6);
  }
}

// cue + aiming

function drawCue() {
  if (!cueBall || !canShoot) return;

  let ballX = cueBall.x;
  let ballY = cueBall.y;
  let angle = atan2(mouseY - ballY, mouseX - ballX);

  if (aiming) {
    // Calculate the vector FROM ball TO mouse
    let mouseDirX = mouseX - ballX;
    let mouseDirY = mouseY - ballY;

    // Calculate the vector FROM ball TO initial click
    let clickDirX = aimStartX - ballX;
    let clickDirY = aimStartY - ballY;

    // Calculate dot product to see if player is dragging in same direction as initial click
    let dotProduct = mouseDirX * clickDirX + mouseDirY * clickDirY;

    // Only give power if dragging AWAY from ball (in same general direction as initial click)
    if (dotProduct > 0) {
      // Dragging away from ball - calculate power based on distance FROM BALL
      let currentDistance = dist(mouseX, mouseY, ballX, ballY);
      let initialDistance = dist(aimStartX, aimStartY, ballX, ballY);
      let dragDistance = currentDistance - initialDistance;

      // Only positive drag (away from ball) gives power
      power = max(0, min(dragDistance / 120, 1.0));
    } else {
      // Dragging toward ball - no power
      power = 0;
    }

    // Draw cue pulling back based on power
    drawAimingCueStick(ballX, ballY, angle, power * 120);

    // Show power meter
    drawPoolPowerMeter(ballX, ballY - 35, power);

    // mode 3: aiming line
    if (gameMode === 3) {
      drawAimingLine(ballX, ballY, angle, power);
    }

  } else {
    // Show cue in ready position
    drawReadyCueStick(ballX, ballY, angle);

    // mode 3: faint line when not aiming
    if (gameMode === 3 && cueBall && canShoot) {
      drawAimingLine(ballX, ballY, angle, 0);
    }
  }
}

function drawAimingLine(startX, startY, angle, power) {
  // Direction the ball will go (opposite of where mouse is)
  let shootAngle = angle + PI;

  // Draw the main aiming line
  stroke(255, 255, 255, 180);
  strokeWeight(2);

  // Calculate line with ball collision detection
  let points = calculateAimingPointsWithBallCollision(startX, startY, shootAngle);

  // Draw the line segments (2 segments max)
  for (let i = 0; i < points.length - 1; i++) {
    // First segment: solid white
    if (i === 0) {
      stroke(255, 255, 255, 220);
      strokeWeight(3);
    }
    // Second segment: shorter and fainter
    else if (i === 1) {
      stroke(255, 255, 255, 150);
      strokeWeight(2);
    }

    line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
  }

  // Draw power indicator dots along the line
  if (power > 0) {
    let totalLength = 0;
    for (let i = 0; i < points.length - 1; i++) {
      totalLength += dist(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }

    let powerLength = totalLength * power;
    let accumulated = 0;

    for (let i = 0; i < points.length - 1; i++) {
      let segmentLength = dist(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);

      if (accumulated + segmentLength >= powerLength) {
        // Draw power indicator at this point
        let t = (powerLength - accumulated) / segmentLength;
        let powerX = lerp(points[i].x, points[i + 1].x, t);
        let powerY = lerp(points[i].y, points[i + 1].y, t);

        fill(255, 255, 0, 200);
        noStroke();
        circle(powerX, powerY, 8);
        break;
      }
      accumulated += segmentLength;
    }
  }

  // Check and mark FIRST ball collision
  let collision = findFirstBallCollision(startX, startY, shootAngle);
  if (collision.hit) {
    // Draw collision indicator
    fill(255, 100, 100, 200);
    noStroke();
    circle(collision.x, collision.y, 12);

    // Draw circle around ball
    noFill();
    stroke(255, 100, 100, 200);
    strokeWeight(3);
    circle(collision.ballX, collision.ballY, ballSize + 10);

    // Draw line from collision point to ball center
    stroke(255, 100, 100, 180);
    strokeWeight(1.5);
    line(collision.x, collision.y, collision.ballX, collision.ballY);
  }
}

function rayEndToWallOrPocket(startX, startY, dirX, dirY) {
  // find where a ray hits the table edge (or a pocket) first
  // dirX, dirY should be normalized

  let left = tableX;
  let right = tableX + tableWidth;
  let top = tableY;
  let bottom = tableY + tableHeight;

  // default: very far
  let bestT = 999999;
  let endX = startX + dirX * 800;
  let endY = startY + dirY * 800;

  // hit vertical walls
  if (dirX !== 0) {
    let t1 = (left - startX) / dirX;
    let y1 = startY + dirY * t1;
    if (t1 > 0 && y1 >= top && y1 <= bottom && t1 < bestT) {
      bestT = t1; endX = left; endY = y1;
    }

    let t2 = (right - startX) / dirX;
    let y2 = startY + dirY * t2;
    if (t2 > 0 && y2 >= top && y2 <= bottom && t2 < bestT) {
      bestT = t2; endX = right; endY = y2;
    }
  }

  // hit horizontal walls
  if (dirY !== 0) {
    let t3 = (top - startY) / dirY;
    let x3 = startX + dirX * t3;
    if (t3 > 0 && x3 >= left && x3 <= right && t3 < bestT) {
      bestT = t3; endX = x3; endY = top;
    }

    let t4 = (bottom - startY) / dirY;
    let x4 = startX + dirX * t4;
    if (t4 > 0 && x4 >= left && x4 <= right && t4 < bestT) {
      bestT = t4; endX = x4; endY = bottom;
    }
  }

  // pockets (if the ray goes "through" a pocket area, snap to pocket)
  let pockets = [
    { x: tableX, y: tableY },
    { x: tableX + tableWidth, y: tableY },
    { x: tableX, y: tableY + tableHeight },
    { x: tableX + tableWidth, y: tableY + tableHeight },
    { x: tableX + tableWidth / 2, y: tableY },
    { x: tableX + tableWidth / 2, y: tableY + tableHeight }
  ];
  let pocketR = 20;

  for (let p of pockets) {
    // projection length along ray
    let vx = p.x - startX;
    let vy = p.y - startY;
    let t = vx * dirX + vy * dirY;

    if (t > 0 && t < bestT) {
      // perpendicular distance from pocket center to ray
      let px = startX + dirX * t;
      let py = startY + dirY * t;
      let d = dist(px, py, p.x, p.y);

      if (d < pocketR) {
        bestT = t;
        endX = p.x;
        endY = p.y;
      }
    }
  }

  return { x: endX, y: endY };
}

function calculateAimingPointsWithBallCollision(startX, startY, angle) {
  let points = [{ x: startX, y: startY }];

  // First, check if palyer hit a ball before any wall
  let ballCollision = findFirstBallCollision(startX, startY, angle);

  if (ballCollision.hit) {
    // line 1: cue ball to the contact point
    points.push({ x: ballCollision.x, y: ballCollision.y });

    // line 2: predicted direction of the ball that gets hit (simple)
    // direction is from contact point towards the ball centre
    let nx = ballCollision.ballX - ballCollision.x;
    let ny = ballCollision.ballY - ballCollision.y;
    let mag = sqrt(nx * nx + ny * ny);
    if (mag > 0) {
      nx /= mag;
      ny /= mag;
    }

    // extend prediction line until wall or pocket
    let endPt = rayEndToWallOrPocket(ballCollision.ballX, ballCollision.ballY, nx, ny);
    points.push({ x: endPt.x, y: endPt.y });
    return points;
  }

  // If no ball collision, calculate wall bounce
  let wallHit = calculateWallIntersection(startX, startY, angle);
  points.push({ x: wallHit.x, y: wallHit.y });

  // Calculate bounce angle for second segment
  let bounceAngle;
  if (wallHit.wallType === 'left' || wallHit.wallType === 'right') {
    bounceAngle = PI - angle; // Horizontal bounce
  } else {
    bounceAngle = -angle; // Vertical bounce
  }

  // Start second segment slightly away from wall
  let segment2StartX = wallHit.x + cos(bounceAngle) * 2;
  let segment2StartY = wallHit.y + sin(bounceAngle) * 2;

  // Second segment is short (20px)
  let segment2EndX = segment2StartX + cos(bounceAngle) * 20;
  let segment2EndY = segment2StartY + sin(bounceAngle) * 20;

  // Check if second segment hits a ball
  let segment2Collision = findFirstBallCollision(segment2StartX, segment2StartY, bounceAngle, 20);
  if (segment2Collision.hit) {
    points.push({ x: segment2Collision.x, y: segment2Collision.y });
  } else {
    points.push({ x: segment2EndX, y: segment2EndY });
  }

  return points;
}

function findFirstBallCollision(startX, startY, angle, maxDistance = 1000) {
  // Check along the ray for ball collisions
  let closestBall = null;
  let closestDistance = maxDistance;
  let closestPoint = null;

  for (let ball of balls) {
    // Calculate closest point on the ray to this ball
    let dx = cos(angle);
    let dy = sin(angle);

    // Vector from start to ball
    let toBallX = ball.x - startX;
    let toBallY = ball.y - startY;

    // Project toBall onto the ray direction
    let projection = (toBallX * dx + toBallY * dy);

    // Only consider points in front of us (positive projection)
    if (projection > 0 && projection < maxDistance) {
      // Closest point on the ray to the ball
      let closestX = startX + dx * projection;
      let closestY = startY + dy * projection;

      let distanceToBall = dist(closestX, closestY, ball.x, ball.y);

      // If player is within ball radius + a little margin
      if (distanceToBall < ballSize * 0.8) {
        // Calculate actual collision point (a bit before the center)
        let collisionDistance = projection - sqrt((ballSize * 0.8) * (ballSize * 0.8) - distanceToBall * distanceToBall);
        collisionDistance = max(collisionDistance, 0);

        if (collisionDistance < closestDistance) {
          closestDistance = collisionDistance;
          closestBall = ball;
          closestPoint = {
            x: startX + dx * collisionDistance,
            y: startY + dy * collisionDistance
          };
        }
      }
    }
  }

  if (closestBall) {
    return {
      hit: true,
      x: closestPoint.x,
      y: closestPoint.y,
      ballX: closestBall.x,
      ballY: closestBall.y,
      ballType: closestBall.type,
      distance: closestDistance
    };
  }

  return { hit: false };
}

function calculateWallIntersection(x, y, angle) {
  // find where the line hits the table edge
  let tLeft = (tableX - x) / cos(angle);
  let tRight = (tableX + tableWidth - x) / cos(angle);
  let tTop = (tableY - y) / sin(angle);
  let tBottom = (tableY + tableHeight - y) / sin(angle);

  // only keep hits in front
  let validTs = [];
  if (tLeft > 0) validTs.push({ t: tLeft, type: 'left' });
  if (tRight > 0) validTs.push({ t: tRight, type: 'right' });
  if (tTop > 0) validTs.push({ t: tTop, type: 'top' });
  if (tBottom > 0) validTs.push({ t: tBottom, type: 'bottom' });

  // pick the nearest hit
  let nearest = validTs[0];
  for (let intersection of validTs) {
    if (intersection.t < nearest.t) {
      nearest = intersection;
    }
  }

  return {
    x: x + cos(angle) * nearest.t,
    y: y + sin(angle) * nearest.t,
    wallType: nearest.type
  };
}

function drawReadyCueStick(ballX, ballY, angle) {
  // Standard pool cue: tip near ball, cue on OPPOSITE side from mouse
  // Add PI to put cue on opposite side
  let cueAngle = angle + PI;  // Add PI to flip to opposite side

  let cueLength = 140;
  let tipOffset = 15; // Tip 15px from ball

  // Calculate positions - now cue extends in opposite direction
  let tipX = ballX - cos(cueAngle) * tipOffset;
  let tipY = ballY - sin(cueAngle) * tipOffset;
  let buttX = tipX - cos(cueAngle) * cueLength;
  let buttY = tipY - sin(cueAngle) * cueLength;

  drawPoolCue(buttX, buttY, tipX, tipY, cueAngle, false);
}

function drawAimingCueStick(ballX, ballY, angle, dragDistance) {
  // Cue pulls back when aiming - on OPPOSITE side
  let cueAngle = angle + PI;  // Add PI to flip to opposite side

  let cueLength = 140;
  let maxPull = 60;
  let pullAmount = min(dragDistance, maxPull);
  let tipOffset = 15 + pullAmount; // Tip pulls back from ball

  // Calculate positions
  let tipX = ballX - cos(cueAngle) * tipOffset;
  let tipY = ballY - sin(cueAngle) * tipOffset;
  let buttX = tipX - cos(cueAngle) * cueLength;
  let buttY = tipY - sin(cueAngle) * cueLength;

  drawPoolCue(buttX, buttY, tipX, tipY, cueAngle, true);
}

function drawPoolCue(buttX, buttY, tipX, tipY, angle, isAiming) {
  push();
  translate(buttX, buttY);
  rotate(angle);

  // Calculate actual cue length
  let cueLength = dist(buttX, buttY, tipX, tipY);

  // Cue shaft (tapered look)
  stroke(160, 120, 80);
  strokeWeight(10);
  line(0, 0, cueLength, 0);

  // Cue tip (white)
  fill(240, 240, 240);
  noStroke();
  ellipse(cueLength, 0, 14, 14);

  // Cue butt (dark)
  fill(80, 50, 30);
  ellipse(0, 0, 18, 18);

  pop();
}

function drawPoolPowerMeter(x, y, powerValue) {
  let width = 100;
  let height = 15;
  let fillWidth = powerValue * width;

  // Background
  fill(40, 40, 40, 200);
  noStroke();
  rect(x - width / 2, y - height / 2, width, height, 3);

  // Power fill (green to red)
  let r = powerValue * 255;
  let g = (1 - powerValue) * 255;
  fill(r, g, 0);
  rect(x - width / 2, y - height / 2, fillWidth, height, 3);

  // Border
  noFill();
  stroke(255);
  strokeWeight(1);
  rect(x - width / 2, y - height / 2, width, height, 3);

  // Text
  noStroke();
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(12);
  text(floor(powerValue * 100) + "%", x, y);
}

// ui + input

function drawDZoneHighlight() {
  push();
  noFill();
  stroke(255, 255, 0, 200);
  strokeWeight(3);

  let dRadius = tableHeight / 4;
  let dCenterX = tableX + tableWidth * 0.25;
  let dCenterY = tableY + tableHeight / 2;

  // Draw highlighted D-zone
  arc(dCenterX, dCenterY, dRadius * 2, dRadius * 2, HALF_PI, -HALF_PI);
  line(dCenterX, tableY, dCenterX, tableY + tableHeight);

  // Add instructions
  fill(255, 255, 0);
  noStroke();
  textSize(20);
  textAlign(CENTER, CENTER);
  text("CLICK IN D-ZONE TO PLACE CUE BALL", dCenterX, dCenterY);
  textSize(16);
  text("(Semi-circle or on baulk line)", dCenterX, dCenterY + 30);

  pop();
}

function placeCueBall(x, y) {
  // Check if position is inside D-zone
  let dRadius = tableHeight / 4;
  let dCenterX = tableX + tableWidth * 0.25;
  let dCenterY = tableY + tableHeight / 2;

  // Check if inside semi-circle OR on baulk line area
  let distance = dist(x, y, dCenterX, dCenterY);
  let inSemiCircle = (distance <= dRadius && x <= dCenterX);
  let onBaulkLine = (x === dCenterX && y >= dCenterY - dRadius && y <= dCenterY + dRadius);

  if (inSemiCircle || onBaulkLine) {
    // Create cue ball at clicked position
    cueBall = makeBall(x, y, color(255), 'white', null, color(255, 255, 255, 100));
    cueBallPlaced = true;
    placingCueBall = false;
    canShoot = true;
    return true;
  }
  return false;
}

function drawUI() {
  fill(255);
  noStroke();
  textSize(20);
  textAlign(LEFT, TOP);
  text("Score: " + score, 20, 20);
  text("Fouls: " + fouls, 120, 20);

  text("Mode: " + gameMode, 20, 50);

  textSize(16);
  text("1 = Triangle (Standard)", 20, 90);
  text("2 = Random Clusters", 20, 115);
  text("3 = Practice Line (with guides)", 20, 140);
  text("4 =  Pinball Mode (Advanced)", 20, 165)
  text("Click & drag to shoot", 20, 190);

  if (placingCueBall) {
    fill(255, 255, 0);
    textSize(18);
    textAlign(CENTER, TOP);
    text("← PLACE CUE BALL IN D-ZONE →", width / 2, 60);
  }

  // Show current mode
  textSize(24);
  textAlign(CENTER, TOP);
  if (gameMode === 1) text("MODE 1: Standard Triangle", width / 2, 20);
  else if (gameMode === 2) text("MODE 2: Random Clusters", width / 2, 20);
  else if (gameMode === 3) text("MODE 3: Practice Line (with guides)", width / 2, 20);
  else if (gameMode === 4) text("MODE 4: Pinball Extension!", width / 2, 20);

}

function mousePressed() {
  if (placingCueBall) {
    // Try to place cue ball
    if (placeCueBall(mouseX, mouseY)) {
      console.log("Cue ball placed in D-zone");
    } else {
      console.log("Click inside D-zone!");
    }
  } else if (cueBall && canShoot) {
    aiming = true;
    // remember mouse start
    aimStartX = mouseX;
    aimStartY = mouseY;
    power = 0; // Start at 0 power
  }
}

function mouseReleased() {
  if (aiming && cueBall && canShoot) {
    let angle = atan2(mouseY - cueBall.y, mouseX - cueBall.x);
    let force = power * 30;
    let shootAngle = angle + PI;

    Body.setVelocity(cueBall.body, { x: cos(shootAngle) * power * 20, y: sin(shootAngle) * power * 20 });
    syncBall(cueBall);

    // Create cue impact animation at contact point
    let impactX = cueBall.x + cos(shootAngle + PI) * (ballSize / 2 + 5);
    let impactY = cueBall.y + sin(shootAngle + PI) * (ballSize / 2 + 5);
    createCueImpact(impactX, impactY, shootAngle);

    aiming = false;
    power = 0;
    canShoot = false;
  }
}

function keyPressed() {
  if (key === '1' || key === '2' || key === '3') {
    pinballMode = false;
    clearBumpers();
  }
  if (key === '1') setupMode1();
  if (key === '2') setupMode2();
  if (key === '3') setupMode3();
  if (key === '4') {
    pinballMode = true;
    gameMode = 4;
    setupPinballMode();
    console.log("After setupPinballMode, bumpers:", bumpers.length);

  }
  if (key === 'r' || key === 'R') {
    if (gameMode === 1) setupMode1();
    else if (gameMode === 2) setupMode2();
    else if (gameMode === 3) setupMode3();
    else if (gameMode === 4) {
      setupPinballMode();

    }
  }

}

function pointInDZone(x, y) {
  let dRadius = tableHeight / 4;
  let dCenterX = tableX + tableWidth * 0.25;
  let dCenterY = tableY + tableHeight / 2;

  // only left side of baulk line
  if (x > dCenterX) return false;

  let dx = x - dCenterX;
  let dy = y - dCenterY;
  return (dx * dx + dy * dy) <= (dRadius * dRadius);
}

function getPocketList() {
  return [
    { x: tableX, y: tableY },
    { x: tableX + tableWidth / 2, y: tableY },
    { x: tableX + tableWidth, y: tableY },
    { x: tableX, y: tableY + tableHeight },
    { x: tableX + tableWidth / 2, y: tableY + tableHeight },
    { x: tableX + tableWidth, y: tableY + tableHeight }
  ];
}

function clearBumpers() {
  for (let b of bumpers) {
    World.remove(world, b.body);
  }
  bumpers = [];
}

function setupPinballMode() {
  fouls = 0;
  colourIndex = 0;
  expectedBall = 'red';
  setupMode1();
  gameMode = 4;
  clearBumpers();

  let count = 6;
  let r = 18;
  let physR = r + BUMPER_RING;
  let pockets = getPocketList();
  let pocketAvoid = 40;        // keep bumpers away from pockets
  let ballAvoid = r + ballSize; // keep bumpers away from balls
  let triesPerBumper = 200;

  for (let i = 0; i < count; i++) {
    let placed = false;

    for (let t = 0; t < triesPerBumper; t++) {
      let x = random(tableX + 80, tableX + tableWidth - 80);
      let y = random(tableY + 80, tableY + tableHeight - 80);

      // avoid D zone
      if (pointInDZone(x, y)) continue;

      // avoid pockets
      let bad = false;
      for (let p of pockets) {
        if (dist(x, y, p.x, p.y) < pocketAvoid) {
          bad = true;
          break;
        }
      }

      if (bad) continue;

      // avoid balls
      for (let b of balls) {
        if (dist(x, y, b.x, b.y) < ballAvoid) {
          bad = true;
          break;
        }
      }
      if (bad) continue;

      // avoid other bumpers already placed
      for (let ob of bumpers) {
        let bp = ob.body.position;
        if (dist(x, y, bp.x, bp.y) < r * 2 + 10) {
          bad = true;
          break;
        }
      }
      if (bad) continue;

      // place it
      let body = Bodies.circle(x, y, physR, {
        isStatic: true,
        restitution: 1.4,
        friction: 0,
        frictionAir: 0
      });

      World.add(world, body);
      bumpers.push({ body: body, r: r });
      placed = true;
      break;
    }

    // if it failed to find space, just stop early
    if (!placed) {
      console.log("Could not place bumper", i);
    }
  }


}

function drawBumpers() {
  for (let b of bumpers) {
    let p = b.body.position;
    noStroke();
    fill(255, 180, 0);
    ellipse(p.x, p.y, b.r * 2);

    noFill();
    stroke(255);
    strokeWeight(3);
    ellipse(p.x, p.y, b.r * 2 + 6);
  }

}

function windowResized() {
  // keep balls in the same place on the table when the window size changes
  let oldTableX = tableX;
  let oldTableY = tableY;

  resizeCanvas(windowWidth, windowHeight);

  tableX = width / 2 - tableWidth / 2;
  tableY = height / 2 - tableHeight / 2;

  let dx = tableX - oldTableX;
  let dy = tableY - oldTableY;

  // move every ball by the same amount
  for (let b of balls) {
    b.x += dx;
    b.y += dy;
  }
  if (cueBall) {
    cueBall.x += dx;
    cueBall.y += dy;
  }

  // respot depends on table position
  updateColoredSpots();
}

