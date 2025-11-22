terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Get the default VPC
data "aws_vpc" "default" {
  default = true
}

# Get availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# Security group for the EC2 instance
resource "aws_security_group" "chess_app_sg" {
  name        = "chess-app-sg"
  description = "Security group for Infinite Chess application"
  vpc_id      = data.aws_vpc.default.id

  # SSH access
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  # HTTP access
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS access
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Backend API access
  ingress {
    description = "Backend API"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # React dev server (for development)
  ingress {
    description = "React Dev Server"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound internet access
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "chess-app-sg"
  }
}

# EC2 Instance (Free Tier eligible: t2.micro or t3.micro)
resource "aws_instance" "chess_app" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = var.instance_type
  key_name      = var.key_pair_name

  vpc_security_group_ids = [aws_security_group.chess_app_sg.id]

  user_data = <<-EOF
              #!/bin/bash
              yum update -y
              
              # Install Node.js 18.x
              curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
              yum install -y nodejs
              
              # Install Python 3.11 and pip
              yum install -y python3.11 python3.11-pip
              
              # Install Git
              yum install -y git
              
              # Install Nginx
              yum install -y nginx
              
              # Install PM2 for process management
              npm install -g pm2
              
              # Start Nginx
              systemctl enable nginx
              systemctl start nginx
              
              # Create app directory
              mkdir -p /opt/chess-app
              chown ec2-user:ec2-user /opt/chess-app
              
              # Log completion
              echo "Setup complete at $(date)" >> /var/log/user-data.log
              EOF

  tags = {
    Name = "chess-app-server"
  }
}

# Get the latest Amazon Linux 2023 AMI
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Output the public IP address
output "instance_public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = aws_instance.chess_app.public_ip
}

# Output the public DNS
output "instance_public_dns" {
  description = "Public DNS name of the EC2 instance"
  value       = aws_instance.chess_app.public_dns
}

# Output SSH command
output "ssh_command" {
  description = "Command to SSH into the instance"
  value       = "ssh -i ${var.key_pair_name}.pem ec2-user@${aws_instance.chess_app.public_ip}"
}

