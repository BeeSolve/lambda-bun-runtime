# AWS OIDC Trust Setup for Publishing Artifacts

One-time setup so the `release.yml` workflow can publish the public Bun layer to the BeeSolve
artifacts account without long-lived credentials. This is separate from the integration test role in
[aws-oidc-setup.md](./aws-oidc-setup.md), which lives in a sandbox account.

The role can publish and share one layer (`BunRuntime`) and one customer-managed runtime (`bun`,
with its ECR repository `bun`) in five regions. It cannot touch anything else.

Regions: `eu-north-1`, `eu-central-1`, `eu-west-1`, `us-east-1`, `us-west-2`.

## Prerequisites

- AWS CLI with admin access to the artifacts account (profile `customer-managed-runtimes-prod`)
- GitHub CLI (`gh`) authenticated to the repo
- No SCP in the account or organization that blocks `lambda:AddLayerVersionPermission` or
  `lambda:PutResourcePolicy` with `Principal: "*"`

Set these once for the commands below:

```bash
export AWS_PROFILE=customer-managed-runtimes-prod
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
```

---

## Step 1 - Create the OIDC provider (once per account)

Skip if it exists (`aws iam list-open-id-connect-providers`).

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

---

## Step 2 - Trust policy

Only workflows running on `main` of this repository can assume the role.

```bash
cat > trust.json <<EOT
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:BeeSolve/lambda-bun-runtime:ref:refs/heads/main"
        }
      }
    }
  ]
}
EOT
```

---

## Step 3 - Permissions policy

The workflow calls `PublishLayerVersion`, `ListLayerVersions` (to make reruns idempotent) and
`AddLayerVersionPermission` (to share the layer with all accounts). For the runtime it creates the ECR
repository and pushes the image, creates the runtime, its versions and aliases, and puts a resource policy
on the runtime ARN.

```bash
cat > publish-policy.json <<EOT
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublishBunLayer",
      "Effect": "Allow",
      "Action": ["lambda:PublishLayerVersion"],
      "Resource": "arn:aws:lambda:*:${ACCOUNT_ID}:layer:BunRuntime",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": ["eu-north-1", "eu-central-1", "eu-west-1", "us-east-1", "us-west-2"]
        }
      }
    },
    {
      "Sid": "ShareAndListBunLayerVersions",
      "Effect": "Allow",
      "Action": ["lambda:AddLayerVersionPermission", "lambda:GetLayerVersion", "lambda:ListLayerVersions"],
      "Resource": ["arn:aws:lambda:*:${ACCOUNT_ID}:layer:BunRuntime", "arn:aws:lambda:*:${ACCOUNT_ID}:layer:BunRuntime:*"],
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": ["eu-north-1", "eu-central-1", "eu-west-1", "us-east-1", "us-west-2"]
        }
      }
    },
    {
      "Sid": "EcrLogin",
      "Effect": "Allow",
      "Action": ["ecr:GetAuthorizationToken"],
      "Resource": "*"
    },
    {
      "Sid": "PushBunRuntimeImage",
      "Effect": "Allow",
      "Action": [
        "ecr:CreateRepository",
        "ecr:DescribeRepositories",
        "ecr:SetRepositoryPolicy",
        "ecr:DescribeImages",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchCheckLayerAvailability",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage"
      ],
      "Resource": "arn:aws:ecr:*:${ACCOUNT_ID}:repository/bun",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": ["eu-north-1", "eu-central-1", "eu-west-1", "us-east-1", "us-west-2"]
        }
      }
    },
    {
      "Sid": "PublishBunRuntime",
      "Effect": "Allow",
      "Action": [
        "lambda:CreateRuntime",
        "lambda:GetRuntime",
        "lambda:CreateRuntimeVersion",
        "lambda:GetRuntimeVersion",
        "lambda:CreateRuntimeAlias",
        "lambda:UpdateRuntimeAlias",
        "lambda:GetRuntimeAlias",
        "lambda:PutResourcePolicy",
        "lambda:GetResourcePolicy"
      ],
      "Resource": ["arn:aws:lambda:*:${ACCOUNT_ID}:runtime/bun", "arn:aws:lambda:*:${ACCOUNT_ID}:runtime/bun/*"],
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": ["eu-north-1", "eu-central-1", "eu-west-1", "us-east-1", "us-west-2"]
        }
      }
    }
  ]
}
EOT
```

> The runtime and ECR actions come from the Lambda documentation on customer-managed runtimes
> (`ecr:BatchGetImage` and `ecr:GetDownloadUrlForLayer` are required to create a runtime version). The
> resource types of `ListLayerVersions` and `PublishLayerVersion` were not verified against the IAM reference. If the first release fails with `AccessDenied`, read the denied action and
> resource from the error message and adjust this policy. Do not widen it to `lambda:*` on `*`.

---

## Step 4 - Create the role

```bash
aws iam create-role \
  --role-name GhActionsBunPublish \
  --assume-role-policy-document file://trust.json

aws iam put-role-policy \
  --role-name GhActionsBunPublish \
  --policy-name PublishBunLayer \
  --policy-document file://publish-policy.json

ROLE_ARN=$(aws iam get-role --role-name GhActionsBunPublish --query Role.Arn --output text)
```

---

## Step 5 - Store the role ARN in GitHub

```bash
gh secret set AWS_PUBLISH_ROLE_ARN --repo BeeSolve/lambda-bun-runtime --body "$ROLE_ARN"
```

The release workflow reads `secrets.AWS_PUBLISH_ROLE_ARN`. The integration role keeps using
`secrets.AWS_INTEG_ROLE_ARN`.

---

## Step 6 - Let the integration account use the published layer

The integration test deploys a function that uses the published layer from the artifacts account.
The CloudFormation execution role in the integration account needs `lambda:GetLayerVersion` on it. Add this
statement to the scoped policy in [aws-oidc-setup.md](./aws-oidc-setup.md) (already listed there) with the
artifacts account ID in place of `<ARTIFACTS_ACCOUNT_ID>`.

---

## What the release does with this role

1. Publishes the layer and the runtime version in `eu-central-1`. The runtime gets only the alias
   `pkg-<package version>`. The integration test runs against it.
2. In all five regions, publishes the layer and the runtime version (idempotent), sets the moving aliases
   `<x.y.z>`, `<x.y>`, `<x>` and `latest`, and makes the runtime public.
3. Only then publishes to npm.

Layer versions and runtime versions are never deleted: consumers' functions reference them. Reruns are safe.
A layer version whose description names the package version is reused, and so are an existing image tag
and runtime version. A moving alias never moves to an older version.
