# -*- coding: utf-8 -*-
"""生成 GitHub Pages 静态版到 site/：复用 app/static 的前端，注入浏览器本地后端。"""
import os
import shutil

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "app", "static")
LOCAL_API = os.path.join(BASE, "deploy", "static", "local-api.js")
OUT = os.path.join(BASE, "site")


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)

    html = open(os.path.join(SRC, "index.html"), encoding="utf-8").read()
    html = html.replace("/static/", "./")
    html = html.replace(
        '<script src="./app.js"></script>',
        '<script src="./local-api.js"></script>\n<script src="./app.js"></script>',
    )
    html = html.replace("FOCUS! · 本地运行 · 数据只留在这台电脑", "FOCUS! · 在线版 · 账号与数据保存在当前浏览器")
    open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(html)

    shutil.copy(os.path.join(SRC, "styles.css"), os.path.join(OUT, "styles.css"))
    shutil.copy(os.path.join(SRC, "app.js"), os.path.join(OUT, "app.js"))
    shutil.copy(LOCAL_API, os.path.join(OUT, "local-api.js"))
    open(os.path.join(OUT, ".nojekyll"), "w", encoding="utf-8").write("")

    files = sorted(os.listdir(OUT))
    print("built site/: " + ", ".join(files))


if __name__ == "__main__":
    main()
