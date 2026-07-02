# AWS OIDC Trust Setup for GitHub Actions

One-time setup to allow the `integration.yml` workflow to deploy and destroy CloudFormation stacks in your sandbox AWS account without long-lived credentials.

## Prerequisites

- AWS CLI configured with admin access to the target account
- GitHub CLI (`gh`) authenticated to the repo
- CDK bootstrapped in the target region (step 5)

---

## Step 1 — Create the OIDC provider (once per account)

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

Skip this step if the provider already exists (`aws iam list-open-id-connect-providers` to check).

---

## Step 2 — Create the trust policy

Save as `trust.json`, replacing `<ACCOUNT_ID>` with your AWS account ID:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:BeeSolve/lambda-bun-runtime:*"
        }
      }
    }
  ]
}
```

---

## Step 3 — Create the IAM role

### How CDK splits permissions

CDK's bootstrap creates three intermediate roles that do the heavy lifting:

| Bootstrap role                              | Purpose                                                         |
| ------------------------------------------- | --------------------------------------------------------------- |
| `cdk-*-deploy-role-ACCOUNT-REGION`          | CDK CLI assumes this to submit stacks to CloudFormation         |
| `cdk-*-file-publishing-role-ACCOUNT-REGION` | Uploads Lambda zips and layer assets to the bootstrap S3 bucket |
| `cdk-*-cfn-exec-role-ACCOUNT-REGION`        | Passed to CloudFormation; actually creates all resources        |

The GitHub Actions role only needs to **assume those bootstrap roles** plus call a handful of APIs directly (test invocations, stack listing for cleanup). All resource creation goes through the CloudFormation execution role, not through the CI role.

### Scoped-down policy for the CI role

Save as `gh-integ-policy.json`, replacing `<ACCOUNT_ID>` throughout:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CdkBootstrapRoles",
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": [
        "arn:aws:iam::<ACCOUNT_ID>:role/cdk-*-deploy-role-<ACCOUNT_ID>-eu-central-1",
        "arn:aws:iam::<ACCOUNT_ID>:role/cdk-*-file-publishing-role-<ACCOUNT_ID>-eu-central-1",
        "arn:aws:iam::<ACCOUNT_ID>:role/cdk-*-lookup-role-<ACCOUNT_ID>-eu-central-1"
      ]
    },
    {
      "Sid": "CallerIdentity",
      "Effect": "Allow",
      "Action": "sts:GetCallerIdentity",
      "Resource": "*"
    },
    {
      "Sid": "CdkBootstrapVersion",
      "Effect": "Allow",
      "Action": "ssm:GetParameter",
      "Resource": "arn:aws:ssm:eu-central-1:<ACCOUNT_ID>:parameter/cdk-bootstrap/*/version"
    },
    {
      "Sid": "IntegCleanupListStacks",
      "Effect": "Allow",
      "Action": "cloudformation:ListStacks",
      "Resource": "*"
    },
    {
      "Sid": "IntegTestLambdaInvoke",
      "Effect": "Allow",
      "Action": "lambda:InvokeFunction",
      "Resource": "arn:aws:lambda:eu-central-1:<ACCOUNT_ID>:function:BunLayerInteg-*"
    },
    {
      "Sid": "IntegTestS3Read",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": "*"
    }
  ]
}
```

> **Note on `IntegTestS3Read`:** CDK generates random bucket names so we cannot predict the ARN at policy-authoring time. The scope is limited in practice — the role cannot create or delete S3 buckets directly (only through the CDK execution role), so read access to `*` is acceptable. If you want to tighten this further, name the bucket explicitly in `sample-stack.ts` using a stable prefix (e.g. `bucketName: \`bun-integ-\${this.stackName}\``) and change the resource to `arn:aws:s3:::bun-integ-BunLayerInteg-_/_`.

### Create the role and attach the policy

```bash
aws iam create-role \
  --role-name GhActionsLambdaInteg \
  --assume-role-policy-document file://trust.json

aws iam put-role-policy \
  --role-name GhActionsLambdaInteg \
  --policy-name IntegPolicy \
  --policy-document file://gh-integ-policy.json
```

### What about the CDK CloudFormation execution role?

`cdk bootstrap` creates `cdk-*-cfn-exec-role-ACCOUNT-REGION` with `AdministratorAccess` by default. That role is what actually creates Lambda functions, S3 buckets, IAM roles, API Gateway, etc. — the GitHub Actions role never touches those APIs directly.

For a sandbox account this is fine. For a production account, use the manually scoped policy below, then re-bootstrap with it:

```bash
bunx cdk bootstrap \
  --cloudformation-execution-policies "arn:aws:iam::<ACCOUNT_ID>:policy/CdkIntegExecPolicy" \
  aws://<ACCOUNT_ID>/eu-central-1
```

#### Scoped CDK execution policy

