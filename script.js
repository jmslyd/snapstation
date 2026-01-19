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
let currentFacingMode = 'user';
let retakeIndex = -1; // Tracks which photo to retake (0-3) or -1 for none

// Grid Geometry (Stored to detect taps on specific photos)
let photoZones = []; 

// 1. Initialize Camera
async function initCamera() {
    if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: currentFacingMode,
                aspectRatio: { ideal: 1.3333 }, // 4:3 Ratio
                width: { ideal: 1280 } 
            },
            audio: false 
        });
        video.srcObject = stream;
        
        // Mirror Logic: Mirror Front (user), Normal Back (env)
        video.style.transform = (currentFacingMode === 'user') ? 'scaleX(-1)' : 'scaleX(1)';
        video.onloadedmetadata = () => video.play();

    } catch (err) {
        console.log("Camera Error");
    }
}
initCamera();

document.getElementById('switch-cam-btn').addEventListener('click', () => {
    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
    initCamera();
});

// 2. Capture Logic
document.getElementById('shutter-btn').addEventListener('click', async () => {
    
    // RETAKE MODE: Only take 1 photo to replace specific slot
    if (retakeIndex !== -1) {
        await runCountdown(3);
        flash.classList.add('flash-fire');
        capturedImages[retakeIndex] = snapPhoto(); // Overwrite
        setTimeout(() => flash.classList.remove('flash-fire'), 150);
        finishRetake();
        return;
    }

    // NORMAL MODE: Take full sequence
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
    // Apply Mirroring to the Photo
    tCtx.scale(currentFacingMode === 'user' ? -1 : 1, 1);
    tCtx.drawImage(video, 0, 0);
    return tCanvas;
}

function enterEditor() {
    createComposite();
    // Switch Screen
    document.getElementById('capture-page').classList.remove('active');
    document.getElementById('capture-page').classList.add('hidden');
    document.getElementById('result-page').classList.remove('hidden');
    document.getElementById('result-page').classList.add('active');

    // Reset Controls
    document.querySelector('.layout-scroll').style.opacity = '1';
    document.getElementById('shutter-btn').style.pointerEvents = 'auto';
    document.getElementById('switch-cam-btn').style.opacity = '1';
}

function finishRetake() {
    retakeIndex = -1;
    enterEditor();
}

// 3. Composite Logic & Click Detection
function createComposite() {
    if(capturedImages.length === 0) return;
    photoZones = []; // Reset click zones

    const gap = 20; const padding = 40; const footerH = 120;
    const singleW = capturedImages[0].width;
    const singleH = capturedImages[0].height;
    
    let finalW, finalH;
    const isStrip = (config.layout === 'strip' || config.layout === 'single');

    if (isStrip) {
        finalW = singleW + (padding * 2);
        finalH = (singleH * config.count) + (gap * (config.count - 1)) + (padding * 2) + footerH;
    } else {
        finalW = (singleW * 2) + gap + (padding * 2);
        finalH = (singleH * 2) + gap + (padding * 2) + footerH;
    }

    // iOS Crash Protection: Downscale if too huge
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
        if (isStrip) {
            x = padding;
            y = padding + (i * (singleH + gap));
        } else {
            const col = i % 2;
            const row = Math.floor(i / 2);
            x = padding + (col * (singleW + gap));
            y = padding + (row * (singleH + gap));
        }
        
        // Draw Scaled Photo
        const dX = Math.floor(x * scaleFactor);
        const dY = Math.floor(y * scaleFactor);
        const dW = Math.floor(singleW * scaleFactor);
        const dH = Math.floor(singleH * scaleFactor);

        ctx.drawImage(img, dX, dY, dW, dH);

        // Save Zone for Click Detection
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

// 4. "Tap to Retake" Logic
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Check which photo zone was clicked
    for (let zone of photoZones) {
        if (clickX >= zone.x && clickX <= zone.x + zone.w &&
            clickY >= zone.y && clickY <= zone.y + zone.h) {
            
            if(confirm(`Retake Photo #${zone.index + 1}?`)) {
                triggerRetake(zone.index);
            }
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

// 5. Mobile Save
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
