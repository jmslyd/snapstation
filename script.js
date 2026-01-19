const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const flash = document.getElementById('flash-overlay');
const countdownEl = document.getElementById('countdown');

// State
let config = { count: 4, layout: 'grid' }; 
let capturedImages = [];
let currentFilter = 'none';
let currentPaper = '#ffffff'; 
let baseState = null;
let currentFacingMode = 'user'; // Start with Front Camera
let retakeIndex = -1;
let photoZones = []; 

// 1. Initialize Camera (Robust Fix)
async function initCamera() {
    // 1. Stop any running streams to prevent conflicts
    if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
    }

    try {
        // 2. Attempt to get camera with ideal settings
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: currentFacingMode,
                width: { ideal: 1280 }, // Soft preference, not forced
                height: { ideal: 720 }
            },
            audio: false 
        });
        
        handleStreamSuccess(stream);

    } catch (err) {
        console.warn("High-res init failed, retrying with basic settings...", err);
        // 3. Fallback: If High-Res fails (White screen issue), try basic
        try {
            const basicStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: currentFacingMode },
                audio: false 
            });
            handleStreamSuccess(basicStream);
        } catch (e) {
            alert("Camera refused to load. Please restart the browser.");
        }
    }
}

function handleStreamSuccess(stream) {
    video.srcObject = stream;
    
    // Mirror Logic: Mirror Front (user), Normal Back (env)
    if (currentFacingMode === 'user') {
        video.style.transform = 'scaleX(-1)';
    } else {
        video.style.transform = 'scaleX(1)';
    }

    // Force Play (Fixes frozen frames on iOS)
    video.onloadedmetadata = () => {
        video.play().catch(e => console.log("Play error", e));
    };
}

initCamera();

// Switch Camera Button
document.getElementById('switch-cam-btn').addEventListener('click', () => {
    // Toggle Mode
    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
    initCamera();
});

// 2. Capture Logic
document.getElementById('shutter-btn').addEventListener('click', async () => {
    
    // RETAKE MODE
    if (retakeIndex !== -1) {
        await runCountdown(3);
        flash.classList.add('flash-fire');
        capturedImages[retakeIndex] = snapPhoto(); 
        setTimeout(() => flash.classList.remove('flash-fire'), 150);
        finishRetake();
        return;
    }

    // NORMAL MODE
    capturedImages = [];
    document.querySelector('.layout-scroll').style.opacity = '0';
    document.getElementById('shutter-btn').style.pointerEvents = 'none';
    document.getElementById('switch-cam-btn').style.opacity = '0';
    
    for (let i = 0; i < config.count; i++) {
        await runCountdown(3);
        flash.classList.add('flash-fire');
        capturedImages.push(snapPhoto());
        setTimeout(() => flash.classList.remove('flash-fire'), 150);
        if (i < config.count - 1) await new Promise(r => setTimeout(r, 800)); 
    }

    enterEditor();
});

function snapPhoto() {
    const tCanvas = document.createElement('canvas');
    tCanvas.width = video.videoWidth;
    tCanvas.height = video.videoHeight;
    const tCtx = tCanvas.getContext('2d');
    
    tCtx.translate(tCanvas.width, 0);
    // Apply Mirroring only if Front Camera
    if (currentFacingMode === 'user') {
        tCtx.scale(-1, 1); 
    } else {
        tCtx.scale(1, 1);
    }
    tCtx.drawImage(video, 0, 0);
    return tCanvas;
}

function enterEditor() {
    createComposite();
    document.getElementById('capture-page').classList.remove('active');
    document.getElementById('capture-page').classList.add('hidden');
    document.getElementById('result-page').classList.remove('hidden');
    document.getElementById('result-page').classList.add('active');

    document.querySelector('.layout-scroll').style.opacity = '1';
    document.getElementById('shutter-btn').style.pointerEvents = 'auto';
    document.getElementById('switch-cam-btn').style.opacity = '1';
}

function finishRetake() {
    retakeIndex = -1;
    enterEditor();
}

