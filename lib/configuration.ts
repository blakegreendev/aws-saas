

export const DEPLOYMENT_TABLE_NAME = 'saas-deployments'; // DynamoDB table name that will be created for deployment management
export const REPOSITORY_NAME = 'blakegreendev/aws-saas-ts'; // Github repository name that holds the code
export const CDK_VERSION = '2.101.1'; // Used to set CodePipeline CLI version

// For production use, specifying exact account and region here is recommended
export const TOOLCHAIN_ENV = {
  region: process.env.CDK_DEFAULT_REGION,
  account: process.env.CDK_DEFAULT_ACCOUNT,
};
