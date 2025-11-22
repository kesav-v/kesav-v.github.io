variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type (must be free tier eligible: t2.micro or t3.micro)"
  type        = string
  default     = "t2.micro"
  
  validation {
    condition     = contains(["t2.micro", "t3.micro"], var.instance_type)
    error_message = "Instance type must be t2.micro or t3.micro for free tier eligibility."
  }
}

variable "key_pair_name" {
  description = "Name of the AWS key pair to use for SSH access"
  type        = string
  
  validation {
    condition     = length(var.key_pair_name) > 0
    error_message = "Key pair name is required."
  }
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to SSH into the instance (use your IP address/32, or 0.0.0.0/0 for anywhere - not recommended for production)"
  type        = string
  default     = "0.0.0.0/0"
}

