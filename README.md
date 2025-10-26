# End-to-end: Provisioning EKS with custom Terraform modules and validating access

This project provisions an Amazon EKS cluster with Terraform using custom modules for VPC, EKS control plane, and managed node groups. It also documents how to access the cluster and validate external traffic.

## Repository layout

- `main.tf` – Root configuration wiring modules and providers
- `variables.tf`, `outputs.tf`, `versions.tf` – Inputs/outputs and provider versions
- `modules/vpc` – VPC with public/private subnets, IGW, NAT, routes
- `modules/eks-cluster` – EKS control plane, IAM, SGs, IRSA, addons
- `modules/eks-node-group` – Managed node group, IAM, SG, optional launch template

## Features

- Highly available VPC across multiple AZs (public/private subnets)
- EKS control plane with logs enabled and IRSA support
- Managed node groups (SPOT or ON_DEMAND) with autoscaling
- Core addons installed (VPC CNI, CoreDNS, kube-proxy, EBS CSI)
- Pragmatic security groups for control plane and workers

## Prerequisites

1. AWS CLI configured with credentials (`aws sts get-caller-identity` should work)
2. Terraform >= 1.0
3. kubectl
4. AWS IAM permissions for EKS, EC2, VPC, IAM

## Deploy

1. Change into the directory:
   ```bash
   cd eks-terraform
   ```

2. Create your variables file (example values shown):
   ```hcl
   # terraform.tfvars
   project_name       = "my-eks-project"
   environment        = "dev"
   aws_region         = "us-west-2"
   cluster_version    = "1.28"
   vpc_cidr           = "10.0.0.0/16"
   node_instance_types = ["t3.medium"]
   capacity_type      = "ON_DEMAND"
   desired_size       = 2
   max_size           = 4
   min_size           = 1
   enable_irsa        = true
   enable_cluster_autoscaler = true
   ```

3. Initialize, plan, and apply:
   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

## Access the cluster

Update kubeconfig from a machine with AWS creds:
```bash
aws eks update-kubeconfig --region <region> --name <cluster-name>
```

Validate access:
```bash
kubectl get nodes
kubectl get pods -n kube-system
```

## Deploy and expose a sample app

```bash
kubectl create deployment nginx --image=nginx
kubectl expose deployment nginx --port=80 --type=LoadBalancer
kubectl get svc nginx -w  # wait for EXTERNAL-IP / hostname
```

Open the LoadBalancer DNS name in a browser or:
```bash
curl -I http://<elb-dns-name>
```

## Important fix we applied (why external access worked)

Kubernetes `Service type=LoadBalancer` forwards traffic to node ports (default 30000–32767/TCP) on the worker nodes. Initially, the worker node security group did not allow inbound traffic on that NodePort range, so the ELB could not reach the pods.

We added the following ingress rule in `modules/eks-node-group/main.tf`:
```hcl
ingress {
  from_port   = 30000
  to_port     = 32767
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"]
}
```
After `terraform apply`, the ELB could connect to the node’s NodePort and reach the nginx pod.

Hardening tip: instead of `0.0.0.0/0`, restrict this rule to the AWS-managed Load Balancer security group.

## Notes on addons

Terraform requires semantic versions for EKS addons. We removed `addon_version = "latest"` so AWS selects a compatible default for the cluster version.

## Troubleshooting

- LoadBalancer hostname shows `<pending>`: wait a few minutes, then `kubectl describe svc <name>` for events
- Pods not reachable: ensure worker SG allows NodePort range (see fix above)
- kubectl cannot connect: re-run `aws eks update-kubeconfig ...`, confirm AWS creds, check cluster name/region
- Verify overall status:
  ```bash
  kubectl get all -A
  ```

## Cleanup

Destroy all resources created by Terraform:
```bash
terraform destroy
```

This removes the EKS cluster, node group, and networking resources.

