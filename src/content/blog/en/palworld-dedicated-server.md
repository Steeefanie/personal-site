---
title: Building a Remotely Maintainable Palworld Dedicated Server on Ubuntu Server
description: Notes from installing Ubuntu Server on a spare laptop and adding Palworld, EasyTier, scheduled backups, and an update script.
attribution: ChatGPT-assisted
publishDate: 2026-07-09
lang: en
tags:
  - { id: linux, label: Linux }
  - { id: palworld, label: Palworld }
  - { id: self-hosting, label: Self-hosting }
  - { id: automation, label: Automation }
readingTime: 12 minutes
featured: false
draft: false
---

In July 2026, I installed Ubuntu Server on a spare laptop and used it for a Palworld world with no more than six concurrent players. These are the settings, scripts, and checks that remained after the setup was working.

## What to prepare

- An x86_64 computer. 16 GB of memory is enough at this scale, and a discrete GPU is unnecessary.
- An Ubuntu Server installer USB, plus a keyboard, display, and wired network for the initial installation.
- Router administration access for a DHCP reservation.
- Another computer for SSH administration and connection tests. The examples use Windows.
- Working internet access for SteamCMD and EasyTier.
- A backup destination separate from the server. The examples write locally first, but important saves should also be copied to another device.

I fixed the following names before installation and reused them in every unit and script:

| Purpose | Example |
|---|---|
| Administrative account | `steeefanie` |
| Game service account | `pal` |
| Hostname | `palserver` |
| LAN address | `192.168.x.x` |
| EasyTier server address | `10.x.x.10` |

## Goals and architecture

The host is a spare laptop with a mobile processor, 16 GB of memory, and NVMe storage. It is intended for no more than six concurrent players. The dedicated server barely uses a discrete GPU, so memory headroom, thermals, network stability, save integrity, and recovery matter much more than graphics performance.

The final stack is:

```text
Ubuntu Server
├── OpenSSH: remote administration
├── systemd: Palworld and EasyTier supervision
├── SteamCMD: installation and updates
├── EasyTier: private overlay network
├── cron: scheduled backups
└── UFW: inbound filtering
```

The game runs as the separate `pal` account. Remote players join the EasyTier network before connecting to the game port, so the router does not need a public port-forwarding rule.

## Separate the administrator from the service

`steeefanie` is the administrative account. The game uses a dedicated `pal` account without an interactive password. SteamCMD downloads and game saves are owned by `pal`.

```bash
sudo adduser --disabled-password --gecos "" pal
sudo mkdir -p /home/pal/server /home/pal/backups
sudo chown -R pal:pal /home/pal
```

I use these paths consistently:

```text
/home/pal/server       server binaries
/home/pal/server/Pal   game data
/home/pal/backups      backups and maintenance logs
```

## LAN addressing and SSH

The server continues to use DHCP, while the router reserves its address for the network adapter. Check the current address and default route with:

```bash
ip -br address
ip route
```

Install and enable OpenSSH:

```bash
sudo apt update
sudo apt install -y openssh-server
sudo systemctl enable --now ssh
sudo systemctl status ssh --no-pager
```

On Windows, create an Ed25519 key and append only the public half to the server:

```powershell
ssh-keygen -t ed25519
$ServerLanIp = "192.168.x.x"
type $env:USERPROFILE\.ssh\id_ed25519.pub |
  ssh "steeefanie@$ServerLanIp" "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
```

Test key-based access in a new terminal before disabling password authentication. Removing the only working login path is not hardening.

## Keep a laptop awake without keeping its screen on

Lid and idle policy matter more than whether the panel is lit. Explicitly disable system sleep, suspend, and hibernation:

```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
sudoedit /etc/systemd/logind.conf
```

Set the following under `[Login]`:

```ini
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
IdleAction=ignore
```

Then reload the login manager:

```bash
sudo systemctl restart systemd-logind
```

For sustained operation, I keep the vents clear, raise the chassis for airflow, and monitor temperatures with `lm-sensors` and `thermald`:

```bash
sudo apt install -y lm-sensors thermald htop
sudo sensors-detect --auto
sudo systemctl enable --now thermald
sensors
```

## Install SteamCMD and the dedicated server

SteamCMD on Ubuntu requires the multiverse repository and i386 support:

```bash
sudo add-apt-repository multiverse -y
sudo dpkg --add-architecture i386
sudo apt update
sudo apt install -y steamcmd lib32gcc-s1
```

Install the server as the service account:

```bash
sudo -iu pal
/usr/games/steamcmd \
  +force_install_dir /home/pal/server \
  +login anonymous \
  +app_update 2394010 validate \
  +quit
```

Run it manually once to verify dependencies and ownership:

```bash
cd /home/pal/server
./PalServer.sh
```

After the server begins listening on port 8211, stop the test with `Ctrl+C`. Exit status 130 in this case means keyboard interruption, not a failed installation.

## Let systemd supervise the game

After the manual test succeeds, systemd handles startup, restart policy, the stop signal, and logs.

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

