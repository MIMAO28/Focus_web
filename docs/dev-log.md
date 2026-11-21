# 开发日志（脱敏）

只记录开发过程中的关键操作与结论，不记录 API Key、密码、令牌与个人敏感信息。完整过程记录（含截图与指令原文）保存在本机 Word，不进入仓库。

---

## P01 · 2026-11-15 · 前置设置

**阶段**：仓库与过程记录基线

**目标**：核对本地目录与 Gitee 仓库；建立 README、COURSEWORK.md、docs/dev-log.md、.gitignore；建立本机 Word 过程记录与“每步提交推送”流程。

**实际操作**

1. 核对工作目录 `F:\Rrea-REPORT`：原为空目录，非 git 仓库，无远程。
2. 核对远程仓库：先按本人提供的 `https://gitee.com/MIMAO28/mihacao` 认证并拉取，发现该仓库已有一套无关的 Java/Maven 项目（12 个文件、4 个提交，2026-05-24，无 README），故停止推送；经本人确认改用新空仓库 `https://gitee.com/MIMAO28/shengchengshirengongzhineng`（仅含 Gitee 初始 README 提交），在其初始提交之上继续。
3. 建立本机 Word 过程记录与截图归档目录（不进入仓库）。
4. 建立基线文件：`README.md`（选题待定）、`COURSEWORK.md`、`docs/dev-log.md`、`.gitignore`。

**修改文件**

- 新增 `README.md`、`COURSEWORK.md`、`docs/dev-log.md`、`.gitignore`

**测试与验证**

- 待提交后记录：本地提交号、远端分支、推送结果。

**问题**

- Q-P01-01：缺少仓库地址导致远程核对与推送无法进行（已在拿到地址后推进）。
- Q-P01-02：当前目录原为空目录，目录归属需本人确认（已按本人指示采用本目录）。

**下一步**

- 完成首次提交并推送，核对远端是否包含该提交；
- 后续轮次继续；选题分析顺延至 P03。

---

## P02 · 2026-11-17 · 环境迁移与记录规则

**阶段**：开发环境准备（非课程功能开发）

**目标**：把本机 Codex 技能迁移为 TRAE CN 全局技能；按要求记录每一步，且不再逐项询问本人。

**实际操作**

1. 扫描 `C:\Users\MIMAO\.codex\skills` 与 `C:\Users\MIMAO\.agents\skills`，找到 26 个直接包含 `SKILL.md` 的独立技能目录。
2. 确认 TRAE 全局技能目录为 `C:\Users\MIMAO\.trae-cn\skills`（原不存在，已新建）。
3. 逐个检查依赖（外部 CLI、Python 包、API Key、本机个人目录、Codex 专用工具）。
4. 复制 21 个可用技能，保留目录结构、脚本、模板与引用文件；排除 `__pycache__`、`.git`、缓存与密钥。
5. 跳过 5 个缺依赖技能：ai-image-generation（缺 belt CLI 与 inference.sh 账号）、byted-seedance-video-generate（缺 ARK_API_KEY）、computer-use-windows（缺 pywin32/keyboard/mouse）、last30days（缺多平台 API Key 与 MCP）、agent-reach（缺 agent-reach CLI，TRAE 已自带同名技能）。
6. `.system`（imagegen、openai-docs、review-agent、skill-creator、skill-installer）与 `plugins/cache`（openai-curated-remote、openai-primary-runtime）只做兼容性盘点，未迁移。
7. 逐文件比对源目录与目标目录：242 个文件，缺失 0。
8. 在 `COURSEWORK.md` 增加“逐步记录”和“不再逐项询问”两条规则。

**修改文件**

