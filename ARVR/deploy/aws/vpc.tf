# ==============================================================================
# VPC & 3-Tier Network Segmentation
# Tier 1: Public Subnets (ALB & NAT Gateway)
# Tier 2: Private Application Subnets (ECS Fargate Containers)
# Tier 3: Isolated Database Subnets (RDS PostgreSQL & ElastiCache Redis)
# ==============================================================================

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name        = "${var.app_name}-vpc-${var.environment}"
    Environment = var.environment
  }
}

# Internet Gateway for public ingress/egress
resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "${var.app_name}-igw-${var.environment}"
    Environment = var.environment
  }
}

# ------------------------------------------------------------------------------
# 1. Public Subnets (Tier 1: Load Balancer & NAT)
# ------------------------------------------------------------------------------
resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index + 1) # 10.0.1.0/24, 10.0.2.0/24
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "${var.app_name}-public-subnet-${count.index + 1}-${var.environment}"
    Tier        = "Public"
    Environment = var.environment
  }
}

# Elastic IP for NAT Gateway
resource "aws_eip" "nat" {
  domain     = "vpc"
  depends_on = [aws_internet_gateway.gw]

  tags = {
    Name        = "${var.app_name}-nat-eip-${var.environment}"
    Environment = var.environment
  }
}

# NAT Gateway (enables private ECS tasks to reach S3 & external APIs)
resource "aws_nat_gateway" "nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = {
    Name        = "${var.app_name}-nat-gw-${var.environment}"
    Environment = var.environment
  }

  depends_on = [aws_internet_gateway.gw]
}

# Public Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw.id
  }

  tags = {
    Name        = "${var.app_name}-public-rt-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ------------------------------------------------------------------------------
# 2. Private Application Subnets (Tier 2: ECS Fargate Containers)
# ------------------------------------------------------------------------------
resource "aws_subnet" "private_app" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10) # 10.0.10.0/24, 10.0.11.0/24
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name        = "${var.app_name}-private-app-subnet-${count.index + 1}-${var.environment}"
    Tier        = "PrivateApp"
    Environment = var.environment
  }
}

# Private Route Table (routes outbound traffic to NAT Gateway)
resource "aws_route_table" "private_app" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat.id
  }

  tags = {
    Name        = "${var.app_name}-private-app-rt-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_route_table_association" "private_app" {
  count          = length(aws_subnet.private_app)
  subnet_id      = aws_subnet.private_app[count.index].id
  route_table_id = aws_route_table.private_app.id
}

# ------------------------------------------------------------------------------
# 3. Isolated Database Subnets (Tier 3: RDS PostgreSQL & ElastiCache)
# NO internet route. Zero external exposure.
# ------------------------------------------------------------------------------
resource "aws_subnet" "isolated_data" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 100) # 10.0.100.0/24, 10.0.101.0/24
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name        = "${var.app_name}-isolated-data-subnet-${count.index + 1}-${var.environment}"
    Tier        = "IsolatedData"
    Environment = var.environment
  }
}

resource "aws_route_table" "isolated_data" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "${var.app_name}-isolated-data-rt-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_route_table_association" "isolated_data" {
  count          = length(aws_subnet.isolated_data)
  subnet_id      = aws_subnet.isolated_data[count.index].id
  route_table_id = aws_route_table.isolated_data.id
}

# ------------------------------------------------------------------------------
# 4. S3 Gateway VPC Endpoint (Cost optimization: bypasses NAT for S3 API calls)
# ------------------------------------------------------------------------------
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private_app.id]

  tags = {
    Name        = "${var.app_name}-s3-endpoint-${var.environment}"
    Environment = var.environment
  }
}
