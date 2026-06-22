# Deploying the Dirac runner to a VPS

The runner is a long-lived agent: it watches the program's events, posts to the
network Chat/Board, refreshes the VARA/USD rate every 30 min, and replies to
incoming `@dirac` mentions every 5 min. It must stay running 24/7, so it runs
under `systemd` with automatic restart and restart-on-reboot.

## What the host needs

- **Ubuntu 22.04+** (any modern Linux with systemd).
- **Node 20+** and npm.
- **The `vara-wallet` CLI installed globally** — the runner shells out to it.
- **The whole repo cloned** — the runner reads `../../programs/dirac/dirac.idl`
  and `../refs/*.idl`, so a bare `runner/` copy is not enough.
- **The operator secret**, supplied either as a file or an env var (below).

## One-time setup

```bash
# 1. System packages
sudo apt update && sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Dedicated unprivileged user (so the secret isn't owned by root/your login)
sudo useradd --system --create-home --shell /usr/sbin/nologin dirac

# 3. Code
sudo git clone https://github.com/Enoch208/Dirac.git /opt/dirac
sudo chown -R dirac:dirac /opt/dirac

# 4. The wallet CLI + runner deps (run as the dirac user)
sudo -u dirac npm install -g vara-wallet
sudo -u dirac bash -c 'cd /opt/dirac/runner && npm install'

# 5. Confirm where the CLI landed and point the unit at it
which vara-wallet   # e.g. /usr/local/bin/vara-wallet  ->  set VARA_WALLET in the unit
```

## The operator secret (pick ONE)

The runner loads the secret from `$DIRAC_OPERATOR_SECRET` if set, otherwise from
`runner/.secrets/operator.json`. **Never commit it; keep it `chmod 600`.**

**Option A — env var (recommended for a VPS).** Put the JSON on one line in an
`.env` that only the `dirac` user can read:

```bash
sudo -u dirac tee /opt/dirac/runner/.env >/dev/null <<'EOF'
DIRAC_OPERATOR_SECRET={"mnemonic":"...","hexAddress":"0x...","ss58Address":"..."}
EOF
sudo chmod 600 /opt/dirac/runner/.env
```

**Option B — file.** Copy your local secret up and lock it down:

```bash
scp runner/.secrets/operator.json you@vps:/tmp/operator.json
sudo mkdir -p /opt/dirac/runner/.secrets
sudo mv /tmp/operator.json /opt/dirac/runner/.secrets/operator.json
sudo chown -R dirac:dirac /opt/dirac/runner/.secrets
sudo chmod 700 /opt/dirac/runner/.secrets
sudo chmod 600 /opt/dirac/runner/.secrets/operator.json
```

## Install & start the service

```bash
# Edit VARA_WALLET= in the unit to match `which vara-wallet`, then:
sudo cp /opt/dirac/runner/deploy/dirac-runner.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now dirac-runner

# Watch it
sudo systemctl status dirac-runner
tail -f /var/log/dirac-runner.log     # or: journalctl -u dirac-runner -f
```

`Restart=always` brings it back after a crash; `enable` brings it back after a
reboot. To deploy new code: `cd /opt/dirac && sudo -u dirac git pull && sudo -u dirac bash -c 'cd runner && npm install' && sudo systemctl restart dirac-runner`.

## Alternative: pm2 instead of systemd

If you already run pm2, skip the unit file and use
[`ecosystem.config.cjs`](./ecosystem.config.cjs). The secret still comes from
`runner/.secrets/operator.json` (or `$DIRAC_OPERATOR_SECRET`) — don't put the
mnemonic in the ecosystem file. Edit `VARA_WALLET` to match `which vara-wallet`.

```bash
cd /opt/dirac/runner
npm install
pm2 start deploy/ecosystem.config.cjs   # start (and auto-restart on crash)
pm2 save                                 # remember it across pm2 restarts
pm2 startup                              # print the command to run so pm2 survives reboot — run what it prints
pm2 logs dirac-runner                    # tail logs
pm2 restart dirac-runner                 # after a git pull / code change
```

## Notes

- **Transient RPC drops are normal.** `wss://rpc.vara.network` occasionally closes
  with `1006 Abnormal Closure`; the rate refresh falls back to a public price feed
  and the next tick recovers. These log lines are noise, not failures.
- **Secret exposure.** The runner passes the mnemonic to the wallet CLI through
  the `VARA_MNEMONIC` environment variable, not the command line — so it is not
  visible in `ps` or in error logs. It is still readable via
  `/proc/<pid>/environ` by root and the owning user, so run as the dedicated
  `dirac` user, keep the box single-tenant and firewalled, and `chmod 600` the
  `.env`/secret. For stricter isolation, mount `/proc` with `hidepid=2`.
- **No inbound ports.** The runner only makes outbound connections — keep the
  firewall closed to inbound except SSH.
