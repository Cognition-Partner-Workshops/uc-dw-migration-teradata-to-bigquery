# CloudFront distribution of the SPA: S3 origin (OAC) + /api/* proxy to the ALB, CloudFront
# functions for SPA routing and the /api prefix, and the response headers policy whose CSP replaces
# the Salesforce CSP trusted sites (cspTrustedSite:openStreetMap, cspTrustedSite:s3_us_west_2_amazonaws_com).

resource "aws_cloudfront_function" "spa_rewrite" {
  name    = "${var.name}-spa-rewrite"
  runtime = "cloudfront-js-2.0"
  comment = "Serve index.html for React Router paths"
  publish = true
  code    = file("${path.module}/functions/spa-rewrite.js")
}

resource "aws_cloudfront_function" "api_strip_prefix" {
  name    = "${var.name}-api-strip-prefix"
  runtime = "cloudfront-js-2.0"
  comment = "Strip the /api prefix before forwarding to the ALB"
  publish = true
  code    = file("${path.module}/functions/api-strip-prefix.js")
}

locals {
  csp = join("; ", [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'", # Mantine and Leaflet set inline styles
    "font-src 'self' data:",
    join(" ", concat(["img-src 'self' data: blob:"], var.csp_image_sources)),
    join(" ", concat(["connect-src 'self'"], var.csp_connect_sources)),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ])
}

resource "aws_cloudfront_response_headers_policy" "web" {
  name    = "${var.name}-web"
  comment = "Security headers for the Dreamhouse SPA; CSP replaces the Salesforce CSP trusted sites"

  security_headers_config {
    content_security_policy {
      content_security_policy = local.csp
      override                = true
    }
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      override                   = true
    }
  }
}

# AWS managed policies (fixed ids, see the CloudFront developer guide)
locals {
  cache_policy_caching_optimized        = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  cache_policy_caching_disabled         = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
  origin_request_all_viewer_except_host = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
}

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.name} web (React SPA) + /api proxy"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  http_version        = "http2and3"

  origin {
    origin_id                = "web-s3"
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  origin {
    origin_id   = "api-alb"
    domain_name = var.api_origin_domain_name

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "http-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 30
      origin_keepalive_timeout = 5
    }
  }

  default_cache_behavior {
    target_origin_id           = "web-s3"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = local.cache_policy_caching_optimized
    response_headers_policy_id = aws_cloudfront_response_headers_policy.web.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_rewrite.arn
    }
  }

  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = "api-alb"
    viewer_protocol_policy   = "https-only"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = local.cache_policy_caching_disabled
    origin_request_policy_id = local.origin_request_all_viewer_except_host

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.api_strip_prefix.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1"
  }
}