- 本机新增 `C:\Users\MIMAO\.trae-cn\skills\` 下 21 个技能目录
- 修改 `COURSEWORK.md`、`docs/dev-log.md`

**测试与验证**

- 文件层：源/目标清单比对一致，21 个技能均含 `SKILL.md`
- TRAE 识别：未验证（需在「设置 → 技能与命令 → 全局」查看，必要时重启 TRAE）
- 实际运行：未验证（按要求本次不运行技能脚本）

**问题**

- Q-P02-01：目标目录不存在且不在沙箱可写范围 → 关闭沙箱执行写入，创建成功。
- Q-P02-02：部分技能依赖缺失 → 按“缺依赖先跳过”处理并逐项记录，未安装任何包、未配置任何密钥。

**下一步**

- 待本人核对 TRAE 全局技能列表；若未识别则重启后复查；
- 后续轮次按本人指令继续。

---

## P05 · 2026-11-17 · 撤销上一轮提交

**阶段**：变更处理

**目标**：按本人指令撤销 P04 对仓库的改动。

**实际操作**

1. 对 773b39c、9a305ec 执行 `git revert`（因换行检查冲突，改为暂存差异后统一提交）。
2. 结果：删除 `docs/requirements.md`；README 回到“选题待定”；移除 P04 日志条目；移除 `.gitignore` 的 `data/`。

**提交**：e091147 P05 撤销 P04 需求文档与 README 改动（已推送）

**结果**：仓库内容回到 822a64e 时的状态；历史保留，可用 `git revert e091147` 恢复。

---

## P06 · 2026-11-20 · 学习专注网站基础版

**阶段**：功能实现（选题改向）

**目标**：按本人新选题实现学习专注网站：番茄钟（倒计时/正计时）、学习项目分项计时、邮箱注册登录、账号内累计时长。

**选题**：FOCUS! 学习专注（本机 Web 应用）。

**主要决策**

1. 形态：FastAPI + 原生 HTML/CSS/JS + SQLite；一条命令启动，无前端构建步骤。
2. 账户从第一天就做：邮箱 + 密码（PBKDF2-SHA256、20 万次迭代、随机盐），会话 Cookie 30 天；各账号数据隔离。
3. 计时双模式：倒计时（25/45/60 分，归零自动保存）与正计时（手动保存）；少于 5 秒不记录。
4. 视觉参照本人提供的 Framer 模板：深色底 + 高饱和红、超大标题、贴纸元素、跑马灯；悬停倾斜与计时呼吸动效。
5. 数据只存本机 `data/focus.db`（已忽略）；用户内容用 `textContent` 渲染，避免 XSS。

**实现**

- 后端：注册/登录/退出、项目增删改、专注记录、统计与最近记录接口；删除最后一个项目返回 400。
- 前端：登录/注册、项目卡片、项目下拉、超大计时数字、进度条、时长预设、快捷键（空格/R）、统计卡片与记录列表。

**测试与验证**

- 接口：注册 200；重复邮箱 409；错误密码 401；项目新增/改名/删除正常；删除最后项目 400；记录入库与统计正确；退出后 /api/me 返回 401。
- 浏览器自动化实测：注册 → 新建项目 → 计时 → 结束保存 → 统计与记录更新，PASS。
- 发现并修复 2 个缺陷：
  - Q-P06-01 登录后仍显示登录卡：`.auth` 的 `display:grid` 覆盖 `hidden` 属性 → 增加 `[hidden]{display:none!important}`。
  - Q-P06-02 新建项目后下拉仍停在默认项目 → 新建成功后自动选中新项目。
- 测试账号已清空，数据库当前无用户。

**提交**

- 0d8c6d6 P06 实现专注计时网站（账户、项目、计时、统计）
- 本条日志与 README 随同批文档提交推送

**已知限制**

- 刷新页面会重置当前计时（已保存记录不受影响）。
- 暂无找回密码与邮箱验证；删除项目会连带删除该项目记录。

**下一步**

- P07：计时状态刷新续接、番茄循环（专注/休息）、按项目周视图图表。

---

## P09 · 2026-11-21 · GitHub 托管与公网部署准备

**阶段**：部署准备

**目标**：按本人要求把代码托管到 GitHub，并给出可关机访问的公网部署路径。

**实际操作**

1. 核对 GitHub 仓库 `https://github.com/MIMAO28/Focus_web`：为空仓库（无任何引用）。
2. 本机未安装 GitHub CLI；直接用 HTTPS 远程推送成功，新增远程 `github`，`master` 推送至 `da630d9`，远端核对一致（仓库为公开）。
3. 事实确认：GitHub Pages 仅托管静态文件，无法运行 FastAPI 与 SQLite，因此不能用 Pages 上线本网站。
4. 新增 `deploy/pythonanywhere_wsgi.py`（ASGI→WSGI 适配入口与操作注释）。
5. `app/main.py` 支持 `FOCUS_SECURE_COOKIE=1`，HTTPS 下 Cookie 带 `Secure`。
6. README 增加“公网部署”：PythonAnywhere 免费版步骤、Oracle Always Free 方案、不建议的 Render 免费实例原因与安全提醒。
7. 重启本地服务验证：首页 200、注册接口正常；随后清空测试账号。

