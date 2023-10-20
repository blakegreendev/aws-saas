

import { Stack, StackProps, RemovalPolicy, DefaultStackSynthesizer } from 'aws-cdk-lib';
import { CodeBuildStep, CodePipelineSource, CodePipeline } from 'aws-cdk-lib/pipelines';
import { LinuxBuildImage, Project, Source, BuildSpec } from 'aws-cdk-lib/aws-codebuild';
import { Role, ServicePrincipal, PolicyDocument, PolicyStatement, Effect, Policy } from 'aws-cdk-lib/aws-iam';
import { Table, AttributeType, StreamViewType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { Function, Runtime, Code, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as path from 'path';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { DEPLOYMENT_TABLE_NAME, REPOSITORY_NAME, CDK_VERSION } from './configuration';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';


export class ToolchainStack extends Stack {

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const deploymentTable = new Table(this, 'deployment-table', {
      tableName: DEPLOYMENT_TABLE_NAME,
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      stream: StreamViewType.NEW_AND_OLD_IMAGES,
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const synthStep = new CodeBuildStep('synth', {
      input: CodePipelineSource.gitHub(REPOSITORY_NAME, 'main'),
      commands: [
        'npm ci',
        'npx cdk synth -q --verbose',
      ],
    });

    const pipeline = new CodePipeline(this, 'cicd-pipeline', {
      pipelineName: 'base-pipeline',
      selfMutation: true,
      dockerEnabledForSynth: true,
      synth: synthStep,
      cliVersion: CDK_VERSION,
    });

    const updateDeploymentsRole = new Role(this, 'update-deployments-role', {
      assumedBy: new ServicePrincipal('codebuild.amazonaws.com'),
      inlinePolicies: {
        'deployment-policy': new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: [
                'codepipeline:StartPipelineExecution',
                'codepipeline:GetPipelineExecution',
                'codepipeline:GetPipelineState',
              ],
              resources: [
                'arn:aws:codepipeline:' + this.region + ':' + this.account + ':silo-*-pipeline',
                'arn:aws:codepipeline:' + this.region + ':' + this.account + ':pool-*-pipeline',
              ],
              effect: Effect.ALLOW,
            }),
            new PolicyStatement({
              actions: ['cloudformation:ListStacks'],
              effect: Effect.ALLOW,
              resources: ['*'],
            }),
            new PolicyStatement({
              actions: ['dynamodb:Query', 'dynamodb:Scan'],
              effect: Effect.ALLOW,
              resources: [deploymentTable.tableArn, deploymentTable.tableArn + '/index/*'],
            }),
            new PolicyStatement({
              actions: ['ec2:DescribeRegions'],
              effect: Effect.ALLOW,
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    pipeline.addWave('UpdateDeployments', {
      post: [
        new CodeBuildStep('update-deployments', {
          commands: [
            'npm ci',
            'npx ts-node bin/get-deployments.ts',
            'npx ts-node bin/update-deployments.ts',
          ],
          buildEnvironment: {
            buildImage: LinuxBuildImage.STANDARD_7_0,
          },
          role: updateDeploymentsRole,
        }),
      ],
    });


    // CodeBuild Project for Provisioning Build Job
    const project = new Project(this, 'provisioning-project', {
      projectName: 'provisioning-project',
      source: Source.gitHub({
        owner: 'blakegreendev',
        repo: 'aws-saas-ts',
        branchOrRef: 'refs/heads/main',
      }),
      environment: {
        buildImage: LinuxBuildImage.STANDARD_7_0,
      },
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
        phases: {
          build: {
            commands: [
              'npm ci',
              'npx ts-node bin/provision-deployment.ts',
            ],
          },
        },
      }),
    });

    // Allow provision project to use CDK bootstrap roles. These are required when provision project runs CDK deploy
    project.addToRolePolicy(new PolicyStatement({
      actions: ['sts:AssumeRole'],
      resources: [
        'arn:aws:iam::' + this.account + ':role/cdk-' + DefaultStackSynthesizer.DEFAULT_QUALIFIER + '-deploy-role-' + this.account + '-' + this.region,
        'arn:aws:iam::' + this.account + ':role/cdk-' + DefaultStackSynthesizer.DEFAULT_QUALIFIER + '-file-publishing-role-' + this.account + '-' + this.region,
        'arn:aws:iam::' + this.account + ':role/cdk-' + DefaultStackSynthesizer.DEFAULT_QUALIFIER + '-image-publishing-role-' + this.account + '-' + this.region,
      ],
      effect: Effect.ALLOW,
    }));

    // Allow provision project to get AWS regions.
    // This is required for deployment information validation.
    project.addToRolePolicy(new PolicyStatement({
      actions: ['ec2:DescribeRegions'],
      effect: Effect.ALLOW,
      resources: ['*'],
    }));

    // Lambda Function for DynamoDB Streams
    const streamLambda = new NodejsFunction(this, 'stream-lambda', {
      runtime: Runtime.NODEJS_18_X,
      entry: 'lib/lambdas/stream-lambda/index.ts',
      environment: {
        PROJECT_NAME: 'provisioning-project',
      },
    });

    streamLambda.role?.attachInlinePolicy(new Policy(this, 'start-pipeline-policy', {
      document: new PolicyDocument({
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            resources: [project.projectArn],
            actions: ['codebuild:StartBuild'],
          }),
        ],
      }),
    }));

    streamLambda.addEventSource(new DynamoEventSource(deploymentTable, {
      startingPosition: StartingPosition.LATEST,
    }));
  }
}
