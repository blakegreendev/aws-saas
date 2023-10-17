var AWS = require("aws-sdk");
AWS.config.update({ region: process.env.AWS_REGION });

var codebuild = new AWS.CodeBuild({ apiVersion: "2016-10-06" });

const projectName = process.env.PROJECT_NAME;

async function startBuildCommand(image) {
  // For production use, implementing error handling for
  // the CodeBuild API calls is recommended. Transient errors, such as
  // reaching maximum number of allowed concurrent CodeBuild executions
  // may cause errors that require a retry.

  const env = [{ name: "DEPLOYMENT_ID", value: image.id.S }];

  if ("type" in image) {
    env.push({ name: "DEPLOYMENT_TYPE", value: image.type.S });
  }
  if ("account" in image) {
    env.push({ name: "COMPONENT_ACCOUNT", value: image.account.S });
  }
  if ("region" in image) {
    env.push({ name: "COMPONENT_REGION", value: image.region.S });
  }

  const params = {
    projectName: projectName,
    environmentVariablesOverride: env,
  };

  console.log("Calling startBuild() on CodeBuild project " + projectName);
  try {
    const result = await codebuild.startBuild(params).promise();
    console.log(result);
  } catch (error) {
    console.error(error);
  }
}

exports.handler = function (event) {
  // Process DynamoDB Streams event records
  event.Records.forEach((record) => {
    // For all INSERT records, we provision a new deployment

    if (record.eventName == "INSERT") {
      console.log("New item added to deployment database");
      console.log(record.dynamodb);

      startBuildCommand(record.dynamodb.NewImage);
    }

    // This sample code does not process MODIFY or DELETE records
    // Implementation of business logic related to these events is
    // left for the reader.

    if (record.eventName == "MODIFY") {
      // TODO
    }

    if (record.eventName == "DELETE") {
      // TODO
    }
  });
};
