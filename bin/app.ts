#!/usr/bin/env ts-node

import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { ToolchainStack } from '../lib/toolchain-stack';
import { WorkloadPipelineStack } from '../lib/workload-pipeline-stack';
import { TOOLCHAIN_ENV } from '../lib/configuration';

const app = new App();

/*
 * This is the main CDK application for the sample solution.
 *
 * This CDK application has two modes of operation, and will synthesize a different
 * stack depending on the mode.
 *
 * Mode A: Synthesize the toolchain stack. This is the default mode.
 *         This is used during the initial deployment of the solution, and by
 *         the CI/CD Pipeline for synthesizing the stack during updates.
 *         No additional arguments are used.
 *
 * Mode B: In this mode, the application synthesizes a silo or pool workload pipeline
 *         stack. To operate in this mode, AWS CDK CLI is called with the following
 *         context variables (-c in the CLI)
 *
 *         deployment_type  : the type of deployment stack to create (silo|pool)
 *         deployment_id    : the deployment id (siloid|poolid)
 *         component_account: the AWS Account where the component resources for
 *                          : this deployment are deployed to
 *         component_region : the AWS Region, as above
 */


const deploymentType = app.node.tryGetContext('deployment_type');
const deploymentId = app.node.tryGetContext('deployment_id');
const componentAccount = app.node.tryGetContext('component_account');
const componentRegion = app.node.tryGetContext('component_region');


if (!deploymentType) {
    // Mode A: synthesize the main toolchain stack
    new ToolchainStack(app, 'toolchain', {
        env: TOOLCHAIN_ENV,
    });
} else {
    // Mode B: synthetize the workload pipeline stack
    const stackName = deploymentType + '-' + deploymentId + '-pipeline';
    console.log('Synthesizing stack for ' + stackName);
    console.log('deployment_id: ' + deploymentId);
    console.log('component_account: ' + componentAccount);
    console.log('component_region: ' + componentRegion);

    new WorkloadPipelineStack(app, stackName, {
        stackName,
        deploymentId,
        deploymentType,
        env: TOOLCHAIN_ENV,
        componentEnv: {
            region: componentRegion,
            account: componentAccount,
        },
    });

}
