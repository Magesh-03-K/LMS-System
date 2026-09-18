# ==============================================================================
# Application Load Balancer (ALB) & AWS WAF v2
# Public Ingress | TLS 1.3 Termination | Health Checking | Anti-DDoS WAF Rules
# ==============================================================================

resource "aws_lb" "main" {
  name               = "${var.app_name}-alb-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  drop_invalid_header_fields = true
  enable_deletion_protection = false

  tags = {
    Name        = "${var.app_name}-alb-${var.environment}"
    Environment = var.environment
  }
}

# Target Group pointing to ECS Fargate container private IP addresses
resource "aws_lb_target_group" "app" {
  name        = "${var.app_name}-tg-${var.environment}"
  port        = var.app_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  # Fast connection draining during rolling deployments
  deregistration_delay = 30

  health_check {
    enabled             = true
    path                = "/api/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  tags = {
    Name        = "${var.app_name}-tg-${var.environment}"
    Environment = var.environment
  }
}

# HTTP Port 80 Listener: Mandatory redirect to HTTPS
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS Port 443 Listener: TLS 1.3 Termination
resource "aws_lb_listener" "https" {
  count             = var.certificate_arn != "" ? 1 : 0
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# ------------------------------------------------------------------------------
# AWS WAF v2: Web Application Firewall Protection
# ------------------------------------------------------------------------------
resource "aws_wafv2_web_acl" "alb_waf" {
  name        = "${var.app_name}-waf-${var.environment}"
  description = "Protects AR/VR Academy ALB against common web exploits and volumetric attacks"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # Rule 1: AWS Managed Common Rules (OWASP Top 10)
  rule {
    name     = "AWS-AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # Rule 2: AWS Managed Bad Inputs (SQLi, Directory Traversal)
  rule {
    name     = "AWS-AWSManagedRulesKnownBadInputsRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesKnownBadInputsRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # Rule 3: Rate-Based Rule (Prevents Volumetric DoS: 500 requests per 5 minutes per IP)
  rule {
    name     = "RateLimit500Per5Min"
    priority = 3

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 500
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimit500Per5MinMetric"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.app_name}-waf-metric-${var.environment}"
    sampled_requests_enabled   = true
  }
}

# Associate WAF with ALB
resource "aws_wafv2_web_acl_association" "alb_assoc" {
  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.alb_waf.arn
}
