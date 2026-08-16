// game.js - simple platformer with left/right and Up-arrow jump + touch buttons
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

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
    onGround: false
  };

  // spike (obstacle) - bigger and close to start
  const spike = {
    x: 300,
    w: 200,
    h: 90,
    color: '#ff4d4d'
  };

  // platforms (the rectangles you want to be solid)
  const platforms = [];
  (function buildPlatforms() {
    for (let i = 0; i < 40; i++) {
      const px = 200 + i * 140;
      const ph = (i % 3 ? 20 : 60);
      platforms.push({ x: px, w: 100, h: ph });
    }
  })();

  const gravity = 1700;
  const moveSpeed = 320;
  const jumpSpeed = -620;

  const keys = { left:false, right:false };
  let gameOver = false, gameOverTimer = 0;

  function initPositions() {
    start.y = groundY() - player.h;
    player.x = start.x;
    player.y = start.y;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
  }
  initPositions();

  // keyboard
  window.addEventListener('keydown', e => {
    if (gameOver) return;
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
    // support Up arrow AND Space for jump (Spacebar keycode: 'Space' or key === ' ')
    if (e.key === 'ArrowUp' || e.code === 'Space' || e.key === ' ') {
      if (player.onGround) { player.vy = jumpSpeed; player.onGround = false; }
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', e => { if (e.key === 'ArrowLeft') keys.left = false; if (e.key === 'ArrowRight') keys.right = false; });

  // touch / pointer controls
  function setupBtn(id, action) {
    const el = document.getElementById(id);
    if (!el) return;

    // Use Pointer Events with pointer capture so holding one control isn't cancelled when touching another
    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      if (gameOver) return;
      try { el.setPointerCapture(ev.pointerId); } catch (e) {}
      action(true);
      el.dataset.down = '1';
    });

    el.addEventListener('pointerup', (ev) => {
      ev.preventDefault();
      try { el.releasePointerCapture(ev.pointerId); } catch (e) {}
      action(false);
      el.dataset.down = '0';
    });

    el.addEventListener('pointercancel', (ev) => {
      ev.preventDefault();
      action(false);
      el.dataset.down = '0';
    });

    // touch fallbacks for older browsers (kept for compatibility)
    el.addEventListener('touchstart', (ev) => { ev.preventDefault(); if (gameOver) return; action(true); el.dataset.down = '1'; }, {passive:false});
    el.addEventListener('touchend', (ev) => { ev.preventDefault(); action(false); el.dataset.down = '0'; });
    el.addEventListener('touchcancel', (ev) => { ev.preventDefault(); action(false); el.dataset.down = '0'; });
  }

  setupBtn('leftBtn', v => keys.left = v);
  setupBtn('rightBtn', v => keys.right = v);

  const jumpBtn = document.getElementById('jumpBtn');
  if (jumpBtn) {
    // make jump robust while other buttons are held by also using pointer capture
    jumpBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (gameOver) return;
      try { jumpBtn.setPointerCapture(e.pointerId); } catch (err) {}
      if (player.onGround) { player.vy = jumpSpeed; player.onGround = false; }
      jumpBtn.dataset.down = '1';
    });
    jumpBtn.addEventListener('pointerup', (e) => { e.preventDefault(); try { jumpBtn.releasePointerCapture(e.pointerId); } catch (err) {} jumpBtn.dataset.down = '0'; });
    jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); if (gameOver) return; if (player.onGround) { player.vy = jumpSpeed; player.onGround = false; } jumpBtn.dataset.down = '1'; }, {passive:false});
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

  // triangle-aware collision test: sample across player's width and compare feet to spike triangular surface
  function checkSpikeCollision() {
    const gY = groundY();
    const spikeLeft = spike.x - spike.w/2;
    const spikeRight = spike.x + spike.w/2;
    const playerLeft = player.x - player.w/2;
    const playerRight = player.x + player.w/2;
    const playerBottom = player.y + player.h;

    // quick reject if no horizontal overlap at all
    if (playerRight < spikeLeft || playerLeft > spikeRight) return false;

    const half = spike.w / 2;
    // sample three X positions across player's width (left, center, right)
    const sampleXs = [playerLeft, player.x, playerRight];
    for (let sx of sampleXs) {
      if (sx < spikeLeft || sx > spikeRight) continue;
      const dx = Math.abs(sx - spike.x);
      // linear triangular profile: height decreases linearly from center to edges
      const localHeight = spike.h * Math.max(0, 1 - (dx / half));
      const spikeSurfaceY = gY - localHeight;
      // collision only if player's feet go below the triangular surface at this x
      if (playerBottom > spikeSurfaceY) return true;
    }
    return false;
  }

  function update(dt) {
    start.y = groundY() - player.h;
    if (gameOver) {
      gameOverTimer -= dt;
      if (gameOverTimer <= 0) {
        initPositions();
        gameOver = false;        // stop the game-over state
        gameOverTimer = 0;      // clamp to zero
      }
      return;
    }

    // save old position for platform collision checks
    const oldY = player.y;
    const oldBottom = player.y + player.h;

    // Fallback: if pointer dataset says a button is still down, keep its key true
    const leftBtnEl = document.getElementById('leftBtn');
    const rightBtnEl = document.getElementById('rightBtn');
    if (leftBtnEl && leftBtnEl.dataset.down === '1') keys.left = true;
    if (rightBtnEl && rightBtnEl.dataset.down === '1') keys.right = true;

    // horizontal control
    let ax = 0; if (keys.left) ax -= 1; if (keys.right) ax += 1; player.vx = ax * moveSpeed;

    // gravity and integrate
    player.vy += gravity * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    const gY = groundY();

    // platform collision: only if falling (player.vy > 0)
    let landed = false;
    if (player.vy > 0) {
      for (let p of platforms) {
        const pTop = gY - p.h;
        const pLeft = p.x - p.w/2;
        const pRight = p.x + p.w/2;
        const newBottom = player.y + player.h;
        // horizontal overlap
        if (player.x + player.w/2 > pLeft && player.x - player.w/2 < pRight) {
          // crossed downward through the platform top this frame?
          if (oldBottom <= pTop && newBottom > pTop) {
            // land on platform
            player.y = pTop - player.h;
            player.vy = 0;
            player.onGround = true;
            landed = true;
            break;
          }
        }
      }
    }

    // ground collision if not landed on a platform
    if (!landed) {
      if (player.y + player.h > gY) {
        player.y = gY - player.h;
        player.vy = 0;
        player.onGround = true;
      } else {
        player.onGround = false;
      }
    }

    // spike collision -> trigger game over
    if (checkSpikeCollision()) {
      gameOver = true;
      gameOverTimer = 5.0; // seconds of game over
      player.vx = 0;
      player.vy = 0;
      return;
    }

    // keep player in bounds horizontally
    if (player.x < 20) player.x = 20;
    if (player.x > 5000) player.x = 5000; // big level width

    // camera follows player
    const canvasW = canvas.width / DPR;
    camX = player.x - canvasW / 2;
    if (camX < 0) camX = 0;
  }

  function drawStickman(x, y) {
    // x is center x, y is top of torso
    const cx = x;
    const top = y;
    const bodyWidth = player.w; // 36
    const bodyHeight = player.h - 8; // leave a little space for head
    const headR = Math.min(12, bodyWidth/2);
    const headCX = cx;
    const headCY = top - headR;

    const torsoTop = top;
    const torsoBottom = top + bodyHeight;
    const shoulderY = torsoTop + 6;
    const waistY = torsoTop + Math.round(bodyHeight * 0.5);

    // head
    ctx.fillStyle = player.skin;
    ctx.beginPath();
    ctx.arc(headCX, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    // shirt
    ctx.fillStyle = player.color;
    ctx.fillRect(cx - bodyWidth/2, torsoTop, bodyWidth, Math.round(bodyHeight * 0.5));

    // pants
    ctx.fillStyle = '#44475a';
    ctx.fillRect(cx - bodyWidth/2, torsoTop + Math.round(bodyHeight * 0.5), bodyWidth, Math.round(bodyHeight * 0.5));

    // arms
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - bodyWidth/2 + 4, shoulderY);
    ctx.lineTo(cx - bodyWidth/2 - 14, shoulderY + 18);
    ctx.moveTo(cx + bodyWidth/2 - 4, shoulderY);
    ctx.lineTo(cx + bodyWidth/2 + 14, shoulderY + 18);
    ctx.stroke();

    // legs
    ctx.beginPath();
    ctx.moveTo(cx - 8, waistY);
    ctx.lineTo(cx - 12, torsoBottom + 20);
    ctx.moveTo(cx + 8, waistY);
    ctx.lineTo(cx + 12, torsoBottom + 20);
    ctx.stroke();

    // eyes
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(headCX - 4, headCY - 2, 1.6, 0, Math.PI * 2);
    ctx.arc(headCX + 4, headCY - 2, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  function render() {
    const w = canvas.width / DPR;
    const h = canvas.height / DPR;
    ctx.clearRect(0,0,w,h);

    // background
    ctx.fillStyle = '#7ec8ff';
    ctx.fillRect(0,0,w,h);

    // draw level translated by camera
    const gY = groundY();
    ctx.save();
    ctx.translate(-camX,0);

    // ground
    ctx.fillStyle = '#2b2b3f';
    ctx.fillRect(0, gY, 6000, h - gY);

    // decorative rectangles & platforms
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      const px = p.x - p.w/2;
      const py = gY - p.h;
      ctx.fillStyle = i % 2 ? '#47506a' : '#3b3f58';
      ctx.fillRect(px, py, p.w, p.h);
    }

    // spike
    ctx.fillStyle = spike.color;
    const sx = spike.x;
    const sw = spike.w;
    const sh = spike.h;
    ctx.beginPath();
    ctx.moveTo(sx - sw/2, gY);
    ctx.lineTo(sx, gY - sh);
    ctx.lineTo(sx + sw/2, gY);
    ctx.closePath();
    ctx.fill();

    // player as stickman
    const px = player.x;
    const py = player.y;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(px, gY + 6, player.w, 6, 0, 0, Math.PI*2);
    ctx.fill();

    drawStickman(px, py);

    ctx.restore();

    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(8,8,340,36);
    ctx.fillStyle = '#fff';
    ctx.font = '14px system-ui, -apple-system';
    ctx.fillText('← / → or touch • Up arrow to jump', 14, 32);

    // Game Over overlay
    if (gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0,0,w,h);
      ctx.fillStyle = '#ffdddd';
      ctx.font = '48px system-ui, -apple-system';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', w/2, h/2 - 10);
      ctx.font = '20px system-ui, -apple-system';
      ctx.fillStyle = '#fff';
      const sec = Math.max(0, Math.ceil(gameOverTimer));
      ctx.fillText('Respawning in ' + sec + '...', w/2, h/2 + 30);
      ctx.textAlign = 'start';
    }
  }

  requestAnimationFrame(loop);
})();
