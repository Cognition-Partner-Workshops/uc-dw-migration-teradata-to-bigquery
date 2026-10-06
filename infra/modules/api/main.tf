# The Dreamhouse API (app/api, NestJS + Prisma): ECR repository, ECS Fargate service in the private
# subnets behind an internet-facing ALB, CloudWatch Logs, IAM roles. The image is built from
# app/api/Dockerfile and pushed by `make push`; the service runs <ecr>:<image_tag>.

data "aws_caller_identity" "current" {}

locals {
  log_group = "/${var.project}/${var.environment}/api"
}

# ----- ECR ---------------------------------------------------------------------------------------

resource "aws_ecr_repository" "api" {
  name                 = "${var.project}/api"
  image_tag_mutability = "MUTABLE" # `latest` is re-pushed by make push / CI
  force_delete         = true      # demo tear-down deletes the images too

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "keep the last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

# ----- Logs --------------------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "api" {
  name              = local.log_group
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "ecs_exec" {
  name              = "/${var.project}/${var.environment}/ecs-exec"
  retention_in_days = var.log_retention_days
}

# ----- Security groups ---------------------------------------------------------------------------

resource "aws_security_group" "alb" {
  name        = "${var.name}-alb"
  description = "Internet-facing ALB of the API"
  vpc_id      = var.vpc_id

  tags = { Name = "${var.name}-alb" }
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP from anywhere (CloudFront /api/* and direct demo access)"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "alb_to_tasks" {
  security_group_id            = aws_security_group.alb.id
  description                  = "To the API tasks"
  from_port                    = var.container_port
  to_port                      = var.container_port
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.task.id
}

resource "aws_security_group" "task" {
  name        = "${var.name}-api"
  description = "API Fargate tasks"
  vpc_id      = var.vpc_id

  tags = { Name = "${var.name}-api" }
}

resource "aws_vpc_security_group_ingress_rule" "task_from_alb" {
  security_group_id            = aws_security_group.task.id
  description                  = "From the ALB"
  from_port                    = var.container_port
  to_port                      = var.container_port
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.alb.id
}

resource "aws_vpc_security_group_egress_rule" "task_all" {
  security_group_id = aws_security_group.task.id
  description       = "RDS, AWS APIs and the geocoding callout (nominatim.openstreetmap.org, the Salesforce remote site setting) through the NAT gateway"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# ----- ALB ---------------------------------------------------------------------------------------

resource "aws_lb" "api" {
  name               = "${var.name}-api"
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  drop_invalid_header_fields = true
  idle_timeout               = 60
}

resource "aws_lb_target_group" "api" {
  name        = "${var.name}-api"
  port        = var.container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  deregistration_delay = 15

  health_check {
    path                = "/health"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# ----- IAM ---------------------------------------------------------------------------------------

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

# Pulls the image and writes logs (used by the ECS agent, not by the application).
resource "aws_iam_role" "execution" {
  name               = "${var.name}-api-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# What the application itself may do.
resource "aws_iam_role" "task" {
  name               = "${var.name}-api-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

data "aws_iam_policy_document" "task" {
  statement {
    sid       = "ReadRuntimeConfig"
    actions   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
    resources = [var.app_secret_arn]
  }

  statement {
    sid       = "FilesBucket"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:GetObjectAttributes"]
    resources = ["${var.files_bucket_arn}/*"]
  }

  statement {
    sid       = "FilesBucketList"
    actions   = ["s3:ListBucket", "s3:GetBucketLocation"]
    resources = [var.files_bucket_arn]
  }

  statement {
    # token verification needs no permission; these are for the admin endpoints (user/group management)
    sid = "CognitoAdmin"
    actions = [
      "cognito-idp:AdminGetUser",
      "cognito-idp:AdminCreateUser",
      "cognito-idp:AdminSetUserPassword",
      "cognito-idp:AdminAddUserToGroup",
      "cognito-idp:AdminRemoveUserFromGroup",
      "cognito-idp:AdminListGroupsForUser",
      "cognito-idp:ListUsers",
      "cognito-idp:ListUsersInGroup",
    ]
    resources = [var.user_pool_arn]
  }

  statement {
    sid = "EcsExec"
    actions = [
      "ssmmessages:CreateControlChannel",
      "ssmmessages:CreateDataChannel",
      "ssmmessages:OpenControlChannel",
      "ssmmessages:OpenDataChannel",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "task" {
  name   = "${var.name}-api-task"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task.json
}

# ----- ECS ---------------------------------------------------------------------------------------

resource "aws_ecs_cluster" "this" {
  name = var.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  configuration {
    execute_command_configuration {
      logging = "OVERRIDE"
      log_configuration {
        cloud_watch_log_group_name = aws_cloudwatch_log_group.ecs_exec.name
      }
    }
  }
}

resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name       = aws_ecs_cluster.this.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${var.name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name      = "api"
    image     = "${aws_ecr_repository.api.repository_url}:${var.image_tag}"
    essential = true

    portMappings = [{
      name          = "http"
      containerPort = var.container_port
      protocol      = "tcp"
    }]

    # Non-secret configuration. DATABASE_URL is read from Secrets Manager by the application
    # (AWS_SECRETS_MANAGER_SECRET_ID) and never passed as a plain environment variable.
    # FILES_BUCKET / COGNITO_* are provided for the files and auth tickets; config.schema.ts
    # ignores unknown keys until they are added there.
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = tostring(var.container_port) },
      { name = "LOG_LEVEL", value = "info" },
      { name = "AWS_REGION", value = var.aws_region },
      { name = "AWS_SECRETS_MANAGER_SECRET_ID", value = var.app_secret_arn },
      { name = "FILES_BUCKET", value = var.files_bucket_name },
      { name = "COGNITO_USER_POOL_ID", value = var.user_pool_id },
      { name = "COGNITO_CLIENT_ID", value = var.user_pool_client_id },
    ]

    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://127.0.0.1:${var.container_port}/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 20
    }

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.api.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "api"
      }
    }

    readonlyRootFilesystem = false
  }])
}

resource "aws_ecs_service" "api" {
  name            = "${var.name}-api"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  enable_execute_command             = true
  health_check_grace_period_seconds  = 60
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.task.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = var.container_port
  }

  propagate_tags = "SERVICE"

  depends_on = [aws_lb_listener.http, aws_iam_role_policy.task, aws_iam_role_policy_attachment.execution]
}
