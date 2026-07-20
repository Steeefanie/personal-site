---
title: 用 Ubuntu Server 搭建可远程维护的《幻兽帕鲁》专用服务器
description: 闲置笔记本安装 Ubuntu Server 后，部署《幻兽帕鲁》专用服务器、EasyTier、自动备份和更新脚本的过程。
attribution: ChatGPT 辅助整理
publishDate: 2026-07-09
lang: zh-CN
tags:
  - { id: linux, label: Linux }
  - { id: palworld, label: 幻兽帕鲁 }
  - { id: self-hosting, label: 自托管 }
  - { id: automation, label: 自动化 }
readingTime: 12 分钟
featured: false
draft: false
---

2026 年 7 月，我把一台闲置笔记本装成 Ubuntu Server，用来运行 6 人以内的《幻兽帕鲁》专用服务器。下面记录最终保留下来的配置、脚本和排障顺序。

## 开始前的准备

- 一台 x86_64 电脑。16 GB 内存足够应付这个规模，独立显卡不是必需品；
- 一个 Ubuntu Server 安装 U 盘，以及安装时临时使用的键盘、显示器和有线网络；
- 路由器管理权限，用于设置 DHCP 静态租约；
- 一台用于 SSH 管理和测试连接的电脑，本文管理端使用 Windows；
- SteamCMD 和 EasyTier 所需的正常网络连接；
- 一个与服务器分开的备份位置。本文先写入本机备份目录，重要存档还应定期复制到其他设备。

安装前先约定名称，后面的服务文件和脚本都沿用这些值：

| 用途 | 示例值 |
|---|---|
| 管理用户 | `steeefanie` |
| 游戏服务用户 | `pal` |
| 主机名 | `palserver` |
| 局域网地址 | `192.168.x.x` |
| EasyTier 服务器地址 | `10.x.x.10` |

## 目标与架构

服务器使用一台配备移动端处理器、16 GB内存和NVMe固态硬盘的闲置笔记本，预计同时在线人数不超过6人。专用服务器几乎不依赖独立显卡，更值得关注的是内存余量、散热、网络稳定性、存档安全和故障恢复。

最后使用的组件如下：

```text
Ubuntu Server
├── OpenSSH：远程管理
├── systemd：托管游戏服务与EasyTier
├── SteamCMD：安装和更新服务端
├── EasyTier：建立虚拟局域网
├── cron：触发定时备份
└── UFW：限制入站端口
```

游戏进程使用独立的 `pal` 用户。远程玩家先加入 EasyTier 虚拟网络，再连接游戏端口，不需要在路由器上做公网端口映射。

## 账户与目录隔离

管理账户使用 `steeefanie`，游戏服务使用无登录需求的专用账户 `pal`。SteamCMD 下载的文件和游戏存档都归 `pal` 所有。

```bash
sudo adduser --disabled-password --gecos "" pal
sudo mkdir -p /home/pal/server /home/pal/backups
sudo chown -R pal:pal /home/pal
```

目录统一如下：

```text
/home/pal/server       服务端程序
/home/pal/server/Pal   游戏数据
/home/pal/backups      备份与维护日志
```

## 局域网与SSH

我在路由器中为服务器网卡设置 DHCP 静态租约，服务器端继续使用 DHCP。当前地址和默认路由可以这样检查：

```bash
ip -br address
ip route
```

安装并启用OpenSSH：

```bash
sudo apt update
sudo apt install -y openssh-server
sudo systemctl enable --now ssh
sudo systemctl status ssh --no-pager
```

Windows端生成Ed25519密钥：

```powershell
ssh-keygen -t ed25519
$ServerLanIp = "192.168.x.x"
type $env:USERPROFILE\.ssh\id_ed25519.pub |
  ssh "steeefanie@$ServerLanIp" "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
```

应先在新终端验证密钥登录，再考虑关闭SSH密码认证；不要在尚未确认密钥可用时直接锁死唯一入口。

## 笔记本长期运行设置

合盖和空闲策略比屏幕是否亮着更重要。服务器应明确禁止睡眠、挂起和休眠：

```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
sudoedit /etc/systemd/logind.conf
```

在 `[Login]` 中设置：

```ini
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
IdleAction=ignore
```

然后重启登录管理服务：

```bash
sudo systemctl restart systemd-logind
```

长期运行时需要保持进风口通畅并适当垫高机身。我使用 `lm-sensors` 和 `thermald` 观察温度：

