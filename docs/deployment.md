# Deploying Tripwire

This guide deploys the workbench, the API and FalkorDB to one server. AWS EC2 is the primary path and is written step by step; ECS, Google Cloud and Azure follow, with what changes on each. Everything here was run end to end on a local Docker host with the production compose file, TLS and basic auth (see "What was verified").

## 1. What runs

```text
Internet ──443──> Caddy (TLS) ──> web:3000 (Next.js, sign-in) 
                  └──/api/*──> api:8000 (FastAPI, verifies the token) ──> falkordb:6379
                                                                                │
                                                                                └── SQLite case store (volume)
```

| Service | Image | Published | State |
| --- | --- | --- | --- |
| `caddy` | `caddy:2.10.2-alpine` | 80, 443 | TLS certificates (volume `caddy-data`) |
| `web` | built from `apps/web/Dockerfile` | no | none |
| `api` | built from `services/api/Dockerfile` | no | case store (volume `cases`), artifacts (read-only bind) |
| `falkordb` | `falkordb/falkordb-server@sha256:2e99eb1c...` (graph module 4.22.1) | no | graph snapshot (volume `falkordb-data`) |
| `graph-loader` | the API image, profile `tools` | no | one-shot job |

Files: `deploy/compose.prod.yaml`, `deploy/Caddyfile`, `deploy/.env.production.example`, `deploy/scripts/`.

Only Caddy is reachable from outside. The browser talks to the Next.js server, which forwards `/api` to the API over the private Docker network, so the API and FalkorDB never need a public port. The agent review's server-sent event stream passes through Caddy unbuffered.

## 2. The data, checked

Measured on the HI-Small v8 artifacts in this workspace.

| Item | Size | Goes to the server |
| --- | --- | --- |
| Release bundle (`make_release_bundle.py` output) | 165.7 MB | yes |
| of which `graph-input/graph-transactions.parquet` | 154.9 MB, 5,078,345 rows, 14 columns | yes, then loaded into FalkorDB |
| of which `artifacts/baselines/inference_scores.parquet` | 10.8 MB, 761,639 rows: `transaction_id`, `timestamp`, `score` | yes |
| of which threshold and metric JSON | under 20 KB | yes |
| FalkorDB graph `traceaml` in memory (`GRAPH.MEMORY USAGE`) | 2,519 MB | built on the server |
| FalkorDB snapshot on disk (`dump.rdb`) | about 0.7 GB | built on the server |
| Fresh full load (`--mode create`) | 370 s on the dev machine; 521 s recorded in Iteration 2 | |
| `data/processed/.../transactions.parquet` | 280 MB | **never**: it holds `target_is_laundering` and `split` |
| `artifacts/.../test_scores.parquet`, `models/`, `data/raw/` | | **never**: evaluation data and training inputs |

The bundle script copies only what the API serves, projects the graph input to the loader's own column allowlist (`graph.load_graph.LOAD_COLUMNS`), refuses any Parquet column or JSON key that looks like a label, split or typology, and writes `MANIFEST.json` and `SHA256SUMS`. The inference score file's hash matches the hash in its own manifest.

## 3. Sizing

| Resource | Minimum | Recommended | Why |
| --- | --- | --- | --- |
| Memory | 8 GiB | 16 GiB | FalkorDB holds 2.5 GiB for the graph; a full load peaked at 4.13 GiB server memory (Iteration 2); snapshots fork the process; API, web and Caddy need about 1 GiB together |
| vCPU | 2 | 2 to 4 | Investigations are milliseconds of graph work; the load is single-stream |
| Disk | 30 GiB | 40 GiB gp3 | OS, images (about 1.5 GB), snapshot, bundle, backups |
| Architecture | x86_64 | x86_64 | The tested images are amd64 |

EC2 choices: `r7i.large` (2 vCPU, 16 GiB, memory-optimized) or `m7i.xlarge` (4 vCPU, 16 GiB). Check current prices for your region in the AWS Pricing Calculator. `t3.large` (8 GiB) works for a demo but has no headroom for a reload while serving.

## 4. AWS EC2, step by step

### 4.1 One-time AWS setup

