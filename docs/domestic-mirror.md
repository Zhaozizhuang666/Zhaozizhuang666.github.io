# 国内镜像与 GitHub Pages 同步

同一仓库、同一次 `main` 推送更新两个独立站点：GitHub Pages 继续使用当前分支发布，新增工作流构建经过检查的公开资源并上传到腾讯 CloudBase。两个站点分别验证；CloudBase 失败不会停用 GitHub Pages。没有配置国内托管时，Actions 明确显示 **NOT DEPLOYED**，不能把跳过步骤当作发布成功。

## 首次开通

1. 在已实名认证的腾讯云账号下打开 [CloudBase 控制台](https://tcb.cloud.tencent.com/dev)。选择已经开通的环境，不要重复购买。静态网站无需云数据库、在线模型或付费个人版的专属能力。
2. 在上海环境的「Web 应用 / 静态网站托管」中启用静态托管，复制控制台实际显示的 HTTPS 访问域名。使用网站专用环境根目录；不要猜测域名，也不要开启网站登录要求。若默认域名显示访问期限、访问频率或其他限制，先核对平台当前提示。自定义大陆域名需满足平台备案要求。
3. 在环境的 API Key 管理处创建权限限定于此环境的部署凭证。不要使用账号级 SecretId/SecretKey，不要将密钥发到聊天、源文件或网页中。
4. 在 [仓库 Actions 设置](https://github.com/Zhaozizhuang666/Zhaozizhuang666.github.io/settings/secrets/actions) 添加两个 **Repository secrets**：`CLOUDBASE_ENV_ID`（环境 ID）、`CLOUDBASE_API_KEY`（环境级 API Key）。在 Variables 中添加 `CLOUDBASE_SITE_URL`（控制台的完整 HTTPS 根地址），最后添加 `CLOUDBASE_ENABLED=true`。
5. 在 Actions 中手动运行 **Verify and sync website mirrors**。测试和安全构建先执行，CloudBase 登录仅发生在部署步骤；只有 HTTPS 内容与当前提交逐文件匹配后才报告成功。首次成功后，后续正常推送自动同步。

GitHub Pages 的 Settings → Pages 保持当前 `main` 根目录分支发布配置。不要另行接入冲突的 `deploy-pages` 工作流。

## 公开范围和验证

`python3 scripts/build-public-site.py` 构建 `dist/`。仅 Git 已跟踪且明确允许的网页、脚本、图片、字体、数据和学习资料进入产物。排除后端、测试、工具、原始相册、工作文档、Office 附件与认证目录；PDF 仅保留原先批准的两份。构建检查资源清单、PDF 哈希、网页链接、片段和敏感内容，拒绝符号链接。`release.json` 记录当前提交和文件 SHA-256，不包含密钥。

本地验证：

```sh
node --test tests/*.test.mjs
python3 scripts/check-learning-resources.py
python3 scripts/build-public-site.py
python3 scripts/verify-public-release.py --artifact dist --url https://zhaozizhuang666.github.io/ --identity optional
```

CloudBase 的验证改为控制台确认的域名并使用 `--identity required`。GitHub Pages 没有构建生成的 `release.json`，所以其分支发布通过完整文件哈希比对验证。两站的运行资源来自同一提交，国内镜像只额外提供构建清单。

主页面使用随站点发布的 Outfit 字体，无需访问 Google Fonts。普通导航和学习资源使用相对地址；小艺的本站参考资料会映射到当前访问域名，外部论文和独立上游项目保持原地址。Xiaoyi 仍为站内本地知识助手，镜像不会启用在线模型或同步访客记忆。不同站点的浏览器存储独立。

发布使用固定的官方 CLI `@cloudbase/cli@3.9.1` 和 `scripts/deploy-cloudbase-site.py`。包装器先盘点远端可见文件，下载并验证上一版本的 `release.json` 和首页／小艺文件，再上传当前公开内容。任何未知可见文件都会中止发布，不执行覆盖或删除。上传时保留旧版本清单；当前文件的 HTTPS 哈希全部通过后，只逐项删除旧清单中已撤回的精确路径并确认公开地址返回 404，最后提交新清单并进行完整验证。因此中途上传或清理失败时，旧清单仍可用于重试；失败不能算作同步成功。

CloudBase 自动生成并保护 `__auth/` 和 `cloud-admin/` 两个目录；包装器只排除这两个精确目录前缀，保留平台文件，绝不上传、删除或覆盖其中的内容。公开产物和旧版本清单均不得声称拥有这些路径。近似名称及其他未知路径仍会中止发布。

根目录部署省略可选的 `cloudPath` 参数，不传 `/`。CLI 3.9.1 在共享托管中会保留本地验证清单路径前面的 `/`，而实际上传对象已去掉该前缀，导致文件已上传却全部被判定缺失。包装器和回归测试均固定使用无前导斜杠的根路径语义。

部署前还会检查其余可见网站对象的大小是否符合旧版或当前版本清单。此项和两个 canary 哈希用于确认专用环境的已有内容；完整逐文件 HTTPS 哈希验证在上传后执行，避免每次启动数百个独立 CLI 下载进程。

首次部署仅允许专用托管根目录中除上述平台保留目录外没有其他文件，先写入当前清单作为可重试的初始化标记，随后仍须完成全部网页、资源及清单验证才能报告成功。相同版本可重复发布；不同版本中断留下的无法识别文件会停止后续发布，需先人工检查。

不使用 CLI 的 `--safe` 或 `--prune`：3.9.1 的公开备份 `.cloudbase-backup/` 不会自动清理，而 `hosting list` 和目录删除默认看不到点号对象；`--prune` 的逐文件删除失败也可能仍返回成功。此流程不生成备份目录、不进行宽泛目录删除，只管理经清单确认的普通公开路径。CLI 无法证明旧有点号文件不存在；必须使用专用新环境，勿混放其他项目。不能把可见清单校验描述为整个存储桶的完整隐藏对象审计。撤回材料必须同时核实两站的旧公开地址已不可访问，不能只删除页面链接。

## 免费环境和维护

核实日期：2026-11-08。[官方定价](https://cloudbase.net/pricing)当前说明每账号可创建一个免费环境、每月 3,000 资源点、每次续期 6 个月；具体以当前账号控制台为准。不能把历史「1 GB / 5 GB」说明当作持续有效的承诺。无需为本站另购个人版；若已购买其他套餐，沿用已开通环境并核对续费与超额计费设置。

本次环境控制台显示有效期至 **2027-05-08**；当前部署 API Key 的 30 天有效期至 **2026-12-08**。到期前需在控制台续期环境、轮换部署凭证并更新仓库 Secret，否则后续双站点自动同步会失败。文档不保存凭证值。

CloudBase 默认域名定位为开发／测试地址，存在访问频率限制，不能承诺作为长期稳定的公众网站入口。需要稳定向国内学生分享时，应绑定符合平台要求的自定义域名，更新 `CLOUDBASE_SITE_URL` 并重新核验；大陆加速域名须完成相应备案。当前测试域名仅作为临时镜像验证入口，保留 GitHub Pages 链接。

首次部署后还需用大陆网络实际打开主页、知识库、学习资源、图片和 PDF；HTTPS 与哈希通过不能替代不同校园网络的连通性检查。将验证过的国内地址发给国内访客，保留 [GitHub Pages](https://zhaozizhuang666.github.io/) 作为另一入口。只有两个站点都验证通过后才宣布双站点同步完成。

官方参考：[安装](https://docs.cloudbase.net/cli-v1/install) · [登录与环境级 API Key](https://docs.cloudbase.net/cli-v1/login) · [静态文件部署](https://docs.cloudbase.net/cli-v1/hosting/deploy) · [静态托管概述](https://docs.cloudbase.net/hosting/introduce)。

## 当前访问入口与实测记录

- GitHub Pages：https://zhaozizhuang666.github.io/
- CloudBase 临时镜像：https://evident-perch-d5gh4ja4h948de79a-1445323010.tcloudbaseapp.com/

2026-11-08：提交 `92d7dcf622fd85ec876a8aabeed4459be3ef254a` 的 [GitHub Actions 运行 42447142404](https://github.com/Zhaozizhuang666/Zhaozizhuang666.github.io/actions/runs/42447142404) 全部通过：本地行为／构建验证、GitHub Pages 校验、CloudBase 发布三个任务均成功。两个站点分别通过 **337/337 个公开内容文件**的 HTTPS 大小与 SHA-256 比对；CloudBase 的 `release.json` 同时确认当前干净提交身份，本机独立复查也分别通过 337/337 文件。后续推送沿用这套自动同步流程，每次仍以对应 Actions 结果和公开文件校验为准。

公开 CloudBase 站点已在浏览器检查主页、中文切换、小艺 VLA 回答与本站来源、知识库、使用手册、VLA Guide、AI 算力网络资源及 390px 移动布局。首次访问测试域名可能显示平台的“页面访问提示”，确认后进入网站；该提示不属于本站登录，不应要求访客输入账号或密钥。测试域名存在平台访问限制，长期分享仍应使用符合平台要求的自定义域名，不能将当前实测扩展为所有校园网络的可用性保证。

维护期限保持为：环境 **2027-05-08**、部署 API Key **2026-12-08**。续期或轮换后更新仓库配置，再运行工作流验证。此前的项目目录认证、平台保留目录及根路径校验问题均已修复，并纳入回归测试；详见仓库 [QA 记录](../QA.md)。
