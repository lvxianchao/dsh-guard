# dsh-guard

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）Web UI 加一道**密码闸门**：一个插件同时解决四件部署上的麻烦事。

[English](README.md)

| 麻烦 | 原生表现 | dsh-guard |
|---|---|---|
| 没有人类登录 | 只有进程启动时打印的 `?token=`，重启就换 | 一个访问密码 + 可吊销会话 |
| 反代一律 403 | `/api` 栅栏要求 `Host` 原样转发，NPM/Caddy 通常会改写 | 代理把 `Host`/`Origin` 改写成回环 authority，天然放行 |
| token 要挖日志 | `journalctl \| grep token` 才能进站 | 进程内自动兑换，浏览器永远见不到 token |
| 明文 HTTP 功能报错 | 非安全上下文下 `crypto.randomUUID is not a function` | 注入 polyfill 兜底 |

零运行时依赖（只用 Node 标准库），没有构建步骤，`dsh plugin add` 装完即跑。

## 它怎么工作

```
浏览器 ──HTTP(S)──> dsh-guard :3081 ──> DSH 监听器 (回环)
                        │
                        ├─ 未登录：/login
                        ├─ 已登录：转发，Host/Origin 改写为回环 authority
                        └─ 注入 DSH cookie（浏览器不可见）
```

DSH 的 `/api` 栅栏接受回环 authority；代理让每个上游请求都看起来来自回环，所以不再 403。密码验证发生在代理里，**不是前端遮罩**——没有 cookie 的请求在进入 DSH 之前就被挡下。

## 安装

```bash
# npm（发布后）
dsh plugin --profile web add dsh-guard

# 本地目录 / Git
dsh plugin --profile web add /path/to/dsh-guard
dsh plugin --profile web add "github:you/dsh-guard"
```

然后在 `~/.dsh/profiles/web/cordis.patch.yml` 里加：

```yaml
- insert:
    - id: guard
      name: dsh-guard
      config:
        listenHost: '0.0.0.0'
        listenPort: 3081
```

重启 `dsh`。**首次启动会自动生成一个密码**，打印在终端并保存到 `$DSH_HOME/dsh-guard.json`（0600）。想固定密码就配 `password` 或 `passwordHash`。

> 前提：DSH 自己必须绑回环（默认就是 `127.0.0.1`）。如果它绑在局域网 IP 上，客户端可以绕过闸门直连——插件启动时会检测并告警。

## 三种部署拓扑

**1. 直接暴露（没有反代）** —— 让插件自己终结 TLS：

```yaml
config:
  listenHost: '0.0.0.0'
  listenPort: 8443
  tls:
    certFile: /path/fullchain.pem
    keyFile: /path/privkey.pem
```

浏览器访问 `https://<host>:8443`，会话 cookie 自动带 `Secure`。DNS 指过来、只开一个端口即可。

**2. 反代之后（NPM / Caddy / Traefik）** —— 反代只做 TLS，认证交给插件：

反代上游填 `http://<dsh-host>:3081`，开启 WebSocket。**不需要**任何 Host 改写配置——这正是本插件要消掉的那部分。

**3. 纯局域网** —— 明文 HTTP + 密码，最简单，也最不安全（会话 cookie 可被嗅探）。

## 语言

登录页和管理页跟随 DSH 的语言设置：插件读取 profile patch 文件
（`~/.dsh/profiles/web/cordis.patch.yml`）里 `locale` 行的 `preference`，
也就是 DSH 设置界面写入的同一个位置。目前支持中文和英文。没有显式偏好时，
按浏览器的 `Accept-Language` 回退。

## 配置

