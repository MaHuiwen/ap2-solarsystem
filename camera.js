// ============================================================
//  camera.js — AP2 相机：透视/正交切换、球坐标视角、关键帧漫游
// ============================================================

export const camera = {
    theta: 0.9,        // 方位角
    phi: 0.55,         // 仰角
    radius: 6.5,       // 到目标距离
    target: [0, 0, 0],
    // 支持 ?ortho 以正交投影启动（用于生成双投影对比截图）
    projection: (typeof location !== 'undefined' && new URLSearchParams(location.search).has('ortho'))
                    ? 'ortho' : 'perspective', // 'perspective' | 'ortho'

    tourActive: true,  // 是否处于漫游模式
    tourPaused: false, // 漫游是否暂停
    tourT: 0,          // 漫游进度 0..1
    dragging: false
};

// 漫游关键帧：t 为进度(0..1)，插值 theta/phi/radius —— “关键帧插值”
const TOUR_KEYS = [
    { t: 0.00, theta: 0.0,       phi: 0.55, radius: 6.5 },
    { t: 0.25, theta: Math.PI/2,  phi: 0.45, radius: 6.0 },
    { t: 0.50, theta: Math.PI,    phi: 0.55, radius: 6.5 },
    { t: 0.75, theta: Math.PI*3/2,phi: 0.42, radius: 7.0 },
    { t: 1.00, theta: 2*Math.PI,  phi: 0.55, radius: 6.5 }
];

function lerp(a, b, s) { return a + (b - a) * s; }

// 关键帧插值：在 TOUR_KEYS 之间按进度线性插值 theta/phi/radius
export function tourStep(dt, speed) {
    if (!camera.tourActive || camera.tourPaused) return;
    camera.tourT = (camera.tourT + dt * speed) % 1.0;
    const t = camera.tourT;
    let i = 0;
    while (i < TOUR_KEYS.length - 2 && TOUR_KEYS[i + 1].t < t) i++;
    const k0 = TOUR_KEYS[i], k1 = TOUR_KEYS[i + 1];
    const s = (t - k0.t) / (k1.t - k0.t);
    camera.theta = lerp(k0.theta, k1.theta, s);
    camera.phi   = lerp(k0.phi,   k1.phi,   s);
    camera.radius = lerp(k0.radius, k1.radius, s);
}

// 球坐标 → 相机位置
function eyeFromSpherical() {
    const ct = Math.cos(camera.theta), st = Math.sin(camera.theta);
    const cp = Math.cos(camera.phi),   sp = Math.sin(camera.phi);
    return [camera.radius * sp * ct, camera.radius * cp, camera.radius * sp * st];
}

export function getViewMatrix() {
    return lookAt(eyeFromSpherical(), camera.target, [0, 1, 0]);
}

export function getProjectionMatrix(aspect) {
    const near = 0.1, far = 60.0;
    if (camera.projection === 'ortho') {
        // 正交投影：固定观察范围（含整个太阳系），平行线永不相交
        const halfH = 3.6, halfW = halfH * aspect;
        return ortho(-halfW, halfW, -halfH, halfH, near, far);
    }
    return perspective(45 * DEG_CAM, aspect, near, far);
}

const DEG_CAM = Math.PI / 180;
