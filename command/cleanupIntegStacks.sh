#!/bin/bash
# Destroys any leftover BunLayerInteg-* CloudFormation stacks, run by the integration
# workflow after the test (which should have destroyed its own stack already).
set -euo pipefail

stacks=$(aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE UPDATE_ROLLBACK_COMPLETE ROLLBACK_COMPLETE \
  --query 'StackSummaries[].StackName' --output text)

for stack in $stacks; do
  case "$stack" in
    BunLayerInteg-*)
      echo "Destroying $stack"
      (cd examples/sample-app && INTEG_STACK_NAME="$stack" bunx cdk destroy "$stack" --force)
      ;;
  esac
done
