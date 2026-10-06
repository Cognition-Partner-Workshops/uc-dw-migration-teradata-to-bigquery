variable "bucket_name" {
  type = string
}

variable "cors_allowed_origins" {
  description = "Origins allowed to PUT/GET objects from the browser (the CloudFront domain is added after the first apply if needed)"
  type        = list(string)
  default     = ["*"]
}
