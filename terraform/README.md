# Terraform Configuration for Infinite Chess App

This Terraform configuration sets up a free-tier EC2 instance on AWS to host the Infinite Chess application.

## Prerequisites

1. **AWS Account** with free tier eligibility
2. **AWS CLI** installed and configured
3. **Terraform** installed (>= 1.0)
4. **AWS Key Pair** created in your AWS account

## Setup Instructions

### 1. Create an AWS Key Pair

If you don't have a key pair yet, create one in the AWS Console:
- Go to EC2 → Key Pairs → Create Key Pair
- Save the `.pem` file securely (you'll need it to SSH into the instance)

### 2. Configure Terraform Variables

Copy the example variables file and fill in your values:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:
```hcl
aws_region     = "us-east-1"  # Choose your preferred region
instance_type  = "t2.micro"   # Free tier eligible
key_pair_name  = "your-key-pair-name"  # Your AWS key pair name
```

### 3. Initialize Terraform

```bash
cd terraform
terraform init
```

### 4. Review the Plan

```bash
terraform plan
```

### 5. Apply the Configuration

```bash
terraform apply
```

Type `yes` when prompted. This will create:
- A security group with necessary ports open
- An EC2 t2.micro instance (free tier eligible)
- The instance will have Node.js, Python, Git, and Nginx pre-installed

### 6. Access Your Instance

After `terraform apply` completes, you'll see output with:
- Public IP address
- Public DNS name
- SSH command

SSH into the instance:
```bash
ssh -i /path/to/your-key.pem ec2-user@<public-ip>
```

## Free Tier Eligibility

- **t2.micro** or **t3.micro** instances are free tier eligible
- 750 hours/month of EC2 usage
- Only applies to new AWS accounts (first 12 months)
- Must be in a free tier eligible region (us-east-1, us-west-2, etc.)

## Security Notes

⚠️ **Important**: By default, the security group allows SSH (port 22) from anywhere (`0.0.0.0/0`). For production, you should restrict this to your IP address.

### How to Restrict SSH Access:

1. **Find your IP address**: Visit https://whatismyipaddress.com/

2. **Update `terraform.tfvars`**:
   ```hcl
   allowed_ssh_cidr = "YOUR_IP_ADDRESS/32"
   ```
   For example: `"203.0.113.42/32"` (replace with your actual IP)

3. **Apply the changes**:
   ```bash
   terraform apply
   ```

The `/32` means "only this specific IP address". This way, only you can SSH into the server, making it much more secure.

## Next Steps

After the instance is created:

1. **Deploy your application**:
   - Clone your repository
   - Set up the backend (Python/Flask)
   - Build and serve the frontend (React)
   - Configure Nginx as a reverse proxy

2. **Configure Nginx** to:
   - Serve the React app on port 80
   - Proxy API requests to the Flask backend on port 8080

3. **Set up process management**:
   - Use PM2 to keep the backend running
   - Configure systemd for Nginx

## Cleanup

To destroy all resources and avoid charges:

```bash
terraform destroy
```

## Cost Estimation

- **EC2 t2.micro**: Free (within free tier limits)
- **Data Transfer**: First 1 GB/month free, then $0.09/GB
- **Storage**: 30 GB EBS free tier (included with instance)

Total estimated cost: **$0/month** (within free tier limits)

