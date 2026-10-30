// ============================================================
//  shaders.js — AP2 太阳系的 GLSL ES 3.00 着色器源码
//  WebGL2 + #version 300 es，与 AP1 同风格
// ============================================================

// 主着色器：纹理 × 简单方向光（环境 + 漫反射）
export const vertexShaderSource = `#version 300 es
precision highp float;
in vec3 aPosition;
in vec2 aTexCoord;
in vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;
out vec2 vTexCoord;
out vec3 vNormal;
out vec3 vWorldPos;
void main(){
    vec4 wp = uModel * vec4(aPosition, 1.0);
    vWorldPos = wp.xyz;
    vNormal = mat3(uModel) * aNormal;
    vTexCoord = aTexCoord;
    gl_Position = uProj * uView * wp;
}
`;

export const fragmentShaderSource = `#version 300 es
precision highp float;
in vec2 vTexCoord;
in vec3 vNormal;
in vec3 vWorldPos;
uniform sampler2D uTexture;
uniform vec3 uLightDir;    // 指向光源（世界坐标方向）
uniform vec3 uLightColor;
uniform vec3 uAmbient;
out vec4 fragColor;
void main(){
    vec3 N = normalize(vNormal);
    vec3 L = normalize(-uLightDir);
    float diff = max(dot(N, L), 0.0);
    vec3 tex = texture(uTexture, vTexCoord).rgb;
    vec3 lit = tex * (uAmbient + uLightColor * diff);
    fragColor = vec4(lit, 1.0);
}
`;

// 轨道线用：纯色线段
export const lineVertexShaderSource = `#version 300 es
precision highp float;
in vec3 aPosition;
uniform mat4 uViewProj;
void main(){
    gl_Position = uViewProj * vec4(aPosition, 1.0);
}
`;

export const lineFragmentShaderSource = `#version 300 es
precision highp float;
uniform vec3 uColor;
out vec4 fragColor;
void main(){
    fragColor = vec4(uColor, 1.0);
}
`;
