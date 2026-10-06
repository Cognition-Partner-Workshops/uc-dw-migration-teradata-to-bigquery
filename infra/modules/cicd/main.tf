# GitHub Actions -> AWS without long-lived keys: the workflows of the repository exchange their
# GitHub OIDC token for one of two roles. `plan` (pull requests) is read-only and can only plan
# Terraform; `deploy` (pushes to the demo branch) can push the API image, run the one-off
# migration task, roll the ECS service and publish the web build. Nothing here can create
# resources: infra changes are still applied by a human with `make -C infra apply`.

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  github_oidc_url = "https://token.actions.githubusercontent.com"
  # Subject claims GitHub puts into the token (https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/about-security-hardening-with-openid-connect#example-subject-claims)
  branch_subject       = "repo:${var.github_repository}:ref:refs/heads/${var.github_branch}"
  pull_request_subject = "repo:${var.github_repository}:pull_request"
  oidc_provider_arn    = var.create_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : data.aws_iam_openid_connect_provider.github[0].arn
  task_definition_arns = [for family in var.ecs_task_families : "arn:aws:ecs:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:task-definition/${family}:*"]
  task_arns            = ["arn:aws:ecs:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:task/${var.ecs_cluster_name}/*"]
}

# ----- OIDC provider -----------------------------------------------------------------------------
# One provider per account. The demo account already has it (shared with other demos), so by
# default the existing one is looked up; set create_oidc_provider = true in a fresh account.

data "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 0 : 1
  url   = local.github_oidc_url
}

resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 1 : 0

  url            = local.github_oidc_url
  client_id_list = ["sts.amazonaws.com"]
  # GitHub's certificate thumbprints are no longer checked by AWS for this provider, but the attribute is required.
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1", "1c58a3a8518e8759bf075b76b750d4f2df264fcd"]
}

# ----- Trust policies ----------------------------------------------------------------------------

data "aws_iam_policy_document" "assume_plan" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [local.pull_request_subject, local.branch_subject]
    }
  }
}

data "aws_iam_policy_document" "assume_deploy" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [local.branch_subject]
    }
  }
}

# ----- Shared: read the Terraform state (terraform init / output / plan) -------------------------

data "aws_iam_policy_document" "state_read" {
  statement {
    sid       = "StateBucketList"
    actions   = ["s3:ListBucket", "s3:GetBucketLocation"]
    resources = ["arn:aws:s3:::${var.state_bucket}"]
  }

  statement {
    sid       = "StateRead"
    actions   = ["s3:GetObject", "s3:GetObjectVersion"]
    resources = ["arn:aws:s3:::${var.state_bucket}/${var.state_key}"]
  }

  statement {
    sid       = "LockTableRead"
    actions   = ["dynamodb:GetItem", "dynamodb:DescribeTable"]
    resources = ["arn:aws:dynamodb:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:table/${var.lock_table}"]
  }
}

# ----- plan role (pull requests): ReadOnlyAccess + state ----------------------------------------

resource "aws_iam_role" "plan" {
  name                 = "${var.name}-github-plan"
  description          = "GitHub Actions (${var.github_repository} pull requests): terraform plan, read-only"
  assume_role_policy   = data.aws_iam_policy_document.assume_plan.json
  max_session_duration = 3600
}

resource "aws_iam_role_policy_attachment" "plan_readonly" {
  role       = aws_iam_role.plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

resource "aws_iam_role_policy" "plan_state" {
  name   = "terraform-state"
  role   = aws_iam_role.plan.id
  policy = data.aws_iam_policy_document.state_read.json
}

# ----- deploy role (pushes to the demo branch) --------------------------------------------------

resource "aws_iam_role" "deploy" {
  name                 = "${var.name}-github-deploy"
  description          = "GitHub Actions (${var.github_repository} ${var.github_branch}): ECR push, ECS migrate/deploy, S3 + CloudFront web publish"
  assume_role_policy   = data.aws_iam_policy_document.assume_deploy.json
  max_session_duration = 3600
}

resource "aws_iam_role_policy" "deploy_state" {
  name   = "terraform-state"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.state_read.json
}

data "aws_iam_policy_document" "deploy" {
  statement {
    sid       = "EcrLogin"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "EcrPush"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:DescribeRepositories",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:ListImages",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = [var.ecr_repository_arn]
  }

  statement {
    sid       = "EcsDescribe"
    actions   = ["ecs:DescribeTaskDefinition", "ecs:ListTasks"]
    resources = ["*"]
  }

  statement {
    sid       = "EcsService"
    actions   = ["ecs:DescribeServices", "ecs:UpdateService"]
    resources = [var.ecs_service_arn]
  }

  statement {
    sid       = "EcsRunMigrationTask"
    actions   = ["ecs:RunTask"]
    resources = local.task_definition_arns
    condition {
      test     = "ArnEquals"
      variable = "ecs:cluster"
      values   = [var.ecs_cluster_arn]
    }
  }

  statement {
    sid       = "EcsTasks"
    actions   = ["ecs:DescribeTasks", "ecs:StopTask"]
    resources = local.task_arns
  }

  statement {
    sid       = "PassTaskRoles"
    actions   = ["iam:PassRole"]
    resources = [var.ecs_execution_role_arn, var.ecs_task_role_arn]
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }

  statement {
    sid       = "MigrationLogs"
    actions   = ["logs:DescribeLogStreams", "logs:GetLogEvents"]
    resources = [var.api_log_group_arn, "${var.api_log_group_arn}:*"]
  }

  statement {
    sid       = "WebBucketList"
    actions   = ["s3:ListBucket", "s3:GetBucketLocation"]
    resources = [var.web_bucket_arn]
  }

  statement {
    sid       = "WebBucketObjects"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${var.web_bucket_arn}/*"]
  }

  statement {
    sid       = "CloudFrontInvalidate"
    actions   = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation", "cloudfront:ListInvalidations"]
    resources = [var.cloudfront_distribution_arn]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "deploy-demo"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}
