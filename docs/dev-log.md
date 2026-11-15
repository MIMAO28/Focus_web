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
- 待本人另发选题指令后进入 P02：选题与需求分析。
