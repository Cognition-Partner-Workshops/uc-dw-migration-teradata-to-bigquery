output "bucket_name" {
  value = aws_s3_bucket.web.bucket
}

output "bucket_arn" {
  value = aws_s3_bucket.web.arn
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.web.domain_name
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.web.id
}

output "content_security_policy" {
  value = local.csp
}

output "cloudfront_distribution_arn" {
  value = aws_cloudfront_distribution.web.arn
}
