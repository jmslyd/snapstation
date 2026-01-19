const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const flash = document.getElementById('flash-overlay');
const countdownEl = document.getElementById('countdown');

// State Variables
let config = { count: 4, layout: 'grid' }; 
let capturedImages = [];
let currentFilter = 'none';
let currentPaper = '#ffffff'; 
let baseState = null;
let currentFacingMode = 'user'; // Front Camera default
let retakeIndex = -1;
let photoZones = []; 
let currentTargetRatio = 1.333; // Default 4:3
let swapSelectedIndex = -1; 

// Set initial CSS variable for ratio
document.documentElement.style.setProperty('--target-ratio', currentTargetRatio);

// 1. Initialize Camera (Robust)
async function initCamera() {
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: currentFacingMode,
                aspectRatio: { ideal: currentTargetRatio },
                width: { ideal: 1280 }
            },
            audio: false 
        });
        handleStreamSuccess(stream);

    } catch (err) {
        try {
            const basicStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: currentFacingMode },
                audio: false 
            });
            handleStreamSuccess(basicStream);
        } catch (e) {
            alert("Camera Error: Please allow camera access.");
        }
    }
}

function handleStreamSuccess(stream) {
    video.srcObject = stream;
    video.style.transform = (currentFacingMode === 'user') ? 'scaleX(-1)' : 'scaleX(1)';
    video.onloadedmetadata = () => video.play().catch(e => console.log(e));
}

initCamera();

// Ratio Switcher
window.setRatio = (ratio) => {
    currentTargetRatio = ratio;
    
    // Update UI
    document.querySelectorAll('.ratio-chip').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    // Update CSS Variable for Video Mask
    document.documentElement.style.setProperty('--target-ratio', ratio);

    // Restart camera
    initCamera();
};

document.getElementById('switch-cam-btn').addEventListener('click', () => {
    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
    initCamera();
});