1. **S3 bucket** for releases and backups, private, Block Public Access on, default encryption on. Example: `s3://traceaml-ops-<account>`.
2. **Secrets** in SSM Parameter Store as `SecureString`:
   ```bash
   # Signs sessions and tokens. At least 32 characters; changing it signs everyone out.
   aws ssm put-parameter --type SecureString --name /traceaml/prod/BETTER_AUTH_SECRET --value "$(openssl rand -base64 32)"
   # OAuth client secrets (section 4.1a). Set the one or two providers you use.
   aws ssm put-parameter --type SecureString --name /traceaml/prod/GOOGLE_CLIENT_SECRET --value '<secret>'
   aws ssm put-parameter --type SecureString --name /traceaml/prod/GITHUB_CLIENT_SECRET --value '<secret>'
   # Optional: the Gemini key. Without it, reviews run the deterministic policy agent.
   aws ssm put-parameter --type SecureString --name /traceaml/prod/LLM_API_KEY --value '<key>'
   ```
3. **IAM role** for the instance (instance profile) with:
   - `AmazonSSMManagedInstanceCore` (shell access through Session Manager, no SSH port).
   - `s3:GetObject` and `s3:ListBucket` on `releases/*`, `s3:PutObject` on `backups/*`.
   - `ssm:GetParameter` on `arn:aws:ssm:<region>:<account>:parameter/traceaml/prod/*`, and `kms:Decrypt` on the key that encrypts them.
