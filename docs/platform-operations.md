# 账号、会员、布局和接力

## 发布状态与开关

触屏布局编辑无需第三方配置，游戏内「菜单 → 编辑触屏布局」即可使用。其他服务默认关闭，部署成功不代表真实短信和付款已经验收。

`GET /api/capabilities` 返回 `auth`、`payments`、`relays`、`touchEditor`。开关要求对应值为字符串 `true`，且所依赖的配置全部存在；任一缺失时前端提示尚未开放。生产环境没有模拟验证码、模拟登录或模拟支付入口。

数据库也采用显式开关：GitHub仓库 Settings / Secrets and variables / Actions / Variables 中的 `PLATFORM_DATABASE_ENABLED` 默认为 `false`。只有部署令牌已具备该账号D1编辑权限时，才将其设为 `true` 并重新运行部署；此时CI先执行迁移，再绑定数据库并发布。关闭时可独立发布触屏编辑和页面，账号相关服务保持关闭。首次尝试D1配置时API返回HTTP 401，因此不能将数据库视为已创建或迁移完成。

其他构建开关也使用同一位置的GitHub仓库变量：`PLATFORM_AUTH_ENABLED`、`PLATFORM_PAYMENTS_ENABLED`、`PLATFORM_RELAYS_ENABLED`，默认全部为 `false`；管理员白名单变量为 `PLATFORM_ADMIN_USER_IDS`。构建将它们映射为Worker运行时的 `AUTH_ENABLED` 等值。关闭的功能不声明其供应商必填Secrets，避免未接入服务阻塞整个站点发布。开关改动后必须重新部署；不要只在Worker后台修改这些派生开关。

在 Cloudflare Worker 的 Settings / Variables and Secrets 中配置下列供应商密钥，敏感值用 Secrets。运行时开关和管理员ID由上述GitHub仓库变量生成。不要把配置值发到代码、日志、Issue 或聊天中。正式开关在联调验收后开启。

| 配置 | 说明 |
| --- | --- |
| `AUTH_ENABLED` | 验收短信后设置 `true` |
| `PAYMENTS_ENABLED` | 三种付款场景全部验收后设置 `true` |
| `RELAYS_ENABLED` | 账号及接力真机验收后设置 `true` |
| `AUTH_SECRET` | 独立、高熵随机密钥，用于手机号检索摘要和验证码摘要 |
| `PHONE_ENCRYPTION_KEY` | 随机32字节AES密钥的标准Base64编码 |
| `ALIYUN_ACCESS_KEY_ID`、`ALIYUN_ACCESS_KEY_SECRET` | 只具备所需短信发送权限的阿里云凭证 |
| `SMS_SIGN_NAME`、`SMS_TEMPLATE_CODE` | 已审核签名与验证码模板，模板变量为 `code` |
| `TURNSTILE_SITE_KEY`、`TURNSTILE_SECRET` | 绑定当前域名的人机验证站点；服务端验证 action=`sms_login` |
| `WX_MCH_ID`、`WX_APP_ID` | 直连商户号及已关联、支持网页授权的公众号AppID |
| `WX_PRIVATE_KEY`、`WX_SERIAL_NO` | 商户PKCS#8 PEM私钥、商户API证书序列号 |
| `WX_API_V3_KEY` | 微信APIv3的32字节密钥 |
| `WX_PUBLIC_KEY`、`WX_PUBLIC_KEY_ID` | 微信支付公钥模式的SPKI PEM公钥及对应公钥ID，非商户公钥 |
| `WX_APP_SECRET` | 公众号网页授权所需密钥，仅用于付款OpenID |
| `ADMIN_USER_IDS` | 逗号分隔的账号ID白名单；登录后 `/api/me` 可查看自己的ID |

密钥须在部署前通过上述安全配置渠道提供，不在仓库维护。更换 `AUTH_SECRET` 会改变手机号唯一检索摘要，更换手机号加密密钥也需要数据迁移，不能直接随机替换已有生产密钥。

## 支付配置

本版为普通直连商户，使用APIv3、公钥验签模式。需开通 Native、H5、JSAPI；H5域名、公众号网页授权域名和JSAPI授权目录应匹配实际域名。

- 支付通知：`https://play.accemarket.com/api/payments/wechat/notify`
- 退款通知：`https://play.accemarket.com/api/payments/wechat/refund-notify`
- 网页授权回调：`https://play.accemarket.com/api/payments/wechat/oauth/callback`

