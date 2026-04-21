# EC2 Access via AWS CLI + SSH

One reliable way to access and recover the EC2 runtime is through AWS CLI first, then SSH.

## Prerequisites

- AWS CLI installed (`aws --version`)
- SSH key file available (example: `C:\Users\<you>\Downloads\agent-key.pem`)
- IAM user with EC2 permissions
- Target region set (for this project: `ap-south-1`)

## 1) Configure AWS CLI

```powershell
aws configure
```

Enter:

- AWS Access Key ID
- AWS Secret Access Key
- Default region: `ap-south-1`
- Output format: `json`

Verify:

```powershell
aws sts get-caller-identity
aws configure list
```

## 2) Required IAM Permissions

At minimum, user needs:

- `ec2:DescribeInstances`
- `ec2:DescribeInstanceStatus`
- `ec2:DescribeSecurityGroups`
- `ec2:StartInstances`
- `ec2:StopInstances`
- `ec2:RebootInstances`
- Optional for SG fixes:
  - `ec2:AuthorizeSecurityGroupIngress`
  - `ec2:RevokeSecurityGroupIngress`

Quick temporary option: attach managed policy `AmazonEC2FullAccess`.

## 3) Locate the Instance

By public IP:

```powershell
aws ec2 describe-instances `
  --region ap-south-1 `
  --filters "Name=ip-address,Values=35.154.54.246" `
  --query "Reservations[].Instances[].{InstanceId:InstanceId,Name:Tags[?Key=='Name']|[0].Value,State:State.Name,PublicIp:PublicIpAddress,PrivateIp:PrivateIpAddress,SecurityGroups:SecurityGroups[*].GroupId}" `
  --output table
```

## 4) Check EC2 Health Checks

```powershell
aws ec2 describe-instance-status `
  --region ap-south-1 `
  --instance-ids <INSTANCE_ID> `
  --include-all-instances `
  --output json
```

Look for:

- `InstanceStatus` (instance reachability)
- `SystemStatus` (AWS host health)
- `AttachedEbsStatus`

If `InstanceStatus` is `impaired`, reboot is often the fastest recovery.

## 5) Reboot from CLI (if needed)

```powershell
aws ec2 reboot-instances --region ap-south-1 --instance-ids <INSTANCE_ID>
```

Poll until all checks are `ok`:

```powershell
aws ec2 describe-instance-status `
  --region ap-south-1 `
  --instance-ids <INSTANCE_ID> `
  --include-all-instances `
  --query "InstanceStatuses[0].{Instance:InstanceStatus.Status,System:SystemStatus.Status,Ebs:AttachedEbsStatus.Status}" `
  --output table
```

## 6) Verify Security Group Allows SSH

```powershell
aws ec2 describe-security-groups `
  --region ap-south-1 `
  --group-ids <SG_ID> `
  --query "SecurityGroups[0].IpPermissions" `
  --output json
```

Ensure inbound TCP `22` includes your source CIDR (or temporary `0.0.0.0/0` during emergency).

## 7) Fix PEM File Permissions (Windows)

If SSH says private key is too open:

```powershell
icacls "C:\Users\<you>\Downloads\agent-key.pem" /inheritance:r /grant:r "<DOMAIN>\<you>:R"
icacls "C:\Users\<you>\Downloads\agent-key.pem"
```

## 8) SSH into EC2

```powershell
ssh -o StrictHostKeyChecking=no -i "C:\Users\<you>\Downloads\agent-key.pem" ubuntu@35.154.54.246
```

Quick connectivity test:

```powershell
ssh -o ConnectTimeout=12 -o StrictHostKeyChecking=no -i "C:\Users\<you>\Downloads\agent-key.pem" ubuntu@35.154.54.246 "hostname && uptime"
```

## 9) Deploy Runtime on EC2

```bash
cd /home/ubuntu/app
git pull
sudo ./deploy.sh
```

Then health checks:

```bash
curl http://35.154.54.246/building/health
curl http://35.154.54.246/lms/health
```

## Common Failures

- `NoCredentials`: AWS CLI not configured.
- `UnauthorizedOperation`: IAM policy missing required EC2 actions.
- SSH timeout: instance reachability failed, SG/NACL route issues, or host networking issue.
- `UNPROTECTED PRIVATE KEY FILE`: fix file ACL with `icacls`.
