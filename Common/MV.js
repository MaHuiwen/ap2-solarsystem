//
//  MV.js  —  教材配套矩阵/向量工具库（3D，列主序）
//  来源：Angel & Shreiner, Interactive Computer Graphics 8th ed. 配套 Common/MV.js
//  约定：矩阵为 16 元素 Float32Array，列主序存储；用于 WebGL 的 uniformMatrix4fv
//

function vec2(x, y) {
    if (Array.isArray(x)) return new Float32Array(x);
    return new Float32Array([x, y]);
}

function vec3(x, y, z) {
    if (Array.isArray(x)) return new Float32Array(x);
    return new Float32Array([x, y, z]);
}

function vec4(x, y, z, w) {
    if (Array.isArray(x)) return new Float32Array(x);
    return new Float32Array([x, y, z, w]);
}

function mat3() {
    if (arguments.length === 0) return new Float32Array([1,0,0, 0,1,0, 0,0,1]);
    return new Float32Array(arguments);
}

function mat4() {
    if (arguments.length === 0) return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    return new Float32Array(arguments);
}

function flatten(a) {
    return new Float32Array(a);
}

// ---- 向量运算辅助 ----
function add(u, v) {
    return vec3(u[0]+v[0], u[1]+v[1], u[2]+v[2]);
}
function subtract(u, v) {
    return vec3(u[0]-v[0], u[1]-v[1], u[2]-v[2]);
}
function dot(u, v) {
    return u[0]*v[0] + u[1]*v[1] + u[2]*v[2];
}
function cross(u, v) {
    return vec3(u[1]*v[2]-u[2]*v[1],
                u[2]*v[0]-u[0]*v[2],
                u[0]*v[1]-u[1]*v[0]);
}
function normalize(u) {
    var len = Math.sqrt(u[0]*u[0]+u[1]*u[1]+u[2]*u[2]);
    if (len === 0) return vec3(0,0,0);
    return vec3(u[0]/len, u[1]/len, u[2]/len);
}

// ---- 矩阵乘法（列主序 4x4 × 4x4，或 4x4 × vec4） ----
function mult(a, b) {
    if (typeof a === 'number') {           // 标量乘
        var res = new Float32Array(b.length);
        for (var i = 0; i < b.length; i++) res[i] = a * b[i];
        return res;
    }
    if (a.length === 16 && b.length === 16) {   // 4x4 × 4x4
        var out = new Float32Array(16);
        for (var j = 0; j < 4; j++) {
            for (var i = 0; i < 4; i++) {
                var s = 0.0;
                for (var k = 0; k < 4; k++) s += a[i + 4*k] * b[k + 4*j];
                out[i + 4*j] = s;
            }
        }
        return out;
    }
    if (a.length === 16 && b.length === 4) {    // 4x4 × vec4
        return vec4(
            a[0]*b[0]+a[4]*b[1]+a[8]*b[2]+a[12]*b[3],
            a[1]*b[0]+a[5]*b[1]+a[9]*b[2]+a[13]*b[3],
            a[2]*b[0]+a[6]*b[1]+a[10]*b[2]+a[14]*b[3],
            a[3]*b[0]+a[7]*b[1]+a[11]*b[2]+a[15]*b[3]);
    }
    return b;
}

// ---- 3D 基本变换 ----
function translate(x, y, z) {
    if (Array.isArray(x)) { z = x[2]; y = x[1]; x = x[0]; }
    return mat4(1,0,0,0,  0,1,0,0,  0,0,1,0,  x,y,z,1);
}

function scalem(x, y, z) {
    if (Array.isArray(x)) { z = x[2]; y = x[1]; x = x[0]; }
    return mat4(x,0,0,0,  0,y,0,0,  0,0,z,0,  0,0,0,1);
}

function rotateX(theta) {
    var s = Math.sin(theta), c = Math.cos(theta);
    return mat4(1,0,0,0,  0,c,s,0,  0,-s,c,0,  0,0,0,1);
}

function rotateY(theta) {
    var s = Math.sin(theta), c = Math.cos(theta);
    return mat4(c,0,-s,0,  0,1,0,0,  s,0,c,0,  0,0,0,1);
}

function rotateZ(theta) {
    var s = Math.sin(theta), c = Math.cos(theta);
    return mat4(c,s,0,0,  -s,c,0,0,  0,0,1,0,  0,0,0,1);
}

// 绕任意轴旋转（Rodrigues 公式），axis 为 [x,y,z]
function rotate(angle, axis) {
    var a = normalize(vec3(axis[0], axis[1], axis[2]));
    var x = a[0], y = a[1], z = a[2];
    var s = Math.sin(angle), c = Math.cos(angle), t = 1 - c;
    return mat4(
        t*x*x + c,    t*x*y + s*z,  t*x*z - s*y,  0,
        t*x*y - s*z,  t*y*y + c,    t*y*z + s*x,  0,
        t*x*z + s*y,  t*y*z - s*x,  t*z*z + c,    0,
        0, 0, 0, 1);
}

// ---- 投影 ----
function perspective(fovy, aspect, near, far) {
    var f = 1.0 / Math.tan(fovy / 2.0);
    var nf = 1.0 / (near - far);
    return mat4(
        f/aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far+near)*nf, -1,
        0, 0, (2*far*near)*nf, 0);
}

function ortho(left, right, bottom, top, near, far) {
    var rl = right - left, tb = top - bottom, fn = far - near;
    return mat4(
        2/rl, 0, 0, 0,
        0, 2/tb, 0, 0,
        0, 0, -2/fn, 0,
        -(right+left)/rl, -(top+bottom)/tb, -(far+near)/fn, 1);
}

// ---- 观察 ----
// 标准 OpenGL view 矩阵（列主序）：
//   f = normalize(at-eye)       前向
//   s = normalize(cross(f,up))  右
//   u = cross(s,f)              上
//   col0=s col1=u col2=-f       相机看向 -z，故第三列取 -f
//   col3=(-s·eye, -u·eye, f·eye, 1)
function lookAt(eye, at, up) {
    var f = normalize(subtract(at, eye));
    var s = normalize(cross(f, up));
    var u = cross(s, f);
    return mat4(
        s[0], u[0], -f[0], 0,
        s[1], u[1], -f[1], 0,
        s[2], u[2], -f[2], 0,
        -dot(s, eye), -dot(u, eye), dot(f, eye), 1);
}