4. **Security group**: inbound TCP 443 and 80 (80 only serves the redirect and the certificate challenge). Restrict the sources to your office or VPN ranges if you can. No port 22: use Session Manager. Outbound: all (image pulls, Let's Encrypt, Gemini).
5. **Elastic IP**, and a DNS `A` record (Route 53 or your DNS host) such as `traceaml.example.com` pointing at it. Caddy obtains the certificate automatically once the name resolves to the instance.

### 4.1a Sign-in (Google and GitHub)

The app signs people in with Better Auth. Only people on the access list get in, and each can start 10 investigations an hour and 20 a day (ADR-027).

1. **Google:** in the Google Cloud console create an OAuth client of type "Web application". Authorised redirect URI: `https://<your domain>/api/auth/callback/google`. Copy the client ID into `GOOGLE_CLIENT_ID` and the secret into SSM.
2. **GitHub:** in GitHub, Settings, Developer settings, OAuth Apps, register an app. Authorization callback URL: `https://<your domain>/api/auth/callback/github`. Copy the client ID into `GITHUB_CLIENT_ID` and the secret into SSM.
3. **Access list:** set `AUTH_ALLOWED_EMAILS` to comma separated addresses and `@domain` entries. The sign-in page refuses anyone else, and an empty list allows nobody. For a public demo set it to `*`: anyone with a verified Google or GitHub email can sign in, and only the per-user limits stand between a visitor and your Gemini key.
4. The provider must report the email as verified. A new Google or GitHub account with the same email as an existing user is linked to that user.

The web app serves `/api/auth/*`; Caddy sends everything else under `/api/` straight to the API, which checks the signed token itself.

### 4.2 Build and upload the release bundle (workstation)

```bash
uv run --project graph python deploy/scripts/make_release_bundle.py \
  --run-root artifacts/runs/hi-small-v8 \
  --transactions data/processed/hi-small-v8/transactions.parquet \
  --out dist/release
aws s3 sync dist/release s3://traceaml-ops-<account>/releases/2026-10-17/
```

`dist/` is ignored by Git. Re-run this whenever the model scores, thresholds or transactions change.

### 4.3 Launch the instance

Ubuntu Server 24.04 LTS (x86_64), `r7i.large`, 40 GiB gp3 root volume, the instance profile, security group and subnet from 4.1, then associate the Elastic IP. With the CLI:

```bash
aws ec2 run-instances \
  --image-id <ubuntu-24.04-amd64-ami-for-your-region> \
  --instance-type r7i.large \
  --iam-instance-profile Name=traceaml-prod \
  --security-group-ids <sg-id> --subnet-id <public-subnet-id> \
  --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=40,VolumeType=gp3,Encrypted=true}' \
  --metadata-options HttpTokens=required \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=traceaml-prod}]'
aws ec2 associate-address --instance-id <i-id> --allocation-id <eipalloc-id>
```

### 4.4 Prepare the host

Connect with `aws ssm start-session --target <i-id>`, then:

```bash
sudo mkdir -p /opt/traceaml && sudo chown "$USER" /opt/traceaml
git clone <your-repo-url> /opt/traceaml && cd /opt/traceaml
git checkout <release-tag-or-commit>
sudo bash deploy/scripts/bootstrap-ubuntu.sh
exit   # reconnect so your user is in the docker group
```

The bootstrap script installs Docker Engine with the compose plugin and the AWS CLI. It caps container log size, applies the kernel settings FalkorDB (Redis) expects (`vm.overcommit_memory=1`, transparent huge pages off), adds a 4 GiB swap file as a safety margin, and creates `/srv/traceaml/{artifacts,graph-input,backups}`.

### 4.5 Fetch and verify the data

```bash
cd /srv/traceaml
aws s3 sync s3://traceaml-ops-<account>/releases/2026-10-17/ .
sha256sum -c SHA256SUMS          # every line must say OK
```

### 4.6 Configure

```bash
cd /opt/traceaml
cp deploy/.env.production.example deploy/.env.production
nano deploy/.env.production      # TRACEAML_DOMAIN, ACME_EMAIL, GOOGLE_CLIENT_ID, GITHUB_CLIENT_ID, AUTH_ALLOWED_EMAILS, RELEASE
bash deploy/scripts/fetch-secrets.sh /traceaml/prod   # writes BETTER_AUTH_SECRET, the OAuth secrets and LLM_API_KEY
```

Settings that matter:

| Variable | Value | Note |
| --- | --- | --- |
| `TRACEAML_DOMAIN` | `traceaml.example.com` | Must resolve to the Elastic IP |
| `ACME_EMAIL` | an ops mailbox | Required; Let's Encrypt expiry and revocation notices |
| `GOOGLE_CLIENT_ID`, `GITHUB_CLIENT_ID` | from the provider | With their secrets from SSM. At least one provider is required |
| `BETTER_AUTH_SECRET` | from SSM | 32 characters or more |
| `AUTH_ALLOWED_EMAILS` | `ops@example.com,@example.com` | Who may sign in. Empty allows nobody |
| `TRACEAML_INVESTIGATION_LIMIT_HOUR`, `TRACEAML_INVESTIGATION_LIMIT_DAY` | `10`, `20` | Per user, rolling windows |
| `TRACEAML_GRAPH_NAME` | `traceaml` | The graph the loader writes and the API reads |
| `TRACEAML_BLOCK_THRESHOLD` | `0.999` | A placeholder (ADR-023); set it from validation precision |
| `LLM_API_KEY` | from SSM | Empty keeps the agent deterministic and free |
| `FALKORDB_MEMORY_LIMIT` | `10g` on a 16 GiB host | Container ceiling; keep about 4 GiB for the rest |

### 4.7 Build, load the graph, start

```bash
C="docker compose -f deploy/compose.prod.yaml --env-file deploy/.env.production"
$C build                                    # a few minutes the first time
$C up -d falkordb
$C --profile tools run --rm graph-loader    # about 6 to 9 minutes for 5,078,345 rows
$C up -d
$C ps                                       # api, web, falkordb healthy; caddy up
```

The loader prints a JSON summary. Its `reconciliation` must show 5,078,345 transactions, 5,078,345 sent and received edges, and 515,088 accounts. `--mode create` refuses to run on a graph that already has transactions, so it cannot double-load. Use `GRAPH_LOAD_MODE=merge` (idempotent, slower) to add rows to an existing graph.

### 4.8 Check it

```bash
D=https://traceaml.example.com; A="-u analyst:<password>"
curl -s -o /dev/null -w '%{http_code}\n' $D/                 # 401 without credentials
curl -s $A $D/api/health                                     # falkordb "available"
curl -s $A "$D/api/alerts?limit=5" | jq '.items[] | {transaction_id, route, graph_status}'
curl -sN $A -X POST $D/api/investigations/stream \
  -H 'content-type: application/json' -d '{"transaction_id":"hi8-tx-04449084"}'
```

Every alert should be `graph_status: "available"`; a `"missing"` alert means the graph load is incomplete. The stream should print `started`, then `tool_started` and `tool_completed` events, then `investigation_completed`. Then open the site in a browser, sign in, and run a review.

### 4.9 Backups

The graph can always be rebuilt from the release bundle. The case store (analyst decisions) cannot, so back it up:

```bash
crontab -e
15 2 * * * cd /opt/traceaml && bash deploy/scripts/backup-cases.sh s3://traceaml-ops-<account>/backups >> /srv/traceaml/backups/backup.log 2>&1
```

The script uses SQLite's online backup API, so it is consistent while the API runs. Also enable an EBS snapshot policy (Data Lifecycle Manager, daily, keep 7) on the root volume.

To restore: stop the API, copy `cases-<stamp>.db` (gunzipped) into the `cases` volume as `cases.db`, start the API.

### 4.10 Operate

| Task | Command |
| --- | --- |
| Logs | `$C logs -f api` (also `web`, `caddy`, `falkordb`) |
| Deploy a new code version | `git fetch && git checkout <tag> && $C build && $C up -d` |
| Roll back | `git checkout <previous-tag> && $C build && $C up -d` (or keep tagged images; see 4.11) |
| Restart one service | `$C restart api` |
| New data release | Load into a new graph (`TRACEAML_GRAPH_NAME=traceaml-20261101` for the loader run), switch the API's `TRACEAML_GRAPH_NAME`, `$C up -d api`, then `GRAPH.DELETE` the old graph |
| FalkorDB restart | The roughly 0.7 GB snapshot reloads before FalkorDB answers; the health check allows 3 minutes |

Container logs are capped at 5 × 20 MB per container. To ship them to CloudWatch, install the CloudWatch agent or set Docker's `awslogs` log driver.

### 4.11 Optional: build in CI and pull from ECR

Building on the server is simple. For repeatable releases, build in CI and push both images to ECR (`IMAGE_PREFIX=<account>.dkr.ecr.<region>.amazonaws.com/traceaml`, `RELEASE=<git sha>`), then on the server run `aws ecr get-login-password | docker login ...`, `$C pull`, `$C up -d` without building. Add `ecr:GetAuthorizationToken` and `ecr:BatchGetImage` to the instance role. Build the web image with `--build-arg TRACEAML_API_ORIGIN=http://api:8000`: Next.js fixes that value at build time.

## 5. Security checklist

- **Authentication.** Google and GitHub sign-in through Better Auth, restricted to an access list. Every screen except the landing page needs a session, and every API route except `/api/health` and `/api/benchmarks` needs a signed token that the API verifies against the web app's public keys (EdDSA, 15 minute lifetime, issuer and audience checked). The API holds no password and no signing secret. If the key server cannot be reached the API answers 503, never lets a request through.
- **Usage limits.** 10 investigations an hour and 20 a day per user, counted in the API's SQLite file when an investigation starts, whether or not it succeeds. Both investigation endpoints share the allowance. A refused request is a 429 with `Retry-After`.
- **Accounts.** Removing someone from `AUTH_ALLOWED_EMAILS` and restarting the web service stops new sign-ins at once and ends their access when their 15 minute token and session next renew. The case history still records whatever reviewer ID the analyst types; it is not yet tied to the login.
- **Network.** Only 80 and 443 are open. FalkorDB has no password and is reachable only on the private Docker network. FalkorDB authentication and TLS are a code follow-up: the API and loader do not pass a password today.
- **Secrets** come from SSM at deploy time and live only in `deploy/.env.production` (mode 600, ignored by Git).
- **Data.** Only label-free files reach the server (section 2). With `use_llm`, retrieved synthetic evidence is sent to Google; without a key nothing leaves the host.
- **Decisions are simulated.** Blocks in the escalation chain never reach a payment system.
- **Updates.** Apply OS updates (`unattended-upgrades` is on by default on Ubuntu) and rebuild images monthly for base-image patches.

## 6. Other platforms

All options keep two constraints of the current code:

1. The case store is SQLite on a local volume, so run exactly one API instance against it, on block storage (not NFS, SMB or EFS, where SQLite locking is unreliable). Several API instances or serverless containers need the case store moved to PostgreSQL first. That is a contained change in `api/database.py` (the engine URL and driver) plus an initial migration.
2. FalkorDB needs about 3 to 5 GiB of memory and persistent block storage for its snapshot.

### 6.1 AWS ECS

**Recommended shape: ECS on EC2 capacity**, one container instance (`r7i.large`), one service with one task running all four containers (`falkordb`, `api`, `web`, and the ALB in place of Caddy).

- **Load balancer.** An Application Load Balancer with an ACM certificate terminates TLS and forwards to `web:3000`. Set its idle timeout to 300 seconds for long agent streams. Use the ALB's built-in Cognito or OIDC authentication action instead of basic auth.
- **Storage.** Use host volumes on the instance's EBS disk for FalkorDB (`/var/lib/falkordb/data`) and the case store (`/app/data/cases`), with `desiredCount: 1` and deployment `minimumHealthyPercent: 0` so two tasks never share the SQLite file.
- **Networking.** `awsvpc` mode: containers in one task reach each other on `localhost`, so build the web image with `TRACEAML_API_ORIGIN=http://localhost:8000` and set `TRACEAML_FALKORDB_HOST=localhost`.
- **Secrets.** Task definition `secrets` reference the SSM parameters. Artifacts can be baked into an image layer or synced from S3 by an init container.
- **Graph load.** Run once as a standalone task from the API image with `traceaml-load-graph`, the same arguments as the compose `graph-loader` service, and the bundle on the host volume.

Fargate fits `web` (and `api` once the case store is PostgreSQL). For the graph, use FalkorDB Cloud (managed) or keep FalkorDB on EC2. Fargate task storage is ephemeral, and the graph would otherwise reload on every restart.

### 6.2 Google Cloud

**Compute Engine VM (recommended)**: `e2-highmem-2` (2 vCPU, 16 GB) or `n2-standard-4`, Ubuntu 24.04, 40 GB balanced persistent disk, static external IP, firewall rules for 80 and 443 only, and IAP TCP forwarding instead of public SSH. Everything in section 4 applies as written, with these substitutions:

| AWS | Google Cloud |
| --- | --- |
| S3 bundle and backups | Cloud Storage: `gcloud storage rsync gs://<bucket>/releases/<rel> /srv/traceaml` |
| SSM Parameter Store | Secret Manager: `gcloud secrets versions access latest --secret=traceaml-llm-key` |
| Instance role | VM service account with Storage Object Viewer and Secret Manager Secret Accessor |
| EBS snapshots | Persistent disk snapshot schedule |

Cloud Run supports server-sent events and can host `web`, and `api` once the case store moves to Cloud SQL for PostgreSQL. Its filesystem is in memory and per instance, so SQLite there would lose every case. Keep FalkorDB on a VM either way.

### 6.3 Azure

**Linux VM (recommended)**: `Standard_E2s_v5` (2 vCPU, 16 GiB) or `Standard_D4s_v5`, Ubuntu 24.04, 64 GiB Premium SSD, static public IP, a network security group allowing 80 and 443, and Azure Bastion for shell access. Section 4 applies as written, with these substitutions:

| AWS | Azure |
| --- | --- |
| S3 | Blob Storage: `azcopy sync 'https://<acct>.blob.core.windows.net/releases/<rel>?<sas>' /srv/traceaml` |
| SSM Parameter Store | Key Vault: `az keyvault secret show --vault-name <kv> --name llm-api-key --query value -o tsv` (VM managed identity with Key Vault Secrets User) |
| EBS snapshots | Azure Backup for the VM, or disk snapshots |

Azure Container Apps can run `web`, and `api` once the case store is Azure Database for PostgreSQL. Azure Files (SMB) is not safe for the SQLite file.

## 7. What was verified

On a local Docker host with `deploy/compose.prod.yaml`:

- Both images build. The release bundle builds and its checksums verify. The loader container loads from the label-free bundle with exact reconciliation, and a full 5,078,345-row load into the dev FalkorDB reconciled exactly.
- Through Caddy with a local certificate: 401 without credentials or with a wrong password, 200 with them, HSTS and security headers present, HTTP redirects to HTTPS, health shows FalkorDB available, the queue reports routes and graph availability, and the agent review streams event by event (started, tool events with their Cypher, completed) without buffering.
- In a browser through Caddy: the overview and an agent review render with no console errors on a fresh case store.

This smoke test found a bug: on a brand-new case store, the first page's concurrent requests raced to create the schema and returned 503. It is fixed with an initialization lock, and `services/api/tests/test_case_db_init.py` covers it.

Not verified here: a real Let's Encrypt certificate and DNS (they need a public host), the AWS, GCP and Azure CLI steps, and the Gemini agent (no key was available).