公众号网页授权只获取付款所需OpenID，不用于注册、登录或自动合并账号。支付和退款通知验签、解密后才更新订单及权益；前端返回页面不作为付款成功证据。

月卡990分/30天，年卡6900分/365天，人民币，不自动续费。商品价格只在服务端定义。续费从剩余有效期结束后累计；全额退款撤销对应订单贡献的时长。部分退款标记 `needs_review`，需人工处理，不自动按全额撤权。本版不提供站内退款申请，商户后台办理退款时必须配置退款通知地址。

定时任务对超时未支付订单查单及关单，支付延迟通知仍会被正常核实并处理。回调失败需通过日志、订单查单和商户记录核实，不能手工伪造“支付成功”接口。

## 数据库与环境隔离

现有生产Worker、R2桶不改名；新增D1 `retro-arcade-platform`。测试环境使用独立Worker `retro-arcade-staging`、D1 `retro-arcade-platform-staging`、R2 `retro-arcade-staging-resources`。

启用数据库开关后，CI在发布Worker前运行 `deploy/migrate-platform.mjs`：查询/创建数据库、执行尚未记录的增量迁移。部署凭证需要本账号的D1编辑权限，以及已有Worker/R2权限。迁移失败会停止发布。新增已发布迁移应使用新编号，不修改已应用文件。回退优先关闭服务开关和回退Worker版本，不删除数据库、用户存档或已支付订单。

推送main触发生产部署。手动运行同一GitHub Actions工作流可选择staging（默认）或production。staging不执行向生产桶上传资源的步骤，且Secrets需要分别配置。

本地隔离验证可用现有Miniflare依赖提供的D1/R2模拟。仓库当前附带的workerd最高支持2026-10-07，隔离数据库验证使用该兼容日期，生产沿用项目2026-10-31。按照AGENTS要求，验证脚本置于仓库之外，不为发布新增测试文件。

## 资料与存档兼容

- 老游客、本地存档、原有 `/api/sync/*` 保持可用。账号云存档存放 `account-saves/<user>/`，接力快照存放 `relay-saves/<relay>/`，不会被游戏缓存淘汰。
- 登录不会静默迁移或删除旧资料；用户从账号页明确选择导入本机资料/旧同步码存档。同步码导入按稳定ID复制，重试不会增加重复条目。
- 账号云存档免费100MB/300条，会员1GB/3000条。上传使用数据库配额预留，失败释放预留，旧对象在确认失去引用并经过宽限期后清理。
- 布局按平台保存，每个预设包含横竖屏配置。免费1套、会员5套；过期不删除额外预设，超额预设只读。可删除预设或续费。
- 修改云端布局使用版本号，冲突不会直接覆盖。账号页明确让用户选择本机或云端；同步失败保留本地配置。

## 挑战与管理

所有登录账号均可接力，会员不影响参与。每天最多发起3场，每场有效7天、最多50棒；每次接棒30分钟，放弃或超时后可由其他人接棒。接力快照单份最多4MB，结束后保留30天，之后清理附件但保留文字记录。

访客能浏览公开列表和详情，下载存档需登录。后台绑定游戏、核心及资源版本；资源更新后旧挑战只保留浏览能力，不能继续接棒。完成状态由发起人声明，不代表服务器已验证通关。

玩家可举报。管理员登录后打开 `/#/moderation` 处理举报及下架；权限由服务端 `ADMIN_USER_IDS` 检查。账号ID不包含手机号，公开页面不显示手机号或同步码。

## 验证记录和待验收

已使用隔离D1/R2、独立测试密钥和模拟供应商响应验证短信登录、验证码重用、会话退出、账号隔离、配额、布局版本冲突、Native/H5/JSAPI协议流程、支付验签、重复回调、续费、整单退款、公开挑战、并发抢棒及幂等提交。测试不发送真实短信、不进行真实扣款、不修改生产用户数据。

正式开放还需真实服务配置及人工验收：验证码到达、三种付款场景及商户退款、跨设备存档、手机横竖屏/多指/编辑取消恢复，以及FC/GBA/街机各至少一款实际试玩。浏览器交互工具不可用时，不把构建或接口测试描述成实际试玩通过。

主要参考：[阿里云ACS3签名](https://help.aliyun.com/en/sdk/product-overview/v3-request-structure-and-signature)、[微信支付产品](https://pay.wechatpay.cn/doc/v3/merchant/4012068590)、[退款通知](https://pay.wechatpay.cn/doc/v3/merchant/4012791906)、[D1接口](https://developers.cloudflare.com/d1/worker-api/d1-database/)。
