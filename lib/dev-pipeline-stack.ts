

import { Stack, StackProps, Environment, pipelines } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ComponentStage } from './component-resources-stack';
import { REPOSITORY_NAME, CDK_VERSION } from './configuration';


interface WorkloadPipelineProps extends StackProps {
  deploymentId: string,
  componentEnv: Environment,
  deploymentType: string,
}

export class WorkloadPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: WorkloadPipelineProps) {
    super(scope, id, props);

    const synthCdkParams =
      ' -c deployment_type=' + props.deploymentType +
      ' -c deployment_id=' + props.deploymentId +
      ' -c component_account=' + props.componentEnv.account +
      ' -c component_region=' + props.componentEnv.region;

    const githubInput = pipelines.CodePipelineSource.gitHub(
      REPOSITORY_NAME,
      'dev',
    );

    const synthStep = new pipelines.CodeBuildStep('synth', {
      input: githubInput,
      commands: [
        'npm ci',
        'npx cdk synth -q --verbose' + synthCdkParams,
      ],
    });

    const pipelineName = props.deploymentType + '-' + props.deploymentId + '-pipeline';
    const pipeline = new pipelines.CodePipeline(this, pipelineName, {
      pipelineName: pipelineName,
      selfMutation: true,
      synth: synthStep,
      crossAccountKeys: true,
      cliVersion: CDK_VERSION,
    });

    pipeline.addStage(new ComponentStage(this, props.deploymentId, {
      deploymentId: props.deploymentId,
      deploymentType: props.deploymentType,
      env: props.componentEnv, // defines where the resources will be provisioned
    }));

  }
}
