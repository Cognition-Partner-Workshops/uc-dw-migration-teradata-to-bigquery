variable "name" {
  type = string
}

variable "bucket_name" {
  description = "Private S3 bucket holding the React build"
  type        = string
}

variable "api_origin_domain_name" {
  description = "DNS name of the API ALB; CloudFront proxies /api/* to it (HTTP, prefix stripped)"
  type        = string
}

variable "csp_image_sources" {
  description = "Extra img-src origins (Salesforce CSP trusted sites + the files bucket)"
  type        = list(string)
}

variable "csp_connect_sources" {
  description = "Extra connect-src origins (Cognito)"
  type        = list(string)
}
