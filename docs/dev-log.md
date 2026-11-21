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

---

## P13 · 2026-11-21 · 接入 Supabase 云端同步（代码完成，待建表启用）

**阶段**：架构升级

**方案**

- 账号：Supabase Auth（邮箱 + 密码），跨设备登录同一邮箱。
- 数据：`focus_projects`、`focus_sessions` 两张表；开启 RLS，`auth.uid() = user_id` 才能读写。
- 前端：新增 `deploy/static/cloud-api.js`，用 REST（`/auth/v1`、`/rest/v1`）实现与本地版相同的接口；`app.js` 优先云端、其次本地、最后本机 FastAPI。
- 构建：`deploy/cloud-config.json` 存在时注入云端脚本；不存在时保持本地版，线上不受影响。

**新增 / 修改文件**

- `deploy/supabase/schema.sql`（建表 + 索引 + RLS + 授权）
- `deploy/static/cloud-api.js`（约 350 行）
- `deploy/build_pages.py`（按配置切换云端/本地）
- `app/static/app.js`（三模式优先、云端文案、UUID 项目 id、邮箱确认提示）
- `app/main.py`（本机版补修改密码接口）

**事实核对**

- Supabase 项目可达，邮箱登录开启，`mailer_autoconfirm=false`（注册需点确认邮件）。
- REST 查询 `focus_projects` 返回 `PGRST205`：表尚未创建。
- 认证接口可达（错误凭据返回 400）。

**验证**

- 本地静态版回归：注册、建项目、倒计时、保存、账号区（修改密码 + 备份卡）、退出，全部 PASS，无控制台报错。

**提交**

- e4163e4 P13 接入 Supabase 云端同步（待启用配置）

**下一步**

- 本人在 Supabase SQL Editor 执行 `deploy/supabase/schema.sql`。
- 之后添加 `deploy/cloud-config.json`，重新构建发布，验证跨浏览器/跨设备同步。

---

## P14 · 2026-11-21 · 启用 Supabase 云端同步

**阶段**：公网架构切换

**前提确认**

- 本人在 Supabase SQL Editor 执行建表脚本；REST 查询 `focus_projects`、`focus_sessions` 均返回 200（空数组），表已存在。

**改动**

- 新增 `deploy/cloud-config.json`（项目 URL 与 publishable key，公开可见）。
- 构建脚本检测到配置后生成云端版：`site/` 含 `cloud-config.js`、`cloud-api.js`，页脚文案改为“账号与记录同步到云端”。
- 推送 `c8a1e10`，GitHub Actions 部署 `completed / success`。

**验证**

- 线上 `https://mimao28.github.io/Focus_web/` 返回 200，HTML 已引用 `cloud-config.js`。
- 浏览器实测：错误账号登录提示“邮箱或密码不正确”，网络请求命中
  `https://thvnchihsoirgwqxfgyn.supabase.co/auth/v1/token?grant_type=password`，返回 400，说明云端鉴权已接管。

**未验证 / 原因**

- 完整注册与跨设备同步：项目开启邮箱确认（`mailer_autoconfirm=false`），没有已确认测试账号，无法自行注册验证。
- 待本人用邮箱注册并点确认邮件，或在控制台临时关闭 Confirm email 后由我完成双端验证。

**已知待加固**

- `focus_sessions` 的 RLS 只校验 `user_id`，未校验 `project_id` 归属；建议后续在 with check 中加入项目归属校验。

---

## P15 · 2026-11-21 · 注册改为邮箱验证并移除修改密码

**阶段**：流程修正

**用户反馈**

- 注册不能点完就进站，必须像旧项目一样先发验证邮件、点链接确认后才能登录。
- 删除“修改密码”入口。

**改动**

