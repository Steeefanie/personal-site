---
title: 使用 Ubuntu Server 架設可遠端維護的《幻獸帕魯》專用伺服器
description: 閒置筆電安裝 Ubuntu Server 後，部署《幻獸帕魯》專用伺服器、EasyTier、自動備份和更新指令碼的過程。
attribution: ChatGPT 協助整理
publishDate: 2026-07-09
lang: zh-TW
tags:
  - { id: linux, label: Linux }
  - { id: palworld, label: 幻獸帕魯 }
  - { id: self-hosting, label: 自架服務 }
  - { id: automation, label: 自動化 }
readingTime: 12 分鐘
featured: false
draft: false
---

2026 年 7 月，我把一台閒置筆電安裝成 Ubuntu Server，用來執行 6 人以內的《幻獸帕魯》專用伺服器。下面記錄最後保留下來的設定、指令碼與排錯順序。

## 開始前的準備

- 一台 x86_64 電腦。16 GB 記憶體足以應付這個規模，獨立顯示卡不是必需品；
- 一個 Ubuntu Server 安裝 USB，以及安裝時暫時使用的鍵盤、螢幕與有線網路；
- 路由器管理權限，用於設定 DHCP 固定租約；
- 一台用於 SSH 管理和測試連線的電腦，本文管理端使用 Windows；
- SteamCMD 與 EasyTier 所需的正常網路連線；
- 一個與伺服器分開的備份位置。本文先寫入本機備份目錄，重要存檔仍應定期複製到其他裝置。

安裝前先約定名稱，後面的服務檔案和指令碼都沿用這些值：

| 用途 | 範例值 |
|---|---|
| 管理帳號 | `steeefanie` |
| 遊戲服務帳號 | `pal` |
| 主機名稱 | `palserver` |
| 區域網路位址 | `192.168.x.x` |
| EasyTier 伺服器位址 | `10.x.x.10` |

## 目標與架構

伺服器使用一台配備行動版處理器、16 GB記憶體與NVMe固態硬碟的閒置筆電，預計同時上線人數不超過6人。專用伺服器幾乎不依賴獨立顯示卡，更需要關注的是記憶體餘量、散熱、網路穩定性、存檔安全與故障復原。

最後使用的元件如下：

```text
Ubuntu Server
├── OpenSSH：遠端管理
├── systemd：託管遊戲服務與EasyTier
├── SteamCMD：安裝和更新伺服器
├── EasyTier：建立虛擬區域網路
├── cron：觸發定時備份
└── UFW：限制輸入連接埠
```

遊戲程序使用獨立的 `pal` 帳號。遠端玩家先加入 EasyTier 虛擬網路，再連線至遊戲連接埠，不需要在路由器設定公網連接埠轉送。

## 帳號與目錄隔離

管理帳號使用 `steeefanie`，遊戲服務使用不需要登入的專用帳號 `pal`。SteamCMD 下載的檔案和遊戲存檔都歸 `pal` 所有。

```bash
sudo adduser --disabled-password --gecos "" pal
sudo mkdir -p /home/pal/server /home/pal/backups
sudo chown -R pal:pal /home/pal
```

目錄統一如下：

```text
/home/pal/server       伺服器程式
/home/pal/server/Pal   遊戲資料
/home/pal/backups      備份與維護日誌
```

## 區域網路與SSH

我在路由器中為伺服器網卡設定 DHCP 固定租約，伺服器端繼續使用 DHCP。目前位址與預設路由可以這樣檢查：

```bash
ip -br address
ip route
```

安裝並啟用OpenSSH：

```bash
sudo apt update
sudo apt install -y openssh-server
sudo systemctl enable --now ssh
sudo systemctl status ssh --no-pager
```

Windows端產生Ed25519密鑰：

```powershell
ssh-keygen -t ed25519
$ServerLanIp = "192.168.x.x"
type $env:USERPROFILE\.ssh\id_ed25519.pub |
  ssh "steeefanie@$ServerLanIp" "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
```

應先在新的終端機驗證密鑰登入，再考慮關閉SSH密碼驗證；不要在尚未確認密鑰可用時直接鎖死唯一入口。