```bash
sudo apt install -y lm-sensors thermald htop
sudo sensors-detect --auto
sudo systemctl enable --now thermald
sensors
```

## 安装SteamCMD与服务端

Ubuntu需要启用multiverse和i386架构：

```bash
sudo add-apt-repository multiverse -y
sudo dpkg --add-architecture i386
sudo apt update
sudo apt install -y steamcmd lib32gcc-s1
```

切换到服务账户后安装服务端：

```bash
sudo -iu pal
/usr/games/steamcmd \
  +force_install_dir /home/pal/server \
  +login anonymous \
  +app_update 2394010 validate \
  +quit
```

安装完成后，先手动运行一次以确认依赖和文件权限正常：

```bash
cd /home/pal/server
./PalServer.sh
```

看到服务监听8211端口后即可按 `Ctrl+C` 退出。此时出现退出码130只是键盘中断，不是安装失败。

## 使用systemd托管服务

手动测试通过后，使用 systemd 管理开机自启、异常重启、停止信号和日志。

```ini
# /etc/systemd/system/palworld.service
[Unit]
Description=Palworld Dedicated Server
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=pal
Group=pal
WorkingDirectory=/home/pal/server
ExecStart=/bin/bash /home/pal/server/PalServer.sh
Restart=always
RestartSec=10
KillSignal=SIGINT
TimeoutStopSec=120

[Install]
WantedBy=multi-user.target
```

加载并启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now palworld
sudo systemctl status palworld --no-pager
```

常用检查只有三组：

```bash
sudo systemctl restart palworld
journalctl -u palworld -n 100 --no-pager
sudo ss -lunp | grep ':8211'
```

我通常先看 `systemctl status`，再查 `journalctl`，最后用 `ss` 确认 8211/UDP 是否已经监听。

## 使用EasyTier建立虚拟局域网

EasyTier 把玩家设备和服务器放进同一个虚拟网段。共享节点负责发现和协商，条件允许时使用 P2P，穿透失败时改走中继。

网络名、密钥、节点地址和虚拟IP不应直接写进systemd单元。将它们放入仅root可读的环境文件：

```ini
# /etc/easytier/palworld.env
EASYTIER_IPV4=10.x.x.10
EASYTIER_NETWORK=<随机网络名>
EASYTIER_SECRET=<足够长的随机密钥>
EASYTIER_PEER=tcp://<共享或自建节点>:<端口>
```

```bash
sudo chown root:root /etc/easytier/palworld.env
sudo chmod 600 /etc/easytier/palworld.env
```

服务单元只引用环境变量：

```ini
# /etc/systemd/system/easytier.service
[Unit]
Description=EasyTier Palworld Network
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/easytier/palworld.env
ExecStart=/opt/easytier/easytier-core --ipv4 ${EASYTIER_IPV4} --network-name ${EASYTIER_NETWORK} --network-secret ${EASYTIER_SECRET} --hostname palserver -p ${EASYTIER_PEER} --latency-first
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Windows节点应在管理员PowerShell中启动，并使用与服务器不同的虚拟IP：

```powershell
cd C:\Tools\EasyTier
.\easytier-core.exe --ipv4 10.x.x.11 `
  --network-name <同一网络名> `
  --network-secret <同一密钥> `
  --hostname win-client `
  -p tcp://<同一节点>:<端口> `
  --latency-first
```

Windows 等桌面端也可以使用 EasyTier GUI。填入相同的网络名、密钥和共享节点，为每台设备分配不同的虚拟 IP 即可。服务器端仍使用 systemd 托管 `easytier-core`，方便开机启动和查看日志。

连接结果使用 `easytier-cli peer` 检查，主要看目标节点是否出现、连接类型、延迟和丢包。

## 防火墙

启用UFW前先放行SSH，再放行游戏使用的UDP端口：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 8211/udp
sudo ufw --force enable
sudo ufw status verbose
```

确认虚拟网已经可以通过SSH访问后，可以按实际接口名增加窄规则，再删除前面的全接口规则：

```bash
sudo ufw allow in on tun0 to any port 22 proto tcp
sudo ufw allow in on tun0 to any port 8211 proto udp
sudo ufw delete allow OpenSSH
sudo ufw delete allow 8211/udp
```

删除宽规则前必须从另一个终端验证虚拟网SSH，避免把自己锁在服务器外。如果还需要局域网直连，应按实际局域网网段单独放行，而不是恢复任意来源规则。

EasyTier 客户端通常只向共享节点发起出站连接。只有自建监听节点时，才需要按实际配置增加入站规则。

## 世界配置与存档边界

