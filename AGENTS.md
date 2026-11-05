# 部署流程

本项目使用 Cloudflare `cf` CLI。部署配置以 `cloudflare.config.ts` 为准，自动部署流程见 `.github/workflows/cloudflare.yml`。

## 常规发布

1. 检查 `git status --short` 和 diff，确认本次要发布的文件；只暂存本次改动。
2. 在项目根目录验证：

   ```sh
   git diff --check
   PATH=/usr/local/bin:$PATH npm run build
   PATH=/usr/local/bin:$PATH npx cf deploy --prebuilt --mode production --dry-run
   ```

   对修改的 JavaScript 文件执行 `node --check <文件路径>`。项目当前没有测试脚本；需要测试时使用已有验证命令，不为发布新增测试文件。

3. 执行 `git fetch github main`，检查本地与 `github/main` 的差异。确认远程没有尚未处理的提交，再提交并推送：

   ```sh
   git add <本次改动的文件>
   git diff --cached --check
   git commit -m 'type: 中文提交说明'
   git push github main
   ```

4. 推送 `main` 会触发 GitHub Actions。获取完整提交 SHA，找到对应的部署任务并等待结束：

   ```sh
   git rev-parse HEAD
   gh run list --repo working-with-ai/retro-arcade --commit <完整SHA> --limit 3 --json databaseId,headSha,status,conclusion,url
   gh run watch <databaseId> --repo working-with-ai/retro-arcade --exit-status --interval 10
   ```

   工作流依次安装依赖、构建、部署预检、上传游戏及模拟器资源到 R2、发布 Worker 和静态资源。只有对应提交的任务显示 `completed` 且 `conclusion=success`，才算 CI 部署成功；失败时查看该任务日志定位原因。

5. 部署后核验 `https://play.accemarket.com`：页面和修改的静态文件可访问；涉及视频时，检查 `/api/videos/<game.id>` 返回有效元数据，`/videos/<game.id>` 的 Range 请求返回 `206`，并抽查详情页实际播放。
6. 报告提交 SHA、部署任务链接、线上验证结果及尚未解决的问题。推送成功和部署成功分开确认。

## 视频资源

`media/videos/` 被 Git 忽略，本地视频不会随代码推送或由现有 CI 自动上传。视频应单独通过 `cf` 上传到 `pokemon-dark-phantom-resources` 的 `videos/<game.id>/clip.mp4`，已有视频可用 `npm run videos:sync` 同步；上传后核对文件大小、校验和和线上 Range 响应。

视频目录使用页面的 `game.id`。例如漆黑的魅影使用 `pokemon-dark-phantom`，其上游数字 ID `1713536658` 对应的对象不能替代这个目录。

## 手动部署

用户明确要求手动发布，或需要绕过已定位的 CI 问题时，在上述构建和部署预检通过后执行 `npm run deploy`。使用 `cf auth whoami` 确认账号；凭证使用本地登录或环境变量，避免写入仓库。手动部署同样需要完成线上核验。
