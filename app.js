/* ==========   app.js — Do You Love Me? 💗   ========== */
(() => {
    'use strict';

    /* ---------- 01. DOM refs & state ---------- */
    const questionCard = document.getElementById('questionCard');
    const resultCard = document.getElementById('resultCard');
    const loader = document.getElementById('loader');
    const greeting = document.getElementById('greeting');
    const yesBtn = document.querySelector('.js-yes-btn');
    const noBtn = document.querySelector('.js-no-btn');
    const againBtn = document.querySelector('.js-again-btn');
    const shareBtn = document.querySelector('.js-share-btn');
    const loveNoteEl = document.querySelector('.js-love-note');
    const heartsLayer = document.getElementById('heartsLayer');
    const confettiCvs = document.getElementById('confetti');
    const meterFill = document.querySelector('.js-meter-fill');
    const meterValue = document.querySelector('.js-meter-value');
    const soundToggle = document.querySelector('.js-sound-toggle');
    const soundGlyph = soundToggle.querySelector('.icon-btn__glyph');
    const toastEl = document.querySelector('.js-toast');

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const STORAGE_KEYS = {
        sound: 'dylm_sound',
        visited: 'dylm_visited',
        note: 'dylm_note_idx',
    };

    const NO_LABELS = [
        'No',
        'Are you sure?',
        'Really sure?',
        'Think again!',
        'Last chance…',
        'Surely not?',
        "You're breaking my heart 💔",
        'Give it one thought',
        "Don't be so cold 🥺",
        'Change of heart?',
        'Pretty please?',
        'I made a GIF for this…',
        'Okay fine, yes 💗',
    ];
    const SURRENDER_INDEX = NO_LABELS.length - 1;
    const MAX_DODGES = 12;

    const TAUNTS = [
        'Nope!', 'Catch me!', 'Too slow 🐌', 'Try again!',
        'Hehe 😜', 'Missed me!', 'Nuh-uh!', 'Nice try!',
        'Zoom! 💨', 'Not today 😘', 'Boop!', 'Over here!',
    ];

    const LOVE_NOTES = [
        'You make my heart do a little dance 💃',
        "Every day with you is my favorite day 💕",
        "You're my favorite notification 📱💗",
        "I love you more than coffee (and that's a lot) ☕",
        'You + Me = Forever ♾️💖',
        'My heart skips a beat when you smile 😊',
        'You are my favorite kind of chaos 🌪️💗',
        'Home is wherever you are 🏡💕',
    ];

    const CONFETTI_COLORS = ['#ff4d6d', '#ff8fa3', '#ffb3c1', '#ffd4de', '#ffffff'];

    let dodgeCount = 0;
    let tx = 0;
    let ty = 0;
    let surrendered = false;
    let yesHandled = false;
    let lastDodge = 0;

    /* ---------- 02. Utilities ---------- */
    // Feature detection
    const hasVibrate = 'vibrate' in navigator;
    const hasShare = typeof navigator.share === 'function';
    const hasClipboard = navigator.clipboard && typeof navigator.clipboard.writeText === 'function';

    // Web Audio — synthesized, no files
    let audioCtx = null;
    function ensureAudio() {
        if (audioCtx) return audioCtx;
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        try { audioCtx = new Ctor(); } catch (_) { audioCtx = null; }
        return audioCtx;
    }

    let soundOn = localStorage.getItem(STORAGE_KEYS.sound) === '1';

    function beep(freq = 440, dur = 0.08, type = 'sine', vol = 0.08) {
        if (!soundOn) return;
        const ctx = ensureAudio();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume().catch(() => { });
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + dur);
    }

    function dodgeSound() {
        const base = 480 + dodgeCount * 45;
        beep(base, 0.06, 'sine', 0.06);
    }

    function yesFanfare() {
        if (!soundOn) return;
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
        notes.forEach((f, i) => setTimeout(() => beep(f, 0.18, 'triangle', 0.09), i * 110));
    }

    function vibrate(pattern) {
        if (!hasVibrate) return;
        try { navigator.vibrate(pattern); } catch (_) { }
    }

    function showToast(text, ms = 2200) {
        toastEl.textContent = text;
        toastEl.classList.add('is-visible');
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => toastEl.classList.remove('is-visible'), ms);
    }

    function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    /* ---------- 03. Greeting & welcome-back ---------- */
    function timeGreeting() {
        const h = new Date().getHours();
        if (h < 5) return 'Up late, cutie? 🥺';
        if (h < 12) return 'Good morning, sunshine ☀️';
        if (h < 17) return 'Good afternoon 💐';
        if (h < 22) return 'Good evening, love 🌙';
        return 'Sweet dreams soon 💤';
    }

    const isReturning = localStorage.getItem(STORAGE_KEYS.visited) === '1';
    greeting.textContent = isReturning
        ? 'Welcome back, cutie 🥰'
        : timeGreeting();
    try { localStorage.setItem(STORAGE_KEYS.visited, '1'); } catch (_) { }

    /* ---------- 04. No-button dodge ---------- */
    function overlaps(a, b, pad = 24) {
        return !(
            a.right + pad < b.left ||
            a.left - pad > b.right ||
            a.bottom + pad < b.top ||
            a.top - pad > b.bottom
        );
    }

    function pickDodgePosition() {
        const rect = noBtn.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        const baseLeft = rect.left - tx;
        const baseTop = rect.top - ty;

        const yesRect = yesBtn.getBoundingClientRect();
        const pad = Math.max(12, Math.min(window.innerWidth, window.innerHeight) * 0.03);
        const maxX = Math.max(pad + 1, window.innerWidth - w - pad);
        const maxY = Math.max(pad + 1, window.innerHeight - h - pad);

        let bestLeft = pad + Math.random() * (maxX - pad);
        let bestTop = pad + Math.random() * (maxY - pad);

        // Try to avoid landing on the Yes button
        for (let i = 0; i < 6; i++) {
            const candidate = {
                left: bestLeft, top: bestTop,
                right: bestLeft + w, bottom: bestTop + h,
            };
            if (!overlaps(candidate, yesRect, 20)) break;
            bestLeft = pad + Math.random() * (maxX - pad);
            bestTop = pad + Math.random() * (maxY - pad);
        }

        return { x: bestLeft - baseLeft, y: bestTop - baseTop };
    }

    function showTaunt(x, y) {
        if (reduceMotion.matches) return;
        const bubble = document.createElement('span');
        bubble.className = 'taunt';
        bubble.textContent = randomFrom(TAUNTS);
        bubble.style.left = `${x}px`;
        bubble.style.top = `${y}px`;
        document.body.appendChild(bubble);
        setTimeout(() => bubble.remove(), 950);
    }

    function updateMeter() {
        const pct = Math.min(100, (dodgeCount / MAX_DODGES) * 100);
        meterFill.style.width = `${pct}%`;
        meterValue.textContent = `${Math.round(pct)}%`;
    }

    function updateNoLabel() {
        dodgeCount = Math.min(dodgeCount + 1, SURRENDER_INDEX);
        const label = noBtn.querySelector('.btn__label');

        if (dodgeCount >= SURRENDER_INDEX) {
            surrendered = true;
            noBtn.classList.add('btn--ghost');
            noBtn.classList.remove('btn--no');
            noBtn.setAttribute('aria-label', 'Okay fine, yes');
        }

        const next = NO_LABELS[dodgeCount];
        if (label.textContent !== next) {
            label.textContent = next;
            noBtn.classList.remove('is-teasing');
            void noBtn.offsetWidth; // restart animation
            noBtn.classList.add('is-teasing');
        }

        // Yes grows as No runs
        const grow = Math.min(1 + dodgeCount * 0.05, 1.55);
        yesBtn.style.setProperty('--scale', grow.toFixed(3));
    }

    function dodge() {
        const now = Date.now();
        if (now - lastDodge < 60) return; // debounce rapid events
        lastDodge = now;

        const { x, y } = pickDodgePosition();
        tx = x;
        ty = y;

        // Capture current center for taunt bubble BEFORE moving
        const r = noBtn.getBoundingClientRect();
        showTaunt(r.left + r.width / 2, r.top + r.height / 2);

        noBtn.style.setProperty('translate', `${tx}px ${ty}px`);

        dodgeSound();
        vibrate(12);
    }

    function handleNoAttempt(e) {
        if (surrendered) {
            if (e && e.preventDefault) e.preventDefault();
            handleYes();
            return;
        }
        if (e && e.preventDefault) e.preventDefault();
        dodge();
        updateNoLabel();
        updateMeter();
    }

    // Desktop: dodge on hover (mouse only)
    noBtn.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        if (reduceMotion.matches) return;
        handleNoAttempt();
    });

    // Mobile + tablet + stylus: dodge on pointerdown, block the click
    noBtn.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return; // mouse already handled by pointerenter
        handleNoAttempt(e);
    });

    // Keyboard (Enter/Space) or any leftover click — still counts
    noBtn.addEventListener('click', (e) => {
        // If we already dodged on pointerdown, the click shouldn't happen
        // (because of preventDefault), but keep this as a safety net.
        if (e.pointerType && e.pointerType !== 'mouse') return;
        handleNoAttempt(e);
    });

    // Prevent the context-menu long-press on iOS from interfering
    noBtn.addEventListener('contextmenu', (e) => e.preventDefault());

    /* ---------- 05. Yes flow ---------- */
    const LOADER_MS = 2400;

    function handleYes() {
        if (yesHandled) return;
        yesHandled = true;

        yesBtn.disabled = true;
        noBtn.disabled = true;

        yesFanfare();
        vibrate([25, 40, 25, 40, 90]);

        questionCard.classList.remove('is-active');
        questionCard.setAttribute('aria-hidden', 'true');

        loader.classList.add('is-active');

        window.setTimeout(() => {
            loader.classList.remove('is-active');

            window.setTimeout(() => {
                resultCard.classList.add('is-active');
                resultCard.removeAttribute('aria-hidden');

                celebrate();
                spawnHearts(28);
                playLoveNote();

                againBtn.focus({ preventScroll: true });
            }, 260);
        }, reduceMotion.matches ? 400 : LOADER_MS);
    }

    yesBtn.addEventListener('click', handleYes);

    /* ---------- 06. Reset ---------- */
    againBtn.addEventListener('click', () => {
        resultCard.classList.remove('is-active');
        resultCard.setAttribute('aria-hidden', 'true');

        heartsLayer.replaceChildren();
        if (myConfetti) myConfetti.reset();
        loveNoteEl.textContent = '';

        window.setTimeout(() => {
            // Reset No state
            dodgeCount = 0;
            surrendered = false;
            tx = ty = 0;
            noBtn.style.setProperty('translate', '0px 0px');
            noBtn.classList.add('btn--no');
            noBtn.classList.remove('btn--ghost', 'is-teasing');
            noBtn.querySelector('.btn__label').textContent = NO_LABELS[0];
            noBtn.setAttribute('aria-label', 'No');
            noBtn.disabled = false;

            yesBtn.disabled = false;
            yesBtn.style.setProperty('--scale', '1');

            meterFill.style.width = '0%';
            meterValue.textContent = '0%';

            questionCard.classList.add('is-active');
            questionCard.removeAttribute('aria-hidden');
            yesBtn.focus({ preventScroll: true });

            yesHandled = false;
        }, 500);
    });

    /* ---------- 07. Celebration ---------- */
    let myConfetti = null;

    if (typeof window.confetti === 'function' && confettiCvs) {
        myConfetti = window.confetti.create(confettiCvs, {
            resize: true,
            useWorker: true,
        });
    }

    function celebrate() {
        if (!myConfetti || reduceMotion.matches) return;

        let shapes = ['circle', 'square'];
        try {
            const heart = window.confetti.shapeFromPath({
                path:
                    'M167.7,29.6c-18.6-18.6-48.8-18.6-67.4,0l-6.3,6.3l-6.3-6.3c-18.6-18.6-48.8-18.6-67.4,0c-18.6,18.6-18.6,48.8,0,67.4l73.7,73.7l73.7-73.7C186.3,78.4,186.3,48.2,167.7,29.6z',
            });
            shapes = [heart, 'circle'];
        } catch (_) { /* Path2D fallback */ }

        const base = {
            colors: CONFETTI_COLORS,
            shapes,
            scalar: 1.1,
            ticks: 220,
            disableForReducedMotion: true,
        };

        myConfetti({ ...base, particleCount: 90, spread: 100, startVelocity: 45, origin: { y: 0.62 } });

        setTimeout(() => {
            myConfetti({ ...base, particleCount: 50, angle: 60, spread: 70, origin: { x: 0, y: 0.75 } });
            myConfetti({ ...base, particleCount: 50, angle: 120, spread: 70, origin: { x: 1, y: 0.75 } });
        }, 180);

        const end = Date.now() + 1800;
        (function frame() {
            myConfetti({
                ...base, particleCount: 3, spread: 60, startVelocity: 20, scalar: 0.9,
                origin: { x: Math.random(), y: -0.05 },
            });
            if (Date.now() < end) requestAnimationFrame(frame);
        })();
    }

    function spawnHearts(count = 24) {
        if (reduceMotion.matches) return;

        const frag = document.createDocumentFragment();

        for (let i = 0; i < count; i++) {
            const heart = document.createElement('span');
            heart.className = 'heart';

            const size = 12 + Math.random() * 22;
            const dur = 6 + Math.random() * 6;
            const delay = Math.random() * 4;
            const drift = Math.random() * 120 - 60;
            const spin = Math.random() * 60 - 30;
            const opacity = 0.55 + Math.random() * 0.4;

            heart.style.left = `${Math.random() * 100}vw`;
            heart.style.setProperty('--size', `${size}px`);
            heart.style.setProperty('--dur', `${dur}s`);
            heart.style.setProperty('--delay', `${delay}s`);
            heart.style.setProperty('--drift', `${drift}px`);
            heart.style.setProperty('--spin', `${spin}deg`);
            heart.style.setProperty('--opacity', opacity.toFixed(2));

            if (Math.random() > 0.6) heart.style.background = 'var(--c-primary-soft)';

            frag.appendChild(heart);
        }

        heartsLayer.appendChild(frag);
        setTimeout(() => heartsLayer.replaceChildren(), 13000);
    }

    /* ---------- 07b. Typewriter love note ---------- */
    function playLoveNote() {
        const idx = Number(localStorage.getItem(STORAGE_KEYS.note) || 0) % LOVE_NOTES.length;
        const text = LOVE_NOTES[idx];
        try { localStorage.setItem(STORAGE_KEYS.note, String((idx + 1) % LOVE_NOTES.length)); } catch (_) { }

        loveNoteEl.textContent = '';

        if (reduceMotion.matches) {
            loveNoteEl.textContent = text;
            return;
        }

        let i = 0;
        const speed = 42;
        (function tick() {
            if (i < text.length) {
                loveNoteEl.textContent += text[i++];
                setTimeout(tick, speed + Math.random() * 26);
            }
        })();
    }

    /* ---------- 07c. Share ---------- */
    async function handleShare() {
        const shareData = {
            title: 'Do you love me? 💗',
            text: 'I just answered the cutest question… 💕',
            url: location.href,
        };

        try {
            if (hasShare) {
                await navigator.share(shareData);
                return;
            }
            if (hasClipboard) {
                await navigator.clipboard.writeText(shareData.url);
                showToast('Link copied! 💌 Now send it 💗');
                return;
            }
            // Very old fallback
            const input = document.createElement('input');
            input.value = shareData.url;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            input.remove();
            showToast('Link copied! 💌');
        } catch (err) {
            // User cancelled share sheet — no toast needed
        }
    }

    shareBtn.addEventListener('click', handleShare);

    /* ---------- 08. Sound toggle ---------- */
    function syncSoundUI() {
        soundToggle.setAttribute('aria-pressed', String(soundOn));
        soundToggle.setAttribute('aria-label', soundOn ? 'Disable sound effects' : 'Enable sound effects');
        soundGlyph.textContent = soundOn ? '🔊' : '🔇';
    }

    soundToggle.addEventListener('click', () => {
        soundOn = !soundOn;
        try { localStorage.setItem(STORAGE_KEYS.sound, soundOn ? '1' : '0'); } catch (_) { }
        syncSoundUI();
        if (soundOn) {
            // Small confirmation blip
            ensureAudio();
            beep(660, 0.09, 'triangle', 0.07);
            setTimeout(() => beep(880, 0.12, 'triangle', 0.07), 90);
        }
    });

    /* ---------- 09. Init ---------- */
    function init() {
        syncSoundUI();

        // Unlock audio context on first user gesture (iOS/Safari requirement)
        const unlock = () => {
            ensureAudio();
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
        };
        window.addEventListener('pointerdown', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });

        // Keep No button on-screen after resize / orientation change
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (!dodgeCount) return;
                const rect = noBtn.getBoundingClientRect();
                const pad = 16;
                let dx = 0, dy = 0;
                if (rect.left < pad) dx = pad - rect.left;
                if (rect.top < pad) dy = pad - rect.top;
                if (rect.right > window.innerWidth - pad) dx = window.innerWidth - pad - rect.right;
                if (rect.bottom > window.innerHeight - pad) dy = window.innerHeight - pad - rect.bottom;
                if (dx || dy) {
                    tx += dx;
                    ty += dy;
                    noBtn.style.setProperty('translate', `${tx}px ${ty}px`);
                }
            }, 150);
        });
    }

    init();
})();
