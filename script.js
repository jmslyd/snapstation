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

// 1. Initialize Camera (4:3 Ratio)
async function initCamera() {
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: currentFacingMode,
                // REQUEST 4:3 ASPECT RATIO
                aspectRatio: { ideal: 1.3333 }, 
                width: { ideal: 1280 } 
            },
            audio: false 
        });
        video.srcObject = stream;
        
        // Mobile Mirror Logic
        if (currentFacingMode === 'user') {
            video.style.transform = 'scaleX(-1)';
        } else {
            video.style.transform = 'scaleX(1)';
        }
        
        // Ensure video plays on iOS
        video.onloadedmetadata = () => {
            video.play();
        };

    } catch (err) {
        alert("Camera access denied.");
    }
}
initCamera();

// 2. Switch Camera
document.getElementById('switch-cam-btn').addEventListener('click', () => {
    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
    initCamera();
});

// 3. Settings
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
        if(b.style.background.includes(color) || (color === '#000000' && b.style.background.includes('0, 0, 0'))) {
            b.classList.add('active');
        }
    });
    createComposite(); 
};

// 4. Shutter
document.getElementById('shutter-btn').addEventListener('click', async () => {
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

    createComposite();
    
    document.getElementById('capture-page').classList.remove('active');
    document.getElementById('capture-page').classList.add('hidden');
    document.getElementById('result-page').classList.remove('hidden');
    document.getElementById('result-page').classList.add('active');

    document.querySelector('.layout-scroll').style.opacity = '1';
    document.getElementById('shutter-btn').style.pointerEvents = 'auto';
    document.getElementById('switch-cam-btn').style.opacity = '1';
});

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

function snapPhoto() {
    const tCanvas = document.createElement('canvas');
    tCanvas.width = video.videoWidth;
    tCanvas.height = video.videoHeight;
    const tCtx = tCanvas.getContext('2d');
    
    // Mirror Logic
    tCtx.translate(tCanvas.width, 0);
    if (currentFacingMode === 'user') {
        tCtx.scale(-1, 1); 
    } else {
        tCtx.scale(1, 1);
    }
    tCtx.drawImage(video, 0, 0);
    return tCanvas;
}

// 5. Composite Logic (With iOS Memory Protection)
function createComposite() {
    if(capturedImages.length === 0) return;

    // Dimensions
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

    // --- CRITICAL iOS FIX: Scale down if too big ---
    // iOS Canvas crashes above ~4096px height or 16MP area
    let scaleFactor = 1;
    const MAX_HEIGHT = 3000; 
    
    if (finalH > MAX_HEIGHT) {
        scaleFactor = MAX_HEIGHT / finalH;
        finalW = Math.floor(finalW * scaleFactor);
        finalH = Math.floor(finalH * scaleFactor);
    }

    canvas.width = finalW;
    canvas.height = finalH;
    
    // Fill Background
    ctx.fillStyle = currentPaper;
    ctx.fillRect(0, 0, finalW, finalH);

    // Draw Photos (Scaled)
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
        
        // Apply scaling
        const drawX = Math.floor(x * scaleFactor);
        const drawY = Math.floor(y * scaleFactor);
        const drawW = Math.floor(singleW * scaleFactor);
        const drawH = Math.floor(singleH * scaleFactor);

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
    });

    // Branding
    ctx.textAlign = 'center';
    const isDarkPaper = (currentPaper === '#000000');
    
    ctx.fillStyle = isDarkPaper ? '#ffffff' : '#111111';
    ctx.font = `900 ${Math.floor(32 * scaleFactor)}px Inter, sans-serif`; 
    ctx.fillText('SNAPSTATION.IO', finalW / 2, finalH - (60 * scaleFactor));

    ctx.fillStyle = isDarkPaper ? '#cccccc' : '#666666';
    ctx.font = `500 ${Math.floor(18 * scaleFactor)}px Inter, sans-serif`;
    const date = new Date().toLocaleDateString(undefined, {  
        weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' 
    });
    ctx.fillText(date.toUpperCase(), finalW / 2, finalH - (25 * scaleFactor));

    // Wait for load before render
    baseState = new Image();
    baseState.onload = () => render();
    baseState.src = canvas.toDataURL();
}

// 6. Render
function render() {
    if (!baseState) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = currentFilter;
    ctx.drawImage(baseState, 0, 0);
}

// 7. Touch Events for Filters
document.querySelectorAll('.filter-btn').forEach(btn => {
    // Handle both Click and Touch to ensure mobile responsiveness
    const handleFilter = (e) => {
        e.preventDefault(); // Stop double firing
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentFilter = e.currentTarget.dataset.filter;
        render();
    };

    btn.addEventListener('click', handleFilter);
    btn.addEventListener('touchstart', handleFilter);
});

// 8. Navigation
document.getElementById('back-btn').addEventListener('click', () => {
    document.getElementById('result-page').classList.remove('active');
    document.getElementById('result-page').classList.add('hidden');
    document.getElementById('capture-page').classList.remove('hidden');
    document.getElementById('capture-page').classList.add('active');
    
    currentFilter = 'none';
    currentPaper = '#ffffff';
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-filter="none"]').classList.add('active');
    document.querySelectorAll('.color-dot').forEach(b => b.classList.remove('active'));
    document.querySelector('.color-dot').classList.add('active'); 
});

document.getElementById('download-btn').addEventListener('click', () => {
    const a = document.createElement('a');
    a.download = `snapstation-${Date.now()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
});
