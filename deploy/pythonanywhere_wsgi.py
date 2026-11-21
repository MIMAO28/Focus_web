# -*- coding: utf-8 -*-
"""PythonAnywhere WSGI 入口示例（FastAPI 是 ASGI，需要 a2wsgi 适配）。

使用步骤：
1. 在 PythonAnywhere 的 Bash 控制台克隆仓库：
   git clone https://github.com/MIMAO28/Focus_web.git
2. 创建虚拟环境并安装依赖：
   mkvirtualenv focus --python=/usr/bin/python3.10
   pip install -r Focus_web/requirements.txt a2wsgi
3. Web 标签 → Add a new web app → Manual configuration → Python 3.10；
4. 把本文件内容贴进 “WSGI configuration file”，把 PROJECT_DIR 改成实际路径；
5. 在 Web 标签设置环境变量 FOCUS_SECURE_COOKIE=1（HTTPS 下 Cookie 加 Secure）；
6. Reload，访问 https://<用户名>.pythonanywhere.com 。

注意：data/focus.db 会保存在项目目录内，PythonAnywhere 的磁盘是持久的，
免费账号仍有每日 CPU 配额；注册入口公开后建议加邀请码或限流。
"""
import os
import sys

PROJECT_DIR = "/home/你的用户名/Focus_web"
if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)

os.environ.setdefault("FOCUS_SECURE_COOKIE", "1")

from a2wsgi import ASGIMiddleware  # noqa: E402
from app.main import app  # noqa: E402

application = ASGIMiddleware(app)
