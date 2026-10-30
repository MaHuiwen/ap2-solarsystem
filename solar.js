// ============================================================
//  solar.js — AP2 太阳系：天体参数、球体几何、层级建模、手造矩阵
//  ============================================================

export const DEG = Math.PI / 180;

// ---------- 天体参数集中配置（便于调整，评分点）----------
export const BODIES = {
    sun: {
        radius: 1.2,
        spinPeriod: 12,          // 自转一周所需“逻辑时间”
        texture: "textures/sun.png"
    },
    earth: {
        radius: 0.45,
        orbitRadius: 3.0,        // 公转轨道半径
        orbitPeriod: 8,          // 公转一周逻辑时间
        spinPeriod: 3,           // 自转一周逻辑时间
        tilt: 23.5,              // 自转轴倾角（度）
        texture: "textures/earth.png"
    },
    moon: {
        radius: 0.16,
        orbitRadius: 0.75,       // 月球到地球的轨道半径
        orbitPeriod: 2.2,        // 月球公转一周逻辑时间
        planeInclination: 5.0,   // 月球轨道面相对黄道面倾角（度）——手造矩阵使用
        texture: "textures/moon.png"
    }
};

// ---------- 球体几何（slices×stacks，不索引，drawArrays TRIANGLES）----------
// texcoord: u 沿经度(0..1)，v 从北极(0)到南极(1)。配合 UNPACK_FLIP_Y_WEBGL=true 得到正立纹理。
export function makeSphere(slices, stacks) {
    const positions = [], texcoords = [], normals = [];
    const pushV = (phi, theta) => {
        const sp = Math.sin(phi), cp = Math.cos(phi);
        const st = Math.sin(theta), ct = Math.cos(theta);
        positions.push(sp * ct, cp, sp * st);   // x,y,z
        normals.push(sp * ct, cp, sp * st);     // 球面法线 = 归一化顶点
        texcoords.push(theta / (2 * Math.PI), phi / Math.PI);
    };
    for (let i = 0; i < stacks; i++) {
        const phi0 = i / stacks * Math.PI;
        const phi1 = (i + 1) / stacks * Math.PI;
        for (let j = 0; j < slices; j++) {
            const th0 = j / slices * 2 * Math.PI;
            const th1 = (j + 1) / slices * 2 * Math.PI;
            // 两个三角形组成一个四边形面片
            pushV(phi0, th0); pushV(phi1, th0); pushV(phi0, th1);
            pushV(phi1, th0); pushV(phi1, th1); pushV(phi0, th1);
        }
    }
    return {
        positions: new Float32Array(positions),
        texcoords: new Float32Array(texcoords),
        normals: new Float32Array(normals),
        count: positions.length / 3
    };
}

// ---------- 层级建模：太阳–地球–月球 三级变换嵌套 ----------
// 传入当前“逻辑时间” t 与面板状态 state（公转/自转倍率、倾角度数）
// 返回一个由 main.js 绘制用的结构数组，便于统一上传矩阵。

export function buildScene(t, state) {
    const B = BODIES;
    const orbitAng = t / B.earth.orbitPeriod * 2 * Math.PI * state.orbitSpeed; // 地球公转角
    const spinAng  = t / B.earth.spinPeriod * 2 * Math.PI * state.spinSpeed;    // 地球自转角
    const moonOrbitAng = t / B.moon.orbitPeriod * 2 * Math.PI * state.orbitSpeed; // 月球公转角
    const sunSpin  = t / B.sun.spinPeriod * 2 * Math.PI * state.spinSpeed;
    const tiltRad  = state.tiltDeg * DEG;

    // ---- 太阳：原点上，仅自转 + 缩放 ----
    const sunModel = mult(rotateY(sunSpin), scalem(B.sun.radius, B.sun.radius, B.sun.radius));

    // ---- 地球：先自转+倾角+缩放(自身模型)，再叠加公转轨道变换（“先转后挂”）----
    // earthSelf = R_z(倾角) · R_y(自转) · S(半径)   —— 倾角施加在地球自身模型上
    const earthSelf = mult(rotateZ(tiltRad), mult(rotateY(spinAng), scalem(B.earth.radius, B.earth.radius, B.earth.radius)));
    // 公转轨道变换：R_y(公转角) · T(轨道半径,0,0)，轨道在 XZ 平面
    const earthOrbit = mult(rotateY(orbitAng), translate(B.earth.orbitRadius, 0, 0));
    const earthModel = mult(earthOrbit, earthSelf);   // 先地球自身旋转，再被公转搬运

    // ---- 月球：绕地球转（含手造矩阵的轨道面倾角）----
    const moonLocal = buildMoonOrbitMatrix(moonOrbitAng, B.moon.planeInclination * DEG, B.moon.orbitRadius);
    const moonSpinM = mult(rotateY(moonOrbitAng), scalem(B.moon.radius, B.moon.radius, B.moon.radius)); // 潮汐锁定：自转=公转
    const moonModel = mult(earthOrbit, mult(moonLocal, moonSpinM));

    return [
        { model: sunModel,   radius: B.sun.radius,   texture: B.sun.texture },
        { model: earthModel, radius: B.earth.radius, texture: B.earth.texture },
        { model: moonModel,  radius: B.moon.radius,  texture: B.moon.texture }
    ];
}

// ---------- 手动矩阵：月球轨道面倾角 ----------
// 要求：不用工具库封装好的“复合函数”，只用 MV.js 基本变换(rotate/translate)手工 mult 组合。
// 构造逻辑（列主序，顶点被最左侧矩阵最后作用）：
//   flat = R_y(angle) · T(r,0,0)      → 在水平(XZ)轨道平面上公转
//   orbit = R_x(inclination) · flat   → 把整个公转轨道面绕 X 轴倾斜 inclination 角度
// 于是月球在相对黄道面倾斜的轨道面上公转；改变 incl 即改变轨道面倾角。
export function buildMoonOrbitMatrix(angle, inclination, radius) {
    const flat = mult(rotateY(angle), translate(radius, 0, 0));
    return mult(rotateX(inclination), flat);
}

// ---------- 轨道线（用于开关显示）----------
// 地球公转轨道：XZ 平面上的圆；月球公转轨道：绕地球、含手造矩阵倾角。
export function buildOrbitLines(step = 96) {
    const B = BODIES;
    const earthPts = [];
    for (let i = 0; i < step; i++) {
        const a = i / step * 2 * Math.PI;
        earthPts.push(Math.cos(a) * B.earth.orbitRadius, 0, -Math.sin(a) * B.earth.orbitRadius);
    }
    const moonPts = [];
    const incl = B.moon.planeInclination * DEG;
    for (let i = 0; i < step; i++) {
        const a = i / step * 2 * Math.PI;
        // 用与 buildMoonOrbitMatrix 相同的构造，取单点位置（不含地球公转）
        const p = buildMoonOrbitMatrix(a, incl, B.moon.orbitRadius); // 矩阵
        // 该矩阵作用在原点 => 第 12/13/14 列为平移后的轨道点
        moonPts.push(p[12], p[13], p[14]);
    }
    return { earth: new Float32Array(earthPts), moon: new Float32Array(moonPts) };
}
