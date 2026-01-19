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

// 1. Initialize Camera (Flexible)
async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: "user",
                width: { ideal: 1280 }, 
                height: { ideal: 720 } 
            },
            audio: false 
        });
        video.srcObject = stream;
    } catch (err) {
        alert("Camera access required.");
    }
}
initCamera();

// 2. Settings
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

// 3. Shutter Sequence
document.getElementById('shutter-btn').addEventListener('click', async () => {
    capturedImages = [];
    document.querySelector('.layout-scroll').style.opacity = '0';
    document.getElementById('shutter-btn').style.pointerEvents = 'none';
    
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
    tCtx.translate(tCanvas.width, 0);
    tCtx.scale(-1, 1);
    tCtx.drawImage(video, 0, 0);
    return tCanvas;
}

// 4. Composite
function createComposite() {
    const gap = 20; const padding = 40; const footerH = 120;
    if(capturedImages.length === 0) return;

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
        ctx.drawImage(img, x, y);
    });

    ctx.textAlign = 'center';
    const isDarkPaper = (currentPaper === '#000000');
    
    ctx.fillStyle = isDarkPaper ? '#ffffff' : '#111111';
    ctx.font = '900 32px Inter, sans-serif'; 
    ctx.fillText('SNAPSTATION.IO', finalW / 2, finalH - 60);

    ctx.fillStyle = isDarkPaper ? '#cccccc' : '#666666';
    ctx.font = '500 18px Inter, sans-serif';
    const date = new Date().toLocaleDateString(undefined, {  
        weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' 
    });
    ctx.fillText(date.toUpperCase(), finalW / 2, finalH - 25);

    baseState = new Image();
    baseState.onload = () => render();
    baseState.src = canvas.toDataURL();
}

// 5. Render
function render() {
    if (!baseState) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = currentFilter;
    ctx.drawImage(baseState, 0, 0);
}

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.dataset.filter;
        render();
    });
});

// 6. Navigation
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