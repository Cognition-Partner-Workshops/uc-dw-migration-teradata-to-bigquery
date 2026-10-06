# infra/ — AWS demo environment (Terraform)

One `demo` environment in **us-east-1** of account **599083837640**, everything tagged
`project=salesforce-to-aws-demo` (provider `default_tags`) so it can be found and torn down.

```
infra/
├── Makefile              bootstrap / plan / apply / push / deploy-api / deploy-web / smoke / destroy
├── envs/demo/            root module: backend.tf (S3 state + DynamoDB lock), main.tf (module wiring),
│                         terraform.tfvars (non-secret settings), outputs.tf (non-secret outputs)
├── modules/network/      VPC 10.42.0.0/16, 2 AZs, public subnets (ALB, NAT) + private subnets (ECS, RDS), S3 gateway endpoint
├── modules/database/     RDS PostgreSQL 16 db.t4g.micro, gp3 encrypted, private; credentials in Secrets Manager
├── modules/api/          ECR repository, ECS Fargate cluster/service, internet-facing ALB, IAM roles, CloudWatch log group
├── modules/web/          private S3 bucket + CloudFront (OAC) for the React build, /api/* proxy to the ALB, CSP headers
├── modules/auth/         Cognito user pool + public SPA client; groups mirror the Salesforce permission sets
├── modules/files/        private S3 bucket for uploaded files (replaces ContentVersion.VersionData)
└── scripts/              the shell behind the Makefile targets
```

## Salesforce → AWS

| Salesforce | AWS (this directory) |
| --- | --- |
| Org / Lightning platform | VPC `sf2aws-demo`, ECS Fargate service `sf2aws-demo-api` behind ALB (`api_url` output) |
| Custom objects, Apex data | RDS PostgreSQL 16 `sf2aws-demo-postgres` (private subnets, encrypted) |
| Named credentials / org secrets | Secrets Manager `salesforce-to-aws-demo/demo/api` (`DATABASE_URL`, read by the API at start-up) |
| Lightning app (LWC) | React build in S3 `sf2aws-demo-web-599083837640` served by CloudFront (`web_url` output) |
| Permission set `dreamhouse` | Cognito group `dreamhouse` (+ demo-only `dreamhouse-admin`), user pool `sf2aws-demo` |
| `ContentVersion` files | S3 `sf2aws-demo-files-599083837640` (private, pre-signed URLs) |
| CSP trusted sites (`openStreetMap`, `s3_us_west_2_amazonaws_com`) | CloudFront response headers policy `Content-Security-Policy` (`modules/web/cloudfront.tf`) |
| Debug logs / event monitoring | CloudWatch Logs `/salesforce-to-aws-demo/demo/api`, RDS `postgresql` + `upgrade` exports |

The row-level mapping lives in [`docs/migration/mapping.yaml`](../docs/migration/mapping.yaml).

## Usage

Requires Terraform ≥ 1.11, the AWS CLI, Docker and GNU make, with `AWS_ACCESS_KEY_ID` /
`AWS_SECRET_ACCESS_KEY` of account 599083837640 in the environment (never in files).

```bash
make -C infra up          # bootstrap backend -> apply -> build+push API image -> migrate -> roll ECS -> build+upload web -> smoke
make -C infra plan        # must print "No changes" after `up`
make -C infra output      # non-secret outputs (api_url, web_url, cognito ids, bucket names, ...)
make -C infra smoke       # ALB /health, CloudFront SPA (+ deep link), CloudFront /api proxy, CSP header
make -C infra destroy     # tear down every resource (buckets and ECR images are force-deleted)
make -C infra destroy-backend   # then remove the state bucket (all versions) and the lock table
```

From the repository root the same targets are reachable as `make infra-<target>`.

Deploying a new API build: `make -C infra push migrate deploy-api` (the service runs `<ecr>:latest`;
each push also tags the git SHA and pushes the Dockerfile's `migrate` stage as `<ecr>:migrate`).
`migrate` runs `prisma migrate deploy` as a one-off Fargate task (`sf2aws-demo-api-migrate`, same
subnets, security group and `DATABASE_URL` secret as the API), waits for it and prints its log.
Deploying the web app: `make -C infra deploy-web` builds
`app/web` with `VITE_AUTH_MODE=cognito` and the pool/client ids from the outputs, uploads
`dist/` (hashed assets immutable, `index.html` no-cache) and invalidates the distribution.

## CI/CD (GitHub Actions, OIDC — no AWS keys in GitHub)

`modules/cicd` creates two IAM roles that trust the account's GitHub OIDC provider
(`token.actions.githubusercontent.com`, looked up; `create_github_oidc_provider = true` creates it
in a fresh account) for this repository only:

| Role | Trusted token subject | Used by | Allowed to |
| --- | --- | --- | --- |
| `sf2aws-demo-github-plan` | `repo:<repo>:pull_request`, `…:ref:refs/heads/salesforce-to-aws-demo` | [`infra.yml`](../.github/workflows/infra.yml) `plan` job | `ReadOnlyAccess` + read the state bucket/lock table → `terraform plan -lock=false` |
| `sf2aws-demo-github-deploy` | `…:ref:refs/heads/salesforce-to-aws-demo` | [`deploy.yml`](../.github/workflows/deploy.yml) | push to the API ECR repository, `ecs:RunTask` of the migration task definition, `ecs:UpdateService` on the API service, `iam:PassRole` of the two task roles, read the migration log, put/delete objects in the web bucket, invalidate the distribution, read the state |

Pull requests: `fmt -check`, `validate`, secret grep, shellcheck and a plan whose output lands in the
job summary (changes do not fail the check). Pushes to `salesforce-to-aws-demo` touching
`app/api`, `app/web` or the scripts run `deploy.yml`: `make push` → `make migrate` → `make deploy-api`
→ `make deploy-web` → `make smoke`, i.e. the same targets as a manual deployment. The deploy role
cannot create or change AWS resources, so Terraform changes stay a human `make -C infra apply`
(the PR plan shows what is pending).

## Secrets

* The RDS master password is generated as a Terraform **ephemeral** value and written through
  **write-only** arguments (`password_wo`, `secret_string_wo`), so it is in neither the state file
  nor any output; it exists only in Secrets Manager (`app_secret_arn` output names the secret,
  not its value). Rotate by bumping `db_password_version` in `terraform.tfvars`.
* The ECS task gets `AWS_SECRETS_MANAGER_SECRET_ID` and reads `DATABASE_URL` itself
  (`app/api/src/config/load-config.ts`); the task role may read exactly that one secret.
* The Cognito SPA client has no client secret; everything `deploy-web.sh` bakes into the bundle is public.
* `terraform.tfvars` holds non-secret settings only; `*.auto.tfvars`, state and plan files are git-ignored.

## Costs / tear-down

Sized for a demo: single NAT gateway, one `db.t4g.micro`, one 0.25 vCPU Fargate task, CloudFront
`PriceClass_100`, 1-day RDS backups, `skip_final_snapshot`, `deletion_protection = false`,
`force_destroy` on every bucket and the ECR repository. `make destroy` therefore removes
everything, including data, without manual steps.

CI (`.github/workflows/infra.yml`) runs `terraform fmt -check`, `terraform validate`,
a secret-pattern grep, shellcheck and a read-only `terraform plan` through the OIDC plan role;
`apply` stays manual (see *CI/CD* above).
