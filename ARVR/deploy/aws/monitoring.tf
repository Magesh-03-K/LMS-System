# ==============================================================================
# AWS CloudWatch Monitoring, Alarms & Observability Dashboard
# Golden Signals: Traffic, Latency, Errors, Saturation | Business Workflow Alerts
# ==============================================================================

# 1. Amazon SNS Topic for SRE Alerts
resource "aws_sns_topic" "alerts" {
  name = "${var.app_name}-sre-alerts-${var.environment}"

  tags = {
    Name        = "${var.app_name}-sre-alerts"
    Environment = var.environment
  }
}

# ------------------------------------------------------------------------------
# 2. Application Load Balancer Alarms (Ingress & Errors)
# ------------------------------------------------------------------------------

# Alarm: High Target 5xx Error Rate (> 10 errors over 5 minutes)
resource "aws_cloudwatch_metric_alarm" "alb_5xx_errors" {
  alarm_name          = "${var.app_name}-ALB-High5xxErrors-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300 # 5 minutes
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Triggered when ALB target 5xx error responses exceed threshold"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.app.arn_suffix
  }
}

# Alarm: High Latency (P95 Target Response Time > 1.5s)
resource "aws_cloudwatch_metric_alarm" "alb_high_latency" {
  alarm_name          = "${var.app_name}-ALB-HighLatency-P95-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  extended_statistic  = "p95"
  threshold           = 1.5 # 1500 ms
  alarm_description   = "Triggered when 95th percentile target response time exceeds 1.5 seconds"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.app.arn_suffix
  }
}

# Alarm: Unhealthy Host Count (> 0 unhealthy containers in target group)
resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_hosts" {
  alarm_name          = "${var.app_name}-ALB-UnhealthyHosts-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "Triggered when one or more ECS containers fail ALB health checks"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.app.arn_suffix
  }
}

# ------------------------------------------------------------------------------
# 3. Amazon RDS PostgreSQL Database Alarms
# ------------------------------------------------------------------------------

# Alarm: High Database CPU Utilization (> 80% for 10 minutes)
resource "aws_cloudwatch_metric_alarm" "rds_high_cpu" {
  alarm_name          = "${var.app_name}-RDS-HighCPU-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Triggered when RDS PostgreSQL CPU utilization exceeds 80%"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.identifier
  }
}

# Alarm: Low Database Free Storage Space (< 10 GB remaining)
resource "aws_cloudwatch_metric_alarm" "rds_low_storage" {
  alarm_name          = "${var.app_name}-RDS-LowFreeStorage-${var.environment}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 10000000000 # 10 GB in bytes
  alarm_description   = "Triggered when RDS PostgreSQL free storage falls below 10 GB"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.identifier
  }
}

# ------------------------------------------------------------------------------
# 4. Amazon ElastiCache Redis Alarms
# ------------------------------------------------------------------------------

# Alarm: High Redis Memory Utilization (> 80%)
resource "aws_cloudwatch_metric_alarm" "redis_high_memory" {
  alarm_name          = "${var.app_name}-Redis-HighMemory-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Triggered when ElastiCache Redis memory usage exceeds 80%"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.redis.id}-001"
  }
}

# ------------------------------------------------------------------------------
# 5. Business Workflow & Security Metric Filters (Derived from Logs)
# ------------------------------------------------------------------------------

# Metric Filter: Security Authentication Failures
resource "aws_cloudwatch_log_metric_filter" "auth_failures" {
  name           = "${var.app_name}-AuthFailuresMetricFilter"
  pattern        = "[SECURITY_AUDIT] * AUTH_LOGIN_FAILURE *"
  log_group_name = aws_cloudwatch_log_group.ecs.name

  metric_transformation {
    name          = "AuthFailureCount"
    namespace     = "ARVR/Security"
    value         = "1"
    default_value = 0
  }
}

# Alarm: Auth Failure Spike (> 20 failed login attempts in 5 minutes)
resource "aws_cloudwatch_metric_alarm" "auth_failure_spike" {
  alarm_name          = "${var.app_name}-Security-AuthFailureSpike-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "AuthFailureCount"
  namespace           = "ARVR/Security"
  period              = 300
  statistic           = "Sum"
  threshold           = 20
  alarm_description   = "Triggered when authentication failures exceed 20 within 5 minutes (potential brute-force attempt)"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

# Metric Filter: Business Workflow Failures (Task, Attendance, Certification)
resource "aws_cloudwatch_log_metric_filter" "workflow_failures" {
  name           = "${var.app_name}-WorkflowFailuresMetricFilter"
  pattern        = "[WORKFLOW_FAILURE] *"
  log_group_name = aws_cloudwatch_log_group.ecs.name

  metric_transformation {
    name          = "WorkflowFailureCount"
    namespace     = "ARVR/Workflows"
    value         = "1"
    default_value = 0
  }
}

# Alarm: Workflow Failure Spike (> 5 workflow failures in 5 minutes)
resource "aws_cloudwatch_metric_alarm" "workflow_failure_spike" {
  alarm_name          = "${var.app_name}-Business-WorkflowFailureSpike-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "WorkflowFailureCount"
  namespace           = "ARVR/Workflows"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Triggered when critical business workflow failures (tasks, certificates, attendance) exceed 5 within 5 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

# ------------------------------------------------------------------------------
# 6. SRE Operational Overview Dashboard
# ------------------------------------------------------------------------------
resource "aws_cloudwatch_dashboard" "sre_dashboard" {
  dashboard_name = "ARVR-Academy-SRE-Overview"

  dashboard_body = jsonencode({
    widgets = [
      # Widget 1: Traffic & Request Volume
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", aws_lb.main.arn_suffix, { stat = "Sum", period = 60, color = "#1f77b4" }]
          ]
          view    = "timeSeries"
          stacked = false
          title   = "HTTP Ingress Traffic (Requests/min)"
        }
      },
      # Widget 2: Latency Percentiles
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", aws_lb.main.arn_suffix, { stat = "p50", period = 60, label = "P50 Latency" }],
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", aws_lb.main.arn_suffix, { stat = "p95", period = 60, label = "P95 Latency", color = "#ff7f0e" }],
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", aws_lb.main.arn_suffix, { stat = "p99", period = 60, label = "P99 Latency", color = "#d62728" }]
          ]
          view    = "timeSeries"
          stacked = false
          title   = "Application Response Latency (Seconds)"
        }
      },
      # Widget 3: HTTP Error Codes (4xx vs 5xx)
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "HTTPCode_Target_4XX_Count", "LoadBalancer", aws_lb.main.arn_suffix, { stat = "Sum", period = 60, color = "#f1c40f" }],
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", aws_lb.main.arn_suffix, { stat = "Sum", period = 60, color = "#e74c3c" }]
          ]
          view    = "timeSeries"
          stacked = false
          title   = "HTTP 4xx & 5xx Error Counts"
        }
      },
      # Widget 4: Database Health (CPU & Storage)
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.postgres.identifier, { stat = "Average", period = 60, label = "DB CPU %" }],
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", aws_db_instance.postgres.identifier, { stat = "Average", period = 60, label = "Active Connections", yAxis = "right" }]
          ]
          view    = "timeSeries"
          stacked = false
          title   = "PostgreSQL Resource Utilization"
        }
      }
    ]
  })
}
