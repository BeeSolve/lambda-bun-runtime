# API Reference <a name="API Reference" id="api-reference"></a>

## Constructs <a name="Constructs" id="Constructs"></a>

### BunFunction <a name="BunFunction" id="@beesolve/lambda-bun-runtime.BunFunction"></a>

#### Initializers <a name="Initializers" id="@beesolve/lambda-bun-runtime.BunFunction.Initializer"></a>

```typescript
import { BunFunction } from '@beesolve/lambda-bun-runtime'

new BunFunction(scope: Construct, id: string, props: BunFunctionProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.Initializer.parameter.props">props</a></code> | <code><a href="#@beesolve/lambda-bun-runtime.BunFunctionProps">BunFunctionProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@beesolve/lambda-bun-runtime.BunFunction.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@beesolve/lambda-bun-runtime.BunFunction.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@beesolve/lambda-bun-runtime.BunFunction.Initializer.parameter.props"></a>

- *Type:* <a href="#@beesolve/lambda-bun-runtime.BunFunctionProps">BunFunctionProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.addEventSource">addEventSource</a></code> | Adds an event source to this function. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.addEventSourceMapping">addEventSourceMapping</a></code> | Adds an event source that maps to this AWS Lambda function. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.addFunctionUrl">addFunctionUrl</a></code> | Adds a url to this lambda function. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.addPermission">addPermission</a></code> | Adds a permission to the Lambda resource policy. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.addToRolePolicy">addToRolePolicy</a></code> | Adds a statement to the IAM role assumed by the instance. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.configureAsyncInvoke">configureAsyncInvoke</a></code> | Configures options for asynchronous invocation. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.considerWarningOnInvokeFunctionPermissions">considerWarningOnInvokeFunctionPermissions</a></code> | A warning will be added to functions under the following conditions: - permissions that include `lambda:InvokeFunction` are added to the unqualified function. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.grantInvoke">grantInvoke</a></code> | Grant the given identity permissions to invoke this Lambda. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.grantInvokeCompositePrincipal">grantInvokeCompositePrincipal</a></code> | Grant multiple principals the ability to invoke this Lambda via CompositePrincipal. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.grantInvokeLatestVersion">grantInvokeLatestVersion</a></code> | Grant the given identity permissions to invoke the $LATEST version or unqualified version of this Lambda. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.grantInvokeUrl">grantInvokeUrl</a></code> | Grant the given identity permissions to invoke this Lambda Function URL. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.grantInvokeVersion">grantInvokeVersion</a></code> | Grant the given identity permissions to invoke the given version of this Lambda. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.metric">metric</a></code> | Return the given named metric for this Function. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.metricDuration">metricDuration</a></code> | How long execution of this Lambda takes. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.metricErrors">metricErrors</a></code> | How many invocations of this Lambda fail. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.metricInvocations">metricInvocations</a></code> | How often this Lambda is invoked. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.metricThrottles">metricThrottles</a></code> | How often this Lambda is throttled. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.addAlias">addAlias</a></code> | Defines an alias for this function. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.addEnvironment">addEnvironment</a></code> | Adds an environment variable to this Lambda function. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.addLayers">addLayers</a></code> | Adds one or more Lambda Layers to this Lambda function. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.invalidateVersionBasedOn">invalidateVersionBasedOn</a></code> | Mix additional information into the hash of the Version object. |

---

##### `toString` <a name="toString" id="@beesolve/lambda-bun-runtime.BunFunction.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="@beesolve/lambda-bun-runtime.BunFunction.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="@beesolve/lambda-bun-runtime.BunFunction.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

##### `addEventSource` <a name="addEventSource" id="@beesolve/lambda-bun-runtime.BunFunction.addEventSource"></a>

```typescript
public addEventSource(source: IEventSource): void
```

Adds an event source to this function.

Event sources are implemented in the aws-cdk-lib/aws-lambda-event-sources module.

The following example adds an SQS Queue as an event source:
```
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
myFunction.addEventSource(new SqsEventSource(myQueue));
```

###### `source`<sup>Required</sup> <a name="source" id="@beesolve/lambda-bun-runtime.BunFunction.addEventSource.parameter.source"></a>

- *Type:* aws-cdk-lib.aws_lambda.IEventSource

---

##### `addEventSourceMapping` <a name="addEventSourceMapping" id="@beesolve/lambda-bun-runtime.BunFunction.addEventSourceMapping"></a>

```typescript
public addEventSourceMapping(id: string, options: EventSourceMappingOptions): EventSourceMapping
```

Adds an event source that maps to this AWS Lambda function.

###### `id`<sup>Required</sup> <a name="id" id="@beesolve/lambda-bun-runtime.BunFunction.addEventSourceMapping.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Required</sup> <a name="options" id="@beesolve/lambda-bun-runtime.BunFunction.addEventSourceMapping.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_lambda.EventSourceMappingOptions

---

##### `addFunctionUrl` <a name="addFunctionUrl" id="@beesolve/lambda-bun-runtime.BunFunction.addFunctionUrl"></a>

```typescript
public addFunctionUrl(options?: FunctionUrlOptions): FunctionUrl
```

Adds a url to this lambda function.

###### `options`<sup>Optional</sup> <a name="options" id="@beesolve/lambda-bun-runtime.BunFunction.addFunctionUrl.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_lambda.FunctionUrlOptions

---

##### `addPermission` <a name="addPermission" id="@beesolve/lambda-bun-runtime.BunFunction.addPermission"></a>

```typescript
public addPermission(id: string, permission: Permission): void
```

Adds a permission to the Lambda resource policy.

> [Permission for details.](Permission for details.)

###### `id`<sup>Required</sup> <a name="id" id="@beesolve/lambda-bun-runtime.BunFunction.addPermission.parameter.id"></a>

- *Type:* string

The id for the permission construct.

---

###### `permission`<sup>Required</sup> <a name="permission" id="@beesolve/lambda-bun-runtime.BunFunction.addPermission.parameter.permission"></a>

- *Type:* aws-cdk-lib.aws_lambda.Permission

The permission to grant to this Lambda function.

---

##### `addToRolePolicy` <a name="addToRolePolicy" id="@beesolve/lambda-bun-runtime.BunFunction.addToRolePolicy"></a>

```typescript
public addToRolePolicy(statement: PolicyStatement): void
```

Adds a statement to the IAM role assumed by the instance.

###### `statement`<sup>Required</sup> <a name="statement" id="@beesolve/lambda-bun-runtime.BunFunction.addToRolePolicy.parameter.statement"></a>

- *Type:* aws-cdk-lib.aws_iam.PolicyStatement

---

##### `configureAsyncInvoke` <a name="configureAsyncInvoke" id="@beesolve/lambda-bun-runtime.BunFunction.configureAsyncInvoke"></a>

```typescript
public configureAsyncInvoke(options: EventInvokeConfigOptions): void
```

Configures options for asynchronous invocation.

###### `options`<sup>Required</sup> <a name="options" id="@beesolve/lambda-bun-runtime.BunFunction.configureAsyncInvoke.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_lambda.EventInvokeConfigOptions

---

##### `considerWarningOnInvokeFunctionPermissions` <a name="considerWarningOnInvokeFunctionPermissions" id="@beesolve/lambda-bun-runtime.BunFunction.considerWarningOnInvokeFunctionPermissions"></a>

```typescript
public considerWarningOnInvokeFunctionPermissions(scope: Construct, action: string): void
```

A warning will be added to functions under the following conditions: - permissions that include `lambda:InvokeFunction` are added to the unqualified function.

function.currentVersion is invoked before or after the permission is created.

This applies only to permissions on Lambda functions, not versions or aliases.
This function is overridden as a noOp for QualifiedFunctionBase.

###### `scope`<sup>Required</sup> <a name="scope" id="@beesolve/lambda-bun-runtime.BunFunction.considerWarningOnInvokeFunctionPermissions.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `action`<sup>Required</sup> <a name="action" id="@beesolve/lambda-bun-runtime.BunFunction.considerWarningOnInvokeFunctionPermissions.parameter.action"></a>

- *Type:* string

---

##### `grantInvoke` <a name="grantInvoke" id="@beesolve/lambda-bun-runtime.BunFunction.grantInvoke"></a>

```typescript
public grantInvoke(grantee: IGrantable): Grant
```

Grant the given identity permissions to invoke this Lambda.

[disable-awslint:no-grants]

###### `grantee`<sup>Required</sup> <a name="grantee" id="@beesolve/lambda-bun-runtime.BunFunction.grantInvoke.parameter.grantee"></a>

- *Type:* aws-cdk-lib.aws_iam.IGrantable

---

##### `grantInvokeCompositePrincipal` <a name="grantInvokeCompositePrincipal" id="@beesolve/lambda-bun-runtime.BunFunction.grantInvokeCompositePrincipal"></a>

```typescript
public grantInvokeCompositePrincipal(compositePrincipal: CompositePrincipal): Grant[]
```

Grant multiple principals the ability to invoke this Lambda via CompositePrincipal.

[disable-awslint:no-grants]

###### `compositePrincipal`<sup>Required</sup> <a name="compositePrincipal" id="@beesolve/lambda-bun-runtime.BunFunction.grantInvokeCompositePrincipal.parameter.compositePrincipal"></a>

- *Type:* aws-cdk-lib.aws_iam.CompositePrincipal

---

##### `grantInvokeLatestVersion` <a name="grantInvokeLatestVersion" id="@beesolve/lambda-bun-runtime.BunFunction.grantInvokeLatestVersion"></a>

```typescript
public grantInvokeLatestVersion(grantee: IGrantable): Grant
```

Grant the given identity permissions to invoke the $LATEST version or unqualified version of this Lambda.

[disable-awslint:no-grants]

###### `grantee`<sup>Required</sup> <a name="grantee" id="@beesolve/lambda-bun-runtime.BunFunction.grantInvokeLatestVersion.parameter.grantee"></a>

- *Type:* aws-cdk-lib.aws_iam.IGrantable

---

##### `grantInvokeUrl` <a name="grantInvokeUrl" id="@beesolve/lambda-bun-runtime.BunFunction.grantInvokeUrl"></a>

```typescript
public grantInvokeUrl(grantee: IGrantable): Grant
```

Grant the given identity permissions to invoke this Lambda Function URL.

[disable-awslint:no-grants]

###### `grantee`<sup>Required</sup> <a name="grantee" id="@beesolve/lambda-bun-runtime.BunFunction.grantInvokeUrl.parameter.grantee"></a>

- *Type:* aws-cdk-lib.aws_iam.IGrantable

---

##### `grantInvokeVersion` <a name="grantInvokeVersion" id="@beesolve/lambda-bun-runtime.BunFunction.grantInvokeVersion"></a>

```typescript
public grantInvokeVersion(grantee: IGrantable, version: IVersion): Grant
```

Grant the given identity permissions to invoke the given version of this Lambda.

[disable-awslint:no-grants]

###### `grantee`<sup>Required</sup> <a name="grantee" id="@beesolve/lambda-bun-runtime.BunFunction.grantInvokeVersion.parameter.grantee"></a>

- *Type:* aws-cdk-lib.aws_iam.IGrantable

---

###### `version`<sup>Required</sup> <a name="version" id="@beesolve/lambda-bun-runtime.BunFunction.grantInvokeVersion.parameter.version"></a>

- *Type:* aws-cdk-lib.aws_lambda.IVersion

---

##### `metric` <a name="metric" id="@beesolve/lambda-bun-runtime.BunFunction.metric"></a>

```typescript
public metric(metricName: string, props?: MetricOptions): Metric
```

Return the given named metric for this Function.

###### `metricName`<sup>Required</sup> <a name="metricName" id="@beesolve/lambda-bun-runtime.BunFunction.metric.parameter.metricName"></a>

- *Type:* string

---

###### `props`<sup>Optional</sup> <a name="props" id="@beesolve/lambda-bun-runtime.BunFunction.metric.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricDuration` <a name="metricDuration" id="@beesolve/lambda-bun-runtime.BunFunction.metricDuration"></a>