1. 云端注册：调用 Supabase `/auth/v1/signup?redirect_to=...`；**无论返回是否带会话，都清空会话并提示“验证邮件已发送”**，不再自动登录。
2. 登录未验证账号时，Supabase 返回 “Email not confirmed”，映射为“邮箱还没验证，请先点确认邮件里的链接”。
3. 新增“没收到验证邮件？重新发送”（`/auth/v1/resend`）。
4. 邮箱验证链接回跳：解析 URL hash 中的 `access_token/refresh_token`，写入会话并自动进入应用。
5. 删除账号区“修改密码”整块及云端/本地/FastAPI 三处密码修改接口。
6. README 更新为 Supabase 云端说明。

**验证**

- 构建与部署：提交 e9558cd，Actions `completed / success`；线上页面含 `resendBtn`，不含 `oldPassword`。
- 代码层：注册分支强制 `saveSession(null)` 后抛出 `EMAIL_CONFIRM`；未验证登录由 Supabase 拦截。
- 未执行：真实注册（需向邮箱发信，避免占用项目邮件额度）；待本人用自身邮箱验证。

**待本人配置**

- Supabase → Authentication → URL Configuration：Site URL 设为 `https://mimao28.github.io/Focus_web/`；Redirect URLs 添加 `https://mimao28.github.io/Focus_web/**`。

## P23 重设计为 Growth Haus 风格

**目标**：按用户提供的 Framer 模板（growth-haus-wbs.framer.website）重做界面，保留全部既有功能。

**参考提炼**

- 字体：Changa One（大标题）、Instrument Serif Italic（装饰斜体）、Inter（正文）。
- 配色：奶油 #F3E9E0、墨 #1A160A、黄 #F5C84B、红 #E8442E、粉 #F5B8C8、绿 #2F8F4E、橙 #FFAE46。
- 版式：黄底红框 Hero、超大标题 + 贴纸、红色跑马灯、彩色卡片、硬阴影、胶囊按钮、深色页脚大字。

**改动**

1. 重写 `app/static/index.html` 的结构与类名，保留全部 ID 与 `data-*` 钩子（登录、计时、项目、统计、备份）。
2. 重写 `app/static/styles.css`：新配色、字体、贴纸、跑马灯、彩色卡片、响应式；移动端导航改为第二行横排。

**验证**

- 本地预览：注册 → 建项目“英语听力” → 计时 43 秒 → 暂停 → 保存；统计与记录更新；刷新后计时器复位。
- 控制台无报错；390px 视口 `scrollWidth = clientWidth`，无横向溢出；移动端导航已恢复为第二行。
- 线上部署：提交 ee58603，Actions `completed / success`；线上 `index.html` 含 `hero-frame` 与 Changa One 字体，`styles.css` 含新配色。

**后续**

- 云端真实邮箱注册回归（待 SMTP 修复后由本人完成）。

## P24 交互与内容调整

**用户要求**：改名不要用浏览器弹窗；删除“账号与数据”；滚动跑马灯换成静态鸡汤；倒计时与正计时时长累加。

**改动**

1. 改名改为页面内弹窗（`renameModal`，支持 Enter 保存、Esc/点遮罩取消），移除 `window.prompt`。
2. 删除“账号与数据”整节、导航入口及备份导入导出脚本；页脚说明改为“FOCUS! · 保持专注”。
3. 跑马灯改为静态引言条（红色底 + Instrument Serif 斜体，无动画）。
4. 切换计时模式或更改预设时保留已计时长：`base` 沿用，倒计时目标改为“已计时 + 新时长”，保存时按累计秒数入账；统计本身一直合并两种模式。

**验证**

- 改名：点“改名”出现页面内弹窗，改为“新名”后卡片与下拉同步，提示“已改名”。
- 账号区：页面无该区块与导航项。
- 引言条：`getAnimations()` 为空，`transform: none`，无滚动。
- 累加：倒计时约 8 秒 → 切换正计时显示约 8 秒 → 再跑 3 秒 → 保存记录 11 秒，项目/今日/本周/累计均为 11 秒。
- 部署：提交 ad8b008，Actions `completed / success`。

## P25 引言字体与随机轮换

**用户要求**：引言条字体太low、与整站风格不一致；每条鸡汤要每次进站/登录都不同。

**改动**