| 键 | 默认 | 说明 |
|---|---|---|
| `listenHost` | `0.0.0.0` | 闸门监听地址 |
| `listenPort` | `3081` | 闸门端口，不能与 DSH 端口相同 |
| `password` | — | 明文密码（启动时哈希） |
| `passwordHash` | — | `scrypt$N$r$p$salt$key`，优先于 `password` |
| `sessionDays` | `7` | 会话时长；`0` = 关浏览器即失效 |
| `maxAttempts` | `5` | 连续失败次数，超过临时锁定 |
| `lockMinutes` | `5` | 锁定时长 |
| `polyfill` | `true` | 注入 `crypto.randomUUID` 兜底 |
| `title` | `DeepSeek Harness` | 登录页标题 |
| `tls` | `null` | `{certFile, keyFile}`，启用 HTTPS |

生成密码哈希：

```bash
node -e "import('./lib/auth.js').then(m=>console.log(m.hashPassword(process.argv[1])))" 'your-password'
```

## 安全模型

- 密码用 scrypt（随机盐）哈希；明文只在"自动生成密码"那一行日志里出现一次。
- 会话 token 服务端只存 SHA-256 摘要；cookie 是 `HttpOnly` + `SameSite=Lax`，启用 TLS 时加 `Secure`。
- 登录 POST 校验 `Origin` 的 hostname 与请求 `Host` 一致（只比 hostname，因为反代常剥端口）。CSRF 的第一道防线仍是 `SameSite`。
- 同一 IP 连续失败会临时锁定（内存计数，重启清零）。
- `/logout` 只退当前浏览器；要全部吊销就改密码并重启，或删掉 `$DSH_HOME/dsh-guard.json`。

**这不是多用户系统**：一个密码，一个权限级别。DSH 的 agent 本身能执行代码，任何登录者都拥有该机器的执行权限——这是产品设计，不是闸门的缺陷。

## 管理页

登录后 DSH 界面右下角会出现一个盾牌按钮，点开就是 `/__guard/admin`（也可以直接把地址收藏起来）：

- 修改登录密码（必须验证当前密码）
- 会话有效期、失败锁定次数与时长、页面标题、GitHub 链接 —— **保存即生效**
- 监听地址/端口 —— 标注「重启后生效」
- 活跃会话列表（来源 IP、浏览器、最后活动）：可以踢名单个设备，或一键退出所有设备

未登录访问管理页只会被弹回登录页，且不保留跳转路径；登录页上不出现任何管理入口。

**为什么不做成 DSH 设置页里的一项**：那需要 `dsh.client` 前端模块和构建产物（React + 打包），插件会从约 30 KB 涨到几百 KB，给一个本来没有构建链的项目引入工具链，还会绑死仍在变动的 slot API —— 版本对不上时整个设置页可能白屏。独立页面零构建、零依赖，DSH 升级也不受影响。

## 排障

| 现象 | 原因 |
|---|---|
| `502 upstream unreachable` | DSH 没起，或 `listenPort` 撞了 |
| 一直跳 `/login` | 浏览器没带 cookie；检查是否混用了 HTTP/HTTPS 两个地址（cookie 不共享） |
| 登录后立刻弹回 | 客户端与主机时间偏差导致会话判定过期 |
| 界面报 `randomUUID` | 把 `polyfill` 关掉了 |
| 局域网能直连 DSH 端口 | DSH 绑的不是回环，见启动告警 |

日志统一带 `[dsh-guard]` 前缀，与 DSH 自身日志在同一个 journal 里。成功请求不记录（Web UI 会持续轮询），只记失败和慢请求。

## 开发

```bash
# 影子实例：复用真实 profile，但不改动它
dsh --profile web --patch ./dev.yml --host 127.0.0.1 --port 3099 --no-open

# 对运行中的闸门跑 e2e
GUARD_URL=http://127.0.0.1:3081 GUARD_PASSWORD=... node test/e2e.mjs
```

`dev.yml` 只需要上面那段 `insert`，把 `listenHost` 改成 `127.0.0.1`、端口换开即可。

插件只用了公开的 harness API：`webServer.register`、`webServer.tapIndex`、`webServer.getOrigin`、`connection.authenticatedUrl`。没有猴子补丁，没有改源码。

## License

MIT
