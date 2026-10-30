# -*- coding: utf-8 -*-
"""生成 AP2 太阳系所需的太阳/地球/月球位图纹理 (512x512 PNG)。"""
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
TEX_DIR = os.path.join(HERE, "textures")
os.makedirs(TEX_DIR, exist_ok=True)

SIZE = 512
rng = np.random.default_rng(42)


def fbm(shape, octaves=5, persistence=0.5, base=128, seed=0):
    """简单分形布朗运动(fBm)：叠加多 octave 的放大噪声，产生平滑自然纹理。"""
    r = np.random.default_rng(seed)
    # 生成低频基础噪声后放大，形成平滑变化
    low = r.random((base, base))
    low = np.array(Image.fromarray((low * 255).astype(np.uint8)).resize(shape, Image.BICUBIC)) / 255.0
    total = low
    amplitude = 1.0
    freq = 2
    norm = 1.0
    for _ in range(octaves - 1):
        h = r.random((base * freq, base * freq))
        h = np.array(Image.fromarray((h * 255).astype(np.uint8)).resize(shape, Image.BICUBIC)) / 255.0
        amplitude *= persistence
        total += h * amplitude
        norm += amplitude
        freq *= 2
    return total / norm


def save(arr, name):
    arr = np.clip(arr, 0.0, 1.0)
    img = Image.fromarray((arr * 255.0).astype(np.uint8))
    img.save(os.path.join(TEX_DIR, name))


# ---------- 太阳：橙黄渐变 + 米粒状斑纹 + 太阳黑子 ----------
def make_sun():
    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    cx, cy = SIZE / 2, SIZE / 2
    r = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / (SIZE / 2)  # 0..1

    n = fbm((SIZE, SIZE), octaves=6, base=64, seed=1)
    # 径向渐变：中心亮黄 -> 边缘橙红
    core = 1.0 - r * 0.35
    base_r = np.clip(1.00 * core, 0, 1)
    base_g = np.clip(0.85 * core - 0.1 * n, 0, 1)
    base_b = np.clip(0.30 * core - 0.2 * n, 0, 1)

    # 太阳黑子：低频暗斑
    spots = np.clip(n - 0.62, 0, 1) * 0.5
    R = np.clip(base_r - spots, 0, 1)
    G = np.clip(base_g - spots, 0, 1)
    B = np.clip(base_b - spots * 0.4, 0, 1)
    # 边缘淡淡压暗（球感）
    edge = np.clip(r - 0.75, 0, 1) * 0.25
    R = np.clip(R - edge, 0, 1)
    G = np.clip(G - edge, 0, 1)
    B = np.clip(B - edge * 0.5, 0, 1)
    save(np.stack([R, G, B], axis=-1), "sun.png")


# ---------- 地球：海洋 + 大陆 + 云 + 极地 ----------
def make_earth():
    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    u = xx / SIZE            # 0..1 经度
    v = yy / SIZE            # 0..1 纬度(下方)
    lat = (1.0 - v) * np.pi - np.pi / 2   # 中心处纬度 0

    n = fbm((SIZE, SIZE), octaves=6, base=96, seed=2)
    # 大陆掩码：经度偏置使大陆分布自然
    land = np.where(n > 0.545, 1.0, 0.0)
    land = np.clip(land + (n - 0.545) * 6.0, 0, 1)

    # 海洋蓝
    ocean_r, ocean_g, ocean_b = 0.08, 0.22, 0.62
    # 大陆：靠赤道偏绿，靠两极偏棕白
    greenness = np.clip(1.0 - np.abs(lat) / 1.1, 0, 1)
    land_r = np.clip(0.10 + 0.28 * (1 - greenness) + 0.10 * n, 0, 1)
    land_g = np.clip(0.32 + 0.35 * greenness + 0.12 * n, 0, 1)
    land_b = np.clip(0.12 + 0.12 * greenness, 0, 1)

    R = ocean_r * (1 - land) + land_r * land
    G = ocean_g * (1 - land) + land_g * land
    B = ocean_b * (1 - land) + land_b * land

    # 极地冰盖
    polar = np.clip((np.abs(lat) - np.radians(68)) / 0.35, 0, 1)
    ice = polar * 0.9
    R = np.clip(R * (1 - ice) + ice, 0, 1)
    G = np.clip(G * (1 - ice) + ice, 0, 1)
    B = np.clip(B * (1 - ice) + ice, 0, 1)

    # 云层（半透明白，偏白）
    clouds = fbm((SIZE, SIZE), octaves=5, base=128, seed=3)
    cld = np.clip((clouds - 0.55) * 3.0, 0, 1) * 0.75
    R = np.clip(R * (1 - cld * 0.5) + cld, 0, 1)
    G = np.clip(G * (1 - cld * 0.5) + cld, 0, 1)
    B = np.clip(B * (1 - cld * 0.5) + cld, 0, 1)

    save(np.stack([R, G, B], axis=-1), "earth.png")


# ---------- 月球：灰基色 + 大量环形山 ----------
def make_moon():
    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    r = np.sqrt((xx - SIZE / 2) ** 2 + (yy - SIZE / 2) ** 2) / (SIZE / 2)

    base = 0.55 + 0.20 * fbm((SIZE, SIZE), octaves=6, base=96, seed=4)
    R = base.copy(); G = base.copy(); B = base.copy()

    # 环形山：暗坑 + 亮缘
    rr = np.random.default_rng(5)
    for _ in range(420):
        cx = rr.uniform(0, SIZE)
        cy = rr.uniform(0, SIZE)
        rad = rr.uniform(2, 16)
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / rad
        floor = np.clip(1.0 - d, 0, 1) ** 2
        rim = np.exp(-((d - 1.0) ** 2) * 6.0) * 0.35
        R -= floor * 0.25; G -= floor * 0.24; B -= floor * 0.24
        R += rim * 0.25; G += rim * 0.24; B += rim * 0.22
        # 中心亮的年轻坑
        inner = np.exp(-(d ** 2) * 8.0) * 0.20
        R += inner; G += inner; B += inner

    # 边缘压暗体现球体
    edge = np.clip(r - 0.82, 0, 1) * 0.5
    R = np.clip(R - edge, 0, 1); G = np.clip(G - edge, 0, 1); B = np.clip(B - edge, 0, 1)

    save(np.stack([R, G, B], axis=-1), "moon.png")


if __name__ == "__main__":
    make_sun()
    make_earth()
    make_moon()
    print("textures generated: sun.png, earth.png, moon.png")
