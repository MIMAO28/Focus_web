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
- 选题与需求分析顺延至 P04。

---

## P04 · 2026-11-17 · 选题与需求分析

**阶段**：需求分析

**目标**：确定选题，完成需求、验收标准与技术方案，作为后续开发的基线。

**选题**：逐句精听（EchoLine）—— 本机单人使用的听力精听训练 Web 应用；导入自己的音频与原文，自动分句对齐，逐句循环听写并自动批改。

**主要决策**

1. 形态用本地 Web 应用（FastAPI + 原生前端），不引入 Node 构建，便于一条命令运行与课堂演示。
2. 本机未安装 ffmpeg，音频解码与静音检测改在浏览器 Web Audio API 完成，避免额外安装。
3. 分句用 DeepSeek，本地标点规则兜底；批改用本地词级 diff，DeepSeek 只做错因解释，保证结果可复现。
4. 密钥只放本机 `.env`，日志脱敏，音频与数据库只在 `data/`。
5. 不新增技能：已有全局技能覆盖界面设计、UI 验证与文档；音频与 AI 能力由代码实现。

**产出文件**

- 新增 `docs/requirements.md`（功能清单、AC1–AC10 验收标准、技术方案、数据模型、里程碑、风险）
- 更新 `README.md`（选题、状态、目录结构）
- 更新 `docs/dev-log.md`（本条）

**下一步**

- P05：搭建 FastAPI 骨架、SQLite 建表、首页与素材上传（F1 部分）。