**提交**

- 本条与部署文件、README 一并提交（见 Word P09 记录）

**下一步**

- 本人在 PythonAnywhere 注册并按 README 部署；我负责 WSGI 路径、环境变量与公网验证。

---

## P11 · 2026-11-21 · GitHub Pages 在线版

**阶段**：公网发布

**参考**：本人旧项目 <https://github.com/MIMAO28/listening-desk>（静态 Vite 站点部署在 GitHub Pages；`account-config.json` 暴露 Supabase 项目地址与 publishable key；README 说明材料/听写存本浏览器，登录统计同步 Supabase）。

**方案**

1. 静态版复用 `app/static` 的前端（HTML/CSS/JS），不另写界面。
2. 新增 `deploy/static/local-api.js`：用 localStorage 实现与服务端同形状的接口（注册、登录、项目、专注记录、统计），`app.js` 通过 `window.FocusLocalApi` 自动切换。
3. `deploy/build_pages.py` 由 `app/static` 生成 `site/`；GitHub Actions 构建并发布到 Pages。
4. 账号密码用 PBKDF2-SHA256（15 万次、随机盐）存浏览器；数据键 `focus.local.v1`。

**问题与修复**

- Q-P11-01：首次 Actions 在 `configure-pages` 失败（Pages 未启用，仓库无管理员权限自动开启）。处理：本人在浏览器登录 GitHub 后，把 Pages 的 Source 改为 GitHub Actions；重新推送后部署成功。

**验证**

- 公网地址：<https://mimao28.github.io/Focus_web/>（路径区分大小写）。
- 浏览器实测：注册 → 新建“英语听力” → 倒计时 → 保存 9 秒 → 刷新后仍登录，统计与记录保留，PASS。
- 工作流：Deploy GitHub Pages 运行 `completed / success`。

**提交**

- 402641c P11 增加 GitHub Pages 静态版与自动部署
- b1c4602 P11 补充 GitHub Pages 在线版说明

**限制**

- 账号与数据存当前浏览器，不清缓存/不换设备才保留；跨设备需接 Supabase（旧项目已有账号与项目）。
- 页面窄屏（≤900px）会隐藏顶栏邮箱，属既有响应式样式。

---

## P12 · 2026-11-21 · 登录与数据保存完善

**阶段**：功能完善

**目标**：先完善登录与数据保存，再继续扩展网站。

**存储机制说明（回答疑问）**

- 线上 GitHub Pages 版是纯静态页面：没有服务器、没有数据库；账号、项目、专注记录存放在浏览器 `localStorage`（键 `focus.local.v1`），密码为 PBKDF2-SHA256 加盐哈希。
- 服务端版（`app/`，FastAPI + SQLite）仍保存在本机，用于本机或云主机部署；两种模式共用同一套前端。

**本轮改动**

1. 修改密码：校验旧密码后重设，账号区入口。
2. 导出 / 导入备份：JSON 文件，用于换设备或清缓存前迁移账号与全部记录。
3. 登录页“显示密码”开关。
4. 计时刷新续接：按用户邮箱保存计时状态，刷新/重开后继续倒计时或正计时；倒计时在离开期间结束时提示手动入账。
5. 存储失败（如配额不足）改为明确报错，不再静默失败。
6. 新增“账号与数据”面板，写明数据位置与迁移方式。

**测试与验证**

- 本地静态版（127.0.0.1:8001）浏览器实测：计时中刷新 00:09 → 00:15 继续运行；改密 123456→654321 成功；退出后新密码登录成功；导出备份提示出现。全部 PASS。
- 公网：GitHub Actions 部署 `completed / success`；线上页面已包含“账号与数据”区块。

**提交**

- 1bcf062 P12 完善登录与数据保存（改密、备份、计时续接）

**注意**

- 登出会丢弃未保存的计时（有意的安全处理）。
- 跨设备仍需导出/导入备份；若要自动同步，下一步接 Supabase。


