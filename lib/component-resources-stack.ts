

import { Stack, StackProps, Stage, StageProps } from 'aws-cdk-lib';
import { CfnService } from 'aws-cdk-lib/aws-apprunner';
import { Construct } from 'constructs';


interface DemoApprunnerStackProps extends StackProps {
  deploymentId: string,
  deploymentType: string,
}

export class DemoApprunnerStack extends Stack {
  constructor(scope: Construct, id: string, props: DemoApprunnerStackProps) {
    super(scope, id, props);

    new CfnService(this, 'app-runner', {
      sourceConfiguration: {
        imageRepository: {
          imageIdentifier: 'public.ecr.aws/aws-containers/hello-app-runner:latest',
          imageRepositoryType: 'ECR_PUBLIC',
        },
      },
      serviceName: props.deploymentType + '-' + props.deploymentId + '-solution',
    });

  }
}

interface ComponentStageProps extends StageProps {
  deploymentId: string,
  deploymentType: string
}

export class ComponentStage extends Stage {
  constructor(scope: Construct, id: string, props: ComponentStageProps) {
    super(scope, id, props);

    // The starting point of your component resource stack(s)
    // props.deploymentId contains the deployment id
    // props.deploymentType contains the deployment type (silo or pool)

    new DemoApprunnerStack(this, props.deploymentId, {
      stackName: props.deploymentType + '-' + props.deploymentId + '-resources',
      deploymentId: props.deploymentId,
      deploymentType: props.deploymentType,
    });

    // Additional stacks can be defined here, in case your
    // component is composed out of more than one stack
  }
}
