# EKS Cluster with Custom Modules
# terraform {
#   required_version = ">= 1.0"
#   required_providers {
#     aws = {
#       source  = "hashicorp/aws"
#       version = "~> 5.0"
#     }
#   }
# }

provider "aws" {
  region = var.aws_region
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# Local values
locals {
  cluster_name = "${var.project_name}-${var.environment}-eks"
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# EKS Cluster Module
module "eks_cluster" {
  source = "./modules/eks-cluster"

  cluster_name    = local.cluster_name
  cluster_version = var.cluster_version
  # aws_region      = var.aws_region
  
  vpc_cidr                = var.vpc_cidr
  availability_zones      = slice(data.aws_availability_zones.available.names, 0, 2)
  
  enable_irsa             = var.enable_irsa
  enable_cluster_autoscaler = var.enable_cluster_autoscaler
  
  tags = local.common_tags
}

# EKS Node Group Module
module "eks_node_group" {
  source = "./modules/eks-node-group"

  cluster_name    = module.eks_cluster.cluster_name
  cluster_version = var.cluster_version
  
  node_group_name = "${local.cluster_name}-node-group"
  instance_types  = var.node_instance_types
  capacity_type   = var.capacity_type
  
  desired_size = var.desired_size
  max_size     = var.max_size
  min_size     = var.min_size
  
  subnet_ids = module.eks_cluster.private_subnet_ids
  vpc_id     = module.eks_cluster.vpc_id
  cluster_security_group_id = module.eks_cluster.cluster_security_group_id
  cluster_endpoint = module.eks_cluster.cluster_endpoint
  cluster_ca = module.eks_cluster.cluster_certificate_authority_data
  
  tags = local.common_tags
}