当前世界真正读取的配置位于：

```text
/home/pal/server/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini
```

根目录的 `DefaultPalWorldSettings.ini` 只是模板。修改模板不会自动影响现有世界。正确流程是停服、备份、修改实际配置，再启动并检查日志：

```bash
sudo systemctl stop palworld
sudo cp /home/pal/server/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini \
  /home/pal/backups/PalWorldSettings.ini.before-edit
sudoedit /home/pal/server/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini
sudo chown pal:pal /home/pal/server/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini
sudo systemctl start palworld
```

调整世界倍率通常不需要删除 `SaveGames`。如果需要生成新世界，我会先改名保留整个 `Saved`：

```bash
sudo systemctl stop palworld
sudo mv /home/pal/server/Pal/Saved \
  "/home/pal/server/Pal/Saved_old_$(date '+%F_%H%M%S')"
sudo systemctl start palworld
```

配置中可能包含服务器密码和管理员密码。公开检查时应先遮盖敏感字段：

```bash
sudo sed -E \
  's/(ServerPassword=")[^"]*/\1****/; s/(AdminPassword=")[^"]*/\1****/' \
  /home/pal/server/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini
```

## 备份策略

备份按时间分层保留：最近 3 天保留小时版本，之后每天保留一个版本，31 天后清理。文件名使用时间戳，并通过 `flock` 防止任务重叠。

核心脚本结构如下：

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

SAVE_DIR="/home/pal/server/Pal/Saved"
BACKUP_DIR="/home/pal/backups/hourly"
STAMP="$(date '+%F_%H%M%S')"
TARGET="$BACKUP_DIR/palworld-$STAMP.tar.gz"

mkdir -p "$BACKUP_DIR"
exec 9>/tmp/backup-palworld.lock
flock -n 9 || exit 0

test -d "$SAVE_DIR"
tar -czf "$TARGET" -C /home/pal/server/Pal Saved
chown pal:pal "$TARGET"
chmod 640 "$TARGET"

find "$BACKUP_DIR" \
  -type f -name 'palworld-*.tar.gz' -mtime +3 \
  ! -name 'palworld-????-??-??_0005??.tar.gz' -delete

find "$BACKUP_DIR" \
  -type f -name 'palworld-????-??-??_0005??.tar.gz' \
  -mtime +31 -delete
```

通过root的cron每小时执行：

```text
5 * * * * /usr/local/bin/backup-palworld >> /home/pal/backups/backup-palworld.log 2>&1
```

小时备份在服务运行期间打包。更新前则先停服再备份，并定期检查压缩包能否解开、是否包含配置和世界目录。

## 更新必须可回退

更新脚本按下面的顺序执行：

```text
获取排他锁
→ 检查SteamCMD、服务目录和存档目录
→ 记录更新前buildid
→ 停止服务
→ 备份Saved
→ 以pal用户执行SteamCMD更新和校验
→ 启动服务
→ 检查systemd状态、buildid和8211/UDP
→ 成功后再清理过期备份
```

关键更新命令仍然以服务账户运行：

```bash
sudo systemctl stop palworld
sudo -u pal /usr/games/steamcmd \
  +force_install_dir /home/pal/server \
  +login anonymous \
  +app_update 2394010 validate \
  +quit
sudo systemctl start palworld
```

脚本设置错误陷阱：更新失败时尝试重新启动服务，并保留更新前备份和完整日志。版本是否变化可以比较 `steamapps/appmanifest_2394010.acf` 中更新前后的 `buildid`。

## 分层排障

远程玩家无法进入时，我按下面的顺序检查：

```text
1. palworld.service是否运行
2. 8211/UDP是否监听
3. easytier.service是否运行
4. easytier-cli peer能否看到目标节点
5. 虚拟IP能否互通
6. 世界配置和存档是否有效
```

对应命令：

```bash
sudo systemctl status palworld --no-pager
sudo ss -lunp | grep 8211
sudo systemctl status easytier --no-pager
easytier-cli peer
journalctl -u palworld -n 100 --no-pager
journalctl -u easytier -n 120 --no-pager
```

EasyTier 日志中的 `handshake timeout`、`connect timeout` 和 `Connection reset by peer` 对应不同连接阶段。域名能解析后，还要继续确认 TCP、EasyTier 握手和目标 peer。

单元配置了 `Restart=always` 后，直接杀进程会被 systemd 重新拉起。修改配置前先 `systemctl stop`，修改单元后执行 `daemon-reload`，再重新启动。
