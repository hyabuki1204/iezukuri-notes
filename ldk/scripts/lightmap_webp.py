# ライトマップ PNG を可逆 WebP に変換する (画素は PNG と完全に同じ。サイズは約半分)。
# Blender からライトマップを焼き直したら実行する:
#   python3 ldk/scripts/lightmap_webp.py ldk/public/lightmaps/ldk_2500.png ...
# 変換後は PNG を消す (読み込むのは data.ts の lightmapUrl が指す .webp)
import io
import os
import sys

import numpy as np
from PIL import Image

for src in sys.argv[1:]:
    im = Image.open(src)
    im.load()
    buf = io.BytesIO()
    im.save(buf, "WEBP", lossless=True, quality=100, method=6, exact=True)
    back = Image.open(io.BytesIO(buf.getvalue())).convert(im.mode)
    if not (np.asarray(back) == np.asarray(im)).all():
        sys.exit(f"{src}: 可逆変換で画素が一致しない")
    dst = os.path.splitext(src)[0] + ".webp"
    open(dst, "wb").write(buf.getvalue())
    os.remove(src)
    print(f"{src}: {os.path.getsize(dst) / 1e6:.2f}MB ({dst})")