```typescript
public metricDuration(props?: MetricOptions): Metric
```

How long execution of this Lambda takes.

Average over 5 minutes

###### `props`<sup>Optional</sup> <a name="props" id="@beesolve/lambda-bun-runtime.BunFunction.metricDuration.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricErrors` <a name="metricErrors" id="@beesolve/lambda-bun-runtime.BunFunction.metricErrors"></a>

```typescript
public metricErrors(props?: MetricOptions): Metric
```

How many invocations of this Lambda fail.

Sum over 5 minutes

###### `props`<sup>Optional</sup> <a name="props" id="@beesolve/lambda-bun-runtime.BunFunction.metricErrors.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricInvocations` <a name="metricInvocations" id="@beesolve/lambda-bun-runtime.BunFunction.metricInvocations"></a>

```typescript
public metricInvocations(props?: MetricOptions): Metric
```

How often this Lambda is invoked.

Sum over 5 minutes

###### `props`<sup>Optional</sup> <a name="props" id="@beesolve/lambda-bun-runtime.BunFunction.metricInvocations.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricThrottles` <a name="metricThrottles" id="@beesolve/lambda-bun-runtime.BunFunction.metricThrottles"></a>

```typescript
public metricThrottles(props?: MetricOptions): Metric
```

How often this Lambda is throttled.

