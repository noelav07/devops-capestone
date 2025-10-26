# EKS Node Group Module Outputs
output "node_group_arn" {
  description = "Amazon Resource Name (ARN) of the EKS Node Group"
  value       = aws_eks_node_group.main.arn
}

output "node_group_id" {
  description = "EKS Node Group ID"
  value       = aws_eks_node_group.main.id
}

output "node_group_status" {
  description = "Status of the EKS Node Group"
  value       = aws_eks_node_group.main.status
}

output "node_group_capacity_type" {
  description = "Type of capacity associated with the EKS Node Group"
  value       = aws_eks_node_group.main.capacity_type
}

output "node_group_instance_types" {
  description = "Set of instance types associated with the EKS Node Group"
  value       = aws_eks_node_group.main.instance_types
}

output "node_group_scaling_config" {
  description = "Scaling configuration of the EKS Node Group"
  value       = aws_eks_node_group.main.scaling_config
}

output "node_group_iam_role_arn" {
  description = "Amazon Resource Name (ARN) of the IAM role that provides permissions for the EKS Node Group"
  value       = aws_iam_role.eks_node_group_role.arn
}

output "node_group_security_group_id" {
  description = "Security group ID of the node group"
  value       = aws_security_group.node_group_sg.id
}