// 3. Composite Logic (6 Grid Support + iOS Safe)
function createComposite() {
    if(capturedImages.length === 0) return;
    photoZones = []; 

    const gap = 20; const padding = 40; const footerH = 120;
    const singleW = capturedImages[0].width;
    const singleH = capturedImages[0].height;
    
    let finalW, finalH;

    // Detect Layout
    if (config.count === 6 && config.layout === 'grid') {
        finalW = (singleW * 2) + gap + (padding * 2);
        finalH = (singleH * 3) + (gap * 2) + (padding * 2) + footerH;
    } 
    else if (config.count === 4 && config.layout === 'grid') {
        finalW = (singleW * 2) + gap + (padding * 2);
        finalH = (singleH * 2) + gap + (padding * 2) + footerH;
    }
    else {
        finalW = singleW + (padding * 2);
        finalH = (singleH * config.count) + (gap * (config.count - 1)) + (padding * 2) + footerH;
    }

    // iOS Safe Scale
    let scaleFactor = 1;
    if (finalH > 3000) {
        scaleFactor = 3000 / finalH;
        finalW = Math.floor(finalW * scaleFactor);
        finalH = Math.floor(finalH * scaleFactor);
    }

    canvas.width = finalW;
    canvas.height = finalH;
    
    ctx.fillStyle = currentPaper;
    ctx.fillRect(0, 0, finalW, finalH);

    capturedImages.forEach((img, i) => {
        let x, y;
        // Layout Math
        if (config.count === 6 && config.layout === 'grid') {
            const col = i % 2;
            const row = Math.floor(i / 2);
            x = padding + (col * (singleW + gap));
            y = padding + (row * (singleH + gap));
        }
        else if (config.count === 4 && config.layout === 'grid') {
            const col = i % 2;
            const row = Math.floor(i / 2);
            x = padding + (col * (singleW + gap));
            y = padding + (row * (singleH + gap));
        }
        else {
            x = padding;
            y = padding + (i * (singleH + gap));
        }
        
        // Draw Scaled
        const dX = Math.floor(x * scaleFactor);
        const dY = Math.floor(y * scaleFactor);
        const dW = Math.floor(singleW * scaleFactor);
        const dH = Math.floor(singleH * scaleFactor);

        ctx.drawImage(img, dX, dY, dW, dH);
        photoZones.push({ index: i, x: dX, y: dY, w: dW, h: dH });
    });

    // Branding
    ctx.textAlign = 'center';
    const isDark = (currentPaper === '#000000');
    ctx.fillStyle = isDark ? '#ffffff' : '#111111';
    ctx.font = `900 ${Math.floor(32 * scaleFactor)}px Inter, sans-serif`; 
    ctx.fillText('SNAPSTATION.IO', finalW / 2, finalH - (60 * scaleFactor));

    ctx.fillStyle = isDark ? '#cccccc' : '#666666';
    ctx.font = `500 ${Math.floor(18 * scaleFactor)}px Inter, sans-serif`;
    const date = new Date().toLocaleDateString();
    ctx.fillText(date, finalW / 2, finalH - (25 * scaleFactor));

    baseState = new Image();
    baseState.onload = () => render();
    baseState.src = canvas.toDataURL();
}

function render() {
    if (!baseState) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = currentFilter;
    ctx.drawImage(baseState, 0, 0);
}

// 4. Click to Retake
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    for (let zone of photoZones) {
        if (clickX >= zone.x && clickX <= zone.x + zone.w &&
            clickY >= zone.y && clickY <= zone.y + zone.h) {
            
            if(confirm(`Retake Photo #${zone.index + 1}?`)) triggerRetake(zone.index);
            break;
        }
    }
});

function triggerRetake(idx) {
    retakeIndex = idx;
    document.getElementById('result-page').classList.remove('active');
    document.getElementById('result-page').classList.add('hidden');
    document.getElementById('capture-page').classList.remove('hidden');
    document.getElementById('capture-page').classList.add('active');
}

// 5. Save/Share
async function shareCanvas() {
    canvas.toBlob(async (blob) => {
        const file = new File([blob], "snapstation.png", { type: "image/png" });
        if (navigator.share && navigator.canShare({ files: [file] })) {
            try { await navigator.share({ files: [file] }); } catch (err) {}
        } else {
            const link = document.createElement('a');
            link.download = `snapstation-${Date.now()}.png`;
            link.href = URL.createObjectURL(blob);
            link.click();
        }
    }, 'image/png');
}

document.getElementById('download-btn').addEventListener('click', shareCanvas);

window.setFormat = (count, layout) => {
    config.count = count;
    config.layout = layout;
    document.querySelectorAll('.layout-chip').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
};

window.setPaper = (color) => {
    currentPaper = color;
    document.querySelectorAll('.color-dot').forEach(b => {
        b.classList.remove('active');
        if(b.style.background.includes(color) || (color === '#000000' && b.style.background.includes('0, 0, 0'))) b.classList.add('active');
    });
    createComposite(); 
};

document.querySelectorAll('.filter-btn').forEach(btn => {
    const handler = (e) => {
        e.preventDefault();
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentFilter = e.currentTarget.dataset.filter;
        render();
    };
    btn.addEventListener('click', handler);
    btn.addEventListener('touchstart', handler);
});

document.getElementById('back-btn').addEventListener('click', () => location.reload());

function runCountdown(sec) {
    return new Promise(resolve => {
        countdownEl.classList.remove('hidden');
        countdownEl.innerText = sec;
        let n = sec;
        const timer = setInterval(() => {
            n--;
            if (n > 0) countdownEl.innerText = n;
            else {
                clearInterval(timer);
                countdownEl.innerText = "";
                countdownEl.classList.add('hidden');
                resolve();
            }
        }, 1000);
    });
}
