"""把多文件项目打包成一个完全离线的 html（发微信、断网都能玩）。

用法：python tools/bundle.py
输出：dist/合成大张楷.html

做的事：
  1. css/style.css 内联，字体换成 base64
  2. vendor/matter.min.js 内联
  3. js/ 下的模块按依赖顺序拼接：去掉 import 行和 export 关键字，整体包进一个函数作用域
  4. config.js 里的 images/*.webp 路径换成 base64
"""
import base64
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dist" / "合成大张楷.html"
IMPORT_RE = re.compile(r"^import\s+\{([^}]*)\}\s+from\s+'\./([\w-]+)\.js';\s*$", re.M)


VAR_LINE_RE = re.compile(r"^(?:export\s+)?(?:const|let)\s+(.+)$", re.M)
NAME_EQ_RE = re.compile(r"(?:^|,)\s*([A-Za-z_$][\w$]*)\s*=")


def top_level_names(src):
    """顶层声明的名字：函数、普通变量、一行多个变量、解构（const { a, b: c } = …）。"""
    names = re.findall(r"^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)", src, re.M)
    for rest in VAR_LINE_RE.findall(src):
        if rest.startswith("{"):
            inner = rest[1:rest.index("}")]
            names += [part.split(":")[-1].strip() for part in inner.split(",") if part.strip()]
        else:
            names += NAME_EQ_RE.findall(rest)
    return names


def data_uri(path, mime):
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def module_order(entry="main"):
    """按 import 关系做拓扑排序，被依赖的模块在前。"""
    order, seen = [], set()

    def visit(name, stack):
        if name in seen:
            return
        if name in stack:
            sys.exit(f"循环依赖：{' -> '.join(stack + [name])}")
        src = (ROOT / "js" / f"{name}.js").read_text(encoding="utf-8")
        for _, dep in IMPORT_RE.findall(src):
            visit(dep, stack + [name])
        seen.add(name)
        order.append(name)

    visit(entry, [])
    return order


def bundle_js():
    parts, owners = [], {}
    for name in module_order():
        src = (ROOT / "js" / f"{name}.js").read_text(encoding="utf-8")
        leftover = [l for l in src.splitlines() if l.startswith("import ") and not IMPORT_RE.match(l)]
        if leftover:
            sys.exit(f"{name}.js 有打包脚本不认识的 import 写法：{leftover[0]}")
        # 所有模块拼进同一个作用域，顶层同名定义会冲突，提前报错
        for decl in top_level_names(src):
            if decl in owners:
                sys.exit(f"顶层重名：{decl} 同时出现在 {owners[decl]}.js 和 {name}.js")
            owners[decl] = name
        body = IMPORT_RE.sub("", src)
        body = re.sub(r"^export\s+", "", body, flags=re.M)
        parts.append(f"// ---- {name}.js ----\n{body.strip()}\n")
    js = "(() => {\n" + "\n".join(parts) + "})();\n"
    # 照片路径换成 base64
    for img in sorted((ROOT / "images").glob("*.webp")):
        rel = f"images/{img.name}"
        if rel in js:
            js = js.replace(f"'{rel}'", f"'{data_uri(img, 'image/webp')}'")
    for img in sorted((ROOT / "images").glob("wechat-group-*.jpg")):
        rel = f"images/{img.name}"
        if rel in js:
            js = js.replace(f"'{rel}'", f"'{data_uri(img, 'image/jpeg')}'")
    for img in sorted((ROOT / "images").glob("crown-*.png")):
        rel = f"images/{img.name}"
        if rel in js:
            js = js.replace(f"'{rel}'", f"'{data_uri(img, 'image/png')}'")
    if re.search(r"'images/[^']+'", js):
        sys.exit("config.js 里有找不到文件的照片路径")
    return js


def main():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "css" / "style.css").read_text(encoding="utf-8")
    css = css.replace('url("../fonts/zcool-sub.woff2")', f'url({data_uri(ROOT / "fonts" / "zcool-sub.woff2", "font/woff2")})')
    matter = (ROOT / "vendor" / "matter.min.js").read_text(encoding="utf-8").replace("</script", "<\\/script")
    js = bundle_js().replace("</script", "<\\/script")

    for tag, new in [
        ('<link rel="stylesheet" href="css/style.css">', f"<style>\n{css}</style>"),
        ('<script src="vendor/matter.min.js"></script>', f"<script>\n{matter}</script>"),
        ('<script type="module" src="js/main.js"></script>', f"<script>\n{js}</script>"),
    ]:
        if html.count(tag) != 1:
            sys.exit(f"index.html 里找不到：{tag}")
        html = html.replace(tag, new)

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    print(f"已生成 {OUT.relative_to(ROOT)}（{OUT.stat().st_size // 1024} KB）")


if __name__ == "__main__":
    main()
