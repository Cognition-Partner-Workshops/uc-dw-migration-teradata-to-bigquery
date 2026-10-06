# RDS PostgreSQL 16 in the private subnets. The master password is generated as an *ephemeral*
# value and handed to RDS and to Secrets Manager through write-only arguments, so it never
# appears in the Terraform state or in any output. The API reads the secret at start-up
# (AWS_SECRETS_MANAGER_SECRET_ID -> app/api/src/config/load-config.ts).

resource "aws_security_group" "db" {
  name        = "${var.name}-db"
  description = "RDS PostgreSQL: 5432 from the API tasks only"
  vpc_id      = var.vpc_id

  tags = { Name = "${var.name}-db" }
}

resource "aws_vpc_security_group_ingress_rule" "db_from_api" {
  security_group_id            = aws_security_group.db.id
  description                  = "PostgreSQL from the API tasks"
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  referenced_security_group_id = var.client_security_group_id
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name}-db"
  subnet_ids = var.subnet_ids

  tags = { Name = "${var.name}-db" }
}

ephemeral "random_password" "master" {
  length           = 32
  special          = true
  override_special = "-_.~" # URL-safe: the password is embedded in DATABASE_URL
}

resource "aws_db_instance" "this" {
  identifier = "${var.name}-postgres"

  engine                      = "postgres"
  engine_version              = var.engine_version
  auto_minor_version_upgrade  = true
  allow_major_version_upgrade = false
  instance_class              = var.instance_class

  allocated_storage     = 20
  max_allocated_storage = 50
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name             = var.db_name
  username            = var.db_username
  password_wo         = ephemeral.random_password.master.result
  password_wo_version = var.password_version
  port                = 5432

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period = 1
  copy_tags_to_snapshot   = true
  # demo environment: tear-down must not leave anything behind
  skip_final_snapshot = true
  deletion_protection = false
  apply_immediately   = true

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  performance_insights_enabled    = false

  tags = { Name = "${var.name}-postgres" }
}

# RDS creates these log groups itself; declaring them sets the retention and the tags.
resource "aws_cloudwatch_log_group" "rds" {
  for_each = toset(["postgresql", "upgrade"])

  name              = "/aws/rds/instance/${var.name}-postgres/${each.key}"
  retention_in_days = var.log_retention_days
}

resource "aws_secretsmanager_secret" "app" {
  name        = var.secret_name
  description = "Dreamhouse API runtime configuration (DATABASE_URL and PG* connection parts)"
  # demo: destroy deletes the secret immediately so the name can be reused by the next apply
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id

  secret_string_wo = jsonencode({
    # RDS enforces TLS (rds.force_ssl=1 in the PostgreSQL 16 default parameter group). sslmode=require +
    # uselibpqcompat=true makes node-pg (Prisma adapter) encrypt without CA verification; sslaccept is the
    # Prisma CLI equivalent (prisma migrate). The RDS CA bundle is not in the API image, so verify-full
    # is not possible yet; the connection never leaves the VPC.
    DATABASE_URL = "postgresql://${var.db_username}:${urlencode(ephemeral.random_password.master.result)}@${aws_db_instance.this.address}:${aws_db_instance.this.port}/${var.db_name}?schema=public&sslmode=require&uselibpqcompat=true&sslaccept=accept_invalid_certs"
    PGHOST       = aws_db_instance.this.address
    PGPORT       = tostring(aws_db_instance.this.port)
    PGDATABASE   = var.db_name
    PGUSER       = var.db_username
    PGPASSWORD   = ephemeral.random_password.master.result
    PGSSLMODE    = "require"
  })
  secret_string_wo_version = var.password_version
}