Load and start the unit:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now palworld
sudo systemctl status palworld --no-pager
```

Three commands answer three different questions:

```bash
sudo systemctl restart palworld
journalctl -u palworld -n 100 --no-pager
sudo ss -lunp | grep ':8211'
```

I normally check `systemctl status`, then `journalctl`, and finally use `ss` to confirm that 8211/UDP is listening.

## Put remote players on an EasyTier overlay

EasyTier places the player devices and server on the same virtual subnet. A shared peer handles discovery and negotiation; connections use P2P when available and relay when traversal fails.

Do not embed the network name, secret, peer, or virtual address directly in the unit. Store them in a root-readable environment file:

```ini
# /etc/easytier/palworld.env
EASYTIER_IPV4=10.x.x.10
EASYTIER_NETWORK=<random-network-name>
EASYTIER_SECRET=<long-random-secret>
EASYTIER_PEER=tcp://<shared-or-self-hosted-peer>:<port>
```

```bash
sudo chown root:root /etc/easytier/palworld.env
sudo chmod 600 /etc/easytier/palworld.env
```

The service unit only references those variables:

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

Start a Windows peer from an elevated PowerShell session and give it a different overlay address:

```powershell
cd C:\Tools\EasyTier
.\easytier-core.exe --ipv4 10.x.x.11 `
  --network-name <same-network-name> `
  --network-secret <same-secret> `
  --hostname win-client `
  -p tcp://<same-peer>:<port> `
  --latency-first
```

EasyTier also has a GUI for desktop clients. Enter the same network name, secret, and shared peer, then assign a unique virtual IP to each device. I still run `easytier-core` under systemd on the server for reliable startup and logs.

Use `easytier-cli peer` to check whether the target appears, along with its path type, latency, and packet loss.

## Firewall

Allow SSH before enabling UFW, then allow the game’s UDP port:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 8211/udp
sudo ufw --force enable
sudo ufw status verbose
```

After confirming that SSH works over the overlay, add interface-specific rules and then remove the broad bootstrap rules:

```bash
sudo ufw allow in on tun0 to any port 22 proto tcp
sudo ufw allow in on tun0 to any port 8211 proto udp
sudo ufw delete allow OpenSSH
sudo ufw delete allow 8211/udp
```

Verify overlay SSH from a second terminal before deleting either broad rule, or it is easy to lock yourself out. If LAN access is still required, allow the actual LAN subnet explicitly instead of restoring an any-source rule.

An EasyTier client normally initiates an outbound connection to its shared peer. Add an inbound EasyTier rule only when operating a peer that actually listens for one.

## Keep world configuration separate from save data

The active world reads this file:

```text
/home/pal/server/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini
```

`DefaultPalWorldSettings.ini` in the server root is only a template. Editing it does not change an existing world. Stop the service, back up the active file, edit it, restore ownership, and then inspect the next startup:

```bash
sudo systemctl stop palworld
sudo cp /home/pal/server/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini \
  /home/pal/backups/PalWorldSettings.ini.before-edit
sudoedit /home/pal/server/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini
sudo chown pal:pal /home/pal/server/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini
sudo systemctl start palworld
```

Changing world rates normally does not require deleting `SaveGames`. When I need a new world, I preserve the existing `Saved` tree by renaming it:

```bash
sudo systemctl stop palworld
sudo mv /home/pal/server/Pal/Saved \
  "/home/pal/server/Pal/Saved_old_$(date '+%F_%H%M%S')"
sudo systemctl start palworld
```

The settings may contain server and administrator passwords. Redact them before showing the file in public output:

```bash
sudo sed -E \
  's/(ServerPassword=")[^"]*/\1****/; s/(AdminPassword=")[^"]*/\1****/' \
  /home/pal/server/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini
```

## Use a retention policy, not an ever-growing backup folder

The backup schedule keeps hourly copies for the newest three days, one daily copy after that, and removes files after 31 days. Timestamped filenames and `flock` prevent overlap.

The essential script structure is small:

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

Run it hourly from root’s crontab:

```text
5 * * * * /usr/local/bin/backup-palworld >> /home/pal/backups/backup-palworld.log 2>&1
```

Hourly archives are created while the service is running. Before an update, I stop the service and create another backup, then periodically check that the archives open and contain both configuration and world data.

## Make every update recoverable

The update script follows this sequence:

```text
take an exclusive lock
→ validate SteamCMD, server, and save paths
→ record the current buildid
→ stop the service
→ back up Saved
→ update and validate as pal
→ start the service
→ check systemd, buildid, and 8211/UDP
→ remove expired backups only after success
```

The update itself still runs as the service account:

```bash
sudo systemctl stop palworld
sudo -u pal /usr/games/steamcmd \
  +force_install_dir /home/pal/server \
  +login anonymous \
  +app_update 2394010 validate \
  +quit
sudo systemctl start palworld
```

The script traps errors, attempts to start the service again, and retains the pre-update archive and full log. I compare the `buildid` in `steamapps/appmanifest_2394010.acf` before and after the run to distinguish an update from a validation-only pass.

## Troubleshoot in dependency order

When a remote player cannot connect, I check the following in order:

```text
1. Is palworld.service running?
2. Is 8211/UDP listening?
3. Is easytier.service running?
4. Does easytier-cli peer show the target node?
5. Are the overlay addresses mutually reachable?
6. Are the world configuration and saves valid?
```

The corresponding evidence is straightforward:

```bash
sudo systemctl status palworld --no-pager
sudo ss -lunp | grep 8211
sudo systemctl status easytier --no-pager
easytier-cli peer
journalctl -u palworld -n 100 --no-pager
journalctl -u easytier -n 120 --no-pager
```

Messages such as `handshake timeout`, `connect timeout`, and `Connection reset by peer` belong to different connection stages. After DNS works, I still check TCP, the EasyTier handshake, and the intended peer.

With `Restart=always`, killing the process directly causes systemd to start it again. I stop the unit first, edit its configuration, run `daemon-reload` when the unit changes, and then start it through systemd.