Sum over 5 minutes

###### `props`<sup>Optional</sup> <a name="props" id="@beesolve/lambda-bun-runtime.BunFunction.metricThrottles.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `addAlias` <a name="addAlias" id="@beesolve/lambda-bun-runtime.BunFunction.addAlias"></a>

```typescript
public addAlias(aliasName: string, options?: AliasOptions): Alias
```

Defines an alias for this function.

The alias will automatically be updated to point to the latest version of
the function as it is being updated during a deployment.

```ts
declare const fn: lambda.Function;

fn.addAlias('Live');

// Is equivalent to

new lambda.Alias(this, 'AliasLive', {
  aliasName: 'Live',
  version: fn.currentVersion,
});
```

###### `aliasName`<sup>Required</sup> <a name="aliasName" id="@beesolve/lambda-bun-runtime.BunFunction.addAlias.parameter.aliasName"></a>

- *Type:* string

The name of the alias.

---

###### `options`<sup>Optional</sup> <a name="options" id="@beesolve/lambda-bun-runtime.BunFunction.addAlias.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_lambda.AliasOptions

Alias options.

---

##### `addEnvironment` <a name="addEnvironment" id="@beesolve/lambda-bun-runtime.BunFunction.addEnvironment"></a>

```typescript
public addEnvironment(key: string, value: string, options?: EnvironmentOptions): Function
```

Adds an environment variable to this Lambda function.

If this is a ref to a Lambda function, this operation results in a no-op.

###### `key`<sup>Required</sup> <a name="key" id="@beesolve/lambda-bun-runtime.BunFunction.addEnvironment.parameter.key"></a>

- *Type:* string

The environment variable key.

---

###### `value`<sup>Required</sup> <a name="value" id="@beesolve/lambda-bun-runtime.BunFunction.addEnvironment.parameter.value"></a>

- *Type:* string

The environment variable's value.

---

###### `options`<sup>Optional</sup> <a name="options" id="@beesolve/lambda-bun-runtime.BunFunction.addEnvironment.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_lambda.EnvironmentOptions

Environment variable options.

---

##### `addLayers` <a name="addLayers" id="@beesolve/lambda-bun-runtime.BunFunction.addLayers"></a>

```typescript
public addLayers(layers: ...ILayerVersion[]): void
```

Adds one or more Lambda Layers to this Lambda function.

###### `layers`<sup>Required</sup> <a name="layers" id="@beesolve/lambda-bun-runtime.BunFunction.addLayers.parameter.layers"></a>

- *Type:* ...aws-cdk-lib.aws_lambda.ILayerVersion[]

the layers to be added.

---

##### `invalidateVersionBasedOn` <a name="invalidateVersionBasedOn" id="@beesolve/lambda-bun-runtime.BunFunction.invalidateVersionBasedOn"></a>

```typescript
public invalidateVersionBasedOn(x: string): void
```

Mix additional information into the hash of the Version object.

The Lambda Function construct does its best to automatically create a new
Version when anything about the Function changes (its code, its layers,
any of the other properties).

However, you can sometimes source information from places that the CDK cannot
look into, like the deploy-time values of SSM parameters. In those cases,
the CDK would not force the creation of a new Version object when it actually
should.

This method can be used to invalidate the current Version object. Pass in
any string into this method, and make sure the string changes when you know
a new Version needs to be created.

This method may be called more than once.

###### `x`<sup>Required</sup> <a name="x" id="@beesolve/lambda-bun-runtime.BunFunction.invalidateVersionBasedOn.parameter.x"></a>

- *Type:* string

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.isResource">isResource</a></code> | Check whether the given construct is a Resource. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.classifyVersionProperty">classifyVersionProperty</a></code> | Record whether specific properties in the `AWS::Lambda::Function` resource should also be associated to the Version resource. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.fromFunctionArn">fromFunctionArn</a></code> | Import a lambda function into the CDK using its ARN. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.fromFunctionAttributes">fromFunctionAttributes</a></code> | Creates a Lambda function object which represents a function not defined within this stack. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.fromFunctionName">fromFunctionName</a></code> | Import a lambda function into the CDK using its name. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.metricAll">metricAll</a></code> | Return the given named metric for this Lambda. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.metricAllConcurrentExecutions">metricAllConcurrentExecutions</a></code> | Metric for the number of concurrent executions across all Lambdas. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.metricAllDuration">metricAllDuration</a></code> | Metric for the Duration executing all Lambdas. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.metricAllErrors">metricAllErrors</a></code> | Metric for the number of Errors executing all Lambdas. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.metricAllInvocations">metricAllInvocations</a></code> | Metric for the number of invocations of all Lambdas. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.metricAllThrottles">metricAllThrottles</a></code> | Metric for the number of throttled invocations of all Lambdas. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.metricAllUnreservedConcurrentExecutions">metricAllUnreservedConcurrentExecutions</a></code> | Metric for the number of unreserved concurrent executions across all Lambdas. |