## 筆電長期運作設定

闔蓋和閒置策略比螢幕是否亮著更重要。伺服器應明確停用睡眠、暫停和休眠：

```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
sudoedit /etc/systemd/logind.conf
```

在 `[Login]` 中設定：

```ini
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
IdleAction=ignore
```

然後重新啟動登入管理服務：

```bash
sudo systemctl restart systemd-logind
```

長期運作時需要保持進風口暢通並適度墊高機身。我使用 `lm-sensors` 和 `thermald` 觀察溫度：

```bash
sudo apt install -y lm-sensors thermald htop
sudo sensors-detect --auto
sudo systemctl enable --now thermald
sensors
```

## 安裝SteamCMD與伺服器

Ubuntu需要啟用multiverse和i386架構：

```bash
sudo add-apt-repository multiverse -y
sudo dpkg --add-architecture i386
sudo apt update
sudo apt install -y steamcmd lib32gcc-s1
```

切換至服務帳號後安裝伺服器：

```bash
sudo -iu pal
/usr/games/steamcmd \
  +force_install_dir /home/pal/server \
  +login anonymous \
  +app_update 2394010 validate \
  +quit
```

安裝完成後，先手動執行一次以確認相依套件和檔案權限正常：

```bash
cd /home/pal/server
./PalServer.sh
```

看到服務監聽8211連接埠後即可按 `Ctrl+C` 離開。此時出現結束碼130只代表鍵盤中斷，不是安裝失敗。

## 使用systemd託管服務

手動測試通過後，使用 systemd 管理開機自動啟動、異常重啟、停止訊號與日誌。

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

載入並啟動：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now palworld
sudo systemctl status palworld --no-pager
```

常用檢查只有三組：

```bash
sudo systemctl restart palworld
journalctl -u palworld -n 100 --no-pager
sudo ss -lunp | grep ':8211'
```

我通常先看 `systemctl status`，再查 `journalctl`，最後用 `ss` 確認 8211/UDP 是否已經監聽。

## 使用EasyTier建立虛擬區域網路

EasyTier 把玩家裝置和伺服器放進同一個虛擬網段。共享節點負責發現和協商，條件允許時使用 P2P，穿透失敗時改走中繼。

網路名稱、密鑰、節點位址和虛擬IP不應直接寫進systemd單元。將它們放入僅root可讀的環境檔案：

```ini
# /etc/easytier/palworld.env
EASYTIER_IPV4=10.x.x.10
EASYTIER_NETWORK=<隨機網路名稱>
EASYTIER_SECRET=<足夠長的隨機密鑰>
EASYTIER_PEER=tcp://<共享或自架節點>:<連接埠>
```

```bash
sudo chown root:root /etc/easytier/palworld.env
sudo chmod 600 /etc/easytier/palworld.env
```

服務單元只參照環境變數：

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

Windows節點應在系統管理員PowerShell中啟動，並使用與伺服器不同的虛擬IP：

```powershell
cd C:\Tools\EasyTier
.\easytier-core.exe --ipv4 10.x.x.11 `
  --network-name <同一網路名稱> `
  --network-secret <同一密鑰> `
  --hostname win-client `
  -p tcp://<同一節點>:<連接埠> `
  --latency-first
```

Windows 等桌面端也可以使用 EasyTier GUI。填入相同的網路名稱、密鑰和共享節點，為每台裝置分配不同的虛擬 IP 即可。伺服器端仍使用 systemd 託管 `easytier-core`，方便開機啟動和查看日誌。

連線結果使用 `easytier-cli peer` 檢查，主要看目標節點是否出現、連線類型、延遲與封包遺失。

## 防火牆

啟用UFW前先允許SSH，再允許遊戲使用的UDP連接埠：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 8211/udp
sudo ufw --force enable
sudo ufw status verbose
```

確認虛擬網路已經可以透過SSH存取後，可以依實際介面名稱增加窄規則，再刪除前面的全介面規則：

```bash
sudo ufw allow in on tun0 to any port 22 proto tcp
sudo ufw allow in on tun0 to any port 8211 proto udp
sudo ufw delete allow OpenSSH
sudo ufw delete allow 8211/udp
```

