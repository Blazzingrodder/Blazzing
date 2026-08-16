// game.js - simple platformer with left/right and jump + touch buttons
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // make the canvas focusable so keyboard input works reliably
  try { canvas.tabIndex = 0; canvas.style.outline = 'none'; } catch (e) {}
  canvas.addEventListener('click', () => { try { canvas.focus(); } catch (e) {} });
  setTimeout(() => { try { canvas.focus(); } catch (e) {} }, 400);

  let DPR = window.devicePixelRatio || 1;
  function resize() {
    DPR = window.devicePixelRatio || 1;
    const w = Math.max(320, window.innerWidth);
    const h = Math.max(240, window.innerHeight);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  window.addEventListener('resize', resize, {passive:true});
  resize();

  // world
  const groundY = () => canvas.height / DPR - 80; // ground position in CSS pixels

  // player start
  const start = { x: 120, y: null };

  // player (we keep w/h for collision but draw a stickman)
  const player = {
    x: start.x,
    y: 0,
    w: 36,
    h: 48, // taller to fit stickman torso
    vx: 0,
    vy: 0,
    color: '#2ecc71', // shirt color (green)
    skin: '#ffd9b3',
    onGround: false,
    onPlatformIndex: null // index of platform player is standing on (or null)
  };

  // spike (obstacle)
  const spike = { x: 300, w: 200, h: 90, color: '#ff4d4d' };

  // platforms (logical) - some will be moving upward
  const platforms = [];
  (function buildPlatforms() {
    for (let i = 0; i < 40; i++) {
      const px = 200 + i * 140;
      const ph = (i % 3 ? 20 : 60);
      // make every 5th platform a moving one for variety
      const moving = (i % 5 === 0) && i > 2;
      platforms.push({ x: px, w: 100, h: ph, moving: moving, offset: moving ? 200 + Math.random()*200 : 0, vy: moving ? (40 + Math.random()*40) : 0 });
    }
  })();

  // preserve the original platform states so we can restore them when the player respawns
  const initialPlatforms = platforms.map(p => ({ x: p.x, w: p.w, h: p.h, moving: p.moving, offset: p.offset, vy: p.vy }));

  // lava: starts below ground and rises over time
  const lava = {
    // will be initialized relative to ground on first update
    level: null,    // y coordinate (CSS pixels) of the lava top
    riseSpeed: 8,   // pixels per second (increase to make it faster)
    colorTop: '#ff6b6b',
    colorBottom: '#cc2c2c'
  };

  // store the original lava level so we can reset on death
  let initialLavaLevel = null;

  // zombies (enemies)
  const zombies = [];
  const initialZombies = [];
  function buildZombies() {
    zombies.length = 0;
    // spawn several zombies at spaced positions along the ground
    const positions = [600, 1100, 1700, 2400, 3100, 3800];
    for (let i = 0; i < positions.length; i++) {
      const x = positions[i];
      const z = { x, w: 36, h: 48, speed: 60 + Math.random()*80, color: '#00cc44', vx: 0 };
      zombies.push(z);
    }
    // snapshot
    initialZombies.length = 0;
    for (let z of zombies) initialZombies.push(Object.assign({}, z));
  }
  buildZombies();

  const gravity = 1700;
  const moveSpeed = 320;
  const jumpSpeed = -620;

  const keys = { left:false, right:false };
  let gameOver = false, gameOverTimer = 0;

  // scheduled timeouts used to stagger platform starts; cleared on respawn
  let platformStartTimeouts = [];
  function clearScheduledStarts() {
    for (let t of platformStartTimeouts) clearTimeout(t);
    platformStartTimeouts = [];
  }

  function restorePlatformsSetToOriginal(resetMoving = true) {
    // replace current platform properties with the initial ones
    platforms.length = 0;
    for (let p of initialPlatforms) {
      platforms.push({ x: p.x, w: p.w, h: p.h, moving: (resetMoving ? false : p.moving), offset: p.offset, vy: p.vy });
    }
  }

  function restoreZombiesToOriginal() {
    zombies.length = 0;
    for (let z of initialZombies) zombies.push(Object.assign({}, z));
  }

  function initPositions() {
    start.y = groundY() - player.h;
    player.x = start.x;
    player.y = start.y;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
    player.onPlatformIndex = null;
    // ensure lava initialized relative to ground (if not yet)
    if (lava.level === null) lava.level = groundY() + 220; // starts 220px below ground
    // capture initial lava level the first time
    if (initialLavaLevel === null) initialLavaLevel = lava.level;
    // restore zombies
    restoreZombiesToOriginal();
  }
  initPositions();

  // After the initial positions are set and lava.level captured, ensure platforms are in original state
  restorePlatformsSetToOriginal(true);

  // schedule the 5th-closest platform to rise 3s after a respawn, then stagger the rest
  function schedulePlatformStarts() {
    clearScheduledStarts();
    // compute distances from player to each platform's x
    const list = platforms.map((p, i) => ({ i, dist: Math.abs(p.x - player.x) }));
    list.sort((a,b) => a.dist - b.dist);
    const pickIndex = Math.min(4, list.length - 1); // 5th closest (index 4) or last if fewer
    const chosenPlatformId = list[pickIndex].i;
    const order = [chosenPlatformId].concat(list.map(x => x.i).filter(i => i !== chosenPlatformId));

    const initialDelay = 3000; // 3 seconds after respawn
    const stagger = 200; // 200ms between others
    order.forEach((pid, idx) => {
      const t = setTimeout(() => {
        // start moving this platform upward
        platforms[pid].moving = true;
        platforms[pid].vy = platforms[pid].vy || (40 + Math.random() * 40);
      }, initialDelay + idx * stagger);
      platformStartTimeouts.push(t);
    });
  }

  function fullResetToOriginal() {
    // restore platforms positions and stop movement
    restorePlatformsSetToOriginal(true);
    // reset lava
    if (initialLavaLevel !== null) lava.level = initialLavaLevel;
    else lava.level = groundY() + 220;
    // restore zombies
    restoreZombiesToOriginal();
    // clear scheduled starts
    clearScheduledStarts();
    // reset camera
    camX = 0;
  }

  // keyboard
  window.addEventListener('keydown', e => {
    if (gameOver) return;
    const k = e.key; const c = e.code;
    if (k === 'ArrowLeft' || c === 'ArrowLeft' || c === 'KeyA' || k === 'a' || k === 'A') keys.left = true;
    if (k === 'ArrowRight' || c === 'ArrowRight' || c === 'KeyD' || k === 'd' || k === 'D') keys.right = true;
    const isJump = (k === 'ArrowUp' || c === 'ArrowUp' || c === 'Space' || k === ' ' || k === 'Spacebar' || c === 'KeyW' || k === 'w' || k === 'W' || c === 'KeyZ' || k === 'z' || k === 'Z');
    if (isJump) { e.preventDefault(); if (player.onGround) { player.vy = jumpSpeed; player.onGround = false; player.onPlatformIndex = null; } }
  });
  window.addEventListener('keyup', e => {
    const k = e.key; const c = e.code;
    if (k === 'ArrowLeft' || c === 'ArrowLeft' || c === 'KeyA' || k === 'a' || k === 'A') keys.left = false;
    if (k === 'ArrowRight' || c === 'ArrowRight' || c === 'KeyD' || k === 'd' || k === 'D') keys.right = false;
  });

  // touch / pointer controls (pointer capture + dataset fallback)
  function setupBtn(id, action) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', (ev) => { ev.preventDefault(); if (gameOver) return; try { el.setPointerCapture(ev.pointerId); } catch (e) {} action(true); el.dataset.down = '1'; });
    el.addEventListener('pointerup', (ev) => { ev.preventDefault(); try { el.releasePointerCapture(ev.pointerId); } catch (e) {} action(false); el.dataset.down = '0'; });
    el.addEventListener('pointercancel', (ev) => { ev.preventDefault(); action(false); el.dataset.down = '0'; });
    el.addEventListener('touchstart', (ev) => { ev.preventDefault(); if (gameOver) return; action(true); el.dataset.down = '1'; }, {passive:false});
    el.addEventListener('touchend', (ev) => { ev.preventDefault(); action(false); el.dataset.down = '0'; });
    el.addEventListener('touchcancel', (ev) => { ev.preventDefault(); action(false); el.dataset.down = '0'; });
  }
  setupBtn('leftBtn', v => keys.left = v);
  setupBtn('rightBtn', v => keys.right = v);
  const jumpBtn = document.getElementById('jumpBtn');
  if (jumpBtn) {
    jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (gameOver) return; try { jumpBtn.setPointerCapture(e.pointerId); } catch (err) {} if (player.onGround) { player.vy = jumpSpeed; player.onGround = false; player.onPlatformIndex = null; } jumpBtn.dataset.down = '1'; });
    jumpBtn.addEventListener('pointerup', (e) => { e.preventDefault(); try { jumpBtn.releasePointerCapture(e.pointerId); } catch (err) {} jumpBtn.dataset.down = '0'; });
    jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); if (gameOver) return; if (player.onGround) { player.vy = jumpSpeed; player.onGround = false; player.onPlatformIndex = null; } jumpBtn.dataset.down = '1'; }, {passive:false});
    jumpBtn.addEventListener('touchend', (e) => { e.preventDefault(); jumpBtn.dataset.down = '0'; });
    jumpBtn.addEventListener('pointercancel', (e) => { e.preventDefault(); jumpBtn.dataset.down = '0'; });
  }

  let camX = 0;
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  // triangle-aware spike collision
  function checkSpikeCollision() {
    const gY = groundY();
    const spikeLeft = spike.x - spike.w/2;
    const spikeRight = spike.x + spike.w/2;
    const playerLeft = player.x - player.w/2;
    const playerRight = player.x + player.w/2;
    const playerBottom = player.y + player.h;
    if (playerRight < spikeLeft || playerLeft > spikeRight) return false;
    const half = spike.w / 2;
    const sampleXs = [playerLeft, player.x, playerRight];
    for (let sx of sampleXs) {
      if (sx < spikeLeft || sx > spikeRight) continue;
      const dx = Math.abs(sx - spike.x);
      const localHeight = spike.h * Math.max(0, 1 - (dx / half));
      const spikeSurfaceY = gY - localHeight;
      if (playerBottom > spikeSurfaceY) return true;
    }
    return false;
  }

  function rectsIntersect(a, b) {
    return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
  }

  function update(dt) {
    start.y = groundY() - player.h;
    if (lava.level === null) lava.level = groundY() + 220; // init lava if needed

    if (gameOver) {
      gameOverTimer -= dt;
      if (gameOverTimer <= 0) {
        // Respawn: reset everything to original and schedule the platform starts
        fullResetToOriginal();
        initPositions();
        gameOver = false; gameOverTimer = 0;
        // after respawn, start the 5th-closest platform after 3s and then stagger the rest
        schedulePlatformStarts();
      }
      return;
    }

    // save old position for platform checks
    const oldY = player.y;
    const oldBottom = player.y + player.h;

    // Fallback: if pointer dataset says button still down, keep key true
    const leftBtnEl = document.getElementById('leftBtn');
    const rightBtnEl = document.getElementById('rightBtn');
    if (leftBtnEl && leftBtnEl.dataset.down === '1') keys.left = true;
    if (rightBtnEl && rightBtnEl.dataset.down === '1') keys.right = true;

    // move platforms upward (and loop them) only when not in gameOver
    const gY = groundY();
    for (let p of platforms) {
      if (p.moving) {
        const prevOffset = p.offset || 0;
        p.offset = (p.offset || 0) - p.vy * dt;
        const delta = p.offset - prevOffset; // negative when moving up
        const pTop = gY - p.h + p.offset;
        // if platform moved too high above ground, send it back below ground
        if (pTop + p.h < gY - 360) {
          p.offset = 200 + Math.random() * 220; // drop back below ground to rise again
          p.vy = 40 + Math.random() * 40; // vary speed
        }
        // if player is standing on this platform, move the player along with it
        if (player.onPlatformIndex !== null) {
          const pi = player.onPlatformIndex;
          if (platforms[pi] === p) {
            // move player by the same offset change
            player.y += delta; // delta is negative for upward movement
            player.vy = 0; // lock vertical velocity while on platform
          }
        }
      }
    }

    // horizontal control
    let ax = 0; if (keys.left) ax -= 1; if (keys.right) ax += 1; player.vx = ax * moveSpeed;
    // gravity and integrate
    player.vy += gravity * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // platform collision (respecting moving platforms' offset)
    let landed = false;
    if (player.vy > 0) {
      for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        const pTop = gY - p.h + (p.offset || 0);
        const pLeft = p.x - p.w/2;
        const pRight = p.x + p.w/2;
        const newBottom = player.y + player.h;
        if (player.x + player.w/2 > pLeft && player.x - player.w/2 < pRight) {
          if (oldBottom <= pTop && newBottom > pTop) {
            // don't land if platform is submerged under lava surface
            if (pTop >= lava.level) continue;
            player.y = pTop - player.h;
            player.vy = 0;
            player.onGround = true;
            player.onPlatformIndex = i; // remember which platform we stand on
            landed = true;
            break;
          }
        }
      }
    }

    // ground collision if not on a platform
    if (!landed) {
      if (player.y + player.h > gY) {
        player.y = gY - player.h;
        player.vy = 0;
        player.onGround = true;
        player.onPlatformIndex = null;
      } else {
        player.onGround = false;
        // if we are not standing on anything, clear platform index
        player.onPlatformIndex = null;
      }
    }

    // spike collision
    if (checkSpikeCollision()) {
      // reset world immediately on death
      fullResetToOriginal();
      gameOver = true; gameOverTimer = 5.0; player.vx = 0; player.vy = 0; return;
    }

    // lava rising
    lava.level -= lava.riseSpeed * dt; // move lava up (smaller y)

    // if player is in lava -> game over (reset world immediately)
    const playerBottom = player.y + player.h;
    if (playerBottom > lava.level) {
      fullResetToOriginal();
      gameOver = true; gameOverTimer = 5.0; player.vx = 0; player.vy = 0; return;
    }

    // zombies: move toward player on ground and check collisions
    for (let z of zombies) {
      // keep zombies on ground
      z.y = groundY() - z.h;
      if (z.x < player.x - 6) z.vx = z.speed; else if (z.x > player.x + 6) z.vx = -z.speed; else z.vx = 0;
      z.x += z.vx * dt;
      // simple collision box between player and zombie
      const zbox = { x: z.x - z.w/2, y: z.y, w: z.w, h: z.h };
      const pbox = { x: player.x - player.w/2, y: player.y, w: player.w, h: player.h };
      if (rectsIntersect(zbox, pbox)) {
        fullResetToOriginal();
        gameOver = true; gameOverTimer = 5.0; player.vx = 0; player.vy = 0; return;
      }
    }

    // keep player in bounds
    if (player.x < 20) player.x = 20;
    if (player.x > 5000) player.x = 5000;

    // camera
    const canvasW = canvas.width / DPR; camX = player.x - canvasW / 2; if (camX < 0) camX = 0;
  }

  function drawStickman(x, y) {
    const cx = x; const top = y; const bodyWidth = player.w; const bodyHeight = player.h - 8; const headR = Math.min(12, bodyWidth/2);
    const headCX = cx; const headCY = top - headR; const torsoTop = top; const torsoBottom = top + bodyHeight; const shoulderY = torsoTop + 6; const waistY = torsoTop + Math.round(bodyHeight * 0.5);
    // head
    ctx.fillStyle = player.skin; ctx.beginPath(); ctx.arc(headCX, headCY, headR, 0, Math.PI * 2); ctx.fill();
    // shirt
    ctx.fillStyle = player.color; ctx.fillRect(cx - bodyWidth/2, torsoTop, bodyWidth, Math.round(bodyHeight * 0.5));
    // pants
    ctx.fillStyle = '#44475a'; ctx.fillRect(cx - bodyWidth/2, torsoTop + Math.round(bodyHeight * 0.5), bodyWidth, Math.round(bodyHeight * 0.5));
    // arms
    ctx.strokeStyle = '#333'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - bodyWidth/2 + 4, shoulderY); ctx.lineTo(cx - bodyWidth/2 - 14, shoulderY + 18); ctx.moveTo(cx + bodyWidth/2 - 4, shoulderY); ctx.lineTo(cx + bodyWidth/2 + 14, shoulderY + 18); ctx.stroke();
    // legs
    ctx.beginPath(); ctx.moveTo(cx - 8, waistY); ctx.lineTo(cx - 12, torsoBottom + 20); ctx.moveTo(cx + 8, waistY); ctx.lineTo(cx + 12, torsoBottom + 20); ctx.stroke();
    // eyes
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(headCX - 4, headCY - 2, 1.6, 0, Math.PI * 2); ctx.arc(headCX + 4, headCY - 2, 1.6, 0, Math.PI * 2); ctx.fill();
  }

  function render() {
    const w = canvas.width / DPR; const h = canvas.height / DPR; ctx.clearRect(0,0,w,h);
    // sky
    ctx.fillStyle = '#7ec8ff'; ctx.fillRect(0,0,w,h);
    // draw world translated by camera
    const gY = groundY(); ctx.save(); ctx.translate(-camX,0);
    // ground
    ctx.fillStyle = '#2b2b3f'; ctx.fillRect(0, gY, 6000, h - gY);
    // platforms
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i]; const px = p.x - p.w/2; const py = gY - p.h + (p.offset || 0);
      // draw moving platforms slightly brighter
      ctx.fillStyle = p.moving ? '#5b6580' : (i % 2 ? '#47506a' : '#3b3f58'); ctx.fillRect(px, py, p.w, p.h);
    }
    // spike
    ctx.fillStyle = spike.color; const sx = spike.x; const sw = spike.w; const sh = spike.h; ctx.beginPath(); ctx.moveTo(sx - sw/2, gY); ctx.lineTo(sx, gY - sh); ctx.lineTo(sx + sw/2, gY); ctx.closePath(); ctx.fill();
    // zombies (draw on world)
    for (let z of zombies) {
      const zx = z.x; const zy = groundY() - z.h; ctx.fillStyle = '#00cc44'; ctx.fillRect(zx - z.w/2, zy, z.w, z.h);
      // simple eyes
      ctx.fillStyle = '#003300'; ctx.fillRect(zx - 8, zy + 8, 4, 4); ctx.fillRect(zx + 4, zy + 8, 4, 4);
    }
    // lava (drawn on top so it can submerge platforms)
    const lavaTop = lava.level; const lavaBottom = h; const grad = ctx.createLinearGradient(0, lavaTop, 0, lavaBottom); grad.addColorStop(0, lava.colorTop); grad.addColorStop(1, lava.colorBottom); ctx.fillStyle = grad; ctx.fillRect(camX, lavaTop, w, lavaBottom - lavaTop);
    // player shadow & sprite
    const px = player.x; const py = player.y; ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(px, gY + 6, player.w, 6, 0, 0, Math.PI*2); ctx.fill(); drawStickman(px, py);
    ctx.restore();
    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(8,8,520,36); ctx.fillStyle = '#fff'; ctx.font = '14px system-ui, -apple-system'; ctx.fillText('← / → or touch • Up/Space/W to jump • Lava rises! • Zombies chase you', 14, 32);
    // Game Over overlay
    if (gameOver) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0,0,w,h); ctx.fillStyle = '#ffdddd'; ctx.font = '48px system-ui, -apple-system'; ctx.textAlign = 'center'; ctx.fillText('GAME OVER', w/2, h/2 - 10); ctx.font = '20px system-ui, -apple-system'; ctx.fillStyle = '#fff'; const sec = Math.max(0, Math.ceil(gameOverTimer)); ctx.fillText('Respawning in ' + sec + '...', w/2, h/2 + 30); ctx.textAlign = 'start'; }
  }

  requestAnimationFrame(loop);
})();