---

##### `isConstruct` <a name="isConstruct" id="@beesolve/lambda-bun-runtime.BunFunction.isConstruct"></a>

```typescript
import { BunFunction } from '@beesolve/lambda-bun-runtime'

BunFunction.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="@beesolve/lambda-bun-runtime.BunFunction.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="@beesolve/lambda-bun-runtime.BunFunction.isOwnedResource"></a>

```typescript
import { BunFunction } from '@beesolve/lambda-bun-runtime'

BunFunction.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="@beesolve/lambda-bun-runtime.BunFunction.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="@beesolve/lambda-bun-runtime.BunFunction.isResource"></a>

```typescript
import { BunFunction } from '@beesolve/lambda-bun-runtime'

BunFunction.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="@beesolve/lambda-bun-runtime.BunFunction.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `classifyVersionProperty` <a name="classifyVersionProperty" id="@beesolve/lambda-bun-runtime.BunFunction.classifyVersionProperty"></a>

```typescript
import { BunFunction } from '@beesolve/lambda-bun-runtime'

BunFunction.classifyVersionProperty(propertyName: string, locked: boolean)
```

Record whether specific properties in the `AWS::Lambda::Function` resource should also be associated to the Version resource.

See 'currentVersion' section in the module README for more details.

###### `propertyName`<sup>Required</sup> <a name="propertyName" id="@beesolve/lambda-bun-runtime.BunFunction.classifyVersionProperty.parameter.propertyName"></a>

- *Type:* string

The property to classify.

---

###### `locked`<sup>Required</sup> <a name="locked" id="@beesolve/lambda-bun-runtime.BunFunction.classifyVersionProperty.parameter.locked"></a>

- *Type:* boolean

whether the property should be associated to the version or not.

---

##### `fromFunctionArn` <a name="fromFunctionArn" id="@beesolve/lambda-bun-runtime.BunFunction.fromFunctionArn"></a>

```typescript
import { BunFunction } from '@beesolve/lambda-bun-runtime'

BunFunction.fromFunctionArn(scope: Construct, id: string, functionArn: string)
```

Import a lambda function into the CDK using its ARN.

For `Function.addPermissions()` to work on this imported lambda, make sure that is
in the same account and region as the stack you are importing it into.

###### `scope`<sup>Required</sup> <a name="scope" id="@beesolve/lambda-bun-runtime.BunFunction.fromFunctionArn.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@beesolve/lambda-bun-runtime.BunFunction.fromFunctionArn.parameter.id"></a>

- *Type:* string

---

###### `functionArn`<sup>Required</sup> <a name="functionArn" id="@beesolve/lambda-bun-runtime.BunFunction.fromFunctionArn.parameter.functionArn"></a>

- *Type:* string

---

##### `fromFunctionAttributes` <a name="fromFunctionAttributes" id="@beesolve/lambda-bun-runtime.BunFunction.fromFunctionAttributes"></a>

```typescript
import { BunFunction } from '@beesolve/lambda-bun-runtime'

BunFunction.fromFunctionAttributes(scope: Construct, id: string, attrs: FunctionAttributes)
```

Creates a Lambda function object which represents a function not defined within this stack.

For `Function.addPermissions()` to work on this imported lambda, set the sameEnvironment property to true
if this imported lambda is in the same account and region as the stack you are importing it into.

###### `scope`<sup>Required</sup> <a name="scope" id="@beesolve/lambda-bun-runtime.BunFunction.fromFunctionAttributes.parameter.scope"></a>

- *Type:* constructs.Construct

The parent construct.

---

###### `id`<sup>Required</sup> <a name="id" id="@beesolve/lambda-bun-runtime.BunFunction.fromFunctionAttributes.parameter.id"></a>

- *Type:* string

The name of the lambda construct.

---

###### `attrs`<sup>Required</sup> <a name="attrs" id="@beesolve/lambda-bun-runtime.BunFunction.fromFunctionAttributes.parameter.attrs"></a>

- *Type:* aws-cdk-lib.aws_lambda.FunctionAttributes

the attributes of the function to import.

---

##### `fromFunctionName` <a name="fromFunctionName" id="@beesolve/lambda-bun-runtime.BunFunction.fromFunctionName"></a>

```typescript
import { BunFunction } from '@beesolve/lambda-bun-runtime'

BunFunction.fromFunctionName(scope: Construct, id: string, functionName: string)
```

Import a lambda function into the CDK using its name.

###### `scope`<sup>Required</sup> <a name="scope" id="@beesolve/lambda-bun-runtime.BunFunction.fromFunctionName.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@beesolve/lambda-bun-runtime.BunFunction.fromFunctionName.parameter.id"></a>

- *Type:* string

---

###### `functionName`<sup>Required</sup> <a name="functionName" id="@beesolve/lambda-bun-runtime.BunFunction.fromFunctionName.parameter.functionName"></a>

- *Type:* string

---

##### `metricAll` <a name="metricAll" id="@beesolve/lambda-bun-runtime.BunFunction.metricAll"></a>

```typescript
import { BunFunction } from '@beesolve/lambda-bun-runtime'