// 2. Capture Logic
document.getElementById('shutter-btn').addEventListener('click', async () => {
    if (retakeIndex !== -1) {
        await runCountdown(3);
        flash.classList.add('flash-fire');
        capturedImages[retakeIndex] = snapPhoto(); 
        setTimeout(() => flash.classList.remove('flash-fire'), 150);
        finishRetake();
        return;
    }

    capturedImages = [];
    document.querySelectorAll('.layout-scroll').forEach(el => el.style.opacity = '0'); 
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

// --- SMART SNAP (Software Crop) ---
function snapPhoto() {
    const tCanvas = document.createElement('canvas');
    
    const vidW = video.videoWidth;
    const vidH = video.videoHeight;
    const camRatio = vidW / vidH;

    let targetW, targetH;
    let sX = 0, sY = 0;

    if (camRatio > currentTargetRatio) {
        targetH = vidH;
        targetW = vidH * currentTargetRatio;
        sX = (vidW - targetW) / 2;
    } else {
        targetW = vidW;
        targetH = vidW / currentTargetRatio;
        sY = (vidH - targetH) / 2;
    }

    tCanvas.width = targetW;
    tCanvas.height = targetH;
    
    const tCtx = tCanvas.getContext('2d');
    
    if (currentFacingMode === 'user') {
        tCtx.translate(targetW, 0);
        tCtx.scale(-1, 1);
    } 
    
    tCtx.drawImage(video, sX, sY, targetW, targetH, 0, 0, targetW, targetH);
    return tCanvas;
}

function enterEditor() {
    createComposite();
    document.getElementById('capture-page').classList.remove('active');
    document.getElementById('capture-page').classList.add('hidden');
    document.getElementById('result-page').classList.remove('hidden');
    document.getElementById('result-page').classList.add('active');

    document.querySelectorAll('.layout-scroll').forEach(el => el.style.opacity = '1');
    document.getElementById('shutter-btn').style.pointerEvents = 'auto';
    document.getElementById('switch-cam-btn').style.opacity = '1';
}

function finishRetake() {
    retakeIndex = -1;
    enterEditor();
}

// 3. Composite Logic
function createComposite() {
    if(capturedImages.length === 0) return;
    photoZones = []; 

    const gap = 20; const padding = 40; const footerH = 120;
    const singleW = capturedImages[0].width;
    const singleH = capturedImages[0].height;
    
    let finalW, finalH;

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
        
        const dX = Math.floor(x * scaleFactor);
        const dY = Math.floor(y * scaleFactor);
        const dW = Math.floor(singleW * scaleFactor);
        const dH = Math.floor(singleH * scaleFactor);

        ctx.drawImage(img, dX, dY, dW, dH);

        if (i === swapSelectedIndex) {
            ctx.strokeStyle = '#3b82f6'; 
            ctx.lineWidth = 10 * scaleFactor;
            ctx.strokeRect(dX, dY, dW, dH);
        }

        photoZones.push({ index: i, x: dX, y: dY, w: dW, h: dH });
    });

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

// 4. Tap Handler
const handleInteraction = (e) => {
    e.preventDefault(); 
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (clientX - rect.left) * scaleX;
    const clickY = (clientY - rect.top) * scaleY;

    for (let zone of photoZones) {
        if (clickX >= zone.x && clickX <= zone.x + zone.w &&
            clickY >= zone.y && clickY <= zone.y + zone.h) {
            handlePhotoTap(zone.index);
            break;
        }
    }
};

function handlePhotoTap(clickedIndex) {
    if (swapSelectedIndex === -1) {
        swapSelectedIndex = clickedIndex;
        createComposite();
        showToast("Tap another to swap, or tap again to retake.");
    } 
    else if (swapSelectedIndex === clickedIndex) {
        swapSelectedIndex = -1;
        createComposite(); 
        if(confirm(`Retake Photo #${clickedIndex + 1}?`)) {
            triggerRetake(clickedIndex);
        }
    } 
    else {
        const temp = capturedImages[swapSelectedIndex];
        capturedImages[swapSelectedIndex] = capturedImages[clickedIndex];
        capturedImages[clickedIndex] = temp;
        
        swapSelectedIndex = -1;
        createComposite();
        showToast("Swapped!");
    }
}

function showToast(msg) {
    const hint = document.getElementById('hint-bubble');
    hint.innerText = msg;
    hint.style.background = "var(--primary)";
    hint.style.opacity = "1";
    setTimeout(() => {
        hint.style.background = "rgba(0,0,0,0.6)";
        hint.innerText = "Tap photo to Select. Tap again to Retake.";
    }, 2500);
}

canvas.addEventListener('click', handleInteraction);
canvas.addEventListener('touchstart', handleInteraction, {passive: false});

function triggerRetake(idx) {
    retakeIndex = idx;
    document.getElementById('result-page').classList.remove('active');
    document.getElementById('result-page').classList.add('hidden');
    document.getElementById('capture-page').classList.remove('hidden');
    document.getElementById('capture-page').classList.add('active');
}

// 5. SMART SAVE: Detect Mobile vs Laptop
async function shareCanvas() {
    swapSelectedIndex = -1; // Remove blue border
    createComposite(); 
    
    setTimeout(() => {
        canvas.toBlob(async (blob) => {
            const file = new File([blob], "snapstation.png", { type: "image/png" });

            // DETECT MOBILE DEVICE
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            // IF MOBILE -> Use Share Sheet
            if (isMobile && navigator.share && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: 'SnapStation Photo',
                        text: 'My Photo Strip'
                    });
                } catch (err) {
                    console.log("Share cancelled or failed");
                }
            } 
            // IF LAPTOP/PC -> Force Direct Download
            else {
                const link = document.createElement('a');
                link.download = `snapstation-${Date.now()}.png`;
                link.href = URL.createObjectURL(blob);
                link.click();
            }
        }, 'image/png');
    }, 50);
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
