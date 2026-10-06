# Non-secret settings of the `demo` environment. Secrets never live in this file.
aws_region          = "us-east-1"
project             = "salesforce-to-aws-demo"
environment         = "demo"
name                = "sf2aws-demo"
vpc_cidr            = "10.42.0.0/16"
availability_zones  = ["us-east-1a", "us-east-1d"]
db_instance_class   = "db.t4g.micro"
db_engine_version   = "16"
db_password_version = 2 # bump to rotate the master password (RDS and the secret are rewritten together)
api_image_tag       = "latest"
api_desired_count   = 1
log_retention_days  = 14