BunFunction.metricAll(metricName: string, props?: MetricOptions)
```

Return the given named metric for this Lambda.

###### `metricName`<sup>Required</sup> <a name="metricName" id="@beesolve/lambda-bun-runtime.BunFunction.metricAll.parameter.metricName"></a>

- *Type:* string

---

###### `props`<sup>Optional</sup> <a name="props" id="@beesolve/lambda-bun-runtime.BunFunction.metricAll.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricAllConcurrentExecutions` <a name="metricAllConcurrentExecutions" id="@beesolve/lambda-bun-runtime.BunFunction.metricAllConcurrentExecutions"></a>

```typescript
import { BunFunction } from '@beesolve/lambda-bun-runtime'

BunFunction.metricAllConcurrentExecutions(props?: MetricOptions)
```

Metric for the number of concurrent executions across all Lambdas.

###### `props`<sup>Optional</sup> <a name="props" id="@beesolve/lambda-bun-runtime.BunFunction.metricAllConcurrentExecutions.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricAllDuration` <a name="metricAllDuration" id="@beesolve/lambda-bun-runtime.BunFunction.metricAllDuration"></a>

```typescript
import { BunFunction } from '@beesolve/lambda-bun-runtime'

BunFunction.metricAllDuration(props?: MetricOptions)
```

Metric for the Duration executing all Lambdas.

###### `props`<sup>Optional</sup> <a name="props" id="@beesolve/lambda-bun-runtime.BunFunction.metricAllDuration.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricAllErrors` <a name="metricAllErrors" id="@beesolve/lambda-bun-runtime.BunFunction.metricAllErrors"></a>

```typescript
import { BunFunction } from '@beesolve/lambda-bun-runtime'

BunFunction.metricAllErrors(props?: MetricOptions)
```

Metric for the number of Errors executing all Lambdas.

###### `props`<sup>Optional</sup> <a name="props" id="@beesolve/lambda-bun-runtime.BunFunction.metricAllErrors.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricAllInvocations` <a name="metricAllInvocations" id="@beesolve/lambda-bun-runtime.BunFunction.metricAllInvocations"></a>

```typescript
import { BunFunction } from '@beesolve/lambda-bun-runtime'

BunFunction.metricAllInvocations(props?: MetricOptions)
```

Metric for the number of invocations of all Lambdas.

###### `props`<sup>Optional</sup> <a name="props" id="@beesolve/lambda-bun-runtime.BunFunction.metricAllInvocations.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricAllThrottles` <a name="metricAllThrottles" id="@beesolve/lambda-bun-runtime.BunFunction.metricAllThrottles"></a>

```typescript
import { BunFunction } from '@beesolve/lambda-bun-runtime'

BunFunction.metricAllThrottles(props?: MetricOptions)
```

Metric for the number of throttled invocations of all Lambdas.

###### `props`<sup>Optional</sup> <a name="props" id="@beesolve/lambda-bun-runtime.BunFunction.metricAllThrottles.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricAllUnreservedConcurrentExecutions` <a name="metricAllUnreservedConcurrentExecutions" id="@beesolve/lambda-bun-runtime.BunFunction.metricAllUnreservedConcurrentExecutions"></a>

```typescript
import { BunFunction } from '@beesolve/lambda-bun-runtime'

BunFunction.metricAllUnreservedConcurrentExecutions(props?: MetricOptions)
```

Metric for the number of unreserved concurrent executions across all Lambdas.

###### `props`<sup>Optional</sup> <a name="props" id="@beesolve/lambda-bun-runtime.BunFunction.metricAllUnreservedConcurrentExecutions.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.property.env">env</a></code> | <code>aws-cdk-lib.interfaces.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.property.architecture">architecture</a></code> | <code>aws-cdk-lib.aws_lambda.Architecture</code> | The architecture of this Lambda Function (this is an optional attribute and defaults to X86_64). |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.property.connections">connections</a></code> | <code>aws-cdk-lib.aws_ec2.Connections</code> | Access the Connections object. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.property.functionArn">functionArn</a></code> | <code>string</code> | ARN of this function. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.property.functionName">functionName</a></code> | <code>string</code> | Name of this function. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.property.functionRef">functionRef</a></code> | <code>aws-cdk-lib.interfaces.aws_lambda.FunctionReference</code> | A reference to a Function resource. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.property.grantPrincipal">grantPrincipal</a></code> | <code>aws-cdk-lib.aws_iam.IPrincipal</code> | The principal this Lambda Function is running as. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.property.isBoundToVpc">isBoundToVpc</a></code> | <code>boolean</code> | Whether or not this Lambda function was bound to a VPC. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.property.latestVersion">latestVersion</a></code> | <code>aws-cdk-lib.aws_lambda.IVersion</code> | The `$LATEST` version of this function. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.property.permissionsNode">permissionsNode</a></code> | <code>constructs.Node</code> | The construct node where permissions are attached. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.property.resourceArnsForGrantInvoke">resourceArnsForGrantInvoke</a></code> | <code>string[]</code> | The ARN(s) to put into the resource field of the generated IAM policy for grantInvoke(). |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.property.role">role</a></code> | <code>aws-cdk-lib.aws_iam.IRole</code> | Execution role associated with this function. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.property.tenancyConfig">tenancyConfig</a></code> | <code>aws-cdk-lib.aws_lambda.TenancyConfig</code> | The tenancy configuration for this function. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.property.currentVersion">currentVersion</a></code> | <code>aws-cdk-lib.aws_lambda.Version</code> | Returns a `lambda.Version` which represents the current version of this Lambda function. A new version will be created every time the function's configuration changes. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.property.logGroup">logGroup</a></code> | <code>aws-cdk-lib.aws_logs.ILogGroup</code> | The LogGroup where the Lambda function's logs are made available. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.property.runtime">runtime</a></code> | <code>aws-cdk-lib.aws_lambda.Runtime</code> | The runtime configured for this lambda. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.property.deadLetterQueue">deadLetterQueue</a></code> | <code>aws-cdk-lib.aws_sqs.IQueue</code> | The DLQ (as queue) associated with this Lambda Function (this is an optional attribute). |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.property.deadLetterTopic">deadLetterTopic</a></code> | <code>aws-cdk-lib.aws_sns.ITopic</code> | The DLQ (as topic) associated with this Lambda Function (this is an optional attribute). |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.property.timeout">timeout</a></code> | <code>aws-cdk-lib.Duration</code> | The timeout configured for this lambda. |