Save as `cfn-exec-policy.json`, replacing `<ACCOUNT_ID>` throughout. This covers everything CDK needs to deploy this specific stack (Lambda, API Gateway, S3, CloudWatch Logs, IAM execution roles).

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CdkBootstrapBucket",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:AbortMultipartUpload", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::cdk-*", "arn:aws:s3:::cdk-*/*"]
    },
    {
      "Sid": "Lambda",
      "Effect": "Allow",
      "Action": ["lambda:*"],
      "Resource": [
        "arn:aws:lambda:eu-central-1:<ACCOUNT_ID>:function:BunLayerInteg-*",
        "arn:aws:lambda:eu-central-1:<ACCOUNT_ID>:layer:BunRuntime",
        "arn:aws:lambda:eu-central-1:<ACCOUNT_ID>:layer:BunRuntime:*"
      ]
    },
    {
      "Sid": "IAMPassAndManageLambdaRoles",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:PassRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRolePolicy",
        "iam:TagRole",
        "iam:UntagRole"
      ],
      "Resource": "arn:aws:iam::<ACCOUNT_ID>:role/BunLayerInteg-*"
    },
    {
      "Sid": "S3TestBucket",
      "Effect": "Allow",
      "Action": ["s3:*"],
      "Resource": ["arn:aws:s3:::bun-integ-*", "arn:aws:s3:::bun-integ-*/*"]
    },
    {
      "Sid": "ApiGateway",
      "Effect": "Allow",
      "Action": ["apigateway:*"],
      "Resource": "arn:aws:apigateway:eu-central-1::/*"
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:DeleteLogGroup",
        "logs:DescribeLogGroups",
        "logs:PutRetentionPolicy",
        "logs:DeleteRetentionPolicy",
        "logs:TagLogGroup",
        "logs:ListTagsLogGroup",
        "logs:ListTagsForResource",
        "logs:TagResource"
      ],
      "Resource": "arn:aws:logs:eu-central-1:<ACCOUNT_ID>:log-group:/aws/lambda/BunLayerInteg-*"
    },
    {
      "Sid": "SSMBootstrapVersion",
      "Effect": "Allow",
      "Action": "ssm:GetParameter",
      "Resource": "arn:aws:ssm:eu-central-1:<ACCOUNT_ID>:parameter/cdk-bootstrap/*/version"
    }
  ]
}
```

> **Note on `S3TestBucket`:** The CDK-generated bucket name is random, so this policy requires naming the bucket explicitly. In `sample-stack.ts`, set `bucketName: \`bun-integ-${this.stackName}\``on the`TestBucket`construct, then update`IntegTestS3Read` in the GitHub Actions role policy to match.

Then create the managed policy and re-bootstrap:

```bash
aws iam create-policy \
  --policy-name CdkIntegExecPolicy \
  --policy-document file://cfn-exec-policy.json
```

#### Fixing the IAM Access Analyzer CloudTrail error

If you tried the IAM Access Analyzer policy generator and hit _"Incorrect permissions assigned to access CloudTrail S3 bucket"_, it means Access Analyzer cannot read the CloudTrail logs it needs to observe API calls. Fix the S3 bucket policy on your CloudTrail bucket to grant Access Analyzer read access:

```bash
BUCKET=$(aws cloudtrail describe-trails --query 'trailList[0].S3BucketName' --output text)

aws s3api get-bucket-policy --bucket "$BUCKET" --query Policy --output text > /tmp/policy.json
```

Add this statement to the policy document in `/tmp/policy.json`, then apply it:

```json
{
  "Sid": "AllowAccessAnalyzer",
  "Effect": "Allow",
  "Principal": { "Service": "access-analyzer.amazonaws.com" },
  "Action": ["s3:GetObject", "s3:ListBucket"],
  "Resource": ["arn:aws:s3:::YOUR-CLOUDTRAIL-BUCKET", "arn:aws:s3:::YOUR-CLOUDTRAIL-BUCKET/*"],
  "Condition": {
    "StringEquals": { "aws:SourceAccount": "<ACCOUNT_ID>" }
  }
}
```

```bash
aws s3api put-bucket-policy --bucket "$BUCKET" --policy file:///tmp/policy.json
```

Then retry the policy generation in the IAM console. However, the manually written policy above is simpler for this use case since the stack's resource types are known ahead of time.

---

## Step 4 — Store the role ARN as a GitHub secret

```bash
ROLE_ARN=$(aws iam get-role --role-name GhActionsLambdaInteg --query Role.Arn --output text)
gh secret set AWS_INTEG_ROLE_ARN --body "$ROLE_ARN" --repo BeeSolve/lambda-bun-runtime
```

---

## Step 5 — Bootstrap CDK (once per account/region)

```bash
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
bunx cdk bootstrap aws://${AWS_ACCOUNT}/eu-central-1
```

---

After these five steps, triggering the `integration` workflow (via `workflow_dispatch` or a PR touching `src/**`) will assume the role via OIDC and deploy/destroy stacks without any long-lived credentials stored in GitHub.
