# Radiance HDR (RGBE) を縦横 1/2 に縮小する（2x2 平均）。出力は RLE なしの RGBE
# 使い方: python3 ldk/scripts/hdr_half.py ldk/public/lightmaps/probe_2500.hdr ldk/public/lightmaps/probe_2500_512.hdr
import sys
import numpy as np

def read_hdr(path):
    data = open(path, 'rb').read()
    pos = 0
    while True:
        end = data.index(b'\n', pos)
        line = data[pos:end]
        pos = end + 1
        if line.startswith(b'-Y'):
            _, h, _, w = line.split()
            h, w = int(h), int(w)
            break
    img = np.zeros((h, w, 4), np.uint8)
    for y in range(h):
        if data[pos] == 2 and data[pos + 1] == 2:
            pos += 4
            for c in range(4):
                x = 0
                while x < w:
                    n = data[pos]; pos += 1
                    if n > 128:
                        n -= 128
                        img[y, x:x + n, c] = data[pos]; pos += 1
                    else:
                        img[y, x:x + n, c] = np.frombuffer(data, np.uint8, n, pos); pos += n
                    x += n
        else:
            img[y] = np.frombuffer(data, np.uint8, w * 4, pos).reshape(w, 4); pos += w * 4
    e = img[..., 3].astype(np.int32)
    f = np.where(e > 0, np.ldexp(1.0, e - 136), 0.0)
    return img[..., :3].astype(np.float64) * f[..., None]

def write_hdr(path, rgb):
    h, w, _ = rgb.shape
    m = rgb.max(axis=2)
    mant, ex = np.frexp(m)
    scale = np.where(m > 1e-32, mant * 256.0 / np.where(m > 0, m, 1), 0)
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = np.clip(rgb * scale[..., None], 0, 255).astype(np.uint8)
    out[..., 3] = np.where(m > 1e-32, ex + 128, 0).astype(np.uint8)
    with open(path, 'wb') as f:
        f.write(b'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n')
        f.write(f'-Y {h} +X {w}\n'.encode())
        f.write(out.tobytes())

src, dst = sys.argv[1:3]
rgb = read_hdr(src)
h, w, _ = rgb.shape
half = rgb.reshape(h // 2, 2, w // 2, 2, 3).mean(axis=(1, 3))
write_hdr(dst, half)
print(src, rgb.shape, '->', half.shape, 'mean', rgb.mean().round(4), half.mean().round(4))