---

##### `node`<sup>Required</sup> <a name="node" id="@beesolve/lambda-bun-runtime.BunFunction.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="@beesolve/lambda-bun-runtime.BunFunction.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.interfaces.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed in a Stack (those created by
creating new class instances like `new Role()`, `new Bucket()`, etc.), this
is always the same as the environment of the stack they belong to.

For referenced resources (those obtained from referencing methods like
`Role.fromRoleArn()`, `Bucket.fromBucketName()`, etc.), they might be
different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="@beesolve/lambda-bun-runtime.BunFunction.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `architecture`<sup>Required</sup> <a name="architecture" id="@beesolve/lambda-bun-runtime.BunFunction.property.architecture"></a>

```typescript
public readonly architecture: Architecture;
```

- *Type:* aws-cdk-lib.aws_lambda.Architecture

The architecture of this Lambda Function (this is an optional attribute and defaults to X86_64).

---

##### `connections`<sup>Required</sup> <a name="connections" id="@beesolve/lambda-bun-runtime.BunFunction.property.connections"></a>

```typescript
public readonly connections: Connections;
```

- *Type:* aws-cdk-lib.aws_ec2.Connections

Access the Connections object.

Will fail if not a VPC-enabled Lambda Function

---

##### `functionArn`<sup>Required</sup> <a name="functionArn" id="@beesolve/lambda-bun-runtime.BunFunction.property.functionArn"></a>

```typescript
public readonly functionArn: string;
```

- *Type:* string

ARN of this function.

---

##### `functionName`<sup>Required</sup> <a name="functionName" id="@beesolve/lambda-bun-runtime.BunFunction.property.functionName"></a>

```typescript
public readonly functionName: string;
```

- *Type:* string

Name of this function.

---

##### `functionRef`<sup>Required</sup> <a name="functionRef" id="@beesolve/lambda-bun-runtime.BunFunction.property.functionRef"></a>

```typescript
public readonly functionRef: FunctionReference;
```

- *Type:* aws-cdk-lib.interfaces.aws_lambda.FunctionReference

A reference to a Function resource.

---

##### `grantPrincipal`<sup>Required</sup> <a name="grantPrincipal" id="@beesolve/lambda-bun-runtime.BunFunction.property.grantPrincipal"></a>

```typescript
public readonly grantPrincipal: IPrincipal;
```

- *Type:* aws-cdk-lib.aws_iam.IPrincipal

The principal this Lambda Function is running as.

---

##### `isBoundToVpc`<sup>Required</sup> <a name="isBoundToVpc" id="@beesolve/lambda-bun-runtime.BunFunction.property.isBoundToVpc"></a>

```typescript
public readonly isBoundToVpc: boolean;
```

- *Type:* boolean

Whether or not this Lambda function was bound to a VPC.

If this is is `false`, trying to access the `connections` object will fail.

---

##### `latestVersion`<sup>Required</sup> <a name="latestVersion" id="@beesolve/lambda-bun-runtime.BunFunction.property.latestVersion"></a>

```typescript
public readonly latestVersion: IVersion;
```

- *Type:* aws-cdk-lib.aws_lambda.IVersion

The `$LATEST` version of this function.

Note that this is reference to a non-specific AWS Lambda version, which
means the function this version refers to can return different results in
different invocations.

To obtain a reference to an explicit version which references the current
function configuration, use `lambdaFunction.currentVersion` instead.

---

##### `permissionsNode`<sup>Required</sup> <a name="permissionsNode" id="@beesolve/lambda-bun-runtime.BunFunction.property.permissionsNode"></a>

```typescript
public readonly permissionsNode: Node;
```

- *Type:* constructs.Node

The construct node where permissions are attached.

---

##### `resourceArnsForGrantInvoke`<sup>Required</sup> <a name="resourceArnsForGrantInvoke" id="@beesolve/lambda-bun-runtime.BunFunction.property.resourceArnsForGrantInvoke"></a>

```typescript
public readonly resourceArnsForGrantInvoke: string[];
```

- *Type:* string[]

The ARN(s) to put into the resource field of the generated IAM policy for grantInvoke().

---

##### `role`<sup>Optional</sup> <a name="role" id="@beesolve/lambda-bun-runtime.BunFunction.property.role"></a>

```typescript
public readonly role: IRole;
```

- *Type:* aws-cdk-lib.aws_iam.IRole

Execution role associated with this function.

---

##### `tenancyConfig`<sup>Optional</sup> <a name="tenancyConfig" id="@beesolve/lambda-bun-runtime.BunFunction.property.tenancyConfig"></a>

```typescript
public readonly tenancyConfig: TenancyConfig;
```

- *Type:* aws-cdk-lib.aws_lambda.TenancyConfig

The tenancy configuration for this function.

---

##### `currentVersion`<sup>Required</sup> <a name="currentVersion" id="@beesolve/lambda-bun-runtime.BunFunction.property.currentVersion"></a>

```typescript
public readonly currentVersion: Version;
```

- *Type:* aws-cdk-lib.aws_lambda.Version

Returns a `lambda.Version` which represents the current version of this Lambda function. A new version will be created every time the function's configuration changes.

You can specify options for this version using the `currentVersionOptions`
prop when initializing the `lambda.Function`.

---

##### `logGroup`<sup>Required</sup> <a name="logGroup" id="@beesolve/lambda-bun-runtime.BunFunction.property.logGroup"></a>

```typescript
public readonly logGroup: ILogGroup;
```

- *Type:* aws-cdk-lib.aws_logs.ILogGroup

