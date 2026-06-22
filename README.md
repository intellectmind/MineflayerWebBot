# Mineflayer Web Bot

基于 Mineflayer 的网页机器人管理面板。

## 主要功能

- 多 Bot 管理：新增、删除、全部上线、全部下线。
- 离线模式 / Microsoft 正版登录。
- AuthMe 自动登录、自动注册、进服后多条自定义指令。
- 集成视角页面，支持第一人称 / 第三人称、清晰度、悬浮视角窗口。
- 键鼠控制：W/A/S/D、空格、Shift、Ctrl、鼠标转向、左右键、滚轮/数字 1-9 快捷栏。
- 在线背包页面，内置背包和 web-inventory 代理。
- 操作页面：移动、战斗、玩家、方块、容器、守卫、自动挖矿、砍树集中在一个页面。
- 默认安装 Mineflayer 常用增强插件。
- 系统页面支持核心依赖在线检查和更新。

## Windows 一键启动

解压后双击：

```text
Windows_start.bat
```

首次启动会自动完成：

1. 检查或下载便携 Node.js v22+。
2. 生成 `config/app.json`。
3. 安装运行依赖和默认插件。
4. 检查 `canvas / prismarine-viewer` 等依赖。
5. 启动 Web 面板并打开浏览器。

默认地址：

```text
http://127.0.0.1:15666/
```

管理员密码会在启动窗口显示，也保存在 `config/app.json` 的 `web.adminPassword`。

## Linux

```bash
chmod +x start.sh
./start.sh
```

## 视角页面

左侧菜单的“视角”页面用于显示 Bot 当前画面。

- 支持第一人称 / 第三人称切换。
- 支持流畅 / 均衡 / 清晰三种清晰度。
- 支持打开悬浮视角窗口，并可拖动和调整大小。
- 外部只需要开放主端口 `15666`，每个 Bot 的 viewer 端口仅用于本机代理。

## 键鼠控制

进入“操作”页面或“视角”页面后，点击“开启键盘控制”，可以用：

```text
W / A / S / D
空格 / Shift / Ctrl
鼠标移动转向
鼠标左键 / 右键
数字 1-9 或鼠标滚轮切换快捷栏
Esc 退出控制
```

控制当前选中的 Bot。开启后浏览器会尝试进入鼠标锁定模式；如果没有锁定，先点击一次页面顶部的控制提示条。

## 自动挖矿和砍树

操作页面支持：

```text
自动挖矿：留空默认采集常见矿物，也可指定方块名，例如 diamond_ore deepslate_diamond_ore
砍树：留空默认采集各种 log/stem，也可指定 oak_log spruce_log
```

寻路默认允许挖方块和搭 1x1 柱，配合 collectblock / tool / blockfinder 插件使用。

## AuthMe 与进服指令

Bot 配置里支持：

```text
AuthMe 登录命令：/login {password}
AuthMe 注册命令：/reg {password} {email}
AuthMe 邮箱：example@example.com
进服后指令：每行一条，例如 /server survival
```

可用占位符：

```text
{password}
{email}
{username}
```

## Microsoft 登录

第一次启动 Microsoft 模式 Bot 时，Web 会显示登录码和“打开微软登录”按钮；授权成功后 token 会缓存到：

```text
data/microsoft-auth/<botId>
```

下次启动同一个 Bot 不需要重复登录。