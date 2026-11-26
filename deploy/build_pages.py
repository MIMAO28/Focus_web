# -*- coding: utf-8 -*-
"""生成 GitHub Pages 静态版到 site/。

- 存在 deploy/cloud-config.json 时：注入 Supabase 云端后端（跨设备同步）。
- 否则：注入浏览器本地后端（local-api.js）。
"""
import json
import os
import shutil
import time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "app", "static")
LOCAL_API = os.path.join(BASE, "deploy", "static", "local-api.js")
CLOUD_API = os.path.join(BASE, "deploy", "static", "cloud-api.js")
CLOUD_CFG = os.path.join(BASE, "deploy", "cloud-config.json")
OUT = os.path.join(BASE, "site")


def main():
    cloud = os.path.isfile(CLOUD_CFG)
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)

    html = open(os.path.join(SRC, "index.html"), encoding="utf-8").read()
    html = html.replace("/static/", "./")
    version = (os.environ.get("GITHUB_SHA") or str(int(time.time())))[:7]
    html = html.replace('href="./styles.css"', 'href="./styles.css?v=%s"' % version)
    html = html.replace('src="./theme.js"', 'src="./theme.js?v=%s"' % version)

    if cloud:
        config = json.load(open(CLOUD_CFG, encoding="utf-8"))
        with open(os.path.join(OUT, "cloud-config.js"), "w", encoding="utf-8") as f:
            f.write("window.FOCUS_SUPABASE = %s;\n" % json.dumps(config, ensure_ascii=False))
        shutil.copy(CLOUD_API, os.path.join(OUT, "cloud-api.js"))
        scripts = (
            '<script src="./cloud-config.js"></script>\n'
            '<script src="./cloud-api.js"></script>\n'
            '<script src="./app.js"></script>'
        )
        footer = "FOCUS! · 保持专注"
    else:
        shutil.copy(LOCAL_API, os.path.join(OUT, "local-api.js"))
        scripts = '<script src="./local-api.js"></script>\n<script src="./app.js"></script>'
        footer = "FOCUS! · 保持专注"

    html = html.replace('<script src="./app.js"></script>', scripts)
    html = html.replace('src="./app.js"', 'src="./app.js?v=%s"' % version)
    html = html.replace('src="./room.js"', 'src="./room.js?v=%s"' % version)
    html = html.replace('src="./auth-scene.js"', 'src="./auth-scene.js?v=%s"' % version)
    html = html.replace('src="./cloud-api.js"', 'src="./cloud-api.js?v=%s"' % version)
    html = html.replace('src="./cloud-config.js"', 'src="./cloud-config.js?v=%s"' % version)
    html = html.replace('src="./local-api.js"', 'src="./local-api.js?v=%s"' % version)
    html = html.replace('src="./character/crispe-still.png"', 'src="./character/crispe-still.png?v=%s"' % version)
    html = html.replace('./character/crispe-still@2x.png', './character/crispe-still@2x.png?v=%s' % version)
    html = html.replace('src="./character/crispe-patch.png"', 'src="./character/crispe-patch.png?v=%s"' % version)
    html = html.replace('./character/crispe-patch@2x.png', './character/crispe-patch@2x.png?v=%s' % version)
    html = html.replace("FOCUS! · 保持专注", footer)
    open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(html)

    shutil.copy(os.path.join(SRC, "styles.css"), os.path.join(OUT, "styles.css"))
    shutil.copy(os.path.join(SRC, "theme.js"), os.path.join(OUT, "theme.js"))
    shutil.copy(os.path.join(SRC, "auth-scene.js"), os.path.join(OUT, "auth-scene.js"))
    shutil.copy(os.path.join(SRC, "app.js"), os.path.join(OUT, "app.js"))
    shutil.copy(os.path.join(SRC, "room.js"), os.path.join(OUT, "room.js"))
    audio_src = os.path.join(SRC, "audio")
    if os.path.isdir(audio_src):
        shutil.copytree(audio_src, os.path.join(OUT, "audio"))
    char_src = os.path.join(SRC, "character")
    if os.path.isdir(char_src):
        shutil.copytree(char_src, os.path.join(OUT, "character"))
    open(os.path.join(OUT, ".nojekyll"), "w", encoding="utf-8").write("")

    print("built site/ (%s): %s" % ("cloud" if cloud else "local", ", ".join(sorted(os.listdir(OUT)))))


if __name__ == "__main__":
    main()