The LogGroup where the Lambda function's logs are made available.

If either `logRetention` is set or this property is called, a CloudFormation custom resource is added to the stack that
pre-creates the log group as part of the stack deployment, if it already doesn't exist, and sets the correct log retention
period (never expire, by default).

Further, if the log group already exists and the `logRetention` is not set, the custom resource will reset the log retention
to never expire even if it was configured with a different value.

---

##### `runtime`<sup>Required</sup> <a name="runtime" id="@beesolve/lambda-bun-runtime.BunFunction.property.runtime"></a>

```typescript
public readonly runtime: Runtime;
```

- *Type:* aws-cdk-lib.aws_lambda.Runtime

The runtime configured for this lambda.

---

##### `deadLetterQueue`<sup>Optional</sup> <a name="deadLetterQueue" id="@beesolve/lambda-bun-runtime.BunFunction.property.deadLetterQueue"></a>

```typescript
public readonly deadLetterQueue: IQueue;
```

- *Type:* aws-cdk-lib.aws_sqs.IQueue

The DLQ (as queue) associated with this Lambda Function (this is an optional attribute).

---

##### `deadLetterTopic`<sup>Optional</sup> <a name="deadLetterTopic" id="@beesolve/lambda-bun-runtime.BunFunction.property.deadLetterTopic"></a>

```typescript
public readonly deadLetterTopic: ITopic;
```

- *Type:* aws-cdk-lib.aws_sns.ITopic

The DLQ (as topic) associated with this Lambda Function (this is an optional attribute).

---

##### `timeout`<sup>Optional</sup> <a name="timeout" id="@beesolve/lambda-bun-runtime.BunFunction.property.timeout"></a>

```typescript
public readonly timeout: Duration;
```

- *Type:* aws-cdk-lib.Duration

The timeout configured for this lambda.

---

#### Constants <a name="Constants" id="Constants"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunction.property.PROPERTY_INJECTION_ID">PROPERTY_INJECTION_ID</a></code> | <code>string</code> | Uniquely identifies this class. |

---

##### `PROPERTY_INJECTION_ID`<sup>Required</sup> <a name="PROPERTY_INJECTION_ID" id="@beesolve/lambda-bun-runtime.BunFunction.property.PROPERTY_INJECTION_ID"></a>

```typescript
public readonly PROPERTY_INJECTION_ID: string;
```

- *Type:* string

Uniquely identifies this class.

---

### BunLambdaLayer <a name="BunLambdaLayer" id="@beesolve/lambda-bun-runtime.BunLambdaLayer"></a>

#### Initializers <a name="Initializers" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.Initializer"></a>

```typescript
import { BunLambdaLayer } from '@beesolve/lambda-bun-runtime'

new BunLambdaLayer(scope: Construct, id: string, props?: BunLambdaLayerProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@beesolve/lambda-bun-runtime.BunLambdaLayer.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@beesolve/lambda-bun-runtime.BunLambdaLayer.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@beesolve/lambda-bun-runtime.BunLambdaLayer.Initializer.parameter.props">props</a></code> | <code><a href="#@beesolve/lambda-bun-runtime.BunLambdaLayerProps">BunLambdaLayerProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Optional</sup> <a name="props" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.Initializer.parameter.props"></a>

- *Type:* <a href="#@beesolve/lambda-bun-runtime.BunLambdaLayerProps">BunLambdaLayerProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@beesolve/lambda-bun-runtime.BunLambdaLayer.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunLambdaLayer.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunLambdaLayer.addPermission">addPermission</a></code> | Add permission for this layer version to specific entities. |

---

##### `toString` <a name="toString" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

##### `addPermission` <a name="addPermission" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.addPermission"></a>

```typescript
public addPermission(id: string, permission: LayerVersionPermission): void
```

Add permission for this layer version to specific entities.

Usage within
the same account where the layer is defined is always allowed and does not
require calling this method. Note that the principal that creates the
Lambda function using the layer (for example, a CloudFormation changeset
execution role) also needs to have the ``lambda:GetLayerVersion``
permission on the layer version.

###### `id`<sup>Required</sup> <a name="id" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.addPermission.parameter.id"></a>

- *Type:* string

---

###### `permission`<sup>Required</sup> <a name="permission" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.addPermission.parameter.permission"></a>

- *Type:* aws-cdk-lib.aws_lambda.LayerVersionPermission

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@beesolve/lambda-bun-runtime.BunLambdaLayer.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunLambdaLayer.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunLambdaLayer.isResource">isResource</a></code> | Check whether the given construct is a Resource. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunLambdaLayer.fromLayerVersionArn">fromLayerVersionArn</a></code> | Imports a layer version by ARN. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunLambdaLayer.fromLayerVersionAttributes">fromLayerVersionAttributes</a></code> | Imports a Layer that has been defined externally. |

---

##### `isConstruct` <a name="isConstruct" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.isConstruct"></a>

```typescript
import { BunLambdaLayer } from '@beesolve/lambda-bun-runtime'

BunLambdaLayer.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.isOwnedResource"></a>

```typescript
import { BunLambdaLayer } from '@beesolve/lambda-bun-runtime'

BunLambdaLayer.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.isResource"></a>

```typescript
import { BunLambdaLayer } from '@beesolve/lambda-bun-runtime'

BunLambdaLayer.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `fromLayerVersionArn` <a name="fromLayerVersionArn" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.fromLayerVersionArn"></a>

```typescript
import { BunLambdaLayer } from '@beesolve/lambda-bun-runtime'

BunLambdaLayer.fromLayerVersionArn(scope: Construct, id: string, layerVersionArn: string)
```

Imports a layer version by ARN.

Assumes it is compatible with all Lambda runtimes.

###### `scope`<sup>Required</sup> <a name="scope" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.fromLayerVersionArn.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.fromLayerVersionArn.parameter.id"></a>

- *Type:* string

---