刪除寬規則前必須從另一個終端機驗證虛擬網路SSH，避免把自己鎖在伺服器外。如果仍需要區域網路直連，應依實際區域網路網段單獨允許，而不是恢復任意來源規則。

EasyTier 用戶端通常只向共享節點發起輸出連線。只有自架監聽節點時，才需要依實際設定增加輸入規則。

## 世界設定與存檔邊界

目前世界真正讀取的設定檔位於：

```text
/home/pal/server/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini
```

根目錄的 `DefaultPalWorldSettings.ini` 只是範本。修改範本不會自動影響現有世界。正確流程是停服、備份、修改實際設定，再啟動並檢查日誌：

```bash
sudo systemctl stop palworld
sudo cp /home/pal/server/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini \
  /home/pal/backups/PalWorldSettings.ini.before-edit
sudoedit /home/pal/server/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini
sudo chown pal:pal /home/pal/server/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini
sudo systemctl start palworld
```

調整世界倍率通常不需要刪除 `SaveGames`。如果需要產生新世界，我會先改名保留整個 `Saved`：

```bash
sudo systemctl stop palworld
sudo mv /home/pal/server/Pal/Saved \
  "/home/pal/server/Pal/Saved_old_$(date '+%F_%H%M%S')"
sudo systemctl start palworld
```

設定中可能包含伺服器密碼和管理員密碼。公開檢查時應先遮蔽敏感欄位：

```bash
sudo sed -E \
  's/(ServerPassword=")[^"]*/\1****/; s/(AdminPassword=")[^"]*/\1****/' \
  /home/pal/server/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini
```

## 備份策略

備份按時間分層保留：最近 3 天保留小時版本，之後每天保留一個版本，31 天後清理。檔名使用時間戳記，並透過 `flock` 防止工作重疊。

核心指令碼結構如下：

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

透過root的cron每小時執行：

```text
5 * * * * /usr/local/bin/backup-palworld >> /home/pal/backups/backup-palworld.log 2>&1
```

小時備份在服務執行期間打包。更新前則先停服再備份，並定期檢查壓縮檔能否解開、是否包含設定和世界目錄。

## 更新必須能夠回復

更新指令碼按下面的順序執行：

```text
取得排他鎖
→ 檢查SteamCMD、服務目錄和存檔目錄
→ 記錄更新前buildid
→ 停止服務
→ 備份Saved
→ 以pal帳號執行SteamCMD更新和驗證
→ 啟動服務
→ 檢查systemd狀態、buildid和8211/UDP
→ 成功後再清理過期備份
```

關鍵更新指令仍然以服務帳號執行：

```bash
sudo systemctl stop palworld
sudo -u pal /usr/games/steamcmd \
  +force_install_dir /home/pal/server \
  +login anonymous \
  +app_update 2394010 validate \
  +quit
sudo systemctl start palworld
```

指令碼設定錯誤陷阱：更新失敗時嘗試重新啟動服務，並保留更新前備份和完整日誌。版本是否改變可比較 `steamapps/appmanifest_2394010.acf` 中更新前後的 `buildid`。

## 分層排錯

遠端玩家無法進入時，我按下面的順序檢查：

```text
1. palworld.service是否執行
2. 8211/UDP是否監聽
3. easytier.service是否執行
4. easytier-cli peer能否看到目標節點
5. 虛擬IP能否互通
6. 世界設定和存檔是否有效
```

對應指令：

```bash
sudo systemctl status palworld --no-pager
sudo ss -lunp | grep 8211
sudo systemctl status easytier --no-pager
easytier-cli peer
journalctl -u palworld -n 100 --no-pager
journalctl -u easytier -n 120 --no-pager
```

EasyTier 日誌中的 `handshake timeout`、`connect timeout` 和 `Connection reset by peer` 對應不同連線階段。網域名稱可以解析後，還要繼續確認 TCP、EasyTier 交握和目標 peer。

單元設定了 `Restart=always` 後，直接終止程序會被 systemd 重新啟動。修改設定前先 `systemctl stop`，修改單元後執行 `daemon-reload`，再重新啟動。
