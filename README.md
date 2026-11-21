# 生成式人工智能应用基础二 · 课程项目

## 选题

**FOCUS! 学习专注** —— 在本机运行的专注计时网站（基础版已实现，2026-11-20）。

- 面向用户：本人及需要按项目统计学习时长的学生；单机、单用户注册使用。
- 解决的问题：普通番茄钟不区分学习项目、不累计账号数据、倒计时与正计时割裂。
- 核心功能：邮箱注册登录；创建多个学习项目；倒计时（番茄钟）与正计时；每段专注结束后按项目累计；今日/本周/累计统计与最近记录。
- 技术栈：Python 3.14 + FastAPI + 原生 HTML/CSS/JS + SQLite（无前端构建步骤）。

## 当前状态

- P01–P05：仓库、过程记录与规则建立（P05 撤销过一次选题）
- P06：基础版功能已实现并通过接口与浏览器实测
- P09：代码已同步到 GitHub；补充公网部署入口与说明
- P11：新增 GitHub Pages 静态版，账号与数据保存在浏览器，自动部署
- 后续：计时刷新续接、番茄循环、图表、可选 Supabase 跨设备同步

## 在线版（GitHub Pages + Supabase）

- 地址：<https://mimao28.github.io/Focus_web/>
- 构建：`python deploy/build_pages.py` 由 `app/static` 生成 `site/`（CI 自动执行）
- 账号：Supabase Auth 邮箱注册；**必须点邮件里的验证链接后才能登录**，注册不会直接进入网站
- 数据：学习项目与专注记录存 Supabase（`focus_projects`、`focus_sessions`），换设备/换浏览器登录同一邮箱即可同步
- 建表脚本：`deploy/supabase/schema.sql`（含行级权限，只能读写自己的数据）
- 配置：`deploy/cloud-config.json` 存在时生成云端版；不存在时退回浏览器 localStorage 版（`local-api.js`）
- 服务端版仍在 `app/`（FastAPI + SQLite），用于本机或云主机部署
- 部署工作流：`.github/workflows/pages.yml`（push 到 `master` 自动发布）

## 功能（基础版）

| 功能 | 说明 |
|---|---|
| 邮箱账户 | 注册即登录；密码 PBKDF2-SHA256 加盐哈希；登录会话 30 天 |
| 学习项目 | 新增、改名、删除；至少保留一个项目；每个项目独立累计 |
| 倒计时 | 25 / 45 / 60 分预设，进度条，归零自动保存并提示音 |
| 正计时 | 自由计时，点“结束并保存”入库 |
| 快捷键 | `空格` 开始/暂停，`R` 重置 |
| 统计 | 今天 / 本周 / 累计 / 次数；最近 20 条记录；按项目分开 |
| 数据隔离 | 每个账号只看到自己的项目与记录 |

## 运行方式

前置：Python 3.10 及以上（本机为 3.14）。

```bash
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

浏览器打开 <http://127.0.0.1:8000>，注册邮箱账号（密码至少 6 位）即可使用。

## 公网部署

代码已托管到 GitHub：<https://github.com/MIMAO28/Focus_web>（Gitee 同步维护）。

**GitHub Pages 不能直接上线本网站**：Pages 只托管静态文件，没有 Python 运行时与数据库，无法运行 FastAPI 与 SQLite。

### 方案 A：PythonAnywhere 免费版（改动最小，数据持久）

1. 注册 <https://www.pythonanywhere.com>，打开 Bash 控制台执行：

```bash
git clone https://github.com/MIMAO28/Focus_web.git
mkvirtualenv focus --python=/usr/bin/python3.10
pip install -r Focus_web/requirements.txt a2wsgi
```

2. Web 标签 → Add a new web app → Manual configuration → Python 3.10。
3. 把 `deploy/pythonanywhere_wsgi.py` 的内容贴进 WSGI 配置文件，并把 `PROJECT_DIR` 改成 `/home/<用户名>/Focus_web`。
4. 在 Web 标签的环境变量里加 `FOCUS_SECURE_COOKIE=1`。
5. 点 Reload，访问 `https://<用户名>.pythonanywhere.com`。

数据库保存在 `Focus_web/data/focus.db`，PythonAnywhere 磁盘持久；免费账号有每日 CPU 配额。

### 方案 B：Oracle Cloud Always Free 虚拟机

创建免费 VM → 安装 Python 与 Nginx → `git clone` 本仓库 → 建虚拟环境装依赖 → `uvicorn` 监听 `127.0.0.1:8000` → Nginx 反向代理 → 用域名申请 HTTPS 证书。适合需要自定义域名、长期稳定的情况。

### 不建议

- Render 免费实例：闲置休眠、磁盘临时，SQLite 数据会在重启或重新部署后丢失。
- Vercel / Netlify / Cloudflare Pages：只能托管静态页，跑不了本项目的后端。

### 公网安全提醒

公开注册入口后建议加邀请码或限流、限制密码尝试次数；HTTPS 下务必设置 `FOCUS_SECURE_COOKIE=1`，Cookie 才会带 `Secure`。

## 目录结构

```
app/
  main.py            FastAPI 路由与接口
  db.py              SQLite 建表与统计查询
  auth.py            密码哈希与令牌
  static/
    index.html       页面结构
    styles.css       视觉样式
    app.js           前端交互与计时逻辑
data/                运行数据（focus.db，已 gitignore）
requirements.txt     运行依赖
docs/dev-log.md      脱敏开发日志
COURSEWORK.md        协作与过程记录规则
```

## 验收（基础版）

| 编号 | 验收项 | 结果 |
|---|---|---|
| AC1 | 按 README 两条命令启动，首页返回 200 | 通过 |
| AC2 | 邮箱注册后自动登录，顶栏显示邮箱 | 通过（浏览器实测） |
| AC3 | 重复邮箱返回 409，密码错误返回 401 | 通过（接口测试） |
| AC4 | 新建项目后自动选中，项目卡片显示独立累计 | 通过（浏览器实测） |
| AC5 | 倒计时开始后数字递减，暂停/继续、重置可用 | 通过（浏览器实测） |
| AC6 | 结束并保存后“今天/累计/次数”与最近记录同步更新 | 通过（浏览器实测） |
| AC7 | 删除最后一个项目被拒绝（400） | 通过（接口测试） |
| AC8 | 退出后访问 /api/me 返回 401 | 通过（接口测试） |

## 已知限制

- 刷新页面会重置正在进行的计时（数据已保存部分不受影响）。
- 暂无找回密码、邮箱验证；账号只在本机有效。
- 删除项目会连带删除该项目的专注记录。
- 未做 CSRF 防护，定位是本机单人使用。

## 数据与安全

- 数据只存本机 `data/focus.db`，已加入 `.gitignore`，不进入仓库。
- 密码以 PBKDF2-SHA256（20 万次迭代、随机盐）保存，不存明文。
- 仓库不含任何密钥、私人截图或运行数据。