###### `layerVersionArn`<sup>Required</sup> <a name="layerVersionArn" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.fromLayerVersionArn.parameter.layerVersionArn"></a>

- *Type:* string

---

##### `fromLayerVersionAttributes` <a name="fromLayerVersionAttributes" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.fromLayerVersionAttributes"></a>

```typescript
import { BunLambdaLayer } from '@beesolve/lambda-bun-runtime'

BunLambdaLayer.fromLayerVersionAttributes(scope: Construct, id: string, attrs: LayerVersionAttributes)
```

Imports a Layer that has been defined externally.

###### `scope`<sup>Required</sup> <a name="scope" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.fromLayerVersionAttributes.parameter.scope"></a>

- *Type:* constructs.Construct

the parent Construct that will use the imported layer.

---

###### `id`<sup>Required</sup> <a name="id" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.fromLayerVersionAttributes.parameter.id"></a>

- *Type:* string

the id of the imported layer in the construct tree.

---

###### `attrs`<sup>Required</sup> <a name="attrs" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.fromLayerVersionAttributes.parameter.attrs"></a>

- *Type:* aws-cdk-lib.aws_lambda.LayerVersionAttributes

the properties of the imported layer.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@beesolve/lambda-bun-runtime.BunLambdaLayer.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunLambdaLayer.property.env">env</a></code> | <code>aws-cdk-lib.interfaces.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunLambdaLayer.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunLambdaLayer.property.layerVersionArn">layerVersionArn</a></code> | <code>string</code> | The ARN of the Lambda Layer version that this Layer defines. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunLambdaLayer.property.layerVersionRef">layerVersionRef</a></code> | <code>aws-cdk-lib.interfaces.aws_lambda.LayerVersionReference</code> | A reference to a LayerVersion resource. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunLambdaLayer.property.compatibleRuntimes">compatibleRuntimes</a></code> | <code>aws-cdk-lib.aws_lambda.Runtime[]</code> | The runtimes compatible with this Layer. |

---

##### `node`<sup>Required</sup> <a name="node" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.interfaces.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed in a Stack (those created by
creating new class instances like `new Role()`, `new Bucket()`, etc.), this
is always the same as the environment of the stack they belong to.

For referenced resources (those obtained from referencing methods like
`Role.fromRoleArn()`, `Bucket.fromBucketName()`, etc.), they might be
different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `layerVersionArn`<sup>Required</sup> <a name="layerVersionArn" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.property.layerVersionArn"></a>

```typescript
public readonly layerVersionArn: string;
```

- *Type:* string

The ARN of the Lambda Layer version that this Layer defines.

---

##### `layerVersionRef`<sup>Required</sup> <a name="layerVersionRef" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.property.layerVersionRef"></a>

```typescript
public readonly layerVersionRef: LayerVersionReference;
```

- *Type:* aws-cdk-lib.interfaces.aws_lambda.LayerVersionReference

A reference to a LayerVersion resource.

---

##### `compatibleRuntimes`<sup>Optional</sup> <a name="compatibleRuntimes" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.property.compatibleRuntimes"></a>

```typescript
public readonly compatibleRuntimes: Runtime[];
```

- *Type:* aws-cdk-lib.aws_lambda.Runtime[]

The runtimes compatible with this Layer.

---

#### Constants <a name="Constants" id="Constants"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@beesolve/lambda-bun-runtime.BunLambdaLayer.property.PROPERTY_INJECTION_ID">PROPERTY_INJECTION_ID</a></code> | <code>string</code> | Uniquely identifies this class. |

---

##### `PROPERTY_INJECTION_ID`<sup>Required</sup> <a name="PROPERTY_INJECTION_ID" id="@beesolve/lambda-bun-runtime.BunLambdaLayer.property.PROPERTY_INJECTION_ID"></a>

```typescript
public readonly PROPERTY_INJECTION_ID: string;
```

- *Type:* string

Uniquely identifies this class.

---

## Structs <a name="Structs" id="Structs"></a>

### BunFunctionProps <a name="BunFunctionProps" id="@beesolve/lambda-bun-runtime.BunFunctionProps"></a>

#### Initializer <a name="Initializer" id="@beesolve/lambda-bun-runtime.BunFunctionProps.Initializer"></a>

```typescript
import { BunFunctionProps } from '@beesolve/lambda-bun-runtime'

const bunFunctionProps: BunFunctionProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunctionProps.property.bunLayer">bunLayer</a></code> | <code><a href="#@beesolve/lambda-bun-runtime.BunLambdaLayer">BunLambdaLayer</a></code> | Bun layer needs to be set. |
| <code><a href="#@beesolve/lambda-bun-runtime.BunFunctionProps.property.entrypoint">entrypoint</a></code> | <code>string</code> | Example: `${__dirname}/dist/index.js`. |

---

##### `bunLayer`<sup>Required</sup> <a name="bunLayer" id="@beesolve/lambda-bun-runtime.BunFunctionProps.property.bunLayer"></a>

```typescript
public readonly bunLayer: BunLambdaLayer;
```

- *Type:* <a href="#@beesolve/lambda-bun-runtime.BunLambdaLayer">BunLambdaLayer</a>

Bun layer needs to be set.

---

##### `entrypoint`<sup>Required</sup> <a name="entrypoint" id="@beesolve/lambda-bun-runtime.BunFunctionProps.property.entrypoint"></a>

```typescript
public readonly entrypoint: string;
```

- *Type:* string

Example: `${__dirname}/dist/index.js`.

---

### BunLambdaLayerProps <a name="BunLambdaLayerProps" id="@beesolve/lambda-bun-runtime.BunLambdaLayerProps"></a>

#### Initializer <a name="Initializer" id="@beesolve/lambda-bun-runtime.BunLambdaLayerProps.Initializer"></a>

```typescript
import { BunLambdaLayerProps } from '@beesolve/lambda-bun-runtime'

const bunLambdaLayerProps: BunLambdaLayerProps = { ... }
```