1. 引言改用 Noto Serif SC 700（Google Fonts），去掉伪斜体；大引号装饰 + 右侧 `01 / 12` 编号，与全站硬边框风格统一。
2. 内置 12 条中文语录；`pickQuote()` 于启动与登录时各抽一次。
3. 用 `localStorage("focus.quote.last")` 记录上一条，抽到相同则顺延一条，保证不会连续重复。

**验证**

- 首开 `12 / 12`、刷新 `02 / 12`、登录后 `08 / 12`，三次文本与编号均不同。
- 计算样式 `font-family: "Noto Serif SC", ...`、`font-weight: 700`、`font-style: normal`；`document.fonts.check` 为 true。
- 引言条无裁切、无横向溢出，控制台无报错。
- 部署：提交 c578ede，Actions `completed / success`。

**注意**

- 依赖 Google Fonts；网络不可达时回退到 Source Han Serif / 宋体。

## P26 引言缓存修复、展示字体与 30 条语录

**用户反馈**：仍看到旧字体；希望语录更多且保持随机抽取。

**定位**

- 线上 JS 已是新版（编号 `01 / 12` 可见），但样式仍是旧版（居中、伪斜体、无大引号）→ 浏览器缓存了旧 `styles.css`。
- 仅换字体无法解决，必须先做缓存失效。

**改动**

1. `deploy/build_pages.py` 注入版本号：`styles.css?v=<GITHUB_SHA>`、`app.js?v=<sha>`；本地构建用时间戳。
2. `index.html` 增加 `Cache-Control/Pragma/Expires` 禁止缓存 meta。
3. 引言字体改为 `ZCOOL QingKe HuangYou`（站酷庆科黄油体，展示型中文标题字），回退 Noto Sans SC/微软雅黑。
4. 语录从 12 条扩到 30 条，抽取逻辑不变（localStorage 防连续重复）。

**验证**

- 本地首开 `30 / 30`、刷新 `20 / 30`、登录 `28 / 30`，三次不同。
- 计算字体 `ZCOOL QingKe HuangYou` / 400 / normal；带实际文本的 `fonts.check` 为 true，字族 92 个 @font-face 中已加载 6 个使用中切片。
- 布局：左引号、正文、右下编号无重叠，无横向溢出。
- 首次线上部署 `deploy-pages` 失败（前 6 步 success），需重跑后复核。

## P28 主题配色与暗色模式

**需求**：浏览 colorhunt.co/palettes/popular，取点赞最高的 20–30 套配色，作为主题选项，并各自支持暗色模式。

**数据**：采集热门页前 24 套（点赞 1,645 → 363），加“经典 FOCUS”共 25 套；每套 4 个 hex。

**实现**

1. 新增 `app/static/theme.js`：把每套 4 色按亮度/饱和度推导出 `--cream/--paper/--ink/--accent/--hero-bg/--card1..4` 等变量；用对比度函数保证正文 ≥ 7:1、按钮/强调 ≥ 4.5:1；亮/暗分别生成一套 token。
2. `styles.css` 全量变量化：硬编码的 rgba 文本、阴影、边框、页脚、引言、统计卡、项目卡改为 CSS 变量；暗色下硬阴影改纯黑。
3. 新增主题弹窗（导航与登录页均有入口）：亮/暗切换 + 25 个配色卡片（4 色预览、名称、点赞数），选择即时生效。
4. 偏好存 `localStorage["focus.theme.v1"]`，刷新保留；首次访问跟随系统 `prefers-color-scheme`。
5. 构建脚本复制并版本化 `theme.js`。

**验证**

- 主题弹窗 25 个卡片；「海盐蓝 + 暗色」下 body `#1B365D`、文字 `#A0E0EF`，对比度 8.31:1；hero 6.12:1；计时卡 6.34:1。
- 切换 c02/c04/c05 三套配色，hero 与计时卡背景均随配色变化，localStorage 同步。
- 刷新后 `data-theme` 与背景色保持，登录态保持；控制台 0 错误。
- 回归：注册、登录、计时、保存、统计均正常。


