"""生成线上发布用的网站副本到 docs/（GitHub Pages 从这里发布）。

用法：python tools/build_site.py

和源代码的区别只有一处：所有本地资源地址都加上按内容算的版本号（如 js/game.js?v=1a2b3c4d），
文件内容一变地址就变，玩家手机不会继续用旧缓存，也不会出现新旧文件混搭。
"""
import hashlib
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs"
COPY_DIRS = ["images", "vendor", "fonts"]
JS_IMPORT_RE = re.compile(r"(from\s+'\./)([\w-]+\.js)(')")


def short_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:8]


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "js").mkdir(parents=True)
    (OUT / "css").mkdir()
    for d in COPY_DIRS:
        shutil.copytree(ROOT / d, OUT / d)

    # JS 之间互相引用：先按“自身内容 + 依赖的版本号”算版本号，依赖变了引用方也会变
    sources = {p.name: p.read_text(encoding="utf-8") for p in sorted((ROOT / "js").glob("*.js"))}
    # 照片在 config.js 里按相对路径加载：先给照片地址加版本号，config.js 自己的版本号才会随照片变化
    sources["config.js"] = re.sub(
        r"'(images/[\w.-]+\.webp)'",
        lambda m: f"'{m.group(1)}?v={short_hash((ROOT / m.group(1)).read_bytes())}'",
        sources["config.js"])
    versions = {}

    def version_of(name, stack=()):
        if name in versions:
            return versions[name]
        if name in stack:
            sys.exit(f"循环依赖：{' -> '.join(stack + (name,))}")
        src = sources[name]
        deps = [m.group(2) for m in JS_IMPORT_RE.finditer(src)]
        dep_versions = "".join(version_of(d, stack + (name,)) for d in deps)
        versions[name] = short_hash((src + dep_versions).encode())
        return versions[name]

    for name, src in sources.items():
        stamped = JS_IMPORT_RE.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={version_of(m.group(2))}{m.group(3)}", src)
        (OUT / "js" / name).write_text(stamped, encoding="utf-8")

    css = (ROOT / "css" / "style.css").read_text(encoding="utf-8")
    font_v = short_hash((ROOT / "fonts" / "zcool-sub.woff2").read_bytes())
    css = css.replace('url("../fonts/zcool-sub.woff2")', f'url("../fonts/zcool-sub.woff2?v={font_v}")')
    (OUT / "css" / "style.css").write_text(css, encoding="utf-8")

    html = (ROOT / "index.html").read_text(encoding="utf-8")
    for tag, path in [('href="css/style.css"', OUT / "css" / "style.css"),
                      ('src="vendor/matter.min.js"', ROOT / "vendor" / "matter.min.js")]:
        if html.count(tag) != 1:
            sys.exit(f"index.html 里找不到：{tag}")
        attr, url = tag.split("=", 1)
        html = html.replace(tag, f'{attr}={url[:-1]}?v={short_hash(path.read_bytes())}"')
    main_tag = 'src="js/main.js"'
    if html.count(main_tag) != 1:
        sys.exit("index.html 里找不到 js/main.js")
    html = html.replace(main_tag, f'src="js/main.js?v={version_of("main.js")}"')
    (OUT / "index.html").write_text(html, encoding="utf-8")
    (OUT / ".nojekyll").write_text("", encoding="utf-8")  # 让 Pages 原样发布，不做 Jekyll 处理

    print(f"已生成 docs/（{len(sources)} 个模块，入口 main.js?v={version_of('main.js')}）")


if __name__ == "__main__":
    main()
