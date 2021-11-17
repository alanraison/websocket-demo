import {
  CfnOutput,
  Construct,
  RemovalPolicy,
  Stack,
  StackProps,
} from "@aws-cdk/core";
import { NodejsFunction } from "@aws-cdk/aws-lambda-nodejs";
import { AttributeType, Table } from "@aws-cdk/aws-dynamodb";
import { PolicyStatement } from "@aws-cdk/aws-iam";
import { WebSocketApi, WebSocketStage } from "@aws-cdk/aws-apigatewayv2";
import { LambdaWebSocketIntegration } from "@aws-cdk/aws-apigatewayv2-integrations";
import { EventBus, Rule } from "@aws-cdk/aws-events";
import { LambdaFunction } from "@aws-cdk/aws-events-targets";

export class WebsocketStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const table = new Table(this, "Websockets", {
      partitionKey: {
        name: "PK",
        type: AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const eventBus = EventBus.fromEventBusName(this, "Bus", "default");

    const wsApi = new WebSocketApi(this, "WSDemoApi");

    const wsStage = new WebSocketStage(this, "Stage", {
      stageName: "default",
      autoDeploy: true,
      webSocketApi: wsApi,
    });

    const connectHandler = new NodejsFunction(this, "ConnectHandler", {
      entry: require.resolve("@websocket-demo/handlers/src/connect"),
      handler: "connect",
      environment: {
        TABLE_NAME: table.tableName,
        EVENT_BUS: eventBus.eventBusName,
      },
    });

    connectHandler.addToRolePolicy(
      new PolicyStatement({
        actions: ["dynamodb:PutItem", "dynamodb:UpdateItem"],
        resources: [table.tableArn],
      })
    );

    connectHandler.addToRolePolicy(
      new PolicyStatement({
        actions: ["events:PutEvents"],
        resources: [eventBus.eventBusArn],
      })
    );

    wsApi.addRoute("$connect", {
      integration: new LambdaWebSocketIntegration({
        handler: connectHandler,
      }),
    });

    const disconnectHandler = new NodejsFunction(this, "Disconnect", {
      entry: require.resolve("@websocket-demo/handlers/src/disconnect"),
      handler: "disconnect",
      environment: {
        TABLE_NAME: table.tableName,
        EVENT_BUS: eventBus.eventBusName,
      },
    });

    disconnectHandler.addToRolePolicy(
      new PolicyStatement({
        actions: ["dynamodb:DeleteItem", "dynamodb:UpdateItem"],
        resources: [table.tableArn],
      })
    );

    disconnectHandler.addToRolePolicy(
      new PolicyStatement({
        actions: ["events:PutEvents"],
        resources: [eventBus.eventBusArn],
      })
    );

    wsApi.addRoute("$disconnect", {
      integration: new LambdaWebSocketIntegration({
        handler: disconnectHandler,
      }),
    });

    const broadcast = new NodejsFunction(this, "Broadcast", {
      entry: require.resolve("@websocket-demo/handlers/src/broadcast"),
      handler: "broadcast",
      environment: {
        WSAPI_URL: wsStage.callbackUrl,
      },
    });

    broadcast.addToRolePolicy(
      new PolicyStatement({
        actions: ["execute-api:ManageConnections"],
        resources: [
          Stack.of(this).formatArn({
            service: "execute-api",
            resource: `${wsApi.apiId}/${wsStage.stageName}/POST/@connections/{connectionId}`,
          }),
        ],
      })
    );

    new Rule(this, "BroadcastRule", {
      eventBus,
      eventPattern: {
        source: ["websocket-demo"],
      },
      targets: [new LambdaFunction(broadcast)],
    });

    new CfnOutput(this, "WsApiUrl", {
      value: wsStage.url,
    });
  }
}
