
import { CodeBuildClient, StartBuildCommand } from "@aws-sdk/client-codebuild";
const codeBuildClient = new CodeBuildClient({});

const projectName = process.env.PROJECT_NAME;

async function startBuildCommand(image: any) {
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
    const command = new StartBuildCommand(params);
    const result = await codeBuildClient.send(command);
    console.log(result);
  } catch (error) {
    console.error(error);
  }
}

exports.handler = function (event: any) {
  // Process DynamoDB Streams event records
  event.Records.forEach((record: any) => {
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
