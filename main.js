// ============================================================
//  main.js — AP2 太阳系：初始化、纹理加载、渲染循环、鼠标交互
// ============================================================
import { vertexShaderSource, fragmentShaderSource,
         lineVertexShaderSource, lineFragmentShaderSource } from "./shaders.js";
import { DEG, BODIES, makeSphere, buildScene, buildOrbitLines } from "./solar.js";
import { camera, tourStep, getViewMatrix, getProjectionMatrix } from "./camera.js";
import { initUI } from "./ui.js";

const canvas = document.getElementById("glcanvas");
let gl, program, lineProgram;

// 全局动画状态（供面板修改）
export const state = {
    orbitSpeed: 1,
    spinSpeed: 1,
    tiltDeg: BODIES.earth.tilt,
    showOrbits: true
};

// ---- 纹理加载：Promise，全部就绪后开始渲染；失败用纯色兜底 ----
function loadTexture(url, fallbackColor) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // 关键：翻转Y，使图片首行对应v=0
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.generateMipmap(gl.TEXTURE_2D);
            resolve(tex);
        };
        img.onerror = () => {
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                new Uint8Array(fallbackColor));
            resolve(tex);
        };
        img.src = url;
    });
}

window.onload = main;
async function main() {
    gl = canvas.getContext("webgl2");
    if (!gl) { alert("浏览器不支持 WebGL2"); return; }

    program = initShaders(gl, vertexShaderSource, fragmentShaderSource);
    lineProgram = initShaders(gl, lineVertexShaderSource, lineFragmentShaderSource);

    // 主程序 location
    const loc = {
        aPosition: gl.getAttribLocation(program, "aPosition"),
        aTexCoord: gl.getAttribLocation(program, "aTexCoord"),
        aNormal: gl.getAttribLocation(program, "aNormal"),
        uModel: gl.getUniformLocation(program, "uModel"),
        uView: gl.getUniformLocation(program, "uView"),
        uProj: gl.getUniformLocation(program, "uProj"),
        uTexture: gl.getUniformLocation(program, "uTexture"),
        uLightDir: gl.getUniformLocation(program, "uLightDir"),
        uLightColor: gl.getUniformLocation(program, "uLightColor"),
        uAmbient: gl.getUniformLocation(program, "uAmbient")
    };
    // 轨道线 location
    const lineLoc = {
        aPosition: gl.getAttribLocation(lineProgram, "aPosition"),
        uViewProj: gl.getUniformLocation(lineProgram, "uViewProj"),
        uColor: gl.getUniformLocation(lineProgram, "uColor")
    };

    // 球体几何（三个天体共用一份球面数据，靠 model 缩放区分大小）
    const sphere = makeSphere(32, 16);
    const sphereVBO = gl.createBuffer();
    const texVBO = gl.createBuffer();
    const normVBO = gl.createBuffer();

    // 轨道线 VBO
    const orbitLines = buildOrbitLines(96);
    const earthOrbitVBO = gl.createBuffer();
    const moonOrbitVBO = gl.createBuffer();

    // 加载纹理
    const texSun = await loadTexture(BODIES.sun.texture, [255, 150, 30, 255]);
    const texEarth = await loadTexture(BODIES.earth.texture, [40, 90, 200, 255]);
    const texMoon = await loadTexture(BODIES.moon.texture, [150, 150, 150, 255]);

    // 绑定球体数据
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVBO);
    gl.bufferData(gl.ARRAY_BUFFER, sphere.positions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, texVBO);
    gl.bufferData(gl.ARRAY_BUFFER, sphere.texcoords, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, normVBO);
    gl.bufferData(gl.ARRAY_BUFFER, sphere.normals, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, earthOrbitVBO);
    gl.bufferData(gl.ARRAY_BUFFER, orbitLines.earth, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, moonOrbitVBO);
    gl.bufferData(gl.ARRAY_BUFFER, orbitLines.moon, gl.STATIC_DRAW);

    gl.enable(gl.DEPTH_TEST);

    // 鼠标交互：拖拽接管视角、滚轮缩放（漫游与手动可互相接管）
    let lastX = 0, lastY = 0;
    canvas.onmousedown = (e) => {
        camera.dragging = true;
        // 拖拽即退出漫游，进入手动视角
        camera.tourActive = false;
        lastX = e.clientX; lastY = e.clientY;
        if (ui) ui.refreshTour();
    };
    canvas.onmousemove = (e) => {
        if (!camera.dragging) return;
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        camera.theta -= dx * 0.008;
        camera.phi = Math.max(0.05, Math.min(Math.PI - 0.05, camera.phi + dy * 0.008));
        lastX = e.clientX; lastY = e.clientY;
    };
    window.addEventListener('mouseup', () => { camera.dragging = false; });
    canvas.onwheel = (e) => {
        e.preventDefault();
        camera.radius *= (e.deltaY > 0 ? 1.06 : 1 / 1.06);
        camera.radius = Math.max(3, Math.min(18, camera.radius));
    };

    const ui = initUI(state, camera);
    // 注意：initUI 绑定 keyboard 与面板；鼠标在 canvas 上

    // ---- 渲染循环 ----
    let lastTime = performance.now();
    function render(now) {
        const dt = (now - lastTime) / 1000; lastTime = now;
        tourStep(dt, 0.08);                    // 关键帧漫游推进
        state.time = (state.time || 0) + dt;

        gl.clearColor(0.01, 0.01, 0.03, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const aspect = canvas.width / canvas.height;
        const view = getViewMatrix();
        const proj = getProjectionMatrix(aspect);
        const viewProj = mult(proj, view);

        // ---- 绘制三个天体 ----
        const bodies = buildScene(state.time, state);
        gl.useProgram(program);
        gl.uniformMatrix4fv(loc.uView, false, flatten(view));
        gl.uniformMatrix4fv(loc.uProj, false, flatten(proj));
        gl.uniform3fv(loc.uLightDir, [-0.4, 0.6, 0.7]);
        gl.uniform3fv(loc.uLightColor, [1, 1, 1]);

        // 依次绘制太阳、地球、月球（每个绑定对应纹理与 model）
        const textures = [texSun, texEarth, texMoon];
        bodies.forEach((b, i) => {
            // 太阳近似自发光（高环境光），地球/月球正常受光照
            gl.uniform3fv(loc.uAmbient, i === 0 ? [0.95, 0.9, 0.65] : [0.18, 0.18, 0.2]);
            gl.uniformMatrix4fv(loc.uModel, false, flatten(b.model));
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, textures[i]);
            gl.uniform1i(loc.uTexture, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, sphereVBO);
            gl.enableVertexAttribArray(loc.aPosition);
            gl.vertexAttribPointer(loc.aPosition, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, texVBO);
            gl.enableVertexAttribArray(loc.aTexCoord);
            gl.vertexAttribPointer(loc.aTexCoord, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, normVBO);
            gl.enableVertexAttribArray(loc.aNormal);
            gl.vertexAttribPointer(loc.aNormal, 3, gl.FLOAT, false, 0, 0);

            gl.drawArrays(gl.TRIANGLES, 0, sphere.count);
        });

        // ---- 轨道线 ----
        if (state.showOrbits) {
            gl.useProgram(lineProgram);
            gl.uniformMatrix4fv(lineLoc.uViewProj, false, flatten(viewProj));
            gl.enableVertexAttribArray(lineLoc.aPosition);
            // 地球轨道
            gl.bindBuffer(gl.ARRAY_BUFFER, earthOrbitVBO);
            gl.vertexAttribPointer(lineLoc.aPosition, 3, gl.FLOAT, false, 0, 0);
            gl.uniform3fv(lineLoc.uColor, [0.35, 0.4, 0.6]);
            gl.drawArrays(gl.LINE_LOOP, 0, 96);
            // 月球轨道（绕地球，需随地球位置移动）
            const earthOrbit0 = buildScene(state.time, state)[1].model; // 地球模型（轨道位置）
            gl.bindBuffer(gl.ARRAY_BUFFER, moonOrbitVBO);
            gl.vertexAttribPointer(lineLoc.aPosition, 3, gl.FLOAT, false, 0, 0);
            // 月球轨道点乘地球轨道矩阵
            gl.uniformMatrix4fv(lineLoc.uViewProj, false, flatten(mult(viewProj, earthOrbit0)));
            gl.uniform3fv(lineLoc.uColor, [0.5, 0.5, 0.55]);
            gl.drawArrays(gl.LINE_LOOP, 0, 96);
        }

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}
